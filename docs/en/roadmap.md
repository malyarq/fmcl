# Roadmap

Current stable release: **v0.7.1**, published on 2026-08-03. The recovery work that led to v0.7.0 and the v0.7.1 patch is complete; shipped changes belong in the [changelog](../../CHANGELOG.md), not in this roadmap.

Active target: **v0.8.0 — Ideal Architecture**. Its implementation phases and acceptance criteria live in the [engineering roadmap](../../.planning/ROADMAP.md). The security, reliability, and maintainability work below is the release scope; broader product expansion follows it.

This is a direction document, not a promise of dates. Work is ordered by risk and user value.

## 1. Trusted distribution

- Sign Windows installers and sign/notarize macOS packages.
- Publish build provenance and a software bill of materials alongside checksums.
- Exercise fresh installation and updater paths on all supported operating systems before each stable release.
- Keep the published MIT license and third-party notices accurate as dependencies change.

## 2. Security and reliability

- Remove the remaining DNS-rebinding exposure from local HTTP callback and control surfaces.
- Keep the single typed renderer boundary enforced as domain capabilities evolve.
- Modpack duplication, import, provider installation, updates, deletion, archive export, and manifest publication use one durable transaction journal.
- Interrupted modpack mutations are recovered deterministically or left explicitly recovery-required instead of relying on best-effort cleanup.

## 3. Maintainability

- Split the oversized modpack service facade by responsibility without duplicating state.
- Centralize the download queue, cancellation, retry, and progress model.
- Expand dependency-direction and module-ownership checks as domain facades are split.
- Expand cross-platform visual coverage and accessibility checks.

## 4. After v0.8.0

- Do not start another architectural milestone until at least 20 external users have tried v0.8.0 and their usage and feedback have been reviewed.
- Improve account reauthentication and expired-session recovery.
- Add supported backup and restore for launcher settings and instances.
- Enable CurseForge browsing only after API credentials, attribution, distribution rules, tests, and failure handling are complete.
- Revisit broader social or marketplace features only after the launcher core remains stable in daily use.

## How work is accepted

A roadmap item is complete only when behavior, tests, documentation, migration or rollback handling, and release impact are addressed together. Confirmed current limitations are tracked in [Known Issues](known-issues.md); security boundaries are documented in [Security](security.md).
