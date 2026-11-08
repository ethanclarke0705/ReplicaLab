# Synchronisation contract

## Operations and values

Every operation has `id`, `replicaId`, `sequence`, `logicalTimestamp`, `type` and `key`. SET also requires `value`; DELETE must not contain it. Unknown fields are rejected. IDs are `JSON.stringify([replicaId, sequence])`, an unambiguous encoding even when identities contain punctuation. Sequence numbers are positive safe integers, incremented only for successful local writes; receiving a peer operation never increments the local sequence.

Keys are arbitrary strings, including empty and prototype-like names. Values are JSON: null, booleans, strings, finite numbers, dense arrays and plain objects. Undefined, nonfinite numbers, class instances, accessors, symbols, cycles and excessively nested values are rejected. Traversal permits at most 100 nested containers including the operation record. Negative zero is normalised to zero. Objects are copied with canonical key ordering and deeply frozen; caller mutation cannot change history. `state()` returns a detached map with immutable values.

## Logical time

A replica starts at clock zero. A successful local write increments the clock before assigning its timestamp. First receipt of an unseen valid operation advances the clock to `max(local, received) + 1`, even if that operation loses resolution. Duplicate packets are filtered before the logical event stream: they change neither state nor clock. Invalid operations do not advance clocks or counters.

Logical time captures ordering consistent with causality, not wall-clock time. Replica clocks need not be equal after convergence because delivery orders differ. With JavaScript safe-integer clocks, an event that would overflow fails atomically; progress and convergence claims assume sufficient clock range. There is no wraparound or wall-clock fallback.

## Resolution and tombstones

The winning operation for each key is the maximum tuple `(logicalTimestamp, replicaId)`. Replica IDs use JavaScript's raw lexicographic UTF-16 code-unit ordering, case sensitive, without locale rules or Unicode normalisation. A valid origin advances its logical timestamp at least once per sequence increment, so distinct operations from one origin cannot tie. Received histories inconsistent with that rule are rejected. A known operation ID with a different canonical payload is rejected as an identity collision.

DELETE participates in exactly the same ordering as SET. Its winning record remains as a tombstone even when the key is absent from visible state. An older SET cannot revive it. A newer SET can intentionally recreate the key. At an equal timestamp, the greater replica ID wins, regardless of operation type; deletes do not have special priority.

Last-writer-wins does **not** preserve all concurrent edits in visible state and does not identify the physically latest user action. Every accepted operation remains in `history()`, including losers. Lamport timestamps alone cannot establish that two edits were concurrent; `superseded` means an operation lost the ordering comparison, not that a concurrent conflict was proven.

## Public exchange API

1. The receiver advertises `knownOperationIds()`.
2. The sender calls `missingOperations(advertisedIds)`.
3. A transport delivers each returned record to `receiver.receive(operation)`.
4. Repeat in the opposite direction, and retry after losses or new writes.

Summaries contain exact IDs rather than per-origin maxima: seeing sequence 3 says nothing about whether 1 and 2 arrived. A stale summary may cause duplicates, which are safe. All known operations can be forwarded, not only locally created ones. A dropped response leaves the receiver missing those IDs, so another request returns them again. The core exposes the protocol primitives; it does not run timers, initiate connections or retry automatically. The [simulator](simulator.md) now supplies scheduled delivery and recovery retries.

`receive` returns a status, the received operation, and the current winner for its key. The status is `applied` if it became the winner, `superseded` if retained only in history, and `duplicate` if already known. Invalid records or identity conflicts throw `TypeError`; clock exhaustion throws an error without changing state. There is no atomic multi-operation batch API: transports deliver and handle failures per record.

## Why complete histories converge

For each key, taking the maximum of a fixed total ordering is associative, commutative and idempotent. Valid replicas that accept the same finite operation set therefore select the same winner, including tombstones, regardless of arrival order or duplicate packets. History is returned in tuple order for deterministic inspection. This argument concerns visible state and winning operations, not equal local clock readings.

Convergence assumes globally unique, non-reused replica identities; consistent immutable records for each ID; valid origin histories; enough clock range; and eventual delivery of every required operation. Permanent partitions, endless loss, malicious or equivocating origins and state loss are outside that guarantee. Validation is not authentication or Byzantine agreement.

## Identity and persistence

The current constructor always creates a fresh in-memory replica. Receiving an unknown operation from its own ID is rejected to expose identity reuse instead of silently resetting a counter. Create a new identity after losing state. Do not use `receive` as a restoration API. Milestone 4 must atomically persist and restore identity, local sequence, logical clock and complete history before permitting new writes; that feature is not implemented yet.

## Cost and tests

History and tombstones are unbounded. New remote operations scan known history to validate origin ordering (O(n)); history and summaries sort O(n log n). Exact-ID reconciliation uses O(n + m) temporary space for n local records and m advertised IDs. These costs are intentional for an inspectable initial engine, not a scalable production protocol. Compaction requires a separate design that cannot resurrect deleted data.

Unit tests cover clock updates, overflow, malformed records, tie-breaking, identity collisions, immutable values, tombstones and missing-history gaps. Seeded fast-check tests compare shuffled and duplicated delivery with an independent winner fold, and reconcile generated offline histories. The fixed seeds are `20261108` and `84117`, each with 250 runs. Network integration tests now live in `packages/simulator/tests`; persistence remains a future milestone.
