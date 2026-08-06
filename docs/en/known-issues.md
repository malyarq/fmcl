# Known issues

Reviewed on 2026-08-06 against the current code and packaging configuration. This list contains confirmed limitations, not speculative feature requests.

## Distribution and security

| Severity | Limitation | Current protection | Planned resolution |
| --- | --- | --- | --- |
| High | Windows artifacts and macOS DMGs are not publisher-signed; macOS is not notarized. The local macOS app uses an ad-hoc signature only to remain runnable. | Releases are built by GitHub Actions after the complete platform matrix, include an explicit warning, and publish SHA-256 checksums. | Add Windows signing, Apple Developer ID signing, notarization, and installed-artifact verification. |

Checksums detect corruption or asset replacement only when users compare them with a trusted release page. They do not provide publisher identity and do not replace code signing.

## Product limitations

- CurseForge browsing is disabled in official builds because the API key and distribution contract are not configured for public binaries. Import/export of local CurseForge archives remains available.
- Long operations share one cancellable, journaled lifecycle, but interrupted network transfers do not resume byte-for-byte after restart.
- The recovery inbox does not expose a generic retry for hidden or already-consumed input. A recovery-required import or export may need a fresh archive selection or save destination from the user.
- Archive export recovery deliberately stops at `recovery-required` after a restart. The launcher preserves the external output and private staging artifacts, but does not rename or delete them after the one-time native save authorization has expired; manual verification is required.
- Real Microsoft authentication is not implemented; supported profiles are offline or compatible third-party Yggdrasil providers.
- LAN discovery and UPnP depend on the local network and router and cannot be guaranteed by the launcher.
- Electron documents that normal quit events may not fire during Windows shutdown, restart, or user logout. The ordered drain applies to ordinary launcher quit paths; crash/journal recovery remains the protection for forced termination.

## Verification and maintenance limits

- The XMCL bytebuffer compatibility correction is applied by a validated postinstall script. It should be replaced by an upstream fix or a managed package patch.
- Deterministic renderer proof and visual regression baselines run on macOS Chromium only; they do not establish native-dialog, window-manager, or graphics-driver behavior on other platforms.
- Full Minecraft installation, real routers, installed updates, and OS signing/notarization still require manual platform smoke tests.

## Not bugs

- An unknown-developer warning on Windows or macOS is expected without publisher signing and notarization.
- `npm run verify` does not package the application and does not run visual or real installation tests; see [Testing](testing.md).

The project stop condition is documented in the short [product gate](roadmap.md). Report an ordinary regression through [GitHub Issues](https://github.com/malyarq/fmcl/issues/new) and a vulnerability according to [SECURITY.md](../../SECURITY.md).
