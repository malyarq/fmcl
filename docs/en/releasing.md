# Release runbook

FriendLauncher releases use immutable SemVer tags and a dispatch-only GitHub workflow. An RC is a prerelease and is never made `latest` by the workflow. A local command can prepare evidence or, with a separate explicit local decision, create a tag; it cannot authorize publication.

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
npx electron-builder --publish never --mac --win --linux
npm run release -- <version> --dry-run
```

The first command prepares the three expected artifacts under `release/<version>` without publishing them. Use native platform runners when cross-building is unavailable. The dry run then uses the Node 24 shared release profile, runs available package smoke, writes checksums and release evidence, creates a schema-valid pre-push report, and validates that report against the exact version, tag, current commit, and prepared artifacts. It creates no commit, tag, push, remote operation, or GitHub Release. The report is normally written to `quality/evidence/prepush-release-report.json`; this ignored local file must be regenerated after any candidate commit or artifact changes.

## Review the evidence

Review the pre-push report before asking for any release action. It names the exact version/tag/commit, every quality stage, artifact paths and SHA-256 checksums, platform smoke with unsupported-runner reasons, signing/notarization status, known failures, and the immutable rollback action.

Checksums establish artifact integrity only. The local report is decision evidence, not a security boundary, publisher-authentication proof, or publication authorization. Current macOS and Windows artifacts are unsigned unless platform verification evidence says otherwise; never infer signing from a checksum or successful launch. Gatekeeper and SmartScreen prompts are OS/reputation behavior that must be checked manually on the target platform and recorded separately.

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

Repository code cannot create or guarantee those protection rules. With the candidate tag available, a maintainer starts **Build and Release** manually through `workflow_dispatch` and supplies that exact tag. The workflow independently checks out the tag, verifies version/commit identity, rebuilds and validates artifact, checksum, smoke, and schema-valid report evidence, then waits for the protected `release-publication` Environment before its only publish job. A tag push alone cannot start publication.

## Failure and rollback

- An RC stays a prerelease and non-latest until a separately approved stable process says otherwise.
- If evidence, smoke, or OS trust behavior fails, withdraw or mark the release non-latest where the host permits, investigate, and publish a new patch when ready.
- Never move or overwrite an existing stable tag or asset. Do not replace bytes under an existing version.
- Regenerate the report whenever the candidate commit or artifact set changes; an old report is intentionally rejected as stale.
