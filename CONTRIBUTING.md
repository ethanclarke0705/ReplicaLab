# Contributing

Use Node.js 24 and the pnpm version pinned in `package.json`. Install with `pnpm install --frozen-lockfile`. Read [AGENTS.md](AGENTS.md) and the design documents before changing protocol semantics.

Keep changes focused. Add regression tests and update documentation when behaviour changes. Tests use deterministic seeds; preserve the seed and failure path when reporting a fast-check counterexample.

Run `pnpm check`, inspect `git diff`, and commit related source, tests and documentation together. Use Conventional Commits such as `feat(core): add operation deduplication`. Do not commit generated output or credentials. Publishing and pushing require the repository owner's approval.

## Changes and pull requests

Explain the concrete problem, the resulting behaviour and how you verified it. For protocol changes, include a deterministic regression test and consider the generated-history properties. For persistence changes, cover malformed checkpoints, restoration, counter continuity and transaction failure. For UI changes, verify labels, keyboard interaction and narrow layouts against real engine behaviour.

Keep the core independent of browsers and the simulator. Avoid introducing backends, dependencies or new protocol features without a specific need. Include documentation changes when contracts or limits change. Report failures honestly; do not weaken assertions or suppress type errors to obtain a green check.

Before proposing a public release, stage intended files and run `pnpm release:check` and `pnpm audit`. Follow [the release guide](docs/releasing.md). CI is configured to perform release checks on Linux and Windows, but an unpushed local change has no hosted CI result yet.

For bugs, include the revision, environment, steps, seed, expected result and observed result. Use a minimal synthetic lab rather than sharing personal data. Follow [SECURITY.md](SECURITY.md) for potentially sensitive reports.
