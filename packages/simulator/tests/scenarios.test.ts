import { describe, expect, it } from 'vitest';
import { runScenario, scenarioNames } from '../src/index.js';

describe('headless scenarios', () => {
  it.each(scenarioNames)(
    '%s runs real operations and replays deterministically',
    (name) => {
      const first = runScenario(name, 86);
      const replay = runScenario(name, 86);
      expect(first.simulation.converged).toBe(true);
      expect(first.simulation.events()).toEqual(replay.simulation.events());
      expect(
        first.simulation.events().some((event) => event.type === 'local'),
      ).toBe(true);
      expect(
        first.simulation.events().some((event) => event.type === 'delivered'),
      ).toBe(true);
      for (const replica of first.replicas) {
        expect(replica.history()).toEqual(first.replicas[0]?.history());
        expect(replica.state()).toEqual(first.replicas[0]?.state());
      }
    },
  );

  it('exposes out-of-order delivery in the actual receive timeline', () => {
    const { simulation } = runScenario('out-of-order');
    const sequences = simulation
      .events()
      .flatMap((event) =>
        event.type === 'received' && event.replicaId === 'b'
          ? [event.result.operation.sequence]
          : [],
      );
    expect(sequences).toEqual([2, 1]);
  });

  it('retains deletions and conflicting histories', () => {
    for (const replica of runScenario('delete-vs-stale').replicas) {
      expect(replica.get('title')).toBeUndefined();
      expect(replica.winner('title')?.type).toBe('DELETE');
    }
    for (const replica of runScenario('concurrent-edits').replicas) {
      expect(replica.get('title')).toBe('Draft C');
      expect(replica.history('title')).toHaveLength(3);
    }
  });

  it('makes duplicate filtering and partition recovery observable', () => {
    expect(
      runScenario('duplicate-delivery')
        .simulation.events()
        .some(
          (event) =>
            event.type === 'received' && event.result.status === 'duplicate',
        ),
    ).toBe(true);
    const events = runScenario('partition-recovery').simulation.events();
    expect(
      events.some(
        (event) => event.type === 'dropped' && event.reason === 'partition',
      ),
    ).toBe(true);
    expect(
      events
        .filter((event) => event.type === 'convergence')
        .map((event) => event.converged),
    ).toEqual([true, false, true]);
  });
});
