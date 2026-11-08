import type { LabCheckpoint } from './session.js';
import {
  StorageConflict,
  storageErrorMessage,
  type LabStore,
} from './storage.js';

export type SaveStatus =
  | { readonly phase: 'saved' | 'saving' }
  | {
      readonly phase: 'error';
      readonly message: string;
      readonly conflict: boolean;
    };

/** One writer at a time; coalesce pending snapshots but never reorder commits. */
export class SaveQueue {
  #latest: LabCheckpoint | undefined;
  #work: Promise<void> | undefined;
  #disposed = false;
  #status: SaveStatus = { phase: 'saved' };

  constructor(
    private readonly store: LabStore,
    private revision: number,
    private readonly changed: (status: SaveStatus) => void,
  ) {}

  get status(): SaveStatus {
    return this.#status;
  }

  save(checkpoint: LabCheckpoint): void {
    if (this.#disposed) return;
    this.#latest = checkpoint;
    if (this.#status.phase !== 'error') this.#start();
  }

  retry(): void {
    if (
      this.#disposed ||
      (this.#status.phase === 'error' && this.#status.conflict)
    )
      return;
    this.#start();
  }

  async settled(): Promise<void> {
    await this.#work;
  }

  dispose(): void {
    this.#disposed = true;
    if (!this.#work) this.store.close();
  }

  #notify(status: SaveStatus): void {
    this.#status = status;
    if (!this.#disposed) this.changed(status);
  }

  #start(): void {
    if (this.#work || !this.#latest) return;
    this.#notify({ phase: 'saving' });
    this.#work = this.#drain().finally(() => {
      this.#work = undefined;
      if (this.#disposed) this.store.close();
    });
  }

  async #drain(): Promise<void> {
    while (this.#latest) {
      const checkpoint = this.#latest;
      this.#latest = undefined;
      try {
        this.revision = await this.store.save(checkpoint, this.revision);
      } catch (error) {
        this.#latest ??= checkpoint;
        this.#notify({
          phase: 'error',
          message: storageErrorMessage(error),
          conflict: error instanceof StorageConflict,
        });
        return;
      }
    }
    this.#notify({ phase: 'saved' });
  }
}
