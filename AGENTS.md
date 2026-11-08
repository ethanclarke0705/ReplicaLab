# ReplicaLab engineering instructions

- Build an accurate, inspectable distributed key-value synchronisation engine and playground.
- Keep `packages/core` independent of browsers, React, timers and simulator code. Future simulator code consumes only public engine APIs; the playground composes those layers.
- Use strict TypeScript, explicit contracts, deterministic algorithms and focused modules. Do not suppress type errors or add runtime dependencies without a concrete need.
- Include deterministic unit tests and seeded fast-check properties with changes to replication semantics. Test tombstones, duplicate and reordered delivery, convergence and clock rules.
- Run relevant tests during development and `pnpm check` before finishing a milestone. Never weaken assertions to conceal a failure.
- Review the diff, stage only related files, then create a self-contained Conventional Commit: `type(scope): description`. Include the tests with their implementation. Never rewrite history or push without explicit approval.
- Keep README and algorithm/architecture docs accurate. Separate implemented capabilities from plans and state the assumptions behind correctness claims.
- Current authorised scope includes Milestone 2: deterministic network simulation, faults, recovery and reproducible scenarios. Stop and report before implementing the playground (Milestone 3) or persistence (4). Do not push.
- No backend, authentication, cloud services, CRDTs or package publication in the initial scope. Do not commit credentials, environment files, build artifacts or temporary output.
- Use `output/` (ignored) or system temp for diagnostics. Report checks actually run, confirmed commit hashes, limitations and next steps at each milestone.
