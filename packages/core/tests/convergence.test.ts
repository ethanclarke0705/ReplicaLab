import fc from 'fast-check';
import { expect, test } from 'vitest';
import { Replica, type Operation } from '../src/index.js';
import { copyJson } from '../src/value.js';

const action = fc.record({
  origin: fc.integer({ min: 0, max: 2 }),
  key: fc.constantFrom('title', 'count', '__proto__', ''),
  value: fc.jsonValue(),
  remove: fc.boolean(),
  deliverTo: fc.integer({ min: 0, max: 2 }),
});

test('valid histories converge under shuffled, duplicated and delayed delivery', () => {
  fc.assert(
    fc.property(
      fc.array(action, { maxLength: 60 }),
      fc.integer(),
      (actions, seed) => {
        const replicas = [new Replica('a'), new Replica('Z'), new Replica('λ')];
        const operations: Operation[] = [];
        for (const item of actions) {
          const source = replicas[item.origin];
          const target = replicas[item.deliverTo];
          if (!source || !target)
            throw new Error('Generator produced invalid replica index');
          const operation = item.remove
            ? source.delete(item.key)
            : source.set(item.key, copyJson(item.value));
          operations.push(operation);
          // Some causal propagation during generation, plus concurrent independent writes.
          target.receive(operation);
        }
        const left = new Replica('observer-left');
        const right = new Replica('observer-right');
        for (const op of operations) left.receive(op);
        const shuffled =
          fc.sample(
            fc.shuffledSubarray(operations, {
              minLength: operations.length,
              maxLength: operations.length,
            }),
            { seed, numRuns: 1 },
          )[0] ?? [];
        for (const op of shuffled) {
          right.receive(op);
          const time = right.logicalTime;
          expect(right.receive(op).status).toBe('duplicate');
          expect(right.logicalTime).toBe(time);
        }
        expect(right.state()).toEqual(left.state());
        expect(right.history()).toEqual(left.history());
        // Independent fold of the specified ordering, including tombstones.
        const expected = new Map<string, Operation>();
        for (const op of operations) {
          const previous = expected.get(op.key);
          if (
            !previous ||
            op.logicalTimestamp > previous.logicalTimestamp ||
            (op.logicalTimestamp === previous.logicalTimestamp &&
              op.replicaId > previous.replicaId)
          )
            expected.set(op.key, op);
        }
        for (const [key, winner] of expected) {
          expect(right.winner(key)).toEqual(winner);
          expect(right.get(key)).toEqual(
            winner.type === 'SET' ? winner.value : undefined,
          );
        }
      },
    ),
    { seed: 20261108, numRuns: 250 },
  );
});
