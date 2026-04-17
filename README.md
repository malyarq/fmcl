# FriendLauncher

[English](#english) | [Русский](#russian)

FriendLauncher is a desktop Minecraft launcher for people who move between vanilla play, modpacks, and multiplayer with friends. It combines local instance management, modpack browsing, content tools, and FriendTunnel P2P play in one Electron application.

The current `v0.4.0` launcher-truth release candidate has been checked against the browser-backed `manual-verification.html` seam on `2026-04-17`. The active closeout proof now covers `?view=dashboard`, `?view=modpack-details`, and `?view=phase-17-polish`, validating launch-state truth, modpack dependency semantics, catalog or compact-nav polish, and Russian settings preset naming before the final packaging gate. The descriptions below reflect that verified launcher surface rather than stale milestone plans.

## <a name="english"></a>English

### What Players Can Do Today

- Launch vanilla or modded Minecraft instances from one desktop launcher.
- Work with Forge, Fabric, NeoForge, OptiFine, offline accounts, and third-party auth servers.
- Browse and install modpacks, duplicate or rename instances, export packs, and import shared manifests.
- Manage mods, worlds, resource packs, shaders, datapacks, screenshots, mirrors, and local storage from the launcher UI.
- Use FriendTunnel to host and join LAN-style multiplayer sessions over the internet without extra VPN tooling.
- Track local statistics, change themes and accents, use custom backgrounds, and adjust the launcher layout for daily use.

### `v0.4.0` Verified Highlights

- Main play surfaces now keep launch progress, CTA state, loader summaries, and localized runtime feedback on one truthful contract instead of drifting between partial states.
- Missing launch or catalog artwork now resolves to a deliberate FMCL fallback treatment instead of broken-image or empty-placeholder states.
- Modpack details now show pack-provided runtime dependencies honestly, render readable requirement copy, and keep dense-screen sections reachable without default horizontal-tab friction.
- Installed and remote catalog surfaces stay legible with the sidebar open, and collapsed navigation keeps an intentional active-state treatment instead of stray placeholder letters.
- Audited settings and launch-adjacent controls no longer leak raw localization keys, and appearance preset names now follow one deliberate RU/EN naming policy on the shipped surface.
- Release truth now includes a reusable three-view browser-backed walkthrough on `manual-verification.html`, not only tests and code review.

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

### Что Уже Проверено В `v0.4.0`

- Основные play-surface теперь держат launch progress, CTA state, loader summary и локализованный runtime feedback на одном truthful-контракте вместо рассинхронизированных состояний.
- Отсутствующее launch- или catalog-artwork теперь заменяется осмысленным FMCL fallback, а не broken-image или пустым placeholder-состоянием.
- Modpack details теперь честно показывают pack-provided runtime dependencies, рендерят читаемый requirement copy и сохраняют доступность dense-screen разделов без tab-friction по умолчанию.
- Installed и remote catalog surface остаются читаемыми при открытом sidebar, а collapsed navigation показывает внятное active-state поведение без случайных буквенных заглушек.
- Audited settings и launch-adjacent controls больше не показывают raw localization keys, а названия appearance preset теперь следуют единой RU/EN политике на shipped surface.
- Truth релиза теперь опирается на переиспользуемый three-view browser-backed walkthrough в `manual-verification.html`, а не только на тесты и code review.

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
