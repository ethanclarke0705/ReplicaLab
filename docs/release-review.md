# Release review — 2026-11-08

Scope: prepare the first public release and deployable demo, followed by the owner-authorized push and GitHub Pages deployment. Milestones 0-5 are complete; v0.1.0 is the first GitHub release; packages remain private and unpublished to npm.

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
- The README now starts with runnable setup, a real screenshot and an experiment walkthrough. Architecture and recovery diagrams, trade-offs, a restoration example, changelog, security guidance and release/rollback steps are included.
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

## Dependabot follow-up and latest deployment - 2026-11-08

All five Dependabot PRs are merged. They change only pinned action references in the CI and Pages workflows; application code, package dependencies and the lockfile are unchanged.

| PR                                                         | Action                          | Reviewed update                                                                                            |
| ---------------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [#1](https://github.com/ethanclarke0705/ReplicaLab/pull/1) | `actions/checkout`              | 6.1.0 to 7.0.1; the new fork-checkout safeguards are compatible with the existing triggers                 |
| [#2](https://github.com/ethanclarke0705/ReplicaLab/pull/2) | `actions/deploy-pages`          | 4.0.5 to 5.0.1; Node 24 runtime and deployment polling updates                                             |
| [#3](https://github.com/ethanclarke0705/ReplicaLab/pull/3) | `pnpm/action-setup`             | Pin the underlying v4 commit directly instead of its annotated-tag object                                  |
| [#4](https://github.com/ethanclarke0705/ReplicaLab/pull/4) | `actions/setup-node`            | 6.5.0 to 7.1.0; ESM migration and token-fallback change do not affect the configured Node 24/pnpm workflow |
| [#5](https://github.com/ethanclarke0705/ReplicaLab/pull/5) | `actions/upload-pages-artifact` | 4.0.0 to 5.0.0; updated artifact uploader, with hidden files still excluded by default                     |

PR #3 was initially held because GitHub's commit-comparison endpoint could not resolve the old pin. Investigation confirmed that `f40ffcd9367d9f12939873eb1018b921a783ffaa` is a signed [annotated v4 tag object](https://api.github.com/repos/pnpm/action-setup/git/tags/f40ffcd9367d9f12939873eb1018b921a783ffaa) pointing to the signed commit `b906affcce14559ad1aafd4ab0e942779e9f58b1`. All 30 files in the two upstream source archives were byte-for-byte identical, including the runtime bundle. Both references already use Node 20 for the action runtime; this update does not downgrade it or change the project's Node 24 configuration. The rebased PR's Linux and Windows CI passed before merging.

The latest verified application deployment uses commit `1fe568db00f618307299ddbe2de61704490df4a2`, which includes all five updates:

- [Post-merge CI passed on Linux and Windows](https://github.com/ethanclarke0705/ReplicaLab/actions/runs/42495952631), including the full release checks; the Linux dependency audit passed.
- [Pages build and deployment passed](https://github.com/ethanclarke0705/ReplicaLab/actions/runs/42496240216), exercising the direct pnpm commit pin, release checks, dependency audit, artifact upload and updated deployment action end to end.
- The public page, JavaScript, CSS, favicon and license notice returned HTTP 200 with appropriate content types.
- In the live browser, the concurrent-edit scenario converged to Draft C, saved replicas survived reload, and no console warnings or errors were recorded. A subsequent status check again confirmed restored, converged replicas and healthy assets.

No Dependabot PRs remained open at verification time. All workspace packages remain private, and nothing was published to npm. The v0.1.0 tag remains unchanged; these workflow updates are subsequent commits on `main`.

Publishing remains manually dispatched; pushing a commit does not deploy it. The first GitHub release is v0.1.0. npm publication remains out of scope.

The browser checks are focused functional/layout checks, not a comprehensive accessibility audit or cross-browser certification. IndexedDB schema migration beyond version 1 is unimplemented. Full histories and whole-checkpoint writes remain intended for small demonstrations.

Follow [the release guide](releasing.md) for subsequent deployments and any separately authorized release tag.
