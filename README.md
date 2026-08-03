# FriendLauncher

[English](#english) | [Русский](#russian)

FriendLauncher is a desktop Minecraft launcher for people who move between vanilla play, modpacks, and multiplayer with friends. It combines local instance management, modpack browsing, content tools, and FriendTunnel P2P play in one Electron application.

The last published version is `v0.6.0`. The repository is currently being hardened for `v0.7.0`: security boundaries, reproducible builds, update consent, release automation, tests, and the modpack workspace are being repaired before new scope is declared release-ready.

## <a name="english"></a>English

### What Players Can Do Today

- Launch vanilla or modded Minecraft instances from one desktop launcher.
- Work with Forge, Fabric, NeoForge, OptiFine, offline accounts, and third-party auth servers.
- Browse and install modpacks, duplicate or rename instances, export packs, and import shared manifests.
- Manage mods, worlds, resource packs, shaders, datapacks, screenshots, mirrors, and local storage from the launcher UI.
- Use FriendTunnel to host and join LAN-style multiplayer sessions over the internet without extra VPN tooling.
- Track local statistics, change themes and accents, use custom backgrounds, and adjust the launcher layout for daily use.

### `v0.6.0` Highlights

- Shared shell surfaces now behave more like a native desktop product: macOS chrome stays native-first, critical shell routes use restrained identity, update urgency stays local to modpack surfaces, and reopen or restart restores truthful runtime state.
- Modpack list, details, dependency, and creation flows now share a smaller config-first runtime story with compact controls, above-the-fold tab reachability, neutral healthy dependency states, and explicit async recovery.
- Settings now run on one explicit appearance-state contract, one compact shell-owned hierarchy, and control copy that explains real scope instead of implying broad fake personalization.
- Bounded `CUSTOM-01` shipped only as preset-adjacent customization: preset ancestry stays visible, customized state is labeled directly, and reset-to-preset recovery is built in.
- Resource-pack and shader entry now route into the same in-app guided browser with explicit local `.zip` fallback, honest shader capability guidance, and named recovery for duplicate, invalid, and blocked installs.
- The release record is backed by milestone audit artifacts plus focused proof routes and regression suites rather than only code review.

### Development

Use Node.js 24 and npm 11. The repository pins the expected runtime in `.nvmrc` and `package.json`.

```bash
nvm use
npm ci
npm run verify
npm run dev
```

Production build:

```bash
npm run build
```

`npm run release -- 0.7.0 --dry-run` runs the release preflight without changing Git. A normal release creates a local commit and tag; it never pushes unless `--push` is passed explicitly. GitHub Actions publishes macOS, Windows and Linux artifacts after the full matrix succeeds. Artifacts are unsigned by default, so macOS and Windows may show an unknown-developer warning; optional signing secrets can be added later.

### Project Docs

- [docs/en/roadmap.md](docs/en/roadmap.md)
- [docs/ru/roadmap.md](docs/ru/roadmap.md)
- [docs/en/contracts-map.md](docs/en/contracts-map.md)
- [docs/en/revival-plan-2026-08-03.md](docs/en/revival-plan-2026-08-03.md)
- [docs/ru/contracts-map.md](docs/ru/contracts-map.md)

### Disclaimer

The project includes support for alternative authentication flows through `authlib-injector`. Use it responsibly and support Mojang/Microsoft by buying the game when possible.

## <a name="russian"></a>Русский

### Что Уже Есть В Лаунчере

- Запуск ванильного и модифицированного Minecraft из одного десктопного лаунчера.
- Поддержка Forge, Fabric, NeoForge, OptiFine, оффлайн-аккаунтов и сторонних auth-серверов.
- Браузер модпаков, установка, дублирование и переименование инстансов, экспорт сборок и импорт shared manifest.
- Управление модами, мирами, ресурспаками, шейдерами, датапаками, скриншотами, зеркалами и локальным хранилищем прямо из UI.
- FriendTunnel для LAN-подобной игры через интернет без отдельных VPN-инструментов.
- Локальная статистика, темы и акцентные цвета, кастомные фоны и настройка вида лаунчера под повседневное использование.

### Основные изменения `v0.6.0`

- Shared shell surface теперь ведут себя ближе к native desktop product: на macOS chrome остаётся native-first, критичные shell route используют сдержанную identity, update urgency остаётся локальной для modpack surface, а reopen/restart восстанавливает truthful runtime state.
- List, details, dependency и create-flow для modpack теперь опираются на одну меньшую config-first runtime-модель с компактными controls, досягаемыми tab surface, нейтральным healthy dependency state и явным async recovery.
- Settings теперь работают через один явный appearance-state contract, одну компактную shell-owned hierarchy и copy, которая честно объясняет scope контролов вместо ложных обещаний широкой personalization-системы.
- Bounded `CUSTOM-01` доехал только как preset-adjacent customization: ancestry текущего preset остаётся видимой, customized-state маркируется явно, а reset-to-preset recovery встроен в UI.
- Entry для resource-pack и shader теперь ведёт в один и тот же in-app guided browser с явным local `.zip` fallback, честной shader capability guidance и named recovery для duplicate, invalid и blocked install case.
- Truth релиза теперь опирается на milestone audit artifacts, proof routes и focused regression suites, а не только на тесты и code review.

### Разработка

Используйте Node.js 24 и npm 11. Ожидаемая версия закреплена в `.nvmrc` и `package.json`.

```bash
nvm use
npm ci
npm run verify
npm run dev
```

Сборка production-версии:

```bash
npm run build
```

`npm run release -- 0.7.0 --dry-run` выполняет релизную проверку без изменений Git. Обычный запуск создаёт локальный коммит и тег, но никогда не пушит без явного `--push`. После успешной матрицы GitHub Actions публикует сборки для macOS, Windows и Linux. По умолчанию они не подписаны, поэтому ОС может показать предупреждение о неизвестном разработчике; при необходимости подпись можно подключить позже через secrets.

### Документация

- [docs/ru/roadmap.md](docs/ru/roadmap.md)
- [docs/en/roadmap.md](docs/en/roadmap.md)
- [docs/ru/contracts-map.md](docs/ru/contracts-map.md)
- [docs/en/contracts-map.md](docs/en/contracts-map.md)
- [docs/ru/revival-plan-2026-08-03.md](docs/ru/revival-plan-2026-08-03.md)

### Дисклеймер

В проекте есть поддержка альтернативных сценариев авторизации через `authlib-injector`. Используйте её ответственно и, если можете, поддержите Mojang/Microsoft покупкой игры.
