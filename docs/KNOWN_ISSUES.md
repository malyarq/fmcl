# Known Issues / Известные проблемы

Актуально на 2026-08-03 для ветки восстановления `v0.7.0`. Этот список содержит только подтверждённые текущие ограничения, а не старые результаты линтера.

## Security and release / Безопасность и релиз

| Priority | Limitation | Current mitigation | Exit condition |
| --- | --- | --- | --- |
| High | macOS and Windows artifacts are published without code signing; macOS also has no notarization. | Release notes disclose the unsigned status, CI publishes only after the complete platform matrix, and users must download only from this repository. | Optionally configure `MACOS_CSC_*`, Apple notarization and `WINDOWS_CSC_*` secrets; verify signatures on installed artifacts. |
| Medium | Public-HTTPS validation blocks literal private/reserved addresses but does not pin DNS resolution, so DNS rebinding remains possible. | Remote downloads are HTTPS-only, capped, streamed and restricted to known hosts where the contract permits it. | Resolve and validate every address at connect time or route downloads through a dispatcher with DNS/IP policy. |
| Medium | Linux `safeStorage` strength depends on the desktop keyring available to Electron. | Account tokens never enter renderer DTOs; legacy plaintext is removed, and provider accounts are explicitly disabled when encryption is unavailable instead of silently losing credentials. | Detect weak-but-available storage backends and document supported keyring setup per Linux desktop. |

## Architecture and operations / Архитектура и эксплуатация

- `electron/services/modpacks/modpackService.ts` is still an oversized facade. Split import/install, metadata, lifecycle and filesystem transactions behind smaller tested services.
- The preload still exposes a generic allowlisted IPC bridge plus legacy globals. New renderer code uses typed `src/services/ipc/*` wrappers, but the raw bridge and duplicate globals should be removed after a migration inventory.
- The XMCL bytebuffer correction still runs as a postinstall patch. It now validates the result and fails installation loudly, but should still be replaced by an upstream release or a checked-in package patch.
- Full Minecraft installation, real UPnP routers, Microsoft authentication, OS signing/notarization and installed auto-update cannot be proven by unit tests alone. They remain release-candidate smoke gates on real Windows, macOS and Linux hosts.
- Browser visual snapshots currently target macOS Chromium. Add Linux/Windows reference baselines only when platform-specific rendering is intentionally owned.
- Release artifacts include `SHA256SUMS.txt`; these checksums detect download corruption but do not replace code-signing identity verification.

## Product debt / Продуктовый долг

- CurseForge browsing remains an intentionally unavailable surface until its API/auth/distribution contract is implemented end to end; do not replace this with a dead “Soon” button.
- Long downloads and large import/install operations need unified cancellation, resumability and one visible download queue.
- Modpack mutation flows still need transactional rollback and crash recovery across install, update, import and delete.

Resolved items and the remaining work programme are tracked in [the revival plan](ru/revival-plan-2026-08-03.md).
