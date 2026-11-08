# Deterministic network simulator

Milestone 2 provides a headless local simulation, not a network server. The core's algorithms are unchanged. `Transport` knows addresses and packets; `Simulation` connects it to replicas through the public `ReplicaEndpoint` interface. Tests include an adapter object to verify that delivery invokes that interface only when the packet arrives.

## Time and reproducibility

Time is nonnegative, integer simulated milliseconds, separate from replica Lamport clocks. `advanceBy(duration, maxEvents = 100000)` processes deadlines up to and including its target; `step()` processes exactly one scheduled task. Equal deadlines use insertion order, including callbacks that enqueue more work for the current instant. Callbacks may schedule work but cannot recursively advance time. A thrown handler leaves time at that event and propagates the error; later queued tasks remain available.

Each simulation schedules recurring anti-entropy work. There is deliberately no unbounded “drain until empty” method. Exhausting the event budget throws while retaining the next event and current time, allowing a caller to resume with an appropriate bounded advance. Simulation work stops whenever the caller stops advancing time; no wall-clock timers or background processes exist.

Mulberry32 accepts any unsigned 32-bit seed, including zero. The same seed, initial replicas, options and command sequence reproduce the event trace. Replica iteration is sorted by ID. A seed alone does not describe edits or network configuration changes: retain the command sequence too. Fault randomness is not cryptographically secure. Reset by constructing fresh replicas and a new simulation (or rerunning a scenario).

## Packet and fault semantics

| Control                   | Behaviour                                                                                                         |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `latency`                 | Minimum delay in simulated milliseconds; default 10.                                                              |
| `jitter`                  | Adds a uniformly sampled integer from 0 through this value; default 0. Different delays allow natural reordering. |
| `loss`                    | Per-copy drop probability from 0 to 1; default 0.                                                                 |
| `duplication`             | Probability of one extra copy per send, never recursive duplication; default 0.                                   |
| `setConnected(id, false)` | Isolates one device in both directions. Local editing remains available.                                          |
| `setLink(a, b, false)`    | Disables that bidirectional link. Other routes may still carry forwarded operations.                              |

All durations and their sums must fit safe integers. Configuration is validated before replacing the previous configuration. Changes affect future sends, not packets already scheduled. Each duplicate copy has its own ID, loss decision and delay. Zero latency is allowed; zero retry intervals are rejected.

`network.send(from, to, payload, options)` supports explicit `delay`, `drop` and `duplicate` overrides for deterministic fault injection. `Simulation.set` and `delete` accept the same options for their initial broadcasts. An explicit delay applies to both copies; without it, copies sample separate delays. Overrides never bypass connectivity. Invalid delivery options are rejected before a local edit is created. Operation and summary payloads are copied and frozen on send.

Sending over a broken route drops the packet immediately. For queued packets, endpoint/link epochs detect any intervening connectivity change: a disconnect followed by reconnect before the delivery deadline still discards that packet. The drop is recorded when its deadline is processed. This models interrupted in-flight transmission; recovery must retransmit. Unrelated link changes do not affect that route.

Use `simulation.setConnected` and `simulation.setLink` for connectivity changes that also initiate recovery. The lower-level transport controls only packet connectivity; its changes still recover through the next periodic round. `network.pending()` returns a detached array of queued packets; `queued` events contain their deadlines.

## Reconciliation and recovery

Local writes immediately enqueue an operation broadcast to all other replicas. No recipient changes until delivery. Each periodic round (default 100 simulated ms) sends each replica's exact known-ID summary to every other replica. Receiving a summary asks the recipient's public `missingOperations` API which records the sender lacks, then sends each missing record back as an operation packet.

Both summaries and operation responses experience latency, duplication, loss and partitions. There is no direct cross-replica state copy and no reliable side channel. `synchronise()` requests a round immediately; reconnection requests one too. Periodic rounds continue even after convergence, so lost requests, lost responses and later edits can recover. Stale summaries can produce duplicate responses, handled by core deduplication. The protocol is pull-based; learned operations can reach another device in a later round, even without a direct link to their origin.

Recovery requires eventual successful delivery across a connected communication graph and enough simulated time for the necessary rounds and responses. A finite time bound is not promised under ongoing probabilistic loss. Permanent partitions or 100% loss can prevent convergence indefinitely. Tests explicitly retain divergence under partitions, then end loss and restore links before asserting recovery.

## Inspection and events

`events()` provides a chronological snapshot with monotonically increasing event indices and simulated times. Events include local operations, packet sends/queues/deliveries/drops/duplication, connectivity changes, reconciliation rounds, core receive results, rejected operations, and convergence transitions. Each packet includes its immutable payload; receive results expose the winning operation and `applied`, `superseded` or `duplicate` status. “Superseded” is not proof of causal concurrency.

`converged` compares complete operation histories across all registered replicas, including disconnected ones. It is stronger than checking only visible values and does not require equal Lamport clocks. The initial empty histories are converged; a local edit may change that immediately. Checking histories is observation only and is never used to bypass packet delivery. Make edits through `Simulation` to capture local events and initial broadcasts. Direct edits through a replica will be discovered by later reconciliation, but do not automatically produce a local simulation event.

Core `TypeError` and `RangeError` receive failures are recorded as rejected packets without mutating other replicas or stopping later valid deliveries. Unexpected exceptions propagate. Custom endpoints must honour the core's immutable, canonical operation contract and stable unique identities. Validation is not authentication.

## Scenarios and verification

Run `pnpm demo:network` for eight scenarios: normal, offline recovery, concurrent edits, delayed delivery, duplicate delivery, out-of-order delivery, deletion versus a stale update, and partition recovery. `runScenario(name, seed)` creates new replicas and returns their actual simulation and final states. These examples execute real engine operations and packet scheduling; their outcomes are verified rather than assigned. The return value can be advanced further.

Tests cover scheduler ordering and bounds, seeded replay, latency, loss, duplicates, jitter-based reordering, node/link isolation, in-flight interruption, public-interface delivery, rejected records, loss of requests and responses, forwarding, and tombstones. A fast-check integration property uses seed `220026` for 100 generated histories with partitioned devices and packet faults, followed by healed links and successful reconciliation. The eight scenarios also have deterministic replay and semantic assertions. CI runs all tests and both built ESM examples.

## Current limits

Everything is memory-only. Events and core histories grow without compaction. The simple sorted-array scheduler is intended for small demonstrations, not throughput benchmarks. Reconciliation sends O(r²) summaries per round for r replicas, with full ID lists; convergence inspection compares complete histories. No bandwidth model, backpressure, adaptive retry/backoff, dynamic endpoint removal, real sockets or durable restoration is implemented. Network partitions are bidirectional, while loss is sampled independently per packet. The [playground](playground.md) exposes these real simulation controls and events.
