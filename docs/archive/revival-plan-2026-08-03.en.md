# FriendLauncher Revival Plan

> **Historical record.** This audit drove the v0.7.0 recovery release and the v0.7.1 patch. It is preserved as the decision and completion record, not as current product documentation. Remaining work is tracked in the [current roadmap](../en/roadmap.md).

Audit date: 2026-08-03. Baseline: `v0.6.0`; target: a trustworthy `v0.7.0`.

## Stack decision

A ground-up rewrite is not justified. TypeScript, React and Electron match the product's need for filesystem access, Java processes, native dialogs, OS secret storage and cross-platform packaging. The failures came from weak trust boundaries, unsafe release automation, accumulated UI debt and an incomplete release gate—not from the language or engine. Keep the stack, narrow the boundaries, replace the genuinely unsafe dependencies and split oversized services incrementally.

## P0 — security and data integrity

- [x] Block path traversal in updater, datapack and launch flows.
- [x] Require public HTTPS and known CDN hosts where contracts permit it.
- [x] Stream and cap downloads; verify hashes before atomic rename.
- [x] Apply one ZIP policy for count, size, ratio, traversal, duplicate, encryption and symlink checks.
- [x] Authorize `app:saveFile` only for a fresh native save-dialog selection.
- [x] Keep account tokens out of renderer models and migrate plaintext storage to `safeStorage`.
- [x] Validate launch and network payloads at the main-process boundary.
- [x] Enable Chromium sandboxing and replace vulnerable `@xmcl/nat-api`.
- [ ] Validate resolved connection addresses against DNS rebinding.
- [x] Replace `adm-zip` with maintained streaming `yauzl`/`yazl` implementations and gate production audit at high severity.
- [ ] Remove the generic IPC bridge and legacy global APIs.

## P0 — build and release

- [x] Pin Node 24/npm 11 and update Electron, builder, updater, Vite and safe transitives.
- [x] Gate CI on unit, lint, type, contracts, IPC, audit, build and macOS visual regression.
- [x] Make release preparation clean-tree-first, injection-safe, dry-runnable and non-pushing by default.
- [x] Build platforms independently and publish one release after the whole matrix succeeds.
- [x] Publish unsigned Windows/macOS artifacts with an explicit release warning; signing can be added later.
- [ ] Optionally configure real certificates, Apple notarization and installed-artifact signature checks.
- [ ] Publish SBOM, checksums and provenance attestations.
- [ ] Smoke-test installed auto-update from the previous signed release.

## P1 — reliability and architecture

- [x] Treat local modpack creation as the hard success boundary; optional follow-up writes no longer overturn it.
- [x] Unify secondary modpack workspace geometry and remove duplicate browser import action.
- [x] Make application update downloads consent-based.
- [ ] Add transaction journals and rollback for install, update, import and delete.
- [ ] Add one cancellable, resumable download queue with disk preflight and checksum status.
- [ ] Move heavy archive/manifest/directory work out of Electron's main thread.
- [ ] Lock concurrent mutation of the same instance and recover idempotently after crashes.
- [ ] Split `modpackService.ts` into lifecycle, metadata, import/export and content transaction services.
- [ ] Generate versioned preload/renderer bindings from one IPC schema.
- [ ] Add structured, token-redacted logging with correlation IDs.

## P1 — UX and accessibility

- [x] Make Settings and Multiplayer mutually exclusive.
- [x] Fix nested modal Escape/focus handling.
- [x] Add window-control names, multiplayer tab semantics and keyboard room-code copy.
- [x] Localize and adapt Console, remove raw IPC and add copy/export feedback.
- [x] Remove hard-coded dependency labels.
- [ ] Complete keyboard and screen-reader audit for dialogs, tabs, toasts, progress and errors.
- [ ] Verify minimum window size, 125–200% zoom and long Russian copy.
- [ ] Unify destructive confirmations and add a crash-recovery/diagnostic export screen.

## P2 — product work

- [ ] Either implement the complete CurseForge API/auth/download contract or remove the navigation item.
- [ ] Add stable/beta release channels with explicit opt-in and rollback.
- [ ] Add world/modpack backup retention and restore preview before update/delete.
- [ ] Improve account expiry, re-auth, revoke, weak-keyring warning and offline fallback.
- [ ] Add server favorites/history and clear FriendTunnel/LAN/UPnP diagnostics.
- [ ] Add mod compatibility/dependency preview and reproducible pack lockfiles with hashes.
- [ ] Add privacy-first crash reports with local preview and explicit submission.

## Documentation and `v0.7.0` exit

- [x] Refresh README, development contract, known issues and this prioritized backlog.
- [ ] Add threat model, security policy, release/signing/rollback runbook, troubleshooting, CONTRIBUTING, CODE_OF_CONDUCT, CHANGELOG and third-party notices.

Stable `v0.7.0` requires `npm ci`, `npm run verify`, builds on all three OSes, macOS visual closeout and bounded full-install smoke. Production audit must have no high or critical findings. This repository intentionally permits unsigned stable artifacts; the GitHub release must disclose that macOS and Windows can show an unknown-developer warning. Signing, notarization and installed-update smoke remain follow-up hardening work rather than publication blockers.
