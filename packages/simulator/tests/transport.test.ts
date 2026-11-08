import { describe, expect, it } from 'vitest';
import {
  EventJournal,
  Scheduler,
  Transport,
  type Packet,
  type NetworkConditions,
} from '../src/index.js';

function setup(conditions: Partial<NetworkConditions> = {}, seed = 5) {
  const clock = new Scheduler<() => void>();
  const journal = new EventJournal();
  const network = new Transport(clock, journal, seed, conditions);
  const delivered: Packet[] = [];
  network.register('a', (packet) => delivered.push(packet));
  network.register('b', (packet) => delivered.push(packet));
  return {
    clock,
    journal,
    network,
    delivered,
    advance: (ms: number) => clock.advanceBy(ms, (event) => event.value()),
  };
}
const payload = { type: 'summary', knownIds: [] } as const;

describe('packet transport', () => {
  it('queues packets until their deadline and copies mutable payloads', () => {
    const { network, advance, delivered } = setup();
    const ids = ['original'];
    network.send('a', 'b', { type: 'summary', knownIds: ids });
    ids.push('later');
    advance(9);
    expect(delivered).toEqual([]);
    expect(network.pending()).toHaveLength(1);
    advance(1);
    expect(delivered[0]?.payload).toEqual({
      type: 'summary',
      knownIds: ['original'],
    });
    expect(network.pending()).toEqual([]);
    expect(Object.isFrozen(delivered[0]?.payload)).toBe(true);
  });

  it('supports explicit reordered delivery and duplication', () => {
    const { network, advance, delivered, journal } = setup();
    network.send('a', 'b', payload, { delay: 20 });
    network.send('a', 'b', payload, { delay: 1, duplicate: true });
    advance(20);
    expect(delivered.map((packet) => packet.id)).toEqual([2, 3, 1]);
    expect(
      journal.snapshot().filter((event) => event.type === 'duplicated'),
    ).toHaveLength(1);
  });

  it('drops all packets at 100% loss and applies explicit overrides', () => {
    const { network, advance, delivered, journal } = setup({ loss: 1 });
    network.send('a', 'b', payload);
    network.send('a', 'b', payload, { drop: false });
    advance(10);
    expect(delivered).toHaveLength(1);
    expect(
      journal
        .snapshot()
        .some((event) => event.type === 'dropped' && event.reason === 'loss'),
    ).toBe(true);
  });

  it('duplicates every packet at 100% duplication', () => {
    const { network, advance, delivered } = setup({ duplication: 1 });
    network.send('a', 'b', payload);
    advance(10);
    expect(delivered).toHaveLength(2);
  });

  it('drops in-flight packets after a link breaks, even if it heals before arrival', () => {
    const { network, advance, delivered } = setup();
    network.send('a', 'b', payload);
    network.setLink('b', 'a', false);
    network.setLink('a', 'b', true);
    advance(10);
    expect(delivered).toHaveLength(0);
    network.send('a', 'b', payload);
    advance(10);
    expect(delivered).toHaveLength(1);
  });

  it('isolates disconnected nodes and bidirectional links', () => {
    const { network, advance, delivered } = setup();
    network.send('a', 'b', payload);
    network.setConnected('a', false);
    network.setConnected('a', true);
    network.setLink('a', 'b', false);
    network.send('b', 'a', payload);
    network.setLink('a', 'b', true);
    network.setConnected('b', false);
    network.send('a', 'b', payload);
    advance(20);
    expect(delivered).toHaveLength(0);
  });

  it('replays the same seeded fault trace and produces jitter-based reordering', () => {
    const run = () => {
      const setupResult = setup(
        { jitter: 100, loss: 0.2, duplication: 0.5 },
        42,
      );
      for (let i = 0; i < 30; i++) setupResult.network.send('a', 'b', payload);
      setupResult.advance(110);
      return setupResult;
    };
    const a = run();
    const b = run();
    expect(a.journal.snapshot()).toEqual(b.journal.snapshot());
    const ids = a.delivered.map((packet) => packet.id);
    expect(ids).not.toEqual([...ids].sort((x, y) => x - y));
    const times = a.journal.snapshot().map((event) => event.time);
    expect(times).toEqual([...times].sort((x, y) => x - y));
  });

  it('validates options before mutation and does not reschedule existing packets on configuration changes', () => {
    const { network, advance, delivered, journal } = setup();
    expect(() => network.configure({ loss: NaN })).toThrow();
    expect(() => network.configure({ jitter: -1 })).toThrow();
    expect(network.conditions.loss).toBe(0);
    expect(() => network.send('a', 'missing', payload)).toThrow();
    expect(() => network.send('a', 'b', payload, { delay: -1 })).toThrow();
    expect(journal.snapshot()).toEqual([]);
    network.send('a', 'b', payload);
    network.configure({ latency: 100 });
    advance(10);
    expect(delivered).toHaveLength(1);
    expect(() => network.register('a', () => {})).toThrow();
  });
});
