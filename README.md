# ReplicaLab

An open-source distributed data synchronisation engine and planned interactive playground for exploring offline-first systems, network failures and conflict resolution.

Independent devices can edit the same data while disconnected. Reconciliation must tolerate duplicates, delays and different delivery orders. ReplicaLab makes those rules explicit and testable, starting with a headless TypeScript engine.

## Status

Milestones 0–2 are implemented: a pnpm workspace, a tested headless replication engine and a deterministic network simulator. The browser playground and persistence are not implemented yet.

- Independent replicas with SET and DELETE operations over JSON values.
- Lamport clocks and deterministic last-writer-wins resolution.
- Tombstones, duplicate suppression and retained operation history.
- Explicit missing-operation exchange, including gaps in received history.
- Runtime validation, immutable records and seeded property-based tests.
- Simulated latency, jitter, packet loss, duplication, reordering and partitions.
- Reconnection reconciliation and periodic recovery retries over the same lossy transport.
- Chronological event inspection and eight reproducible headless scenarios.

Last-writer-wins can discard concurrent updates from visible state. Convergence requires successful exchange of all operations; it is not promised during partitions or indefinite message loss.

## Development

Install Node.js 24 and pnpm 11.25.0, then run:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test:watch
pnpm demo
pnpm demo:network
```

`pnpm check` runs formatting, linting, type checking, tests and package builds. Individual commands are `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build`. Run `pnpm format` to format changes. Generated ESM and declarations go into each package's ignored `dist/` folder.

## Try the engine

`pnpm demo` builds the core and runs [an executable offline-edit example](examples/reconciliation.mjs) with assertions. From another workspace package, depend on `@replicalab/core` using `workspace:*` and import its public API:

```ts
import { Replica } from '@replicalab/core';

const laptop = new Replica('laptop');
const phone = new Replica('phone');
laptop.set('title', 'Laptop draft');
phone.set('title', 'Phone draft');

// The transport delivers records; the core owns their application.
for (const operation of laptop.missingOperations(phone.knownOperationIds())) {
  phone.receive(operation);
}
for (const operation of phone.missingOperations(laptop.knownOperationIds())) {
  laptop.receive(operation);
}
// Both show "Phone draft": equal logical timestamps, then replica-ID ordering.
```

Use `get(key)` or `state()` for visible values, `winner(key)` for the winning operation (including tombstones), and `history(key?)` to inspect every accepted operation. Receiving an operation reports `applied`, `superseded` or `duplicate`.

## Try the network simulator

`pnpm demo:network` runs eight real scenarios with convergence assertions: normal synchronisation, offline recovery, concurrent edits, delayed delivery, duplicate delivery, out-of-order delivery, deletion versus a stale update, and partition recovery.

```ts
import { Replica } from '@replicalab/core';
import { Simulation } from '@replicalab/simulator';

const replicas = ['a', 'b', 'c'].map((id) => new Replica(id));
const sim = new Simulation(replicas, {
  seed: 42,
  retryInterval: 100,
  conditions: { latency: 10, jitter: 20, loss: 0.2, duplication: 0.1 },
});
sim.setConnected('c', false);
sim.set('c', 'title', 'Offline edit');
sim.advanceBy(200);
sim.network.configure({ loss: 0 });
sim.setConnected('c', true);
sim.advanceBy(200);
// Inspect sim.converged, sim.events(), and the actual replicas.
```

Time advances only through `advanceBy` or `step`; there are no real timers. See the [simulator contract](docs/simulator.md) for fault semantics, retry behaviour and limits.

## Architecture

```mermaid
flowchart LR
  Playground[React playground · planned] --> Simulator[Network simulator]
  Playground --> Core[Replication core]
  Simulator --> Core
```

- `packages/core`: transport-independent operation and replica logic.
- `packages/simulator`: deterministic scheduler, packet transport, recovery and scenarios.
- `apps/playground`: planned React/Vite interface.

See [architecture](docs/architecture.md), [synchronisation](docs/synchronisation.md), [roadmap](docs/roadmap.md) and [contributing](CONTRIBUTING.md).

## Current limitations

State is memory-only. Replica IDs must be unique and must not be reused after losing state. Full history and event logs are retained without compaction, and reconciliation exchanges exact ID lists. Neither layer authenticates peers or detects causal concurrency. The simulator uses local message queues, not real networking. Numeric clocks stop with an error at JavaScript's safe-integer limit. See the design documents for detailed contracts and costs.

Next is Milestone 3: the React/Vite playground, subject to the next scope instruction. IndexedDB follows in Milestone 4. No playground work has started.

## License

[MIT](LICENSE).
