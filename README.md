# FriendLauncher

[English](#english) | [Русский](#russian)

FriendLauncher is a desktop Minecraft launcher for people who move between vanilla play, modpacks, and multiplayer with friends. It combines local instance management, modpack browsing, content tools, and FriendTunnel P2P play in one Electron application.

The current `v0.2.0` UI refresh has been checked against a browser-backed manual verification seam on `2026-04-13`. The verified walkthrough covered welcome and onboarding, the dashboard and play flow, settings and accounts, modpack list and browser, modpack details and export flows, sharing, screenshots, utilities, and datapack management. The descriptions below reflect that verified launcher surface rather than old backlog plans.

## <a name="english"></a>English

### What Players Can Do Today

- Launch vanilla or modded Minecraft instances from one desktop launcher.
- Work with Forge, Fabric, NeoForge, OptiFine, offline accounts, and third-party auth servers.
- Browse and install modpacks, duplicate or rename instances, export packs, and import shared manifests.
- Manage mods, worlds, resource packs, shaders, datapacks, screenshots, mirrors, and local storage from the launcher UI.
- Use FriendTunnel to host and join LAN-style multiplayer sessions over the internet without extra VPN tooling.
- Track local statistics, change themes and accents, use custom backgrounds, and adjust the launcher layout for daily use.

### Refreshed UI Status

- Shared shells, cards, dialogs, forms, and feedback states now follow one visual system instead of route-specific styling.
- Theme and accent settings update the launcher shell and refreshed routes consistently.
- Refreshed surfaces ship with synchronized English and Russian UI copy instead of placeholder-heavy mixes.
- Core and secondary routes were manually walked through before release closeout instead of being declared finished from code review alone.

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

### Состояние UI-обновления

- Shell, карточки, диалоги, формы и состояния обратной связи теперь собраны в одну визуальную систему вместо разрозненных экранных стилей.
- Настройки темы и акцента применяются ко всему shell и обновлённым маршрутам согласованно.
- На обновлённых экранах синхронизированы английская и русская локализации без смеси плейсхолдеров и пропущенных строк.
- Основные и вторичные сценарии были вручную пройдены через браузерный проверочный контур перед закрытием milestone, а не объявлены готовыми только по коду.

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
