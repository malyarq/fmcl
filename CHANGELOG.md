# Changelog

This file summarizes user-visible and operational changes. Git history remains the detailed record, and [GitHub Releases](https://github.com/malyarq/fmcl/releases) is the canonical source for downloadable artifacts.

## Unreleased

No changes after the local v0.9.1 candidate.

## [0.9.1] — 2026-08-07

### Security

- Updated `js-yaml` to 4.3.1 to fix quadratic CPU consumption while parsing crafted `!!omap` YAML input (GHSA-5p4m-2wfm-xmqj).

## [0.9.0] — 2026-08-06

### Added

- Replaced the generic first-run tour with an immediate English/Russian choice and outcome-based actions for ordinary play, FriendTunnel, and modpacks; the short tour is now optional.
- Added readable, copyable FriendTunnel invitations and concrete Direct Connection guidance for the joining player.
- Added settings export/import through native dialogs with a strict allowlist that excludes credentials, analytics identity and consent, room secrets, local paths, worlds, and modpacks.
- Added consent-gated outcome analytics for onboarding, FriendTunnel, long operations, and settings transfer without collecting paths, account data, room secrets, or error contents.
- Added a complete Russian project README and current English/Russian first-run screenshots.

### Changed

- Removed the 43-phase `.planning` archive from the active tree; Git history remains the historical record and the roadmap is now a short external-user product gate.
- Reduced the complexity budget from a generated source inventory and exact-line ratchet to rounded category limits and explicit hotspot ceilings.
- Kept fast source checks in the pull-request contract and moved bundle, performance, accessibility, and packaging checks to release validation.
- Updated Electron to 43.3 and removed the unused `react-virtuoso` dependency and stale bundle split.
- Made local macOS packages fall back to an ad-hoc signature when Developer ID is unavailable, so Electron fuse changes no longer leave Apple Silicon builds unlaunchable; publisher signing and notarization remain separate release gates.

### Security

- Added connection-time public-IP enforcement for public HTTPS downloads, including redirect validation, to close DNS-rebinding paths in updater, content, image, and direct-download flows.
- Reject Electron's reversible Linux `basic_text` credential backend instead of treating it as secure storage.
- Enabled production Electron fuses for ASAR integrity, cookie encryption, Node/inspector restrictions, and ASAR-only application loading.
- Removed `unsafe-inline` from the renderer script policy in development and production.

## [0.8.1] — 2026-08-06

### Fixed

- Keep the debug console closed across application restarts instead of restoring it in front of the launcher.
- Keep startup recovery notices out of the dedicated console window and remember notices the user closes.
- Give repeated recovery failures stable identities so dismissed notices do not return with a new identifier.
- Focus the existing production window on a second launch instead of creating a stale `_2` profile.
- Resolve bundled brand assets relative to the packaged renderer so first-run logos load from the installed application.
- Keep the welcome dismissal action on one line at supported desktop widths.
- Restore the degraded-state visual proof and refresh all release-candidate snapshots against the current interface.

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

### Release

- Published unsigned Windows, macOS, and Linux packages with native host smoke, explicit foreign-runner evidence, SHA-256 manifests, rollback rules, and protected release approval.
- Added canonical Linux desktop identity and game category metadata so launchers associate the running window with the installed application entry.

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

Historical changes before v0.6.0 are available in [GitHub Releases](https://github.com/malyarq/fmcl/releases) and Git history.

[0.9.1]: https://github.com/malyarq/fmcl/compare/v0.9.0...v0.9.1
[0.9.0]: https://github.com/malyarq/fmcl/compare/v0.8.1...v0.9.0
[0.8.1]: https://github.com/malyarq/fmcl/compare/v0.8.0...v0.8.1
[0.8.0]: https://github.com/malyarq/fmcl/compare/v0.7.1...v0.8.0
[0.7.1]: https://github.com/malyarq/fmcl/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/malyarq/fmcl/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/malyarq/fmcl/compare/v0.5.0...v0.6.0
