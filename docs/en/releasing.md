# Release runbook

FriendLauncher releases use immutable SemVer tags and a dispatch-only GitHub workflow. A tag with a SemVer prerelease suffix is published as a non-latest prerelease; a normal `vMAJOR.MINOR.PATCH` tag is published as the latest stable release. A local command can prepare evidence or, with a separate explicit local decision, create a tag; it cannot authorize publication.

## Prepare an exact candidate

Start on a clean branch. The candidate version is committed before any release report is generated; the release helper never runs `npm version` for you.

```bash
nvm use
npm ci
npm version <version> --no-git-tag-version --ignore-scripts
git add package.json package-lock.json
git commit -m "chore: prepare v<version> candidate"
```

Confirm that `package.json` and `package-lock.json` contain the same version, the worktree is clean, and `v<version>` does not already exist. Then build local readiness evidence:

```bash
npm run build -- --publish never --mac --win --linux
npm run release -- <version> --dry-run
```

The first command prepares the three expected artifacts under `release/<version>` without publishing them. If cross-building is unavailable, build on native platform runners and collect the exact DMG, NSIS installer, and AppImage in that directory before the dry run; a missing or unhashed package is a hard failure, never `unsupported-runner` evidence. The dry run then uses the Node 24 shared release profile, runs available package smoke, writes checksums and release evidence, creates a schema-valid pre-push report, and validates that report against the exact version, tag, current commit, and prepared artifacts. It creates no commit, tag, push, remote operation, or GitHub Release. The report is normally written to `quality/evidence/prepush-release-report.json`; this ignored local file must be regenerated after any candidate commit or artifact changes.

## Review the evidence

Review the pre-push report before asking for any release action. It names the exact version/tag/commit, every quality stage, artifact paths and SHA-256 checksums, platform smoke with unsupported-runner reasons, signing/notarization status, known failures, and the immutable rollback action.

Checksums establish artifact integrity only. The local report is decision evidence, not a security boundary, publisher-authentication proof, or publication authorization. Current macOS DMGs and Windows artifacts are not publisher-signed unless platform verification evidence says otherwise. A local ad-hoc macOS app signature proves neither publisher identity nor notarization; never infer either from a checksum or successful launch. Gatekeeper and SmartScreen prompts are OS/reputation behavior that must be checked manually on the target platform and recorded separately.

## Tag and dispatch publication

After a maintainer separately approves the exact report, the helper can create the matching annotated local tag only when it is given both the report and the literal local approval value:

```bash
npm run release -- <version> --report quality/evidence/prepush-release-report.json --approval approve-local-release
```

`--push` remains a separate remote action and does not publish anything. The helper rejects an absent, invalid, stale, mismatched, or unapproved report before it can create a tag or push. Local approval authorizes neither GitHub publication nor a bypass of review.

Before dispatching publication, a repository administrator must configure **Settings → Environments → `release-publication`**:

1. Add required reviewers.
2. Restrict deployments to the approved release refs.
3. Verify that the configured gate applies to the `publish` job.

Official release builds also require these GitHub repository variables:

- `POSTHOG_PROJECT_TOKEN` — the public project token from the PostHog EU project;
- `POSTHOG_HOST` — optional; leave empty to use `https://eu.i.posthog.com`.

Before the first release, open PostHog **Settings → Project → General**, disable IP data capture, keep person profiles unused, and confirm retention does not exceed 12 months. The workflow refuses to package without the project token, but hosted privacy settings require a manual owner check.

Repository code cannot create or guarantee those protection rules. With the candidate tag available, a maintainer starts **Build and Release** manually through `workflow_dispatch` and supplies that exact tag. The workflow independently checks out the tag, verifies version/commit identity, rebuilds and validates artifact, checksum, smoke, and schema-valid report evidence, then waits for the protected `release-publication` Environment before its only publish job. A tag push alone cannot start publication.

## Failure and rollback

- Prerelease tags stay non-latest; stable tags become latest only through the same protected publication job.
- If evidence, smoke, or OS trust behavior fails, withdraw or mark the release non-latest where the host permits, investigate, and publish a new patch when ready.
- Never move or overwrite an existing stable tag or asset. Do not replace bytes under an existing version.
- Regenerate the report whenever the candidate commit or artifact set changes; an old report is intentionally rejected as stale.
