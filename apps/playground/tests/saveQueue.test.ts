import { expect, test, vi } from 'vitest';
import { LabSession } from '../src/session.js';
import { SaveQueue } from '../src/saveQueue.js';
import { StorageConflict, type LabStore } from '../src/storage.js';

test('serializes writes, coalesces pending edits and only reports saved after the latest commit', async () => {
  let release!: (revision: number) => void;
  const store: LabStore = {
    load: async () => null,
    close: vi.fn(),
    save: vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<number>((resolve) => {
            release = resolve;
          }),
      )
      .mockResolvedValue(3),
  };
  const changed = vi.fn();
  const queue = new SaveQueue(store, 1, changed);
  const lab = new LabSession();
  queue.save(lab.checkpoint());
  lab.write('a', 'x', 'second', 'text');
  queue.save(lab.checkpoint());
  lab.write('a', 'x', 'latest', 'text');
  queue.save(lab.checkpoint());
  expect(store.save).toHaveBeenCalledTimes(1);
  expect(queue.status.phase).toBe('saving');
  release(2);
  await queue.settled();
  expect(store.save).toHaveBeenCalledTimes(2);
  expect(store.save).toHaveBeenLastCalledWith(lab.checkpoint(), 2);
  expect(queue.status.phase).toBe('saved');
  queue.dispose();
  expect(store.close).toHaveBeenCalledOnce();
});

test('retains the newest snapshot after storage failure and retries with the uncommitted revision', async () => {
  const store: LabStore = {
    load: async () => null,
    close: vi.fn(),
    save: vi
      .fn()
      .mockRejectedValueOnce(
        new DOMException('Storage full', 'QuotaExceededError'),
      )
      .mockResolvedValue(5),
  };
  const queue = new SaveQueue(store, 4, () => {});
  const checkpoint = new LabSession().checkpoint();
  queue.save(checkpoint);
  await queue.settled();
  expect(queue.status).toMatchObject({ phase: 'error', conflict: false });
  queue.retry();
  await queue.settled();
  expect(store.save).toHaveBeenLastCalledWith(checkpoint, 4);
  expect(queue.status.phase).toBe('saved');
  queue.dispose();
});

test('a revision conflict cannot be retried to overwrite the newer tab', async () => {
  const store: LabStore = {
    load: async () => null,
    close: vi.fn(),
    save: vi.fn().mockRejectedValue(new StorageConflict()),
  };
  const queue = new SaveQueue(store, 1, () => {});
  queue.save(new LabSession().checkpoint());
  await queue.settled();
  queue.retry();
  await queue.settled();
  expect(store.save).toHaveBeenCalledOnce();
  expect(queue.status).toMatchObject({ phase: 'error', conflict: true });
  queue.dispose();
});
