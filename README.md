# FriendLauncher

[English](#english) | [Русский](#russian)

FriendLauncher is a desktop Minecraft launcher for people who move between vanilla play, modpacks, and multiplayer with friends. It combines local instance management, modpack browsing, content tools, and FriendTunnel P2P play in one Electron application.

The current `v0.5.0` redesign closeout has been checked against the browser-backed `manual-verification.html` seam on `2026-04-19`. The authoritative closeout set now covers `?view=phase-24-home-closeout`, `?view=phase-24-modpacks-closeout`, `?view=phase-24-degraded-closeout`, `?view=phase-24-theme-dark`, `?view=phase-24-theme-light`, `?view=phase-24-locale-en`, and `?view=phase-24-locale-ru`, with `npm run test:visual:closeout` guarding screenshot drift before packaging. The descriptions below reflect that verified redesign surface rather than stale milestone plans.

## <a name="english"></a>English

### What Players Can Do Today

- Launch vanilla or modded Minecraft instances from one desktop launcher.
- Work with Forge, Fabric, NeoForge, OptiFine, offline accounts, and third-party auth servers.
- Browse and install modpacks, duplicate or rename instances, export packs, and import shared manifests.
- Manage mods, worlds, resource packs, shaders, datapacks, screenshots, mirrors, and local storage from the launcher UI.
- Use FriendTunnel to host and join LAN-style multiplayer sessions over the internet without extra VPN tooling.
- Track local statistics, change themes and accents, use custom backgrounds, and adjust the launcher layout for daily use.

### `v0.5.0` Verified Highlights

- Shared shell surfaces now hold one trustworthy layout contract: content clears the custom title bar, dense pages keep their last actions visible, and deep routes no longer fight the sidebar for primary CTA ownership.
- The launcher brand reset is consistent across shell, settings, onboarding, and fallback states, while missing artwork now resolves through a neutral product-owned media treatment instead of broken or noisy branding.
- Modpack browser, details, create, edit, and secondary-content routes stay readable under dense desktop pressure with labeled metadata, stable summaries, and truthful dependency/runtime state.
- Dark/light themes and EN/RU locales now use explicit closeout pairs on the real shell, so state contrast, accent propagation, dates, counts, and translated copy can be reviewed on stable fixture data.
- Degraded, empty, missing-data, and fatal error states now render through productized recovery surfaces instead of raw React internals, unresolved placeholders, or contradictory availability copy.
- Release truth now includes a reusable seven-view closeout matrix on `manual-verification.html` plus a committed Playwright screenshot lane, not only tests and code review.

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

### Что Уже Проверено В `v0.5.0`

- Shared shell surface теперь держат единый layout-контракт: контент не уходит под custom title bar, dense-страницы не прячут финальные действия, а deep-route экраны не конфликтуют с sidebar по primary CTA.
- Brand reset применён последовательно к shell, settings, onboarding и fallback state, а отсутствующее artwork теперь проходит через нейтральный product-owned media fallback вместо broken-image или навязчивого брендинга.
- Modpack browser, details, create, edit и secondary-content route остаются читаемыми под плотной desktop-нагрузкой, с подписанными metadata, стабильными summary и честным runtime/dependency state.
- Для dark/light темы и EN/RU locale есть явные closeout-пары на реальном shell, поэтому контраст состояний, accent propagation, даты, счётчики и translated copy можно проверять на стабильных fixture-данных.
- Degraded, empty, missing-data и fatal error state теперь рендерятся через productized recovery surface вместо raw React internals, unresolved placeholder и противоречивого availability copy.
- Truth релиза теперь опирается на переиспользуемую seven-view closeout matrix в `manual-verification.html` и на committed Playwright screenshot lane, а не только на тесты и code review.

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
