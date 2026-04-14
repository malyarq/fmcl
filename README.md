# FriendLauncher

[English](#english) | [Русский](#russian)

FriendLauncher is a desktop Minecraft launcher for people who move between vanilla play, modpacks, and multiplayer with friends. It combines local instance management, modpack browsing, content tools, and FriendTunnel P2P play in one Electron application.

The current `v0.3.0` UX-hardening release has been checked against the browser-backed `manual-verification.html` seam on `2026-04-14`. The reviewed walkthrough covered the launcher at `1440x1100` and `900x1180`, including welcome and onboarding, dashboard and launch-state feedback, settings and accounts, create/list/browser/details/export/add-mod modpack flows, sharing, screenshots, utilities, and datapack management. The descriptions below reflect that verified launcher surface rather than old backlog plans.

## <a name="english"></a>English

### What Players Can Do Today

- Launch vanilla or modded Minecraft instances from one desktop launcher.
- Work with Forge, Fabric, NeoForge, OptiFine, offline accounts, and third-party auth servers.
- Browse and install modpacks, duplicate or rename instances, export packs, and import shared manifests.
- Manage mods, worlds, resource packs, shaders, datapacks, screenshots, mirrors, and local storage from the launcher UI.
- Use FriendTunnel to host and join LAN-style multiplayer sessions over the internet without extra VPN tooling.
- Track local statistics, change themes and accents, use custom backgrounds, and adjust the launcher layout for daily use.

### `v0.3.0` UX-Hardening Highlights

- Adaptive shell, cards, controls, and overlays now stay readable across first-launch default bounds and narrower desktop widths instead of relying on one lucky window size.
- Preset themes apply truthfully in both light and dark mode, and refreshed inputs, cards, and overlays no longer regress into unreadable white-on-white states.
- Common settings tasks are flatter to reach, so appearance, launcher behavior, accounts, mirrors, statistics, and related actions no longer feel buried behind tab-inside-tab navigation.
- Main play surfaces now expose explicit launch-stage feedback and busy-state truth instead of ambiguous waiting that invites repeated clicks.
- Modpack creation, browsing, and installed-pack actions now surface runtime dependencies, clearer filtering state, and anchored quick-action menus that stay inside the current window.
- Classic and fallback launcher surfaces now use shipped assets instead of placeholder-feeling logo leaks.
- Release truth now includes browser-backed walkthrough evidence, not only tests and code review.

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

### Что Улучшено В `v0.3.0`

- Адаптивный shell, карточки, контролы и overlays теперь остаются читаемыми и устойчивыми как на стартовом размере окна, так и на более узкой ширине, без расчёта на один «удачный» viewport.
- Готовые темы применяются честно и в светлом, и в тёмном режиме, а обновлённые inputs, карточки и overlays больше не разваливаются в белый текст на белом фоне.
- Частые настройки стали доступнее: appearance, launcher behavior, accounts, mirrors, statistics и связанные действия больше не требуют прохода через лишние вложенные панели.
- На основном play surface теперь видны явные стадии запуска и busy-state, поэтому лаунчер не выглядит подвисшим во время подготовки или загрузки.
- Создание, браузинг и управление установленными modpack-сборками теперь показывают runtime dependencies, более понятное состояние фильтров и anchored quick actions без выпадающих меню вне окна.
- Классические и fallback-поверхности теперь используют shipped assets вместо ощущения «плейсхолдера вместо логотипа».
- Truth релиза теперь опирается на browser-backed walkthrough, а не только на тесты и code review.

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
