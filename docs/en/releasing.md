# Release runbook

FriendLauncher releases use a tag-last, dispatch-only GitHub workflow. A protected publication job creates the immutable annotated SemVer tag only after source checks, native builds, package smoke, checksums, and downloaded-artifact evidence pass. A prerelease version is published as non-latest; a normal `MAJOR.MINOR.PATCH` version becomes the latest stable release.

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

Review the pre-push report before asking for any release action. It names the exact version/proposed tag/commit, every quality stage, artifact paths and SHA-256 checksums, platform smoke with unsupported-runner reasons, signing/notarization status, known failures, and the immutable rollback action.

Checksums establish artifact integrity only. The local report is decision evidence, not a security boundary, publisher-authentication proof, or publication authorization. Current macOS DMGs and Windows artifacts are not publisher-signed unless platform verification evidence says otherwise. A local ad-hoc macOS app signature proves neither publisher identity nor notarization; never infer either from a checksum or successful launch. Gatekeeper and SmartScreen prompts are OS/reputation behavior that must be checked manually on the target platform and recorded separately.

## Dispatch publication

The local helper is evidence-only and never creates or pushes a tag. Commit the prepared version to `main`, confirm the exact commit, then dispatch the workflow with that version and commit:

```bash
COMMIT=$(git rev-parse HEAD)
gh workflow run release.yml -f version=<version> -f commit="$COMMIT"
```

The workflow rejects a commit that is no longer the exact `origin/main`, a mismatched `package.json` version, an existing tag, or an existing GitHub Release. Do not create the release tag locally first.

Before dispatching publication, a repository administrator must configure **Settings → Environments → `release-publication`**:

1. Add required reviewers.
2. Restrict deployments to the approved release refs.
3. Verify that the configured gate applies to the `publish` job.

Official release builds also require these GitHub repository variables:

- `POSTHOG_PROJECT_TOKEN` — the public project token from the PostHog EU project;
- `POSTHOG_HOST` — optional; leave empty to use `https://eu.i.posthog.com`.

Before the first release, open PostHog **Settings → Project → General**, disable IP data capture, keep person profiles unused, and confirm retention does not exceed 12 months. The workflow refuses to package without the project token, but hosted privacy settings require a manual owner check.

Repository code cannot create or guarantee those protection rules. A maintainer starts **Build and Release** manually through `workflow_dispatch` and supplies the committed version plus the exact 40-character `main` commit. The workflow independently checks out that commit, downloads the previous published package on each native runner, verifies an in-place upgrade with preserved user data and the rendered candidate version, then validates artifacts, checksums, smoke, and schema-valid evidence. It waits for the protected `release-publication` Environment before creating anything public. Only that job creates the annotated tag and GitHub Release. Stable releases move the mutable `latest` tag only after GitHub publication succeeds. Release notes come from every `CHANGELOG.md` entry since the previous published stable release, so an abandoned tag cannot hide shipped changes.

If asset upload fails before publication, the workflow removes its draft and newly created tag. After publication, repository immutability wins: the tag and assets are preserved and any follow-up failure must be fixed with a new patch release.

## Failure and rollback

- Prerelease tags stay non-latest; stable tags become latest only through the same protected publication job.
- If evidence, smoke, or OS trust behavior fails, withdraw or mark the release non-latest where the host permits, investigate, and publish a new patch when ready.
- Never move or overwrite an existing stable tag or asset. Do not replace bytes under an existing version.
- Regenerate the report whenever the candidate commit or artifact set changes; an old report is intentionally rejected as stale.
