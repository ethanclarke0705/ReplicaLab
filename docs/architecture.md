# Architecture

The core owns replica state, logical time, operation history and deterministic resolution. It exports ESM and TypeScript declarations, with no runtime dependencies. Tests run in Node without a browser.

Implemented modules are `clock.ts` (safe Lamport arithmetic), `value.ts` (JSON validation and immutable copies), `operation.ts` (wire records and ordering), and `replica.ts` (state, history and exchange primitives). `index.ts` defines the public API. The core targets ES2022 and uses no DOM types or Node APIs. `examples/reconciliation.mjs` verifies the built ESM in Node.

Each replica owns private maps of known operations and winning operations. Incoming records are validated before any mutation. Values and operations are deeply immutable; visible maps are detached snapshots. No hidden singleton state, timers or shared mutable replica state are used.

The simulator owns delivery, scheduling, seedable randomness, network links and retries. `Transport` delivers immutable packets to registered handlers without holding replicas. `Simulation` adapts the structural `ReplicaEndpoint` interface to this transport; it exchanges summaries and operations through public core APIs. Only the scenario factory constructs concrete replicas. A later React/Vite playground will display real state and events from those layers.

`Scheduler` orders events by simulated deadline and insertion ID; `SeededRandom` drives fault choices. A single scheduler serves packet delivery and reconciliation retries, giving deterministic ordering across both. `EventJournal` exposes detached event-array snapshots. Details and correctness limits are in [the simulator contract](simulator.md).

Start with full operation history and explicit known-ID exchange. This is easy to inspect and supports gaps caused by out-of-order delivery. A maximum sequence number alone is not sufficient to identify missing operations. Compaction and transport optimisation are deferred until they have a proven protocol.

Runtime dependencies for the UI and IndexedDB are intentionally deferred until their milestones. The repository uses pnpm workspaces so those packages can be added without changing the core's dependency direction.

Development type checking and Vitest resolve workspace source through the `development` package-export condition. Package builds disable that condition and use compiled exports, building core before simulator through the workspace dependency graph. This avoids testing stale build output while keeping the built ESM independently runnable. The simulator's only runtime dependency is the workspace core.

TypeScript is pinned to 6.0.3: typescript-eslint 8.72.1 supports TypeScript below 6.1 and rejects TypeScript 7. Upgrade the compiler when the lint toolchain supports it. pnpm is pinned to the installed 11.25.0 version for reproducible local and CI installs.
