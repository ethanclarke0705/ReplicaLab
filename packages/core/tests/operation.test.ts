import { describe, expect, it } from 'vitest';
import {
  compareOperations,
  operationId,
  parseOperation,
} from '../src/index.js';

const set = {
  id: operationId('a', 1),
  replicaId: 'a',
  sequence: 1,
  logicalTimestamp: 1,
  key: 'title',
  type: 'SET',
  value: { title: 'Draft' },
};

describe('operation boundary', () => {
  it('copies and deeply freezes values', () => {
    const input = { ...set, value: { items: [1, 2] } };
    const op = parseOperation(input);
    input.value.items.push(3);
    expect(op.type === 'SET' && op.value).toEqual({ items: [1, 2] });
    expect(Object.isFrozen(op)).toBe(true);
    if (op.type === 'SET') expect(Object.isFrozen(op.value)).toBe(true);
  });

  it('uses unambiguous operation IDs even for punctuation in identities', () => {
    expect(operationId('a:1', 2)).not.toBe(operationId('a', 12));
    expect(JSON.parse(operationId('a:"λ', 2))).toEqual(['a:"λ', 2]);
  });

  it.each([
    { ...set, id: 'wrong' },
    { ...set, replicaId: '' },
    { ...set, sequence: 0 },
    { ...set, logicalTimestamp: 0 },
    { ...set, type: 'PATCH' },
    { ...set, key: 2 },
    { ...set, extra: true },
    { ...set, type: 'DELETE' },
    { ...set, value: undefined },
    { ...set, value: NaN },
    { ...set, value: new Date() },
    { ...set, value: new Array(2) },
    {
      ...set,
      value: {
        get unsafe() {
          throw new Error('must not run');
        },
      },
    },
  ])('rejects malformed data %#', (input) => {
    expect(() => parseOperation(input)).toThrow(TypeError);
  });

  it('rejects cycles and allows repeated non-cyclic references', () => {
    const cycle: unknown[] = [];
    cycle.push(cycle);
    expect(() => parseOperation({ ...set, value: cycle })).toThrow(TypeError);
    const shared = { x: 1 };
    expect(() =>
      parseOperation({ ...set, value: [shared, shared] }),
    ).not.toThrow();
  });

  it('canonicalises object key order and preserves special keys', () => {
    const op = parseOperation({
      ...set,
      value: JSON.parse('{"z":1,"__proto__":2,"a":3}'),
    });
    expect(op.type === 'SET' && JSON.stringify(op.value)).toBe(
      '{"__proto__":2,"a":3,"z":1}',
    );
  });

  it('orders timestamps before locale-independent replica IDs', () => {
    const a = parseOperation(set);
    const b = parseOperation({
      ...set,
      replicaId: 'Z',
      id: operationId('Z', 1),
    });
    const later = parseOperation({ ...set, logicalTimestamp: 2 });
    expect(compareOperations(a, b)).toBe(1);
    expect(compareOperations(b, a)).toBe(-1);
    expect(compareOperations(later, a)).toBe(1);
    expect(compareOperations(a, a)).toBe(0);
  });
});
