import { IDBFactory } from 'fake-indexeddb';
import { expect, test } from 'vitest';
import { LabSession } from '../src/session.js';
import { openLabStore, StorageConflict } from '../src/storage.js';
import { scenarioNames } from '@replicalab/simulator';

test('a newer database version is not downgraded or cleared', async () => {
  const factory = new IDBFactory();
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open('replicalab', 2);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
  db.close();
  await expect(openLabStore(factory)).rejects.toMatchObject({
    name: 'VersionError',
  });
});

test('open connections close on version change so an upgrade can complete', async () => {
  const factory = new IDBFactory();
  const store = await openLabStore(factory);
  await store.save(new LabSession().checkpoint(), 0);
  const upgraded = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open('replicalab', 2);
    request.onblocked = () =>
      reject(new Error('Old connection blocked upgrade'));
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
  expect(upgraded.version).toBe(2);
  await expect(store.load()).rejects.toMatchObject({
    name: 'InvalidStateError',
  });
  upgraded.close();
});

test('all real scenario histories can be restored and continued', () => {
  for (const name of scenarioNames) {
    const lab = new LabSession(42, name);
    const restored = LabSession.restore(lab.checkpoint());
    expect(restored.checkpoint()).toEqual(lab.checkpoint());
    restored.write('a', 'after-reload', 'continued', 'text');
    restored.simulation.network.configure({ loss: 0, latency: 10, jitter: 0 });
    restored.simulation.advanceBy(2000);
    expect(restored.simulation.converged).toBe(true);
  }
});

test('atomically restores offline data, identities, counters, tombstones and connectivity after reopening', async () => {
  const factory = new IDBFactory();
  const store = await openLabStore(factory);
  expect(await store.load()).toBeNull();
  const lab = new LabSession();
  lab.simulation.setConnected('c', false);
  lab.write('c', 'offline', '{"draft":true}', 'json');
  lab.simulation.delete('a', 'title');
  lab.simulation.setLink('a', 'b', false);
  expect(await store.save(lab.checkpoint(), 0)).toBe(1);
  store.close();
  const reopened = await openLabStore(factory);
  const record = (await reopened.load())!;
  const restored = LabSession.restore(record.checkpoint);
  expect(restored.checkpoint()).toEqual(lab.checkpoint());
  expect(restored.snapshot().now).toBe(0);
  expect(restored.snapshot().pending).toBe(0);
  expect(restored.replicas[0]!.winner('title')?.type).toBe('DELETE');
  expect(restored.simulation.set('c', 'after', true).sequence).toBe(2);
  restored.simulation.setConnected('c', true);
  restored.simulation.setLink('a', 'b', true);
  restored.simulation.advanceBy(2000);
  expect(restored.simulation.converged).toBe(true);
  expect(restored.replicas.map((replica) => replica.get('offline'))).toEqual([
    { draft: true },
    { draft: true },
    { draft: true },
  ]);
  reopened.close();
});

test('compare-and-swap prevents stale tabs overwriting newer history or a reset', async () => {
  const factory = new IDBFactory();
  const left = await openLabStore(factory);
  const right = await openLabStore(factory);
  const first = new LabSession();
  const second = new LabSession(9);
  const results = await Promise.allSettled([
    left.save(first.checkpoint(), 0),
    right.save(second.checkpoint(), 0),
  ]);
  expect(
    results.filter((result) => result.status === 'fulfilled'),
  ).toHaveLength(1);
  const rejected = results.find((result) => result.status === 'rejected');
  expect(rejected?.status === 'rejected' && rejected.reason).toBeInstanceOf(
    StorageConflict,
  );
  await left.save(second.checkpoint(), 1);
  await expect(right.save(first.checkpoint(), 1)).rejects.toBeInstanceOf(
    StorageConflict,
  );
  expect((await right.load())?.checkpoint).toEqual(second.checkpoint());
  left.close();
  right.close();
});

test('uncloneable writes abort without changing the saved checkpoint or revision', async () => {
  const store = await openLabStore(new IDBFactory());
  const checkpoint = new LabSession().checkpoint();
  await store.save(checkpoint, 0);
  await expect(
    store.save({ ...checkpoint, extra: () => {} } as typeof checkpoint, 1),
  ).rejects.toThrow();
  expect(await store.load()).toEqual({ revision: 1, checkpoint });
  store.close();
});

test('rejects corrupted lab checkpoints rather than repairing identities or discarding history', () => {
  const saved = new LabSession().checkpoint();
  for (const input of [
    { ...saved, version: 2 },
    { ...saved, seed: -1 },
    { ...saved, replicas: saved.replicas.slice(1) },
    { ...saved, connected: [true] },
    { ...saved, conditions: { ...saved.conditions, loss: 2 } },
    {
      ...saved,
      replicas: [saved.replicas[1], saved.replicas[0], saved.replicas[2]],
    },
  ])
    expect(() => LabSession.restore(input)).toThrow();
  const conflicting = structuredClone(saved);
  const operation = conflicting.replicas[1]!.operations[0]!;
  if (operation.type === 'SET')
    Object.assign(operation, { value: 'corrupted' });
  expect(() => LabSession.restore(conflicting)).toThrow(/disagree/);
});
