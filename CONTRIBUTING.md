# Contributing

Use Node.js 24 and the pnpm version pinned in `package.json`. Install with `pnpm install --frozen-lockfile`. Read [AGENTS.md](AGENTS.md) and the design documents before changing protocol semantics.

Keep changes focused. Add regression tests and update documentation when behaviour changes. Tests use deterministic seeds; preserve the seed and failure path when reporting a fast-check counterexample.

Run `pnpm check`, inspect `git diff`, and commit related source, tests and documentation together. Use Conventional Commits such as `feat(core): add operation deduplication`. Do not commit generated output or credentials. Publishing and pushing require the repository owner's approval.
