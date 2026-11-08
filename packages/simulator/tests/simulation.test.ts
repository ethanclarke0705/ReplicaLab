import { Replica } from '@replicalab/core';
import { describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { Simulation, type SimulationOptions } from '../src/index.js';

function setup(options: SimulationOptions = {}) {
  const a = new Replica('a');
  const b = new Replica('b');
  const c = new Replica('c');
  return { a, b, c, sim: new Simulation([a, b, c], options) };
}

describe('replication over simulated transport', () => {
  it('uses the public receive interface only when a packet arrives', () => {
    const a = new Replica('a');
    const b = new Replica('b');
    const receive = vi.fn((operation: unknown) => b.receive(operation));
    const sim = new Simulation([
      a,
      {
        id: b.id,
        receive,
        set: b.set.bind(b),
        delete: b.delete.bind(b),
        knownOperationIds: b.knownOperationIds.bind(b),
        missingOperations: b.missingOperations.bind(b),
      },
    ]);
    sim.set('a', 'x', 1);
    expect(receive).not.toHaveBeenCalled();
    sim.advanceBy(10);
    expect(receive).toHaveBeenCalledTimes(1);
    expect(b.get('x')).toBe(1);
  });

  it('keeps offline edits local, then initiates reconciliation on reconnect', () => {
    const { a, b, c, sim } = setup();
    sim.setConnected('c', false);
    sim.set('a', 'x', 'a');
    sim.set('c', 'x', 'c');
    sim.advanceBy(50);
    expect(a.get('x')).toBe('a');
    expect(c.get('x')).toBe('c');
    expect(sim.converged).toBe(false);
    sim.setConnected('c', true);
    sim.advanceBy(20);
    expect(sim.converged).toBe(true);
    expect(a.get('x')).toBe('c');
    expect(a.history()).toEqual(b.history());
    expect(
      sim
        .events()
        .some(
          (event) =>
            event.type === 'reconciliation' && event.reason === 'reconnect',
        ),
    ).toBe(true);
  });

  it('recovers a lost initial broadcast and lost reconciliation requests through periodic retries', () => {
    const { a, b, sim } = setup({ conditions: { loss: 1 } });
    sim.set('a', 'x', 1);
    sim.advanceBy(100);
    expect(b.get('x')).toBeUndefined();
    expect(sim.converged).toBe(false);
    sim.network.configure({ loss: 0 });
    sim.advanceBy(120);
    expect(a.history()).toEqual(b.history());
    expect(sim.converged).toBe(true);
  });

  it('retries when summaries arrive but their missing-operation responses are lost', () => {
    const { b, sim } = setup({ conditions: { loss: 1 } });
    sim.set('a', 'x', 1);
    sim.network.configure({ loss: 0 });
    sim.synchronise();
    sim.network.configure({ loss: 1 });
    sim.advanceBy(10);
    expect(b.get('x')).toBeUndefined();
    expect(
      sim
        .events()
        .some(
          (event) =>
            event.type === 'dropped' &&
            event.packet.payload.type === 'operation' &&
            event.time === 10,
        ),
    ).toBe(true);
    sim.network.configure({ loss: 0 });
    sim.advanceBy(110);
    expect(b.get('x')).toBe(1);
    expect(sim.converged).toBe(true);
  });

  it('forwards learned operations along surviving links', () => {
    const { a, c, sim } = setup();
    sim.setLink('a', 'c', false);
    sim.set('a', 'x', 1);
    sim.advanceBy(120);
    expect(c.history()).toEqual(a.history());
    expect(sim.converged).toBe(true);
  });

  it('does not claim convergence under a persistent partition or perpetual loss', () => {
    const { sim } = setup();
    sim.setLink('a', 'c', false);
    sim.setLink('b', 'c', false);
    sim.set('c', 'x', 1);
    sim.advanceBy(500);
    expect(sim.converged).toBe(false);
    expect(
      sim
        .events()
        .filter((event) => event.type === 'convergence')
        .at(-1),
    ).toMatchObject({ converged: false });
  });

  it('does not resurrect tombstones when duplicated older updates arrive last', () => {
    const { b, sim } = setup();
    sim.set('a', 'x', 1, { delay: 50, duplicate: true });
    sim.delete('a', 'x', { delay: 1 });
    sim.advanceBy(50);
    expect(b.winner('x')?.type).toBe('DELETE');
    expect(sim.converged).toBe(true);
    expect(
      sim
        .events()
        .some(
          (event) =>
            event.type === 'received' && event.result.status === 'superseded',
        ),
    ).toBe(true);
    expect(
      sim
        .events()
        .some(
          (event) =>
            event.type === 'received' && event.result.status === 'duplicate',
        ),
    ).toBe(true);
  });

  it('records rejected identity collisions while continuing valid packet delivery', () => {
    const { b, sim } = setup();
    const operation = sim.set('a', 'x', 1);
    sim.advanceBy(10);
    sim.network.send('a', 'b', {
      type: 'operation',
      operation: { ...operation, type: 'SET', value: 99 },
    });
    sim.set('a', 'y', 2);
    sim.advanceBy(10);
    expect(b.get('x')).toBe(1);
    expect(b.get('y')).toBe(2);
    expect(sim.events().some((event) => event.type === 'rejected')).toBe(true);
  });

  it('replays a complete seeded fault trace and converges after healing', () => {
    const run = () => {
      const { sim } = setup({
        seed: 735,
        retryInterval: 30,
        conditions: { jitter: 25, loss: 0.4, duplication: 0.5 },
      });
      sim.set('a', 'x', 'a');
      sim.set('b', 'x', 'b');
      sim.set('c', 'y', true);
      sim.advanceBy(300);
      sim.network.configure({ loss: 0, jitter: 0, duplication: 0 });
      sim.advanceBy(100);
      return sim;
    };
    const a = run();
    const b = run();
    expect(a.converged).toBe(true);
    expect(a.events()).toEqual(b.events());
  });

  it('converges generated partitioned histories once loss ends and all links recover', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 0xffff_ffff }),
        fc.array(
          fc.record({
            id: fc.constantFrom('a', 'b', 'c'),
            key: fc.constantFrom('x', 'y', '__proto__'),
            value: fc.string(),
            remove: fc.boolean(),
          }),
          { minLength: 1, maxLength: 30 },
        ),
        (seed, edits) => {
          const { a, b, c, sim } = setup({
            seed,
            retryInterval: 30,
            conditions: { latency: 2, jitter: 8, loss: 0.35, duplication: 0.4 },
          });
          sim.setConnected('c', false);
          for (const edit of edits) {
            if (edit.remove) sim.delete(edit.id, edit.key);
            else sim.set(edit.id, edit.key, edit.value);
            sim.advanceBy(1);
          }
          sim.advanceBy(80);
          sim.network.configure({ loss: 0 });
          sim.setConnected('c', true);
          sim.advanceBy(100);
          expect(sim.converged).toBe(true);
          expect(a.history()).toEqual(b.history());
          expect(a.history()).toEqual(c.history());
          expect(a.state()).toEqual(c.state());
        },
      ),
      { seed: 220026, numRuns: 100 },
    );
  });

  it('validates setup and bounds recurring work', () => {
    expect(() => new Simulation([])).toThrow();
    expect(() => setup({ retryInterval: 0 })).toThrow();
    expect(
      () => new Simulation([new Replica('a'), new Replica('a')]),
    ).toThrow();
    const { sim } = setup({ retryInterval: 1 });
    expect(() => sim.advanceBy(100, 2)).toThrow(/budget/);
    expect(sim.now).toBeLessThan(100);
    expect(() => sim.set('unknown', 'x', 1)).toThrow();
  });
});
