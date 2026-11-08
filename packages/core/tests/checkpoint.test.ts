import { expect, test } from 'vitest';
import fc from 'fast-check';
import { Replica, type JsonValue } from '../src/index.js';

test('checkpoint envelopes do not reduce the supported JSON nesting depth', () => {
  let value: JsonValue = 'leaf';
  for (let i = 0; i < 98; i++) value = [value];
  const replica = new Replica('deep');
  replica.set('value', value);
  expect(Replica.restore(replica.checkpoint()).get('value')).toEqual(value);
});

test('rejects inherited fields and accessor-backed history without invoking accessors', () => {
  const replica = new Replica('a');
  replica.set('x', 1);
  const checkpoint = replica.checkpoint();
  const inherited = Object.assign(Object.create({ version: 1 }), {
    ...checkpoint,
    extra: true,
  });
  delete inherited.version;
  expect(() => Replica.restore(inherited)).toThrow();
  let invoked = false;
  const operations = [checkpoint.operations[0]];
  Object.defineProperty(operations, '0', {
    get() {
      invoked = true;
      return checkpoint.operations[0];
    },
  });
  expect(() => Replica.restore({ ...checkpoint, operations })).toThrow(
    /dense data array/,
  );
  expect(invoked).toBe(false);
});

test('restores exact clocks, local identity, tombstones and losing history without replay ticks', () => {
  const a = new Replica('a');
  const b = new Replica('b');
  a.set('x', 'losing');
  a.receive(b.set('x', 'winning'));
  a.delete('x');
  const restored = Replica.restore(JSON.parse(JSON.stringify(a.checkpoint())));
  expect(restored.checkpoint()).toEqual(a.checkpoint());
  expect(restored.get('x')).toBeUndefined();
  expect(restored.winner('x')?.type).toBe('DELETE');
  expect(restored.receive(b.history()[0]).status).toBe('duplicate');
  expect(restored.set('next', true)).toMatchObject({
    replicaId: 'a',
    sequence: 3,
    logicalTimestamp: 4,
  });
  expect(a.localSequence).toBe(2);
});

test('rejects corrupted schemas, counters, gaps, duplicate IDs and inconsistent origins', () => {
  const a = new Replica('a');
  a.set('x', 1);
  a.set('x', 2);
  const base = a.checkpoint();
  const invalid = [
    null,
    { ...base, version: 2 },
    { ...base, extra: true },
    { ...base, localSequence: 1 },
    { ...base, logicalTime: 1 },
    { ...base, logicalTime: Number.MAX_SAFE_INTEGER + 1 },
    { ...base, operations: [base.operations[1]] },
    { ...base, operations: [...base.operations, base.operations[0]] },
    {
      ...base,
      logicalTime: 5,
      operations: [
        base.operations[0],
        { ...base.operations[1], logicalTimestamp: 1 },
      ],
    },
  ];
  for (const input of invalid) expect(() => Replica.restore(input)).toThrow();
});

test('allows remote sequence gaps but rejects a clock that omits the receive increment', () => {
  const remote = new Replica('b');
  remote.set('x', 1);
  const a = new Replica('a');
  a.receive(remote.set('x', 2));
  expect(Replica.restore(a.checkpoint()).checkpoint()).toEqual(a.checkpoint());
  expect(() => Replica.restore({ ...a.checkpoint(), logicalTime: 2 })).toThrow(
    /clock/,
  );
});

test('restoration preserves the next operation and convergence across generated histories', () => {
  fc.assert(
    fc.property(
      fc.array(
        fc.record({
          origin: fc.boolean(),
          remove: fc.boolean(),
          value: fc.integer(),
        }),
        { maxLength: 40 },
      ),
      (actions) => {
        const a = new Replica('a');
        const b = new Replica('b');
        for (const action of actions) {
          const source = action.origin ? a : b;
          const target = action.origin ? b : a;
          target.receive(
            action.remove ? source.delete('x') : source.set('x', action.value),
          );
        }
        const recovered = Replica.restore(a.checkpoint());
        expect(recovered.checkpoint()).toEqual(a.checkpoint());
        expect(recovered.set('after', 42)).toEqual(a.set('after', 42));
        for (const op of recovered.missingOperations(b.knownOperationIds()))
          b.receive(op);
        expect(b.history()).toEqual(recovered.history());
      },
    ),
    { seed: 440026, numRuns: 100 },
  );
});
