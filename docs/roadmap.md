# Roadmap

| Milestone | Scope                                                 | Status   |
| --------- | ----------------------------------------------------- | -------- |
| 0         | Workspace, standards, documentation and CI            | Complete |
| 1         | Headless replication engine and correctness tests     | Complete |
| 2         | Deterministic network simulation and recovery retries | Complete |
| 3         | Accessible React/Vite playground and real scenarios   | Complete |
| 4         | IndexedDB identity, counters and history restoration  | Complete |
| 5         | Screenshots, deployable demo and release review       | Complete |

Milestone 5 is complete. Hosted CI passes on Linux and Windows, and the [public demo](https://ethanclarke0705.github.io/ReplicaLab/) is deployed and verified. Deployments remain manual. The first GitHub release is v0.1.0; npm publication remains out of scope. See the [release review](release-review.md) and [release guide](releasing.md).

WebSockets, alternative resolution policies, CRDTs, benchmarks and npm publication are future considerations, not initial MVP requirements.
