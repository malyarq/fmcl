# FriendLauncher 🎮

![License](https://img.shields.io/badge/license-MIT-blue.svg) ![Version](https://img.shields.io/badge/version-0.1.0-green.svg)

[English](#english) | [Русский](#russian)

---

<a name="english"></a>
# English 🇺🇸

**FriendLauncher** is a modern, lightweight, and collaborative Minecraft Launcher allowing you to play "LAN" worlds with friends over the internet seamlessly. No need for port forwarding, static IPs, or external VPN tools like Hamachi.

## ✨ Key Features

- **🌐 Easy P2P Multiplayer (FriendTunnel)**:
  - Built-in tunneling system using **Hyperswarm**.
  - Host a world, generate a code, and friends can join as if they were on your local Wi-Fi.
  - Bypass NAT and firewall restrictions automatically.
- **📦 Modpack and Instance Workflows**:
  - Browse Modrinth modpacks with history and configurable pagination.
  - Create local instances, duplicate or rename them from the installed cards, and import or export packs.
  - Share instances with invite codes and import shared manifests directly in the launcher.
- **🧩 Content Management**:
  - Manage mods, resource packs, shaders, worlds, datapacks, and screenshots from the launcher UI.
  - Track content storage usage and clean up stale data safely.
- **🔓 Flexible Accounts and Skins**:
  - Support offline accounts and third-party auth servers through **authlib-injector**.
  - Add, remove, and switch between multiple accounts.
  - Provider-aware skin preview and management handoff for **Blessing Skin** and **LittleSkin**.
- **🚀 Download Resilience and Caching**:
  - Parallel and resumable downloads with validation and retry handling.
  - Persistent disk cache for remote modpack and mod imagery.
  - Custom mirrors, speed tests, auto-select, persisted priority order, and fallback download behavior.
- **📊 Local Statistics and UI Customization**:
  - View total play time, launch counts, popular modpacks, usage trends, and export local statistics.
  - Customize themes, background images/videos/particles, UI scale, sidebar position, compact mode, and animation settings.
- **⚡ Modern Tech Stack**:
  - Built on **Electron** + **React** + **TypeScript** + **TailwindCSS**.
  - **Vite** powered build system with **Vitest** coverage for release-critical logic.

## 🚀 How It Works

### The P2P Networking
FriendLauncher removes the headache of setting up servers. It treats the internet like a LAN room.
1. **Host**: When you click "Host" in the launcher, it joins a distributed P2P network (DHT) with a unique topic (Room Code). It proxies your local Minecraft LAN port (e.g., 54321) through this P2P stream.
2. **Join**: Your friend enters the Room Code. Their launcher finds your computer in the swarm, creates a local server on their machine, and tunnels the traffic to you.
3. **Playing**: To Minecraft, it looks like a local connection (`localhost:random_port`), but the data travels securely peer-to-peer over the internet.

## 📦 Installation & Development

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher)
- [Java](https://www.java.com/) (Java 8 for older versions, Java 17 for 1.18+)

## 📚 Docs

- Project docs: `docs/README.md`
- **Development Roadmap:**
  - `docs/en/roadmap.md` (EN)
  - `docs/ru/roadmap.md` (RU)
- Public contracts (IPC + `window.*`):
  - `docs/en/contracts-map.md` (EN)
  - `docs/ru/contracts-map.md` (RU)

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/your-username/friend-launcher.git

# 2. Install dependencies
npm install

# 3. Run tests (recommended before local changes)
npm test

# 4. Start Development Mode
# This runs the Vite renderer and Electron main process concurrently
npm run dev
```

### Building for Production

To create a standalone `.exe` installer:

```bash
npm run build
```
The output will be in the `release/` folder.

## ⚠️ Disclaimer
This project includes tools (`authlib-injector`) to bypass official Minecraft authentication. It is intended for educational purposes and for players who cannot access official services. Please support Mojang/Microsoft by purchasing the game if you can.

---

<a name="russian"></a>
# Русский 🇷🇺

**FriendLauncher** — это современный, легкий лаунчер для Minecraft, созданный с одной главной целью: играть с друзьями по сети так же просто, как в одной комнате. Забудьте об открытии портов, белых IP и Hamachi.

## ✨ Основные Возможности

- **🌐 Простой P2P Мультиплеер**:
  - Встроенная система туннелирования на базе **Hyperswarm**.
  - Создайте мир, скиньте другу **Код Комнаты**, и он подключится к вам через интернет, как по локальной сети.
  - Работает через любые NAT и брандмауэры.
- **📦 Управление модпаками и инстансами**:
  - Браузер Modrinth с историей просмотров и настраиваемой пагинацией.
  - Создание локальных инстансов, дублирование и переименование прямо из карточек.
  - Импорт, экспорт и обмен инстансами через share code.
- **🧩 Управление контентом**:
  - Моды, ресурспаки, шейдеры, миры, датапаки и скриншоты управляются из UI лаунчера.
  - Есть статистика использования контента и безопасная очистка лишних данных.
- **🔓 Гибкие аккаунты и скины**:
  - Поддержка оффлайн-аккаунтов и сторонних auth-серверов через **authlib-injector**.
  - Несколько аккаунтов, переключение между ними и удаление из настроек.
  - Provider-aware preview и переход к управлению скинами для **Blessing Skin** и **LittleSkin**.
- **🚀 Устойчивые загрузки и кэширование**:
  - Параллельные и возобновляемые загрузки с проверкой файлов и retry-логикой.
  - Постоянный дисковый кэш для иконок и изображений модпаков и модов.
  - Кастомные зеркала, тест скорости, авто-выбор, сохранение приоритета и fallback-поведение загрузок.
- **📊 Локальная статистика и кастомизация UI**:
  - Время игры, число запусков, популярные модпаки, тренды использования и экспорт статистики.
  - Кастомные темы, фоновые изображения/видео/частицы, zoom интерфейса, положение сайдбара, compact mode и отключение анимаций.
- **⚡ Современный Стек**:
  - Интерфейс на **Electron** + **React** + **TypeScript** + **TailwindCSS**.
  - Сборка на **Vite** и тесты на **Vitest** для критичных релизных сценариев.

## 🚀 Как это работает?

### Магия Сети (P2P)
FriendLauncher превращает интернет в локальную сеть.
1. **Хост**: Когда вы создаете лобби в лаунчере, он регистрируется в децентрализованной сети (DHT) с уникальным кодом. Весь трафик с вашего LAN-порта Minecraft передается через зашифрованный P2P канал.
2. **Игрок**: Друг вводит код. Его лаунчер находит ваш ПК в сети, поднимает локальный сервер-мост и пересылает данные.
3. **Игра**: Minecraft "думает", что вы играете по локалке, подключаясь к `localhost`, хотя вы можете быть в разных городах.

## 📦 Установка и Разработка

### Требования
- [Node.js](https://nodejs.org/) (v16 и выше)
- [Java](https://www.java.com/) (Java 8 для старых версий, Java 17 для 1.18+)

## 📚 Документация

- Документация проекта: `docs/README.md`
- **Роадмап разработки:**
  - `docs/ru/roadmap.md` (RU)
  - `docs/en/roadmap.md` (EN)
- Контракты (IPC + `window.*`):
  - `docs/ru/contracts-map.md` (RU)
  - `docs/en/contracts-map.md` (EN)

### Запуск проекта

```bash
# 1. Установите зависимости
npm install

# 2. Прогон тестов перед изменениями (рекомендуется)
npm test

# 3. Запуск в режиме разработки
# Запускает и интерфейс (Vite), и ядро (Electron)
npm run dev
```

### Сборка (Build)

Для создания установочного файла `.exe`:

```bash
npm run build
```
Готовый файл появится в папке `release/`.

## ⚠️ Отказ от ответственности
Проект содержит инструменты для обхода официальной авторизации (`authlib-injector`). Это сделано для удобства и образовательных целей. Если у вас есть возможность, пожалуйста, поддержите разработчиков игры (Mojang/Microsoft), купив лицензионную версию.
