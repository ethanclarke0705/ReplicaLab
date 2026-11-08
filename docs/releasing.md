# Release and demo deployment

Milestone 5 prepares the repository and deployable static demo. It does not publish a release, push Git commits, change repository visibility, enable Pages or deploy a site. Perform those actions only after the owner authorizes them.

## Local release checks

Use Node.js 24 and pnpm 11.25.0 from a clean checkout:

```sh
pnpm install --frozen-lockfile
pnpm release:check
pnpm audit
pnpm peers check
```

`release:check` includes formatting, ESLint, strict TypeScript, Vitest, the Node tooling test, builds, static-file checks, repository/history signature scanning, local Markdown links and all three built-ESM examples. `check:repo` scans tracked working files and all locally reachable history; stage intended new files before running it. It is a bounded signature scan, not proof that every possible secret is absent. Review new images, configuration, Git metadata and the complete diff as well.

Validate workflow edits with [actionlint](https://github.com/rhysd/actionlint). Actions are pinned to full commit hashes; their major versions are comments. Dependabot is configured to propose monthly Action updates, not merge them. A documented minimatch override fixes GHSA-g3hv-75wg-m249 in the development lint toolchain; reconsider it when upstream dependencies require a patched version.

## Preview the actual artifact

```sh
pnpm preview --base /ReplicaLab/ --port 4173 --strictPort
```

Open `http://127.0.0.1:4173/ReplicaLab/`. Exercise a scenario and event details, make an offline edit, wait for the saved indicator, reload and reconnect. Check a narrow viewport and the browser console. Stop the preview with Ctrl+C afterward.

The artifact is **only** `apps/playground/dist/`. Do not upload the repository, local `output/`, environment files, source dependencies or IndexedDB data. `pnpm demo:check` verifies relative entry assets, file presence, a static-file allowlist and prints SHA-256 hashes. The app uses hash anchors rather than client-side routes, so no SPA fallback or server runtime is required. Serve the directory over HTTPS on a public host; `vite preview` is a local verification server, not the public hosting service.

Relative URLs use Vite's [relative base](https://vite.dev/guide/build#relative-base). Keep the trailing slash on the project URL. Root hosting and other project subpaths can use the same artifact. Changing scheme, host or port creates a different IndexedDB origin; paths on the same origin share its database. Avoid hosting multiple independent ReplicaLab installations on the same origin without changing the database name.

The build writes `NOTICE.txt` into the artifact using the project license and installed React, React DOM and Scheduler licenses and versions. Keep that file with the distributed assets. Reassess runtime notices when adding or replacing bundled dependencies.

## GitHub Pages: later, with authorization

The workflow at `.github/workflows/pages.yml` has no push, PR or release trigger. Both jobs are restricted to `main`; `publish` defaults to false. The build job runs the full release checks and advisory audit before uploading a Pages artifact retained for seven days. The deploy job runs only when the explicitly supplied boolean is true.

After authorization:

1. Push the reviewed commits, then wait for the Linux and Windows CI jobs to pass. The workflow must exist on the default branch before it can be dispatched.
2. In repository Settings → Pages, choose **GitHub Actions** as the publishing source. The workflow does not enable Pages or change repository visibility for you.
3. Configure the `github-pages` environment to allow `main` only. Add required reviewers where the repository plan supports them. These settings are external to the workflow and have not been changed by local preparation.
4. Run **Demo artifact and optional Pages deployment** on `main` with publishing unchecked. Inspect the run's commit SHA, checks and artifact. This builds but does not deploy.
5. Once that exact revision is approved, run it on `main` with **Publish the verified demo to GitHub Pages** checked. Confirm `main` still points to the approved SHA. The workflow rebuilds and verifies the selected revision before deployment.
6. Use the URL returned by the deployment job; do not advertise an assumed URL before it succeeds. Verify the deployed page, assets, interaction and storage from that origin.

The deployment job alone receives `pages: write` and `id-token: write`. There is no personal access token or custom cloud credential. The `github-pages` environment can provide an additional approval boundary. See [GitHub's custom Pages workflow requirements](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Versioning and release notes

All workspace packages currently carry version `0.1.0` and remain `private: true`. Keep that protection; npm publication is out of scope. `CHANGELOG.md` holds an Unreleased draft, not an assertion that a release exists.

Before an authorized release, confirm the version, date, scope, successful CI run and demo status; promote the appropriate changelog section. Review commit author email visibility and the MIT attribution. Then create the agreed annotated tag and GitHub release against the reviewed commit, only with permission to do so. No tag or release is created automatically by these workflows.

## Rollback and storage compatibility

If a deployed regression appears, stop promoting changes. Prepare a reviewed revert or fix on `main`, rerun the checks and dispatch a new deployment after authorization. Do not force-push history to roll back a demo. There is no automatic rollback policy.

IndexedDB version 1 is the first durable schema. A future release that changes it needs explicit migration tests and backward-compatibility review. Do not roll back across an incompatible storage schema without a data plan: older code rejects a newer database instead of deleting it. Never ask users to clear their browser storage as an unexplained routine deployment step.
