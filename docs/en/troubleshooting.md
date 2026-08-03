# Troubleshooting

Use this page for common user-facing failures in the stable release. Do not delete the game-data or `.fmcl` directories before making a backup.

## The operating system blocks the installer

Windows and macOS packages are unsigned. Confirm that the file came from the [official release page](https://github.com/malyarq/fmcl/releases/latest) and verify its SHA-256 as described in the [user guide](user-guide.md). If the checksum does not match, delete the file.

Signing and notarization are not currently available, so FMCL cannot remove the operating-system warning itself.

## Minecraft does not start

1. Open the launcher console and keep the final error and the lines immediately before it.
2. Confirm the selected Minecraft version and modloader are compatible.
3. Remove a custom Java path temporarily so FMCL can detect or provision the required Java version.
4. Check that the configured game-data directory exists and has enough free disk space.
5. Retry without changing several settings at once.

Minecraft versions before 1.17 normally require Java 8, versions from 1.17 require Java 17, and versions from 1.20.5 require Java 21. FMCL applies this mapping automatically; a forced incompatible custom runtime can still break launch.

## Java setup fails

- Check internet access to Mojang runtime metadata and artifact hosts.
- In Settings or the instance settings, select a known working Java home or executable.
- Do not point the launcher at an arbitrary directory containing unrelated binaries.
- Include the requested and detected Java versions when reporting the failure.

## Downloads or catalog requests fail

- Retry once to rule out a transient provider failure.
- Switch the configured download mirror back to automatic selection.
- Check free disk space and filesystem permissions.
- A proxy, DNS filter, antivirus, or corporate network may block Mojang, Modrinth, GitHub, or Java artifact hosts.
- CurseForge browsing is unavailable in official builds by design; use archive import or a share code instead.

## A modpack import is rejected

FMCL rejects unsafe or malformed archives, including path traversal, links, duplicate entries, encrypted entries, and archives that exceed safety limits. Use an original CurseForge or Modrinth export and do not manually repackage it with absolute paths.

If creation succeeded but a metadata refresh failed, reopen the modpack list before recreating the instance. The original instance may already exist.

## A mod or content item cannot be installed

- Confirm that the item has a version for the instance's Minecraft version and modloader.
- Check whether the provider permits direct distribution of that file.
- Retry from the same screen; failed selections are preserved where recovery is supported.
- For resource packs and shaders, use the local `.zip` fallback if provider browsing is unavailable.

## FriendTunnel cannot connect

- The host must open the world to LAN and enter the port shown by Minecraft, not the default server port from memory.
- Share the current room code after the host session has started.
- Restart both ends if the host reopened the world and Minecraft selected a new LAN port.
- LAN discovery and UPnP require local network/router support; use the default FriendTunnel mode when those diagnostics fail.

## An update is stuck

Application updates are downloaded only after confirmation. If an in-app update fails, close FMCL and install the same stable version from GitHub Releases. Do not replace files inside a running installation manually.

## Collect a useful bug report

Include:

- FMCL version and operating system;
- Minecraft version, modloader, and instance type;
- exact reproduction steps;
- expected and actual result;
- exported launcher console output;
- whether the problem also occurs in a new local instance.

Remove access tokens, client tokens, account identifiers, room codes, and personal filesystem paths before attaching logs. Use a [GitHub issue](https://github.com/malyarq/fmcl/issues/new) for ordinary bugs and [private security reporting](../../SECURITY.md) for vulnerabilities.
