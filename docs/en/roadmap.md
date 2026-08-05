# Roadmap

Current stable release: **v0.8.0**, published on 2026-08-05. The Ideal Architecture milestone is complete; shipped changes belong in the [changelog](../../CHANGELOG.md), not in this roadmap.

Current work is the bounded **v0.8.1 maintenance patch**. It fixes startup console and recovery behavior, production single-instance ownership, packaged brand assets, and stale visual release evidence. It does not start another architecture milestone.

This is a direction document, not a promise of dates. Work is ordered by risk and user value.

## 1. Close v0.8.1

- Restore a green `main` branch, including the current macOS Chromium visual lane.
- Freeze the candidate, review only its final diff, and build exact-HEAD release evidence before push or tag creation.
- Exercise the installed macOS package locally and let the protected release workflow rebuild all supported artifacts.

## 2. Prove the product

- Do not start another architecture milestone until at least 20 external users have tried the launcher and their opt-in usage and feedback have been reviewed.
- Track successful and failed Minecraft launches, failure stages, operating systems, languages, and Classic/Modpacks usage without collecting account, path, server, or log data.
- Prioritize observed installation, launch, update, and recovery failures over speculative expansion.

## 3. Distribution and security follow-up

- Exercise fresh installation and updater paths on Windows, macOS, and Linux before each stable release.
- Sign Windows installers and sign/notarize macOS packages when publisher credentials are available.
- Remove the remaining DNS-rebinding exposure from local HTTP callback and control surfaces.
- Detect weak Linux keyring backends and expand cross-platform visual and accessibility coverage.
- Keep the MIT license, third-party notices, checksums, provenance, and privacy settings accurate.

## 4. Product candidates after external evidence

- Add Microsoft authentication for official Minecraft accounts.
- Improve reauthentication and expired-session recovery for every supported account provider.
- Add supported backup and restore for launcher settings and instances.
- Resume interrupted downloads safely after restart.
- Enable CurseForge browsing only after API credentials, attribution, distribution rules, tests, and failure handling are complete.
- Revisit broader social or marketplace features only after the launcher core remains stable in daily use.

## How work is accepted

A roadmap item is complete only when behavior, tests, documentation, migration or rollback handling, and release impact are addressed together. Confirmed current limitations are tracked in [Known Issues](known-issues.md); security boundaries are documented in [Security](security.md).
