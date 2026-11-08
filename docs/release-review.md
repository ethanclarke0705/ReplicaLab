# Release review — 2026-11-08

Scope: prepare the first public release and deployable demo, followed by the owner-authorized push and GitHub Pages deployment. Milestones 0-5 are complete; no release tag or npm package has been published.

## Reviewed results

| Area                  | Result                                                                                                                            |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Correctness           | 122 Vitest tests covering core, generated histories, simulator, storage and UI flows                                              |
| Release tooling       | Node regression test verifies rejection of missing/root-only assets and accidental private artifact files                         |
| Builds                | Strict core/app type checks and all three package builds pass on Node 24                                                          |
| Examples              | Offline reconciliation, all eight network scenarios and checkpoint restoration run against built ESM with assertions              |
| Static hosting        | Five-file artifact checked for root and project-subpath hosting, including generated project and runtime license notices          |
| Browser               | Production bundle exercised at `/ReplicaLab/`; scenario resolution, event details and persisted reload verified                   |
| Layout                | Desktop 1440 px and mobile 390 px screenshots refreshed; mobile had no horizontal overflow                                        |
| Console               | No warning/error recorded in the verified release browser flow                                                                    |
| Workflows             | actionlint 1.7.12 passes; official action tags resolved and pinned to immutable hashes                                            |
| Dependency advisories | `pnpm audit` reports no known vulnerabilities after the minimatch fix; peer checks pass                                           |
| Repository hygiene    | Tracked files, local Markdown links and reachable historical blobs scanned for configured credential signatures; no matches found |

## Findings and decisions

An independent local checkout passed `pnpm install --offline --frozen-lockfile` and `pnpm release:check` without relying on the original checkout's installed packages or build output. The subsequent license-notice build and final documentation checks were verified in the primary checkout.

- The initial audit found [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) in development-only minimatch 10.2.6. Upstream lint versions were already current. A documented override selects patched 11.0.1; lint, types, tests and builds pass with it. The override should be reviewed when upstream requirements change.
- The README now starts with runnable setup, a real screenshot and an experiment walkthrough. Architecture and recovery diagrams, trade-offs, a restoration example, draft changelog, security guidance and release/rollback steps are included.
- CI is configured to run release checks on Linux and Windows with read-only repository permissions. The separate Pages workflow is manual only, defaults to build-only and grants publishing permissions only to its conditional deploy job.
- The app remains a static local simulator. No backend, analytics, remote data sync, credentials or npm publication were introduced.
- New screenshots contain synthetic demonstration data. No environment file, generated bundle or local diagnostics are tracked. The scan is deliberately bounded: it does not prove the absence of every possible credential or sensitive value, and binaries require visual review.
- Existing Git author metadata contains a personal email rather than a GitHub no-reply address. History was pushed with owner authorization. No author identity or history was rewritten.

## Hosted verification - 2026-11-08

The initial deployment used commit `5f47cd7eb30eb043c170007839be386c82009f83`:

- [CI passed on Linux and Windows](https://github.com/ethanclarke0705/ReplicaLab/actions/runs/42490908221), including 122 Vitest tests, one Node tooling test, builds, repository checks and executable examples. The Linux dependency audit reported no known vulnerabilities.
- [Build-only Pages run passed](https://github.com/ethanclarke0705/ReplicaLab/actions/runs/42491055043), uploaded the artifact and correctly skipped deployment.
- [Pages publishing run passed](https://github.com/ethanclarke0705/ReplicaLab/actions/runs/42491157328). Pages uses GitHub Actions, HTTPS is enforced and the deployment environment allows only `main`.
- The [live demo](https://ethanclarke0705.github.io/ReplicaLab/) and all four referenced/distributed assets returned HTTP 200 with appropriate content types.
- On the public origin, an offline edit survived reload with replica identity, counters and connectivity intact; reconnection and simulated delivery converged. The concurrent-edit scenario and superseded-operation inspector worked. A 390 px viewport had no horizontal overflow.

Publishing remains manually dispatched; pushing a commit does not deploy it. Release tags, GitHub releases and npm publication have not been performed.

The browser checks are focused functional/layout checks, not a comprehensive accessibility audit or cross-browser certification. IndexedDB schema migration beyond version 1 is unimplemented. Full histories and whole-checkpoint writes remain intended for small demonstrations.

Follow [the release guide](releasing.md) for subsequent deployments and any separately authorized release tag.
