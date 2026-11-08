import {
  compareOperations,
  type JsonValue,
  type Operation,
  type ReceiveResult,
} from '@replicalab/core';
import { EventJournal, type Packet, type SimulationEvent } from './events.js';
import { assertDuration, Scheduler } from './scheduler.js';
import {
  Transport,
  type NetworkConditions,
  type SendOptions,
} from './transport.js';

/** Structural port: adapters need no access to Replica's private implementation. */
export interface ReplicaEndpoint {
  readonly id: string;
  set(key: string, value: JsonValue): Operation;
  delete(key: string): Operation;
  receive(operation: unknown): ReceiveResult;
  knownOperationIds(): readonly string[];
  missingOperations(ids: Iterable<string>): readonly Operation[];
}

export interface SimulationOptions {
  readonly seed?: number;
  readonly retryInterval?: number;
  readonly conditions?: Partial<NetworkConditions>;
}

export class Simulation {
  readonly #clock = new Scheduler<() => void>();
  readonly #journal = new EventJournal();
  readonly #network: Transport;
  readonly #replicas = new Map<string, ReplicaEndpoint>();
  readonly #retryInterval: number;
  #lastConverged: boolean | undefined;

  constructor(
    replicas: readonly ReplicaEndpoint[],
    options: SimulationOptions = {},
  ) {
    this.#retryInterval = options.retryInterval ?? 100;
    assertDuration(this.#retryInterval);
    if (this.#retryInterval === 0)
      throw new RangeError('Retry interval must be positive');
    if (replicas.length === 0)
      throw new TypeError('At least one replica is required');
    this.#network = new Transport(
      this.#clock,
      this.#journal,
      options.seed ?? 1,
      options.conditions,
    );
    for (const replica of [...replicas].sort((a, b) =>
      a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
    )) {
      this.#network.register(replica.id, (packet) =>
        this.#receive(replica, packet),
      );
      this.#replicas.set(replica.id, replica);
    }
    this.#checkConvergence();
    this.#scheduleRetry();
  }

  get now(): number {
    return this.#clock.now;
  }
  get network(): Transport {
    return this.#network;
  }
  get replicaIds(): readonly string[] {
    return Object.freeze([...this.#replicas.keys()]);
  }
  events(): readonly SimulationEvent[] {
    return this.#journal.snapshot();
  }

  /** Equality of full histories is stronger than equality of visible values. */
  get converged(): boolean {
    const histories = [...this.#replicas.values()].map((replica) =>
      JSON.stringify(
        [...replica.missingOperations([])].sort(compareOperations),
      ),
    );
    return histories.every((history) => history === histories[0]);
  }

  set(
    id: string,
    key: string,
    value: JsonValue,
    options: SendOptions = {},
  ): Operation {
    return this.#publish(this.#replica(id).set(key, value), options);
  }

  delete(id: string, key: string, options: SendOptions = {}): Operation {
    return this.#publish(this.#replica(id).delete(key), options);
  }

  setConnected(id: string, connected: boolean): void {
    const wasConnected = this.#network.isConnected(id);
    this.#network.setConnected(id, connected);
    if (!wasConnected && connected) this.#reconcile('reconnect');
  }

  setLink(from: string, to: string, connected: boolean): void {
    this.#network.setLink(from, to, connected);
    if (connected) this.#reconcile('reconnect');
  }

  synchronise(): void {
    this.#reconcile('manual');
  }

  advanceBy(duration: number, maxEvents = 100_000): number {
    return this.#clock.advanceBy(duration, (event) => event.value(), maxEvents);
  }

  step(): boolean {
    return this.#clock.step((event) => event.value());
  }

  #publish(operation: Operation, options: SendOptions): Operation {
    this.#journal.record(this.now, {
      type: 'local',
      replicaId: operation.replicaId,
      operation,
    });
    this.#checkConvergence();
    for (const id of this.#replicas.keys()) {
      if (id !== operation.replicaId)
        this.#network.send(
          operation.replicaId,
          id,
          { type: 'operation', operation },
          options,
        );
    }
    return operation;
  }

  #receive(replica: ReplicaEndpoint, packet: Packet): void {
    if (packet.payload.type === 'summary') {
      for (const operation of replica.missingOperations(
        packet.payload.knownIds,
      )) {
        this.#network.send(replica.id, packet.from, {
          type: 'operation',
          operation,
        });
      }
      return;
    }
    try {
      const result = Object.freeze(replica.receive(packet.payload.operation));
      this.#journal.record(this.now, {
        type: 'received',
        replicaId: replica.id,
        result,
      });
    } catch (error) {
      if (!(error instanceof TypeError || error instanceof RangeError))
        throw error;
      this.#journal.record(this.now, {
        type: 'rejected',
        packet,
        reason: error.message,
      });
    }
    this.#checkConvergence();
  }

  #reconcile(reason: 'manual' | 'retry' | 'reconnect'): void {
    this.#journal.record(this.now, { type: 'reconciliation', reason });
    for (const source of this.#replicas.values()) {
      for (const target of this.#replicas.keys()) {
        if (source.id !== target)
          this.#network.send(source.id, target, {
            type: 'summary',
            knownIds: source.knownOperationIds(),
          });
      }
    }
    this.#checkConvergence();
  }

  #scheduleRetry(): void {
    this.#clock.schedule(this.#retryInterval, () => {
      this.#scheduleRetry();
      this.#reconcile('retry');
    });
  }

  #checkConvergence(): void {
    const converged = this.converged;
    if (converged !== this.#lastConverged) {
      this.#lastConverged = converged;
      this.#journal.record(this.now, { type: 'convergence', converged });
    }
  }

  #replica(id: string): ReplicaEndpoint {
    const replica = this.#replicas.get(id);
    if (!replica) throw new TypeError(`Unknown replica: ${id}`);
    return replica;
  }
}
