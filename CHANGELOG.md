# Changelog

This file summarizes user-visible and operational changes. Git history remains the detailed record, and [GitHub Releases](https://github.com/malyarq/fmcl/releases) is the canonical source for downloadable artifacts.

## Unreleased

No changes after the local v0.8.0 candidate.

## [0.8.0] — 2026-08-05

### Changed

- Rebuilt instance ownership around one canonical control plane, composition root, typed renderer capabilities, and transactional operation engine.
- Replaced duplicate renderer contexts and workflow state with focused feature owners, deterministic recovery, and measured lazy boundaries.
- Split FriendTunnel, LAN discovery, and UPnP mapping into independently owned lifecycles with ordered shutdown and bounded diagnostics.
- Reorganized and synchronized the player, contributor, maintainer, architecture, security, testing, release, and historical documentation in English and Russian.
- Added explicit opt-in, personless product analytics with a reviewed event allowlist and an editable privacy-safe GitHub feedback report.
- Published the project under the MIT License.

### Reliability and security

- Added atomic, backup-aware, schema-versioned state; root-serialized journaling; cancellation; recovery; and fault-injection coverage for persistence and destructive operations.
- Enforced path-free renderer contracts, dependency direction, canonical construction, deleted-owner absence, privileged-loader denial, and path-keyed complexity ratchets.
- Hardened the release supply chain with allowlisted SHA-pinned Actions, annotated immutable tags, verified per-platform checksum manifests, and a verified-assets-only publish handoff.

### Performance and accessibility

- Added clean Node 24 production bundle budgets and representative median/p95 renderer performance gates.
- Added real Chromium keyboard, focus-return, semantic naming, computed contrast, EN/RU route, and dialog behavior checks.

### Release candidate

- Prepared unsigned Windows, macOS, and Linux packaging, native host smoke, explicit foreign-runner evidence, SHA-256 manifests, rollback rules, and a schema-valid exact-commit pre-push report.
- Added canonical Linux desktop identity and game category metadata so launchers associate the running window with the installed application entry.
- The stable candidate is prepared locally but is not tagged, pushed, or published until the maintainer approves the final report and the protected GitHub release Environment is configured.

## [0.7.1] — 2026-08-03

### Fixed

- Wait for the mod catalog filters to load before the initial search, preventing incomplete or stale results in the add-mod flow.
- Exclude electron-builder debug metadata from release uploads.

### Release

- Published Windows, macOS, and Linux packages with one `SHA256SUMS.txt` file.
- Refreshed visual regression baselines for the stable release.

## [0.7.0] — 2026-08-03

### Changed

- Hardened Electron windows, navigation, permissions, IPC validation, path boundaries, archive extraction, downloads, account storage, and updater behavior.
- Consolidated modpack and guided-content workflows, recovery states, settings controls, semantic themes, and renderer/main contracts.
- Updated the project to Node.js 24 and current Electron, React, TypeScript, Vite, Vitest, and packaging tooling.

### Release

- Added repeatable CI gates, deterministic visual regression, cross-platform unsigned packages, and SHA-256 checksums.
- Added a release helper for preflight, version commit, annotated tag, and explicit push.

## [0.6.0] — 2026-04-21

- Stabilized native shell behavior, modpack catalog/details, dependency and runtime state, settings, and guided resource-pack/shader flows.
- Made failures and recovery actions explicit across the primary launcher workflows.

## Earlier releases

Historical changes before v0.6.0 are available in [GitHub Releases](https://github.com/malyarq/fmcl/releases) and the archived planning records under `.planning/milestones/`.

[0.8.0]: https://github.com/malyarq/fmcl/compare/v0.7.1...v0.8.0
[0.7.1]: https://github.com/malyarq/fmcl/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/malyarq/fmcl/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/malyarq/fmcl/compare/v0.5.0...v0.6.0
