# Persistence contract

The browser playground uses native IndexedDB to save one isolated three-replica lab per origin. The core has no browser dependency: it exposes `checkpoint()` and `Replica.restore(unknown)`; the app owns storage and session lifecycle.

## What is saved

Database `replicalab`, version 1, contains object store `lab`. Key `current` holds `{ revision, checkpoint }`. The version-1 lab checkpoint contains the seed, network conditions, three connectivity flags, three link flags and the three complete replica checkpoints. Each replica record holds its identity, logical clock, local sequence and complete operation history, including losing writes and DELETE tombstones. Visible state is derived from history rather than stored as a second source of truth.

The fixed IDs a, b and c are identities within this isolated lab. Reset and scenarios replace all three replicas together. These identities must not be used as global identities for a future real transport. Separate tabs do not exchange operations; revision checks protect the saved record, not collaborative editing.

Reload starts a new paused simulation at time zero. It does not restore pending packets, retry deadlines, random-generator progress, timeline entries, playback state, unsaved editor text or filters. Conditions and connectivity are restored; recovery uses a fresh 500 ms retry interval and the saved seed. Advance time or request synchronization to reconcile missing operations through the actual lossy transport. This is durable replica recovery, not exact simulation replay.

## Validation and atomicity

`Replica.restore` validates operations and checkpoint counters before exposing a replica. It rejects duplicate operation IDs, incompatible origin timestamps, a clock behind its history, missing local operations, unsupported versions and malformed values. Remote history gaps remain valid. Restoration directly rebuilds winners without changing saved logical time. It does not call `receive` on historical local operations.

`LabSession.restore` additionally requires exactly a, b and c, valid network controls and connectivity, and agreement with the originating replica for every stored operation. Corruption or a future schema is an error, never a reason to silently discard data or reset counters.

All three replicas and controls are committed in one read-write transaction. The transaction reads the current revision and only writes if it matches the writer's expected revision, then increments it. A stale tab cannot overwrite a newer checkpoint, including a reset. “Saved” is reported only after transaction completion, not request success. A failed transaction leaves the previous checkpoint intact.

One save queue serializes writes and coalesces pending snapshots to the latest complete state. Commands mutate memory immediately; changed persistent state is queued for saving. Commands that only advance simulated time or add journal entries do not trigger a checkpoint write. Edits made during an in-flight save are not reported saved until their subsequent checkpoint commits.

## Failure behaviour

Loading finishes before edit controls appear. No saved record causes a fresh lab to be committed before editing begins. Existing unsupported or corrupt records remain untouched; the user can retry loading or explicitly choose a temporary session with no storage writes.

Save failures pause playback and disable simulation controls. The latest unsaved checkpoint stays in memory for retry. Revision conflicts cannot be forced through Retry saving: reload is required and discards that tab's unsaved edits. Database version changes close open connections to allow upgrades. A closed connection or unsupported newer database requires a reload with compatible code; retrying cannot repair it.

The page registers a before-unload warning while saving or after a failed save. Browsers may suppress it, and it cannot guarantee completion on shutdown. Wait for the saved indicator. IndexedDB is origin-specific, subject to quota, user deletion and browser eviction, and is not a backup or a cloud service. Different schemes, hosts or ports have independent labs. Private browsing may restrict storage or remove it on exit.

Version 1 is the first durable schema. Future versions require explicit migrations; this milestone does not add import/export, compaction, multi-tab collaboration or a persistence permission request. History growth makes full-checkpoint writes increasingly expensive, so the adapter is intended for small demonstrations.

The transaction lifecycle follows the [IndexedDB specification](https://www.w3.org/TR/IndexedDB/); shutdown and connection behaviour are described in [MDN's IndexedDB guide](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB).

## Verification

Core unit and seeded property tests verify restoration, counter continuation, duplicate suppression, retained tombstones and rejection of invalid checkpoints. Native-API adapter tests use fake-indexeddb for reopen, atomic abort, stale writers, future database versions and version-change closure. Queue tests cover ordering, coalescing, failures and retries. UI integration tests cover StrictMode startup, loading gates, reload, reset, temporary mode, save failures and conflict handling. Production browser checks exercise actual IndexedDB across reloads and reconnection.

At Milestone 4 completion, `pnpm check` passed all 122 tests, formatting, lint, type checks and production builds. Both built ESM examples passed, and `pnpm peers check` reported no peer dependency issues. Milestone 5 has not started.
