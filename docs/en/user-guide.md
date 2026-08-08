# Burrow user guide

This guide covers the current stable release. For confirmed limitations, see [Known issues](known-issues.md).

## Install

1. Open the [latest GitHub release](https://github.com/malyarq/burrow/releases/latest).
2. Download the package for your operating system and `SHA256SUMS.txt`.
3. Compare the package SHA-256 with the matching line in `SHA256SUMS.txt`.
4. Install or run the package.

| Platform | Package | Installation |
| --- | --- | --- |
| Windows | `Burrow-Windows-<version>-Setup.exe` | Run the installer. |
| macOS | `Burrow-Mac-<version>-Installer.dmg` | Open the image and move Burrow to Applications. |
| Linux | `Burrow-Linux-<version>.AppImage` | Mark the file executable, then run it. |

Windows packages and macOS DMGs are not publisher-signed. The local macOS app may carry an ad-hoc signature, but that only makes the fused binary runnable and does not identify the publisher. An unknown-developer warning is expected; it does not prove that a file is safe. Verify that the download URL belongs to `github.com/malyarq/burrow` and compare its checksum before deciding whether to run it.

### Check the download

macOS or Linux:

```bash
shasum -a 256 Burrow-<platform>-<version>.<extension>
```

Windows PowerShell:

```powershell
Get-FileHash -Algorithm SHA256 .\Burrow-Windows-<version>-Setup.exe
```

Compare the printed value with `SHA256SUMS.txt`. A mismatch means the file must not be used.

## First launch

1. Choose English or Russian directly on the welcome screen.
2. Choose the outcome you want: **Play Minecraft**, **Play with a friend**, or **Use a modpack**. The short tour is optional.
3. For ordinary play, choose a nickname, Minecraft version, and optional modloader in **Classic**, then press **Play**.
4. Open **Settings** only when you need to change appearance, storage, mirrors, memory, Java, accounts, privacy, or backup options.

Offline play works immediately. Microsoft sign-in is not available yet; supported third-party Yggdrasil accounts can be added in Settings.

Burrow selects Java 8, 17, or 21 according to the Minecraft version. It first checks a configured or local runtime and can download a compatible runtime when necessary.

## Modpacks and content

- Create a local instance from the Modpacks screen.
- Browse and install Modrinth packs or import a local CurseForge/Modrinth archive.
- Open an instance to manage mods, resource packs, shaders, worlds, datapacks, and screenshots.
- Export or back up important instances before large updates or deletion.

CurseForge browsing is intentionally disabled in official builds. Local archive import/export and share-code flows remain available.

## Multiplayer

Burrow Link connects a Minecraft world opened to LAN through an invitation:

1. The host opens a world to LAN in Minecraft and copies the LAN port shown in chat.
2. The host starts Burrow Link with that port and copies the generated `BURROW-…` invitation.
3. The other player pastes the invitation into Burrow Link.
4. After the connection is ready, the joining player opens **Multiplayer → Direct Connection** in Minecraft and enters the `localhost:<port>` address shown by Burrow.

The invitation contains a private connection secret. Share it only with the person who should join and stop the session when finished.

LAN discovery and UPnP modes depend on the local network and router. They are optional and are not required for the default Burrow Link flow.

## Updates

Burrow may check for application and modpack updates automatically, but application downloads require explicit confirmation. Install stable updates from the in-app prompt or from the repository's Releases page.

## Data and backups

The game-data directory is configurable in Settings. New installations store application configuration in Electron's `Burrow` user-data directory, typically:

- Windows: `%APPDATA%\Burrow`
- macOS: `~/Library/Application Support/Burrow`
- Linux: `~/.config/Burrow`

Use **Settings → Storage → Export settings** to create a portable JSON backup. The file deliberately excludes account credentials, analytics consent and identifier, Burrow Link room codes, local filesystem paths, game files, worlds, and modpacks. Importing a backup replaces only the supported settings and then restarts the interface.

Export important modpacks separately. For a complete manual backup, save both the configured game-data directory and the `Burrow` application-data directory. Do not delete either directory as a generic troubleshooting step.

## Privacy and feedback

Anonymous product analytics is disabled by default. The **Privacy and Feedback** card in Launcher settings shows the exact scope and lets you opt in or out. The GitHub report action previews a safe diagnostic draft and never submits it automatically. See [Privacy and analytics](privacy.md) for the complete event allowlist and data controls.

## Get help

Start with [Troubleshooting](troubleshooting.md). If the problem remains, use **Settings → Launcher → Report a problem on GitHub** or open a [GitHub issue](https://github.com/malyarq/burrow/issues/new). Include reproduction steps and only attach exported console output after removing secrets and personal paths.

Report security vulnerabilities privately according to [SECURITY.md](../../SECURITY.md).
