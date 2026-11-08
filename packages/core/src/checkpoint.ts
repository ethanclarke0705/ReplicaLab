import {
  assertReplicaId,
  parseOperation,
  type Operation,
} from './operation.js';

export interface ReplicaCheckpoint {
  readonly version: 1;
  readonly replicaId: string;
  readonly logicalTime: number;
  readonly localSequence: number;
  readonly operations: readonly Operation[];
}

/** A checkpoint is untrusted storage input, never a shortcut around validation. */
export function parseCheckpoint(input: unknown): ReplicaCheckpoint {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new TypeError('Replica checkpoint must be an object');
  const descriptors = Object.getOwnPropertyDescriptors(input);
  if (
    Reflect.ownKeys(input).length !== 5 ||
    Object.values(descriptors).some(
      (field) => !field.enumerable || !('value' in field),
    )
  )
    throw new TypeError('Checkpoint fields must be enumerable data properties');
  const data = input as Record<string, unknown>;
  const { version, replicaId, logicalTime, localSequence, operations } = data;
  if (version !== 1 || Object.keys(data).length !== 5)
    throw new TypeError('Unsupported replica checkpoint schema');
  assertReplicaId(replicaId);
  if (
    typeof logicalTime !== 'number' ||
    !Number.isSafeInteger(logicalTime) ||
    logicalTime < 0 ||
    typeof localSequence !== 'number' ||
    !Number.isSafeInteger(localSequence) ||
    localSequence < 0 ||
    !Array.isArray(operations)
  )
    throw new TypeError('Invalid checkpoint counters or history');
  const parsed = Array.from(operations, parseOperation);
  const origins = new Map<string, Operation[]>();
  const ids = new Set<string>();
  for (const op of parsed) {
    if (ids.has(op.id))
      throw new TypeError('Duplicate operation in checkpoint');
    ids.add(op.id);
    const minimumTime =
      op.logicalTimestamp + (op.replicaId === replicaId ? 0 : 1);
    if (logicalTime < minimumTime)
      throw new TypeError('Checkpoint clock is behind its history');
    const origin = origins.get(op.replicaId) ?? [];
    origin.push(op);
    origins.set(op.replicaId, origin);
  }
  if (logicalTime < parsed.length)
    throw new TypeError('Checkpoint clock is behind its event count');
  for (const origin of origins.values()) {
    origin.sort((a, b) => a.sequence - b.sequence);
    for (let i = 1; i < origin.length; i++) {
      const before = origin[i - 1]!;
      const after = origin[i]!;
      if (
        after.logicalTimestamp - before.logicalTimestamp <
        after.sequence - before.sequence
      )
        throw new TypeError('Origin timestamps must advance with its sequence');
    }
  }
  const own = origins.get(replicaId) ?? [];
  if (
    own.length !== localSequence ||
    own.some((op, index) => op.sequence !== index + 1)
  )
    throw new TypeError('Local sequence must match complete local history');
  return Object.freeze({
    version: 1,
    replicaId,
    logicalTime,
    localSequence,
    operations: Object.freeze(parsed),
  });
}
