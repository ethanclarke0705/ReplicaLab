# Contributing

Use Node.js 24 and the pnpm version pinned in `package.json`. Install with `pnpm install --frozen-lockfile`. Read [AGENTS.md](AGENTS.md) and the design documents before changing protocol semantics.

Keep changes focused. Add regression tests and update documentation when behaviour changes. Tests use deterministic seeds; preserve the seed and failure path when reporting a fast-check counterexample.

Run `pnpm check`, inspect `git diff`, and commit related source, tests and documentation together. Use Conventional Commits such as `feat(core): add operation deduplication`. Do not commit generated output or credentials. Publishing and pushing require the repository owner's approval.

## Browser regression tests

Install Chromium once with `pnpm exec playwright install chromium` (on Linux, use `--with-deps` to install system libraries too). Run `pnpm test:browser` to build the real production playground and test it at `http://127.0.0.1:4178/ReplicaLab/`. Port 4178 must be free: the suite refuses to reuse an existing server, then stops its own preview server on completion.

The four Chromium tests cover offline isolation, IndexedDB reload recovery with counter continuity, reconnection convergence and losing-operation inspection. Each test uses a fresh browser context and real engine, simulator and storage; simulated time advances through the UI without fixed sleeps. These are functional regressions, not a complete accessibility or cross-browser audit.

CI runs the same tests on Linux and Windows after the release checks build the app. Browser tests are separate from `pnpm check` so local unit checks do not require downloaded browsers. For UI or persistence changes, run both. Failures retain screenshots, traces and an HTML report under ignored `output/browser/`; CI uploads that directory for seven days. View the report with `pnpm exec playwright show-report output/browser/report`. Review diagnostics for sensitive test data before sharing them.

## Changes and pull requests

Explain the concrete problem, the resulting behaviour and how you verified it. For protocol changes, include a deterministic regression test and consider the generated-history properties. For persistence changes, cover malformed checkpoints, restoration, counter continuity and transaction failure. For UI changes, verify labels, keyboard interaction and narrow layouts against real engine behaviour.

Keep the core independent of browsers and the simulator. Avoid introducing backends, dependencies or new protocol features without a specific need. Include documentation changes when contracts or limits change. Report failures honestly; do not weaken assertions or suppress type errors to obtain a green check.

Before proposing a public release, stage intended files and run `pnpm release:check` and `pnpm audit`. Follow [the release guide](docs/releasing.md). CI is configured to perform release checks on Linux and Windows, but an unpushed local change has no hosted CI result yet.

For bugs, include the revision, environment, steps, seed, expected result and observed result. Use a minimal synthetic lab rather than sharing personal data. Follow [SECURITY.md](SECURITY.md) for potentially sensitive reports.
