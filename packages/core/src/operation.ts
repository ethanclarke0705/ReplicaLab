import { copyJson, type JsonValue } from './value.js';

interface Metadata {
  readonly id: string;
  readonly replicaId: string;
  readonly sequence: number;
  readonly logicalTimestamp: number;
  readonly key: string;
}

export type Operation = Metadata &
  (
    | { readonly type: 'SET'; readonly value: JsonValue }
    | { readonly type: 'DELETE' }
  );

export function assertReplicaId(id: unknown): asserts id is string {
  if (typeof id !== 'string' || id.length === 0) {
    throw new TypeError('Replica ID must be a nonempty string');
  }
}

export function operationId(replicaId: string, sequence: number): string {
  assertReplicaId(replicaId);
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    throw new TypeError('Sequence must be a positive safe integer');
  }
  return JSON.stringify([replicaId, sequence]);
}

/** Ascending timestamp, then raw UTF-16 code-unit ordering (never localeCompare). */
export function compareOperations(a: Operation, b: Operation): number {
  if (a.logicalTimestamp !== b.logicalTimestamp) {
    return a.logicalTimestamp < b.logicalTimestamp ? -1 : 1;
  }
  return a.replicaId < b.replicaId ? -1 : a.replicaId > b.replicaId ? 1 : 0;
}

/** Treat incoming network records as untrusted data, not TypeScript types. */
export function parseOperation(input: unknown): Operation {
  const record = copyJson(input);
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new TypeError('Operation must be an object');
  }
  const data = record as { readonly [key: string]: JsonValue };
  const { replicaId, sequence, logicalTimestamp, key, type, id } = data;
  assertReplicaId(replicaId);
  if (typeof sequence !== 'number' || id !== operationId(replicaId, sequence)) {
    throw new TypeError('Operation ID must match origin and sequence');
  }
  if (
    typeof logicalTimestamp !== 'number' ||
    !Number.isSafeInteger(logicalTimestamp) ||
    logicalTimestamp < sequence
  ) {
    throw new TypeError(
      'Timestamp must be a safe integer at least as large as sequence',
    );
  }
  if (typeof key !== 'string' || (type !== 'SET' && type !== 'DELETE')) {
    throw new TypeError('Operation needs a string key and SET or DELETE type');
  }
  const expected = type === 'SET' ? 7 : 6;
  if (
    Object.keys(data).length !== expected ||
    (type === 'SET' && !Object.hasOwn(data, 'value'))
  ) {
    throw new TypeError('Unexpected or missing operation fields');
  }
  const metadata = { id, replicaId, sequence, logicalTimestamp, key };
  if (type === 'SET') {
    return Object.freeze({ ...metadata, type, value: copyJson(data.value) });
  }
  return Object.freeze({ ...metadata, type });
}
