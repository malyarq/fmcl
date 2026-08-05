# Security model

This document explains FriendLauncher's trust boundaries and current protections. It is not a claim that the application is vulnerability-free. Report suspected vulnerabilities through [SECURITY.md](../../SECURITY.md), not a public issue.

## Trust boundaries

FriendLauncher handles several kinds of untrusted input:

- renderer messages crossing into the Electron main process;
- remote metadata, images, downloads, update manifests, and authentication servers;
- imported modpack, world, datapack, resource-pack, and shader archives;
- local paths chosen by the user or supplied by imported metadata;
- account tokens stored on the local machine;
- LAN peers, UPnP devices, FriendTunnel peers, and local callback traffic.

The renderer is never treated as trusted merely because it was bundled with the application.

## Electron boundary

- Application windows use sandboxing and context isolation with Node integration disabled.
- Navigation and new-window requests are checked before an external URL is opened.
- Renderer operations cross a preload boundary and an IPC allowlist.
- Shared contracts describe public renderer/main data; secrets should not appear in renderer DTOs.
- Main-process handlers validate paths, URLs, enums, sizes, and identifiers before calling services.

Preload exposes one typed `window.api` namespace. Renderer code cannot select arbitrary allowlisted channels; each operation must exist in a domain contract and bridge.

## Files, paths, and archives

- File operations resolve and constrain paths to the intended root before mutation.
- Archive readers reject absolute paths, traversal, duplicate entries, symbolic links, encrypted entries, excessive entry counts/sizes, and checksum mismatches.
- Downloads use streaming limits and validate hashes when trusted metadata provides them.
- Imported metadata is not permission to write outside an instance or managed data root.
- Destructive operations should preserve explicit user intent and avoid following untrusted links.
- Maintained JSON state is written through a versioned atomic store with backup recovery. Corrupt or unsupported state fails closed and is preserved instead of being silently replaced.
- Save and export handlers consume a path authorized by a native save dialog for the issuing renderer; another window or a renderer-supplied absolute path alone has no authority.
- The root mutation lock uses a token-authenticated local Node socket for process-incarnation liveness. A missing or refusing unique socket marks the referenced lease dead; timeouts and ambiguous errors fail closed. Token death can remove only its immutable ticket, never the process-shared endpoint. Never delete another build's canonical lock during a live upgrade: stop all FMCL processes sharing that root before upgrade, downgrade, or custom-root build mixing.

## Network input

- Remote application inputs require approved schemes and host policy; account providers normally require HTTPS, with loopback allowed for local development flows.
- Requests and archives use size limits and timeouts where the owning service supports them.
- Browser permissions are denied unless explicitly allowed by the application policy.
- Literal private/reserved targets are restricted for public-HTTPS fetches. DNS resolution is not yet pinned, so DNS rebinding remains a known risk.

Do not broaden the URL allowlist merely to make one provider work. Add a narrow policy, tests, and failure behavior.

## Accounts and secrets

- Offline profiles have no remote credential.
- Third-party access and client tokens are encrypted with Electron `safeStorage` before persistence and are omitted from renderer-facing account objects.
- If encryption is unavailable, third-party account persistence is disabled rather than falling back to plaintext.
- Logs, diagnostics, screenshots, fixtures, and bug reports must not contain tokens, passwords, signing material, or private provider keys.

On Linux, `safeStorage` security depends on the desktop keyring. This is a platform limitation, not equivalent to hardware-backed storage.

## Releases and updates

- Publication is manual and dispatch-only. The workflow revalidates the exact tag, commit, artifact checksums, platform smoke, and schema-valid pre-push report before its publish job.
- The local pre-push report is evidence, not a security boundary or publication authorization. GitHub publication additionally requires approval from the repository-configured protected `release-publication` Environment; repository code cannot create or guarantee that protection.
- Release jobs build each platform from the tagged source and publish SHA-256 checksums.
- Windows and macOS artifacts are currently unsigned; checksums help detect mismatch but do not authenticate the publisher. Gatekeeper and SmartScreen behavior must be checked manually on the target platform.
- Release candidates are prereleases and non-latest.
- Stable SemVer tags and their assets are immutable. A broken release is followed by a new patch version.
- Update installation requires explicit product behavior and must use release metadata from the configured trusted source.

## Security review checklist

For changes involving IPC, paths, archives, downloads, authentication, navigation, updater behavior, or local servers:

1. Identify every untrusted input and privileged side effect.
2. Validate at the main-process boundary, not only in the UI.
3. Add negative tests for traversal, oversized input, malformed URLs, unexpected enum values, and missing secrets as relevant.
4. Avoid logging sensitive values or returning them to the renderer.
5. Document any accepted residual risk in [Known Issues](known-issues.md).
6. Run `npm run verify` and the relevant packaging or full-install check.
