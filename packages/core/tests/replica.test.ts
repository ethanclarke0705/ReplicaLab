import { describe, expect, it } from 'vitest';
import { Replica, operationId, type JsonValue } from '../src/index.js';

describe('Replica', () => {
  it('creates independent replicas with monotonic counters and logical clocks', () => {
    const a = new Replica('a');
    const b = new Replica('b');
    const first = a.set('title', 'a');
    const second = a.delete('title');
    expect(first).toMatchObject({
      id: operationId('a', 1),
      sequence: 1,
      logicalTimestamp: 1,
      type: 'SET',
    });
    expect(second).toMatchObject({
      sequence: 2,
      logicalTimestamp: 2,
      type: 'DELETE',
    });
    expect(a.localSequence).toBe(2);
    expect(b.operationCount).toBe(0);
    expect(b.logicalTime).toBe(0);
    expect(a.get('title')).toBeUndefined();
  });

  it('advances receive time and keeps local sequence independent', () => {
    const a = new Replica('a');
    const b = new Replica('b');
    a.set('x', 1);
    a.set('x', 2);
    b.receive(a.set('x', 3));
    expect(b.logicalTime).toBe(4);
    expect(b.localSequence).toBe(0);
    expect(b.set('x', 4)).toMatchObject({ sequence: 1, logicalTimestamp: 5 });
  });

  it('resolves equal-time writes by replica ID and retains losing history', () => {
    const a = new Replica('a');
    const b = new Replica('b');
    const left = a.set('x', 'left');
    const right = b.set('x', 'right');
    expect(a.receive(right).status).toBe('applied');
    expect(b.receive(left).status).toBe('superseded');
    expect(a.get('x')).toBe('right');
    expect(b.get('x')).toBe('right');
    expect(a.history('x')).toEqual([left, right]);
    expect(a.history()).toEqual(b.history());
  });

  it('treats duplicate delivery as a complete no-op, including clocks', () => {
    const a = new Replica('a');
    const b = new Replica('b');
    const op = a.set('x', { b: 2, a: 1 });
    b.receive(op);
    const time = b.logicalTime;
    expect(b.receive({ ...op, value: { a: 1, b: 2 } }).status).toBe(
      'duplicate',
    );
    expect(b.logicalTime).toBe(time);
    expect(b.operationCount).toBe(1);
    expect(a.receive(op).status).toBe('duplicate');
    expect(a.logicalTime).toBe(1);
  });

  it('does not revive a deletion when older writes arrive later', () => {
    const a = new Replica('a');
    const b = new Replica('b');
    const old = a.set('x', 1);
    const deleted = a.delete('x');
    b.receive(deleted);
    b.receive(old);
    expect(b.get('x')).toBeUndefined();
    expect(b.state().has('x')).toBe(false);
    expect(b.winner('x')).toEqual(deleted);
    expect(b.history('x')).toHaveLength(2);
    const revived = a.set('x', 3);
    b.receive(revived);
    expect(b.get('x')).toBe(3);
  });

  it('resolves concurrent delete versus set with the same tuple rule', () => {
    const a = new Replica('a');
    const z = new Replica('z');
    const set = a.set('x', 1);
    const del = z.delete('x');
    a.receive(del);
    z.receive(set);
    expect(a.winner('x')).toEqual(del);
    expect(z.winner('x')).toEqual(del);
  });

  it('rejects collisions and impossible origin histories atomically', () => {
    const a = new Replica('a');
    const b = new Replica('b');
    const op = a.set('x', 1);
    b.receive(op);
    const time = b.logicalTime;
    expect(() => b.receive({ ...op, value: 2 })).toThrow(/collision/);
    expect(() =>
      b.receive({
        ...op,
        sequence: 2,
        id: operationId('a', 2),
        logicalTimestamp: 1,
      }),
    ).toThrow();
    const high = {
      ...op,
      sequence: 3,
      id: operationId('a', 3),
      logicalTimestamp: 10,
    };
    b.receive(high);
    const afterHigh = b.logicalTime;
    expect(() =>
      b.receive({
        ...op,
        sequence: 2,
        id: operationId('a', 2),
        logicalTimestamp: 10,
      }),
    ).toThrow(/advance/);
    expect(b.logicalTime).toBe(afterHigh);
    expect(time).toBe(2);
    expect(b.operationCount).toBe(2);
    expect(b.get('x')).toBe(1);
  });

  it('rejects unknown operations using the local identity', () => {
    const a = new Replica('same');
    const clone = new Replica('same');
    expect(() => clone.receive(a.set('x', 1))).toThrow(/identity/);
    expect(clone.operationCount).toBe(0);
    expect(clone.logicalTime).toBe(0);
  });

  it('invalid local values and incoming overflow do not consume counters or state', () => {
    const a = new Replica('a');
    expect(() => a.set('x', NaN)).toThrow();
    expect(a.localSequence).toBe(0);
    expect(a.logicalTime).toBe(0);
    const op = new Replica('b').set('x', 1);
    expect(() =>
      a.receive({ ...op, logicalTimestamp: Number.MAX_SAFE_INTEGER }),
    ).toThrow(RangeError);
    expect(a.operationCount).toBe(0);
    expect(a.logicalTime).toBe(0);
    expect(a.set('x', null).sequence).toBe(1);
  });

  it('protects state and history from caller mutation and supports arbitrary keys', () => {
    const a = new Replica('a');
    const input = { nested: [1] };
    a.set('__proto__', input);
    input.nested.push(2);
    a.set('', null);
    a.set('constructor', false);
    expect(a.get('__proto__')).toEqual({ nested: [1] });
    const state = a.state() as Map<string, JsonValue>;
    state.clear();
    expect(a.state().size).toBe(3);
    expect(Object.isFrozen(a.history())).toBe(true);
    expect(Object.isFrozen(a.get('__proto__'))).toBe(true);
    expect(a.get('')).toBeNull();
    expect(a.get('constructor')).toBe(false);
  });
});
