# Release runbook

Stable releases use immutable SemVer tags (`vMAJOR.MINOR.PATCH`) and GitHub Releases. The moving `latest` tag is only a convenience pointer to the newest stable release.

## Before tagging

1. Start from a clean, current `main` and confirm its CI run is green.
2. Review [Known Issues](known-issues.md), update version-specific roadmap/contract snapshots, and move user-visible changes into [CHANGELOG.md](../../CHANGELOG.md).
3. For UI changes, run the visual closeout and inspect the screenshots.
4. For installer, updater, Java, or modloader changes, run the relevant bounded manual or full-install checks.
5. Choose a version that has never been tagged.

```bash
git switch main
git pull --ff-only origin main
nvm use
npm ci
npm run release -- <version> --dry-run
```

The dry run runs `verify` and a full local package build. It does not change tracked files, commits, tags, or remotes, but it refreshes ignored build output.

## Create and publish

The release helper requires a clean worktree, an active branch, a valid new SemVer version, and an absent version tag. It updates `package.json` and `package-lock.json`, creates one commit, and creates an annotated tag.

```bash
npm run release -- <version> "chore: release v<version>" --push
```

`--push` pushes the current branch and the immutable version tag. The tag starts `.github/workflows/release.yml`, which:

- validates the version and runs tests, lint, type checks, documentation/IPC contract checks, dependency audit, and a Linux packaging smoke test;
- builds unsigned Windows, macOS, and Linux packages on native runners;
- publishes one GitHub Release only after all platform builds succeed;
- generates `SHA256SUMS.txt` and uploads updater metadata and blockmaps.

After the release workflow succeeds, move the convenience tag:

```bash
git tag -f latest 'v<version>^{}'
git push origin :refs/tags/latest
git push origin latest
```

Then verify the [release page](https://github.com/malyarq/fmcl/releases/latest), all three installers, checksums, release notes, and the `latest` tag target.

## Manual workflow dispatch

Use `workflow_dispatch` only to rerun packaging for an **existing immutable version tag** after an infrastructure failure. Enter the full tag, such as `v0.8.0`. Do not use it to invent a release from an arbitrary `main` commit.

## Failure and rollback

- Before pushing a tag, fix the issue locally and rerun the dry run.
- After pushing a tag, do not move, overwrite, or rebuild that SemVer tag with different source.
- If publishing failed before a GitHub Release appeared, fix the workflow and rerun it for the same source tag.
- If shipped behavior is broken, publish a new patch release. Do not silently replace assets under an existing version.
- If an asset checksum does not match, treat the release as compromised: remove it from `latest`, warn users, investigate, and publish a new patch version.

Signing is not configured yet. Never claim that an unsigned artifact is signed, and never bypass the checksum step.
