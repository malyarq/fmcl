# FriendLauncher

[English](#english) | [Русский](#russian)

FriendLauncher is a desktop Minecraft launcher for people who move between vanilla play, modpacks, and multiplayer with friends. It combines local instance management, modpack browsing, content tools, and FriendTunnel P2P play in one Electron application.

The current `v0.6.0` release has been checked against the browser-backed `manual-verification.html` seam and focused milestone proof routes for settings and guided content. The shipped record now covers restrained shell behavior, truthful modpack runtime state, bounded honest settings personalization, and guided resource-pack and shader flows with explicit fallback and recovery. The descriptions below reflect that verified shipped surface rather than stale milestone plans.

## <a name="english"></a>English

### What Players Can Do Today

- Launch vanilla or modded Minecraft instances from one desktop launcher.
- Work with Forge, Fabric, NeoForge, OptiFine, offline accounts, and third-party auth servers.
- Browse and install modpacks, duplicate or rename instances, export packs, and import shared manifests.
- Manage mods, worlds, resource packs, shaders, datapacks, screenshots, mirrors, and local storage from the launcher UI.
- Use FriendTunnel to host and join LAN-style multiplayer sessions over the internet without extra VPN tooling.
- Track local statistics, change themes and accents, use custom backgrounds, and adjust the launcher layout for daily use.

### `v0.6.0` Verified Highlights

- Shared shell surfaces now behave more like a native desktop product: macOS chrome stays native-first, critical shell routes use restrained identity, update urgency stays local to modpack surfaces, and reopen or restart restores truthful runtime state.
- Modpack list, details, dependency, and creation flows now share a smaller config-first runtime story with compact controls, above-the-fold tab reachability, neutral healthy dependency states, and explicit async recovery.
- Settings now run on one explicit appearance-state contract, one compact shell-owned hierarchy, and control copy that explains real scope instead of implying broad fake personalization.
- Bounded `CUSTOM-01` shipped only as preset-adjacent customization: preset ancestry stays visible, customized state is labeled directly, and reset-to-preset recovery is built in.
- Resource-pack and shader entry now route into the same in-app guided browser with explicit local `.zip` fallback, honest shader capability guidance, and named recovery for duplicate, invalid, and blocked installs.
- The release record is backed by milestone audit artifacts plus focused proof routes and regression suites rather than only code review.

### Development

Use a current Node.js LTS release.

```bash
npm install
npm test
npm run lint
npx tsc --noEmit
npm run dev
```

Production build:

```bash
npm run build
```

### Project Docs

- [docs/en/roadmap.md](docs/en/roadmap.md)
- [docs/ru/roadmap.md](docs/ru/roadmap.md)
- [docs/en/contracts-map.md](docs/en/contracts-map.md)
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

### Что Уже Проверено В `v0.6.0`

- Shared shell surface теперь ведут себя ближе к native desktop product: на macOS chrome остаётся native-first, критичные shell route используют сдержанную identity, update urgency остаётся локальной для modpack surface, а reopen/restart восстанавливает truthful runtime state.
- List, details, dependency и create-flow для modpack теперь опираются на одну меньшую config-first runtime-модель с компактными controls, досягаемыми tab surface, нейтральным healthy dependency state и явным async recovery.
- Settings теперь работают через один явный appearance-state contract, одну компактную shell-owned hierarchy и copy, которая честно объясняет scope контролов вместо ложных обещаний широкой personalization-системы.
- Bounded `CUSTOM-01` доехал только как preset-adjacent customization: ancestry текущего preset остаётся видимой, customized-state маркируется явно, а reset-to-preset recovery встроен в UI.
- Entry для resource-pack и shader теперь ведёт в один и тот же in-app guided browser с явным local `.zip` fallback, честной shader capability guidance и named recovery для duplicate, invalid и blocked install case.
- Truth релиза теперь опирается на milestone audit artifacts, proof routes и focused regression suites, а не только на тесты и code review.

### Разработка

Используйте актуальную LTS-версию Node.js.

```bash
npm install
npm test
npm run lint
npx tsc --noEmit
npm run dev
```

Сборка production-версии:

```bash
npm run build
```

### Документация

- [docs/ru/roadmap.md](docs/ru/roadmap.md)
- [docs/en/roadmap.md](docs/en/roadmap.md)
- [docs/ru/contracts-map.md](docs/ru/contracts-map.md)
- [docs/en/contracts-map.md](docs/en/contracts-map.md)

### Дисклеймер

В проекте есть поддержка альтернативных сценариев авторизации через `authlib-injector`. Используйте её ответственно и, если можете, поддержите Mojang/Microsoft покупкой игры.
