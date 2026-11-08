# Changelog

## 0.1.0 - 2026-11-08

First public GitHub release. [Live demo](https://ethanclarke0705.github.io/ReplicaLab/). Packages remain private and are not published to npm.

### Added

- Independent TypeScript replicas with JSON SET/DELETE operations, Lamport clocks, deterministic last-writer-wins resolution, tombstones and duplicate suppression.
- Exact-ID anti-entropy and a deterministic simulator for latency, jitter, loss, duplication, offline devices and link partitions.
- Eight real scenarios and an accessible React/Vite playground with replica editing, playback, history and event inspection.
- Validated checkpoints and atomic IndexedDB persistence with restore-before-edit, save feedback, retries and stale-tab protection.
- Seeded property tests, integration tests, UI/storage tests and runnable reconciliation, network and restoration examples.
- Static-demo verification, Linux/Windows CI, a manually gated GitHub Pages workflow, release instructions and security guidance.

### Fixed during release review

- Patched the development-only minimatch advisory GHSA-g3hv-75wg-m249 through a pinned override, with the lint/type/test/build suite verified afterward.

### Known limits

- No real networking, CRDTs, causal-conflict detection, history compaction, multi-tab collaboration or cloud backup.
- Last-writer-wins retains losing operations in history but may discard their values from visible state.
- Reload restores replicas and network settings, not the simulation queue, random-generator progress or event timeline.
- Browser storage can be restricted, cleared or evicted. Workloads are intended to remain small and inspectable.
