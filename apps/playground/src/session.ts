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

  constructor(seed = 42, scenario?: ScenarioName) {
    this.seed = seed;
    if (scenario) {
      const result = runScenario(scenario, seed);
      this.replicas = result.replicas;
      this.simulation = result.simulation;
    } else {
      this.replicas = ['a', 'b', 'c'].map((id) => new Replica(id));
      this.simulation = new Simulation(this.replicas, {
        seed,
        retryInterval: 500,
        conditions: { latency: 200 },
      });
      this.simulation.set('a', 'title', 'A shared starting point');
      this.simulation.advanceBy(200);
    }
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
