# Local release review — 2026-11-08

Scope: prepare the first public release and a deployable demo without pushing, deploying, tagging or publishing. Milestones 0–4 remain implemented; Milestone 5's local preparation is complete. Remote configuration and hosted execution are explicitly pending.

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
- Existing Git author metadata contains a personal email rather than a GitHub no-reply address. Review that privacy choice before making history public. No author identity or history was rewritten.

## Publication steps still pending

No hosted CI run has been claimed for these unpushed commits. Linux execution, the GitHub artifact upload and the actual Pages deployment must be verified after authorization. Pages settings, environment reviewers and branch protections are repository settings; local configuration does not enable them. There is no live demo URL or published release to advertise yet.

The browser checks are focused functional/layout checks, not a comprehensive accessibility audit or cross-browser certification. IndexedDB schema migration beyond version 1 is unimplemented. Full histories and whole-checkpoint writes remain intended for small demonstrations.

Follow [the release guide](releasing.md) for the authorized push, CI verification, Pages setup, publish step and eventual release tag. Do not treat this review as permission to perform them.
