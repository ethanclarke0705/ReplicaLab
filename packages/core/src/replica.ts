import { LamportClock } from './clock.js';
import {
  assertReplicaId,
  compareOperations,
  operationId,
  parseOperation,
  type Operation,
} from './operation.js';
import type { JsonValue } from './value.js';

export interface ReceiveResult {
  readonly status: 'applied' | 'superseded' | 'duplicate';
  readonly operation: Operation;
  readonly winner: Operation;
}

/** An in-memory replica. Each live origin must have a unique, never-reused ID. */
export class Replica {
  readonly #id: string;
  readonly #clock = new LamportClock();
  readonly #operations = new Map<string, Operation>();
  readonly #winners = new Map<string, Operation>();
  #sequence = 0;

  constructor(id: string) {
    assertReplicaId(id);
    this.#id = id;
  }

  get id(): string {
    return this.#id;
  }
  get logicalTime(): number {
    return this.#clock.value;
  }
  get localSequence(): number {
    return this.#sequence;
  }
  get operationCount(): number {
    return this.#operations.size;
  }

  set(key: string, value: JsonValue): Operation {
    return this.#create(key, { type: 'SET', value });
  }

  delete(key: string): Operation {
    return this.#create(key, { type: 'DELETE' });
  }

  get(key: string): JsonValue | undefined {
    const winner = this.#winners.get(key);
    return winner?.type === 'SET' ? winner.value : undefined;
  }

  /** Includes DELETE tombstones, unlike the visible state. */
  winner(key: string): Operation | undefined {
    return this.#winners.get(key);
  }

  /** Detached map with immutable values; callers cannot mutate internal state. */
  state(): ReadonlyMap<string, JsonValue> {
    const result = new Map<string, JsonValue>();
    for (const [key, winner] of [...this.#winners].sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    )) {
      if (winner.type === 'SET') result.set(key, winner.value);
    }
    return result;
  }

  history(key?: string): readonly Operation[] {
    return Object.freeze(
      [...this.#operations.values()]
        .filter((operation) => key === undefined || operation.key === key)
        .sort(compareOperations),
    );
  }

  /** Exact IDs preserve holes when operations arrive out of order. */
  knownOperationIds(): readonly string[] {
    return Object.freeze(this.history().map((operation) => operation.id));
  }

  /** A transport sends these operations and may safely retry a stale request. */
  missingOperations(peerKnownIds: Iterable<string>): readonly Operation[] {
    const known = new Set(peerKnownIds);
    return Object.freeze(
      this.history().filter((operation) => !known.has(operation.id)),
    );
  }

  receive(input: unknown): ReceiveResult {
    const operation = parseOperation(input);
    const existing = this.#operations.get(operation.id);
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(operation)) {
        throw new TypeError(
          'Operation ID collision: payload differs from known operation',
        );
      }
      // Duplicate packets are filtered before entering the logical event stream.
      return {
        status: 'duplicate',
        operation: existing,
        winner: this.#winners.get(existing.key) ?? existing,
      };
    }
    if (operation.replicaId === this.#id) {
      throw new TypeError(
        'Unknown operation from local identity; identity reuse or missing restoration',
      );
    }
    for (const known of this.#operations.values()) {
      if (known.replicaId !== operation.replicaId) continue;
      const sequenceDelta = operation.sequence - known.sequence;
      const timeDelta = operation.logicalTimestamp - known.logicalTimestamp;
      if (
        (sequenceDelta > 0 && timeDelta < sequenceDelta) ||
        (sequenceDelta < 0 && timeDelta > sequenceDelta)
      ) {
        throw new TypeError('Origin timestamps must advance with its sequence');
      }
    }
    // Validate everything before committing any state, including clock overflow.
    this.#clock.receive(operation.logicalTimestamp);
    return this.#record(operation);
  }

  #create(
    key: string,
    change: { type: 'SET'; value: JsonValue } | { type: 'DELETE' },
  ): Operation {
    const sequence = this.#sequence + 1;
    const operation = parseOperation({
      id: operationId(this.#id, sequence),
      replicaId: this.#id,
      sequence,
      logicalTimestamp: this.#clock.value + 1,
      key,
      ...change,
    });
    this.#clock.tick();
    this.#sequence = sequence;
    this.#record(operation);
    return operation;
  }

  #record(operation: Operation): ReceiveResult {
    this.#operations.set(operation.id, operation);
    const previous = this.#winners.get(operation.key);
    if (!previous || compareOperations(operation, previous) > 0) {
      this.#winners.set(operation.key, operation);
      return { status: 'applied', operation, winner: operation };
    }
    return { status: 'superseded', operation, winner: previous };
  }
}
