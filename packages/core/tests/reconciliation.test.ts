import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { Replica } from '../src/index.js';

function exchange(source: Replica, target: Replica): void {
  for (const operation of source.missingOperations(
    target.knownOperationIds(),
  )) {
    target.receive(operation);
  }
}

describe('missing-operation exchange', () => {
  it('recovers independent offline edits, including deletion, after exchange resumes', () => {
    const a = new Replica('a');
    const b = new Replica('b');
    const c = new Replica('c');
    a.set('title', 'original');
    exchange(a, b);
    exchange(a, c);
    a.set('title', 'offline a');
    b.delete('title');
    c.set('other', 'offline c');
    expect(a.state()).not.toEqual(b.state());
    exchange(a, b);
    exchange(c, b);
    exchange(b, a);
    exchange(b, c);
    expect(a.state()).toEqual(b.state());
    expect(c.state()).toEqual(b.state());
    expect(a.get('title')).toBeUndefined();
    expect(a.get('other')).toBe('offline c');
    expect(a.history()).toEqual(b.history());
    expect(c.history()).toEqual(b.history());
    expect(a.missingOperations(b.knownOperationIds())).toEqual([]);
  });

  it('detects gaps below the highest received sequence', () => {
    const a = new Replica('a');
    const b = new Replica('b');
    const first = a.set('x', 1);
    const second = a.set('x', 2);
    const third = a.set('x', 3);
    b.receive(third);
    expect(a.missingOperations(b.knownOperationIds())).toEqual([first, second]);
    exchange(a, b);
    expect(b.get('x')).toBe(3);
    expect(b.operationCount).toBe(3);
  });

  it('retries lost responses and safely replays stale summaries', () => {
    const a = new Replica('a');
    const b = new Replica('b');
    a.set('x', 1);
    a.delete('x');
    const summary = b.knownOperationIds();
    const lostResponse = a.missingOperations(summary);
    expect(b.operationCount).toBe(0);
    expect(a.missingOperations(summary)).toEqual(lostResponse);
    for (const op of [...a.missingOperations(summary)].reverse()) b.receive(op);
    const time = b.logicalTime;
    for (const op of lostResponse)
      expect(b.receive(op).status).toBe('duplicate');
    expect(b.logicalTime).toBe(time);
    expect(b.get('x')).toBeUndefined();
  });

  it('forwards operations learned from another origin', () => {
    const a = new Replica('a');
    const b = new Replica('b');
    const c = new Replica('c');
    a.set('x', true);
    exchange(a, b);
    exchange(b, c);
    expect(c.history()).toEqual(a.history());
    expect(Object.isFrozen(b.knownOperationIds())).toBe(true);
    expect(Object.isFrozen(b.missingOperations([]))).toBe(true);
  });

  it('converges generated offline histories after successful bidirectional exchanges', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            origin: fc.boolean(),
            key: fc.string(),
            value: fc.string(),
            remove: fc.boolean(),
          }),
          { maxLength: 80 },
        ),
        (edits) => {
          const a = new Replica('a');
          const b = new Replica('b');
          for (const edit of edits) {
            const replica = edit.origin ? a : b;
            if (edit.remove) replica.delete(edit.key);
            else replica.set(edit.key, edit.value);
          }
          const fromA = a.missingOperations(b.knownOperationIds());
          const fromB = b.missingOperations(a.knownOperationIds());
          for (const op of [...fromA].reverse()) b.receive(op);
          for (const op of [...fromB].reverse()) a.receive(op);
          expect(a.state()).toEqual(b.state());
          expect(a.history()).toEqual(b.history());
          expect(a.missingOperations(b.knownOperationIds())).toEqual([]);
          expect(b.missingOperations(a.knownOperationIds())).toEqual([]);
        },
      ),
      { seed: 84117, numRuns: 250 },
    );
  });
});
