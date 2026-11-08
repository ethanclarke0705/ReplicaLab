import type { LabCheckpoint } from './session.js';

export class StorageConflict extends Error {
  constructor() {
    super(
      'Another tab saved a newer lab. Reload before making further changes.',
    );
  }
}

export interface StoredLab {
  readonly revision: number;
  readonly checkpoint: unknown;
}

function storedRecord(input: unknown): StoredLab | null {
  if (input === undefined) return null;
  if (!input || typeof input !== 'object')
    throw new TypeError('Invalid stored lab record');
  const data = input as Record<string, unknown>;
  if (
    Object.keys(data).length !== 2 ||
    typeof data.revision !== 'number' ||
    !Number.isSafeInteger(data.revision) ||
    data.revision < 1 ||
    !Object.hasOwn(data, 'checkpoint')
  )
    throw new TypeError('Invalid stored lab revision');
  return { revision: data.revision, checkpoint: data.checkpoint };
}

export interface LabStore {
  load(): Promise<StoredLab | null>;
  save(checkpoint: LabCheckpoint, expectedRevision: number): Promise<number>;
  close(): void;
}

/** Resolve writes on transaction completion, not merely request success. */
export async function openLabStore(
  factory: IDBFactory = indexedDB,
  name = 'replicalab',
): Promise<LabStore> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(name, 1);
    let abandoned = false;
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('lab'))
        request.result.createObjectStore('lab');
    };
    request.onblocked = () => {
      abandoned = true;
      reject(
        new Error(
          'Storage upgrade is blocked. Close other ReplicaLab tabs, then retry.',
        ),
      );
    };
    request.onerror = () =>
      reject(request.error ?? new Error('Could not open IndexedDB'));
    request.onsuccess = () => {
      if (abandoned) request.result.close();
      else resolve(request.result);
    };
  });
  db.onversionchange = () => db.close();
  return {
    close: () => db.close(),
    load: () =>
      new Promise((resolve, reject) => {
        const tx = db.transaction('lab', 'readonly');
        const request = tx.objectStore('lab').get('current');
        tx.onabort = () =>
          reject(tx.error ?? new Error('Reading saved lab was aborted'));
        tx.oncomplete = () => {
          try {
            resolve(storedRecord(request.result));
          } catch (error) {
            reject(error);
          }
        };
      }),
    save: (checkpoint, expectedRevision) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction('lab', 'readwrite');
        const store = tx.objectStore('lab');
        const request = store.get('current');
        let failure: unknown;
        tx.onabort = () =>
          reject(failure ?? tx.error ?? new Error('Saving lab was aborted'));
        tx.oncomplete = () => resolve(expectedRevision + 1);
        request.onsuccess = () => {
          try {
            const current = storedRecord(request.result);
            if ((current?.revision ?? 0) !== expectedRevision)
              throw new StorageConflict();
            if (!Number.isSafeInteger(expectedRevision + 1))
              throw new RangeError('Storage revision exhausted');
            store.put(
              { revision: expectedRevision + 1, checkpoint },
              'current',
            );
          } catch (error) {
            failure = error;
            tx.abort();
          }
        };
      }),
  };
}
