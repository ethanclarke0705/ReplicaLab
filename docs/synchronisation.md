# Synchronisation design

The initial engine will use a replicated key-value store with SET and DELETE operations. Each operation has a unique replica/sequence ID and a Lamport logical timestamp. Winners are ordered by `(logicalTimestamp, replicaId)` using a locale-independent replica ID comparison.

Logical time orders events consistently with causality; it is not elapsed time or a wall-clock timestamp. Last-writer-wins refers to this logical order, not to which user physically typed last. Concurrent updates may disappear from visible state; full history retains the losing operations for inspection.

Deletes must remain as tombstones. Forgetting them could allow delayed old SET operations to resurrect a key. Convergence requires successful exchange of all required operations; it is not guaranteed during a partition or endless loss.

Implementation details and executable examples will be documented with the engine.
