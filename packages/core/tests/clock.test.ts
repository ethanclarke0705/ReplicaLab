import { describe, expect, it } from 'vitest';
import { LamportClock } from '../src/index.js';

describe('LamportClock', () => {
  it('advances local and receive events with max(local, remote) + 1', () => {
    const clock = new LamportClock();
    expect(clock.value).toBe(0);
    expect(clock.tick()).toBe(1);
    expect(clock.receive(9)).toBe(10);
    expect(clock.receive(2)).toBe(11);
    expect(clock.tick()).toBe(12);
  });

  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid time %s without mutation',
    (timestamp) => {
      const clock = new LamportClock();
      expect(() => clock.receive(timestamp)).toThrow(TypeError);
      expect(clock.value).toBe(0);
    },
  );

  it('refuses unsafe overflow without advancing', () => {
    const clock = new LamportClock();
    expect(() => clock.receive(Number.MAX_SAFE_INTEGER)).toThrow(RangeError);
    expect(clock.value).toBe(0);
    clock.receive(Number.MAX_SAFE_INTEGER - 1);
    expect(() => clock.tick()).toThrow(RangeError);
    expect(clock.value).toBe(Number.MAX_SAFE_INTEGER);
  });
});
