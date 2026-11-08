# Security

ReplicaLab is an educational local simulator, not a secure multi-user database. It has no server, authentication, encryption layer or real peer transport. Do not use it to store credentials or sensitive personal information. Browser IndexedDB is accessible to scripts running on the same origin and is not a backup.

## Reporting a problem

Use GitHub's **Report a vulnerability** option in this repository's Security tab if private vulnerability reporting has been enabled. If that option is unavailable, open an issue asking the maintainer for a private reporting channel without including exploit details, credentials or private data. No response-time commitment or dedicated security inbox is currently advertised.

Reports should identify the affected revision, browser/Node version, impact and minimal reproduction. Do not post real secrets or another person's saved lab. Redact tokens, browser profiles and personal data from screenshots and logs.

## Boundaries

- Core input validation protects operation invariants; it is not authentication, authorization or Byzantine agreement.
- Storage checkpoints are validated, saved atomically and protected against stale writers. This does not make separate browser tabs collaborative or prevent an origin's own scripts from modifying storage.
- No analytics, external fonts or runtime API clients are included. Static hosting still receives ordinary page and asset requests and may log them.
- Reset and scenario replacement intentionally replace the saved lab. Browser quota, eviction and deletion can remove it.
- Third-party dependencies and CI actions are part of the supply chain. Install the frozen lockfile and review dependency updates. Actions are pinned; deployment is an explicit manual job with scoped permissions.

## Release review

Run `pnpm release:check` and `pnpm audit`, then inspect the diff and Git history metadata. The repository scanner checks selected credential formats and disallowed tracked paths; it cannot prove all secrets absent. If a real credential is found, revoke it first and coordinate any history cleanup with the owner. Never rewrite history automatically.

Only the current development line is maintained. Older snapshots have no promised security support. See the [release review](docs/release-review.md) for the dated checks and outstanding publication steps.
