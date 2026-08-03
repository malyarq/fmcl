# Known issues

Reviewed on 2026-08-03 for the current stable FriendLauncher release. This list contains confirmed limitations, not speculative feature requests.

## Distribution and security

| Severity | Limitation | Current protection | Planned resolution |
| --- | --- | --- | --- |
| High | Windows and macOS artifacts are not code-signed; macOS is not notarized. | Releases are built by GitHub Actions after the complete platform matrix, include an explicit warning, and publish SHA-256 checksums. | Add Windows signing, Apple Developer ID signing, notarization, and installed-artifact verification. |
| Medium | Public-HTTPS validation blocks literal private and reserved addresses but does not pin the resolved address, so DNS rebinding is still possible. | Remote inputs are restricted by scheme, host policy, size limits, streaming, and archive validation where applicable. | Validate resolved addresses when connecting or use a dispatcher that enforces DNS/IP policy. |
| Medium | Electron `safeStorage` strength on Linux depends on the available desktop keyring. | Tokens are excluded from renderer DTOs; third-party accounts are disabled when encryption is unavailable instead of silently persisting plaintext. | Detect weak backends and document tested keyring configurations. |

Checksums detect corruption or asset replacement only when users compare them with a trusted release page. They do not provide publisher identity and do not replace code signing.

## Product limitations

- CurseForge browsing is disabled in official builds because the API key and distribution contract are not configured for public binaries. Import/export of local CurseForge archives remains available.
- Long operations share one cancellable, journaled lifecycle, but interrupted network transfers do not resume byte-for-byte after restart.
- Archive export recovery deliberately stops at `recovery-required` after a restart. The launcher preserves the external output and private staging artifacts, but does not rename or delete them after the one-time native save authorization has expired; manual verification is required.
- Real Microsoft authentication is not implemented; supported profiles are offline or compatible third-party Yggdrasil providers.
- LAN discovery and UPnP depend on the local network and router and cannot be guaranteed by the launcher.

## Architecture and maintenance debt

- `electron/services/modpacks/modpackService.ts` is still an oversized facade and should be split into lifecycle, metadata, import/export, and content-transaction services.
- Some renderer IPC wrappers still contain defensive availability checks even though `window.api` is now the only preload surface; these can be simplified as their owning features are refactored.
- The XMCL bytebuffer compatibility correction is applied by a validated postinstall script. It should be replaced by an upstream fix or a managed package patch.
- Visual regression baselines are owned on macOS Chromium only.
- Full Minecraft installation, real routers, installed updates, and OS signing/notarization still require manual platform smoke tests.

## Not bugs

- An unknown-developer warning on Windows or macOS is expected for the current unsigned artifacts.
- `npm run verify` does not package the application and does not run visual or real installation tests; see [Testing](testing.md).

Planned work is prioritized in the [roadmap](roadmap.md). Report an ordinary regression through [GitHub Issues](https://github.com/malyarq/fmcl/issues/new) and a vulnerability according to [SECURITY.md](../../SECURITY.md).
