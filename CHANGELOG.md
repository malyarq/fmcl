# Changelog

This file summarizes the current public release. Git history remains the detailed development record, and [GitHub Releases](https://github.com/malyarq/burrow/releases) is the canonical source for downloadable artifacts.

## Unreleased

No changes after v0.12.0.

## [0.12.0] — 2026-08-08

### Added

- A bilingual English/Russian launcher for vanilla Minecraft and managed modpacks.
- Burrow Link multiplayer invitations, modpack sharing, settings backup, guided onboarding, and privacy-first optional analytics.
- Cross-platform Windows, macOS, and Linux packages with checksums and automated native smoke evidence.

### Changed

- Standardized the application ID, user-data directory, persistent schema marker, temporary workspaces, and public protocols on the Burrow identity.
- Made invitations, modpack share codes, settings backups, package upgrades, and anonymous analytics use only their current Burrow formats.
- Removed pre-public migration branches and obsolete namespaces before external adoption.

### Security

- Hardened Electron windows, IPC validation, navigation, archives, downloads, credential storage, updater behavior, and renderer isolation.
- Anonymous analytics stays disabled until explicit consent and sends only allowlisted product events without persons, IP-derived location, paths, accounts, logs, or room secrets.

### Release

- Release publication is tag-last: every platform package and required check must finish before the exact commit is tagged and published.
- Publisher signing and macOS notarization are not configured; the release notes and user guide state the resulting operating-system warnings.
