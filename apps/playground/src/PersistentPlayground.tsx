import { useEffect, useState } from 'react';
import { App } from './App.js';
import { LabSession } from './session.js';
import { openLabStore, storageErrorMessage, type LabStore } from './storage.js';
import { SaveQueue, type SaveStatus } from './saveQueue.js';

type ReadyLab = { session: LabSession; writer: SaveQueue; restored: boolean };

export function PersistentPlayground({
  openStore = openLabStore,
}: {
  openStore?: () => Promise<LabStore>;
}) {
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState<ReadyLab | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [temporary, setTemporary] = useState(false);
  const [status, setStatus] = useState<SaveStatus>({ phase: 'saved' });

  useEffect(() => {
    if (temporary) return;
    let active = true;
    let store: LabStore | undefined;
    let writer: SaveQueue | undefined;
    void (async () => {
      try {
        store = await openStore();
        if (!active) {
          store.close();
          return;
        }
        const saved = await store.load();
        if (!active) {
          store.close();
          return;
        }
        const session = saved
          ? LabSession.restore(saved.checkpoint)
          : new LabSession();
        const revision =
          saved?.revision ?? (await store.save(session.checkpoint(), 0));
        if (!active) {
          store.close();
          return;
        }
        writer = new SaveQueue(store, revision, (next) => {
          if (active) setStatus(next);
        });
        setReady({ session, writer, restored: saved !== null });
      } catch (cause) {
        store?.close();
        if (active) setError(storageErrorMessage(cause));
      }
    })();
    return () => {
      active = false;
      if (writer) writer.dispose();
      else store?.close();
    };
  }, [attempt, openStore, temporary]);

  useEffect(() => {
    if (status.phase === 'saved') return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [status.phase]);

  if (temporary)
    return (
      <App
        storageNotice={
          <p role="status">
            Temporary session · Changes will not survive reload. Existing saved
            data is untouched.
          </p>
        }
      />
    );
  if (!ready)
    return (
      <main className="storage-start" aria-busy={!error}>
        <p className="eyebrow">REPLICALAB</p>
        <h1>{error ? 'Saved lab unavailable' : 'Opening your lab…'}</h1>
        {error ? (
          <>
            <p role="alert">{error}</p>
            <p>
              Your saved data has not been replaced. Close other lab tabs if
              storage is blocked, then retry. A temporary session will leave the
              saved record untouched.
            </p>
            <button
              className="primary"
              onClick={() => {
                setError(null);
                setAttempt((value) => value + 1);
              }}
            >
              Retry loading
            </button>
            <button className="secondary" onClick={() => setTemporary(true)}>
              Use temporary session
            </button>
          </>
        ) : (
          <p role="status">
            Restoring replica identities, clocks and operation history before
            enabling edits.
          </p>
        )}
      </main>
    );
  return (
    <App
      initialSession={ready.session}
      onCheckpoint={(checkpoint) => ready.writer.save(checkpoint)}
      blocked={status.phase === 'error'}
      restored={ready.restored}
      storageNotice={
        <section className="storage-status" aria-label="Browser storage">
          {status.phase === 'error' ? (
            <>
              <p role="alert">
                Not saved: {status.message} Editing and playback are paused;
                your current changes remain in memory.
              </p>
              {!status.conflict && (
                <button
                  className="secondary"
                  onClick={() => ready.writer.retry()}
                >
                  Retry saving
                </button>
              )}
              <p>
                {status.conflict
                  ? 'Reload to use the newer saved lab. Unsaved changes in this tab will be discarded.'
                  : 'Free browser storage if needed, then retry before reloading.'}
              </p>
            </>
          ) : (
            <p role="status">
              {status.phase === 'saving'
                ? 'Saving to this browser… Wait before closing.'
                : 'Saved to this browser · Replica data survives reload.'}
            </p>
          )}
          <small>
            Reload restarts simulated time, queued packets and the event
            timeline. Reset lab and Run scenario replace the saved lab.
          </small>
        </section>
      }
    />
  );
}
