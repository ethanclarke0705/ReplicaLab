import { describe, expect, it } from 'vitest';
import { Scheduler, SeededRandom } from '../src/index.js';

describe('simulated scheduler', () => {
  it('orders deadlines then insertion, including newly scheduled same-time events', () => {
    const scheduler = new Scheduler<string>();
    scheduler.schedule(20, 'late');
    scheduler.schedule(10, 'first');
    scheduler.schedule(10, 'second');
    const observed: string[] = [];
    scheduler.advanceBy(10, (event) => {
      observed.push(event.value);
      if (event.value === 'first') scheduler.schedule(0, 'nested');
    });
    expect(observed).toEqual(['first', 'second', 'nested']);
    expect(scheduler.now).toBe(10);
    scheduler.step((event) => observed.push(event.value));
    expect(scheduler.now).toBe(20);
    expect(observed.at(-1)).toBe('late');
    expect(scheduler.step(() => {})).toBe(false);
  });

  it('bounds runaway work without losing the next event or moving beyond it', () => {
    const scheduler = new Scheduler<null>();
    scheduler.schedule(0, null);
    expect(() =>
      scheduler.advanceBy(100, () => scheduler.schedule(0, null), 3),
    ).toThrow(/budget/);
    expect(scheduler.now).toBe(0);
    expect(scheduler.pending()).toHaveLength(1);
    scheduler.advanceBy(100, () => {});
    expect(scheduler.now).toBe(100);
  });

  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid duration %s atomically',
    (duration) => {
      const scheduler = new Scheduler<null>();
      expect(() => scheduler.schedule(duration, null)).toThrow();
      expect(() => scheduler.advanceBy(duration, () => {})).toThrow();
      expect(scheduler.now).toBe(0);
      expect(scheduler.pending()).toEqual([]);
    },
  );

  it('checks addition overflow and keeps detached immutable queue records', () => {
    const scheduler = new Scheduler<null>();
    scheduler.advanceBy(Number.MAX_SAFE_INTEGER, () => {});
    expect(() => scheduler.schedule(1, null)).toThrow();
    expect(() => scheduler.advanceBy(1, () => {})).toThrow();
    scheduler.schedule(0, null);
    expect(Object.isFrozen(scheduler.pending())).toBe(true);
    expect(Object.isFrozen(scheduler.pending()[0])).toBe(true);
  });
});

describe('seeded randomness', () => {
  it('reproduces a stream without degenerating for a zero seed', () => {
    const a = new SeededRandom(0);
    const b = new SeededRandom(0);
    const c = new SeededRandom(1);
    const values = Array.from({ length: 100 }, () => a.next());
    expect(values).toEqual(Array.from({ length: 100 }, () => b.next()));
    expect(values).not.toEqual(Array.from({ length: 100 }, () => c.next()));
    expect(values.every((value) => value >= 0 && value < 1)).toBe(true);
    expect(new Set(values).size).toBe(100);
  });
  it.each([-1, 0.5, NaN, 0x1_0000_0000])('rejects invalid seed %s', (seed) => {
    expect(() => new SeededRandom(seed)).toThrow();
  });
});
