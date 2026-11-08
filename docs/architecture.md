# Architecture

The core owns replica state, logical time, operation history and deterministic resolution. It exports ESM and TypeScript declarations, with no runtime dependencies. Tests run in Node without a browser.

The future simulator will own delivery, scheduling, seedable randomness, network links and retries. It must exchange operations through public core APIs rather than mutate replica internals. A later React/Vite playground will display real state and events from those layers.

Start with full operation history and explicit known-ID exchange. This is easy to inspect and supports gaps caused by out-of-order delivery. A maximum sequence number alone is not sufficient to identify missing operations. Compaction and transport optimisation are deferred until they have a proven protocol.

Runtime dependencies for the UI and IndexedDB are intentionally deferred until their milestones. The repository uses pnpm workspaces so those packages can be added without changing the core's dependency direction.

TypeScript is pinned to 6.0.3: typescript-eslint 8.72.1 supports TypeScript below 6.1 and rejects TypeScript 7. Upgrade the compiler when the lint toolchain supports it. pnpm is pinned to the installed 11.25.0 version for reproducible local and CI installs.
