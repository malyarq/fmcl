# Changelog

This file summarizes user-visible and operational changes. Git history remains the detailed record, and [GitHub Releases](https://github.com/malyarq/fmcl/releases) is the canonical source for downloadable artifacts.

## Unreleased

- Rebuilt the player, contributor, maintainer, architecture, security, testing, release, and historical documentation.
- Added automated documentation link and EN/RU mirror checks.

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

[0.7.1]: https://github.com/malyarq/fmcl/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/malyarq/fmcl/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/malyarq/fmcl/compare/v0.5.0...v0.6.0
