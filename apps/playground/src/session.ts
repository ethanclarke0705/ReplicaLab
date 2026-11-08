import { Replica, type JsonValue } from '@replicalab/core';
import {
  runScenario,
  Simulation,
  type ScenarioName,
} from '@replicalab/simulator';

export const links = [
  ['a', 'b'],
  ['a', 'c'],
  ['b', 'c'],
] as const;

/** Owns the real simulation; React reads detached views and issues public commands. */
export class LabSession {
  readonly replicas: readonly Replica[];
  readonly simulation: Simulation;
  readonly seed: number;

  constructor(
    seed = 42,
    scenario?: ScenarioName,
    restored?: readonly Replica[],
  ) {
    this.seed = seed;
    if (scenario) {
      const result = runScenario(scenario, seed);
      this.replicas = result.replicas;
      this.simulation = result.simulation;
    } else {
      this.replicas = restored ?? ['a', 'b', 'c'].map((id) => new Replica(id));
      this.simulation = new Simulation(this.replicas, {
        seed,
        retryInterval: 500,
        conditions: { latency: 200 },
      });
      if (!restored) {
        this.simulation.set('a', 'title', 'A shared starting point');
        this.simulation.advanceBy(200);
      }
    }
  }

  checkpoint() {
    const view = this.snapshot();
    return {
      version: 1 as const,
      seed: this.seed,
      conditions: view.conditions,
      replicas: this.replicas.map((replica) => replica.checkpoint()),
      connected: view.replicas.map((replica) => replica.connected),
      links: view.links.map((link) => link.open),
    };
  }

  static restore(input: unknown): LabSession {
    if (!input || typeof input !== 'object' || Array.isArray(input))
      throw new TypeError('Invalid saved lab');
    const data = input as Record<string, unknown>;
    if (data.version !== 1 || Object.keys(data).length !== 6)
      throw new TypeError('Unsupported saved lab schema');
    if (
      typeof data.seed !== 'number' ||
      !Number.isInteger(data.seed) ||
      data.seed < 0 ||
      data.seed > 4294967295
    )
      throw new TypeError('Invalid saved seed');
    if (!Array.isArray(data.replicas) || data.replicas.length !== 3)
      throw new TypeError('Saved lab must contain three replicas');
    const replicas = data.replicas.map(Replica.restore);
    if (replicas.map((replica) => replica.id).join(',') !== 'a,b,c')
      throw new TypeError('Saved replica identities must be a, b, c');
    // An atomic lab checkpoint must not combine incompatible replica histories.
    const originOperations = new Map(
      replicas.flatMap((replica) =>
        replica
          .history()
          .filter((op) => op.replicaId === replica.id)
          .map((op) => [op.id, JSON.stringify(op)] as const),
      ),
    );
    for (const replica of replicas)
      for (const op of replica.history()) {
        if (originOperations.get(op.id) !== JSON.stringify(op))
          throw new TypeError(
            'Saved replicas disagree about an operation origin',
          );
      }
    for (const flags of [data.connected, data.links]) {
      if (
        !Array.isArray(flags) ||
        flags.length !== 3 ||
        Array.from(flags).some((flag) => typeof flag !== 'boolean')
      )
        throw new TypeError('Invalid saved connectivity');
    }
    const conditions = data.conditions;
    if (
      !conditions ||
      typeof conditions !== 'object' ||
      Array.isArray(conditions)
    )
      throw new TypeError('Invalid saved network conditions');
    const values = conditions as Record<string, unknown>;
    if (
      Object.keys(values).length !== 4 ||
      ['latency', 'jitter', 'loss', 'duplication'].some(
        (key) => typeof values[key] !== 'number',
      )
    )
      throw new TypeError('Invalid saved network conditions');
    const session = new LabSession(data.seed, undefined, replicas);
    session.simulation.network.configure({
      latency: values.latency as number,
      jitter: values.jitter as number,
      loss: values.loss as number,
      duplication: values.duplication as number,
    });
    replicas.forEach((replica, index) => {
      if (!(data.connected as boolean[])[index])
        session.simulation.setConnected(replica.id, false);
    });
    links.forEach(([from, to], index) => {
      if (!(data.links as boolean[])[index])
        session.simulation.setLink(from, to, false);
    });
    return session;
  }

  write(id: string, key: string, text: string, format: 'text' | 'json'): void {
    if (!key.trim()) throw new TypeError('Enter a key before saving.');
    let value: JsonValue = text;
    if (format === 'json') {
      try {
        value = JSON.parse(text);
      } catch {
        throw new TypeError(
          'Enter valid JSON, such as "hello", 42 or {"done":true}.',
        );
      }
    }
    this.simulation.set(id, key, value);
  }

  snapshot() {
    const events = this.simulation.events();
    const closed = new Set<string>();
    for (const event of events) {
      if (event.type === 'link') {
        const key = [event.from, event.to].sort().join(':');
        if (event.connected) closed.delete(key);
        else closed.add(key);
      }
    }
    return {
      seed: this.seed,
      now: this.simulation.now,
      converged: this.simulation.converged,
      conditions: this.simulation.network.conditions,
      events,
      pending: this.simulation.network.pending().length,
      dropped: events.filter((event) => event.type === 'dropped').length,
      links: links.map(([from, to]) => ({
        from,
        to,
        open: !closed.has([from, to].sort().join(':')),
      })),
      replicas: this.replicas.map((replica) => ({
        id: replica.id,
        clock: replica.logicalTime,
        sequence: replica.localSequence,
        count: replica.operationCount,
        connected: this.simulation.network.isConnected(replica.id),
        entries: [...replica.state()],
        history: replica.history(),
        winners: new Map(
          replica.history().map((op) => [op.key, replica.winner(op.key)]),
        ),
      })),
    };
  }
}

export type LabSnapshot = ReturnType<LabSession['snapshot']>;
export type ReplicaView = LabSnapshot['replicas'][number];
export type LabCheckpoint = ReturnType<LabSession['checkpoint']>;
