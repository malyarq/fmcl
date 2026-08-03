# FriendLauncher user guide

This guide covers the current stable release. For confirmed limitations, see [Known issues](known-issues.md).

## Install

1. Open the [latest GitHub release](https://github.com/malyarq/fmcl/releases/latest).
2. Download the package for your operating system and `SHA256SUMS.txt`.
3. Compare the package SHA-256 with the matching line in `SHA256SUMS.txt`.
4. Install or run the package.

| Platform | Package | Installation |
| --- | --- | --- |
| Windows | `FriendLauncher-Windows-<version>-Setup.exe` | Run the installer. |
| macOS | `FriendLauncher-Mac-<version>-Installer.dmg` | Open the image and move FriendLauncher to Applications. |
| Linux | `FriendLauncher-Linux-<version>.AppImage` | Mark the file executable, then run it. |

Windows and macOS packages are unsigned. An unknown-developer warning is expected; it does not prove that a file is safe. Verify that the download URL belongs to `github.com/malyarq/fmcl` and compare its checksum before deciding whether to run it.

### Check the download

macOS or Linux:

```bash
shasum -a 256 FriendLauncher-<platform>-<version>.<extension>
```

Windows PowerShell:

```powershell
Get-FileHash -Algorithm SHA256 .\FriendLauncher-Windows-<version>-Setup.exe
```

Compare the printed value with `SHA256SUMS.txt`. A mismatch means the file must not be used.

## First launch

1. Review the welcome screen, start the guided tour, or skip it.
2. Open **Accounts** and create an offline profile or add a supported third-party account.
3. Open **Settings** to choose the interface language and appearance or change the game-data location, mirror, memory, or Java path.
4. Select a Minecraft version and modloader in **Classic**, then press **Play**.

FMCL selects Java 8, 17, or 21 according to the Minecraft version. It first checks a configured or local runtime and can download a compatible runtime when necessary.

## Modpacks and content

- Create a local instance from the Modpacks screen.
- Browse and install Modrinth packs or import a local CurseForge/Modrinth archive.
- Open an instance to manage mods, resource packs, shaders, worlds, datapacks, and screenshots.
- Export or back up important instances before large updates or deletion.

CurseForge browsing is intentionally disabled in official builds. Local archive import/export and share-code flows remain available.

## Multiplayer

FriendTunnel connects a Minecraft world opened to LAN over a room code:

1. The host opens a world to LAN in Minecraft and copies the LAN port shown in chat.
2. The host starts FriendTunnel with that port and shares the generated room code.
3. The other player joins with the room code.

LAN discovery and UPnP modes depend on the local network and router. They are optional and are not required for the default FriendTunnel flow.

## Updates

FMCL may check for application and modpack updates automatically, but application downloads require explicit confirmation. Install stable updates from the in-app prompt or from the repository's Releases page.

## Data and backups

The game-data directory is configurable in Settings. Application configuration is stored in Electron's `.fmcl` user-data directory, typically:

- Windows: `%APPDATA%\.fmcl`
- macOS: `~/Library/Application Support/.fmcl`
- Linux: `~/.config/.fmcl`

Back up both the configured game-data directory and `.fmcl` before moving to another computer or doing manual recovery. Do not delete either directory as a generic troubleshooting step.

## Get help

Start with [Troubleshooting](troubleshooting.md). If the problem remains, open a [GitHub issue](https://github.com/malyarq/fmcl/issues/new) and include the FMCL version, operating system, selected Minecraft/modloader version, reproduction steps, and exported console output with secrets removed.

Report security vulnerabilities privately according to [SECURITY.md](../../SECURITY.md).
