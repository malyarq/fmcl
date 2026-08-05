# FriendLauncher

[Latest release](https://github.com/malyarq/fmcl/releases/latest) · [Русская документация](docs/ru/user-guide.md) · [Documentation index](docs/README.md)

FriendLauncher (FMCL) is a cross-platform desktop Minecraft launcher for vanilla play, modpacks, local content management, and multiplayer with friends. It is built with Electron, React, and TypeScript.

Current stable release: [latest GitHub release](https://github.com/malyarq/fmcl/releases/latest).

> [!WARNING]
> Windows and macOS packages are currently unsigned. Download them only from this repository and verify `SHA256SUMS.txt` from the release before installing. The operating system may show an unknown-developer warning.

## Features

- Launch vanilla Minecraft or instances using Forge, Fabric, NeoForge, and OptiFine.
- Detect or provision the Java runtime required by the selected Minecraft version.
- Create, import, export, duplicate, rename, update, and remove modpacks.
- Browse Modrinth and manage mods, resource packs, shaders, worlds, datapacks, and screenshots.
- Use offline profiles or supported third-party Yggdrasil/authlib-injector providers.
- Host and join LAN-style sessions through FriendTunnel; optional LAN discovery and UPnP modes are available for diagnostics.
- Configure themes, storage, download mirrors, launcher behavior, and local statistics.
- Check for application and modpack updates with explicit download consent.

CurseForge archive import/export is supported, but browsing CurseForge is disabled in official builds until the API and distribution contract is configured end to end.

## Download

Download the latest package from [GitHub Releases](https://github.com/malyarq/fmcl/releases/latest):

| Platform | Artifact |
| --- | --- |
| Windows | `FriendLauncher-Windows-<version>-Setup.exe` |
| macOS | `FriendLauncher-Mac-<version>-Installer.dmg` |
| Linux | `FriendLauncher-Linux-<version>.AppImage` |

Release metadata also includes updater manifests, blockmaps, and `SHA256SUMS.txt`. Installation and first-run instructions are in the [user guide](docs/en/user-guide.md).

## Development

Requirements:

- Node.js 24.x (`.nvmrc`)
- npm 11.x (`package.json#packageManager`)
- Git

```bash
nvm use
npm ci
npm run verify
npm run dev
```

`npm run verify` runs unit tests, ESLint, TypeScript, documentation and IPC contract checks, and the production dependency audit. It does not run visual regression, packaging, or real Minecraft installation tests; see [Testing](docs/en/testing.md) for the full matrix.

Create production packages locally with:

```bash
npm run build -- --publish never
```

## Documentation

| Topic | English | Русский |
| --- | --- | --- |
| User guide | [User guide](docs/en/user-guide.md) | [Руководство](docs/ru/user-guide.md) |
| Troubleshooting | [Troubleshooting](docs/en/troubleshooting.md) | [Решение проблем](docs/ru/troubleshooting.md) |
| Development | [Development](docs/en/development.md) | [Разработка](docs/ru/development.md) |
| Architecture | [Architecture](docs/en/architecture.md) | [Архитектура](docs/ru/architecture.md) |
| Testing | [Testing](docs/en/testing.md) | [Тестирование](docs/ru/testing.md) |
| IPC contracts | [Contracts](docs/en/contracts.md) | [Контракты](docs/ru/contracts.md) |
| Design system | [Design system](docs/en/design-system.md) | [Дизайн-система](docs/ru/design-system.md) |
| Security model | [Security](docs/en/security.md) | [Безопасность](docs/ru/security.md) |
| Privacy and analytics | [Privacy](docs/en/privacy.md) | [Приватность](docs/ru/privacy.md) |
| Release process | [Releasing](docs/en/releasing.md) | [Релизы](docs/ru/releasing.md) |
| Roadmap | [Roadmap](docs/en/roadmap.md) | [Роадмап](docs/ru/roadmap.md) |

Repository-wide contribution and release history documents:

- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Changelog](CHANGELOG.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)
- [Known issues](docs/KNOWN_ISSUES.md)

## Project status

`main` is the active development branch. Stable releases are versioned as `vMAJOR.MINOR.PATCH`; the `latest` tag points to the newest stable release. Current limitations and work that is intentionally not release-blocking are tracked in [Known Issues](docs/en/known-issues.md).

## Authentication and game ownership

FMCL supports offline and alternative Yggdrasil authentication flows through `authlib-injector`. Use these features responsibly. FriendLauncher is not affiliated with Mojang or Microsoft, and this project does not grant ownership of Minecraft.

## License

FriendLauncher is available under the [MIT License](LICENSE).
