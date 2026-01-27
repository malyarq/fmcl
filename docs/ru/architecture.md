## Архитектура (Русский)

FriendLauncher — это **Electron** приложение с **React (Vite)** renderer’ом. Важно держать границы слоёв жёсткими:

- **Electron main process (`electron/`)**: доступ к ОС, файловой системе, сети, запуск игры.
- **Preload (`electron/preload.ts` + `electron/preload/bridges/*`)**: *единственное* место, где renderer получает API через `contextBridge`.
- **Renderer (`src/`)**: UI/состояние. Никаких импортов Node/Electron.

---

## Правила слоёв (самое важное)

- **Renderer не должен дергать IPC-каналы напрямую**.
  - Используем обёртки `src/services/ipc/*` (типизация, единая обработка ошибок).
- В новом коде предпочитаем `window.api.*` (namespaced preload surface) вместо legacy `window.*` глобалов.
- **Сервисы не должны импортировать IPC wiring**.
  - IPC — это “проводка”, бизнес-логика живёт в сервисах.
- **Renderer не привязываем к структуре Electron-папок**.
  - Renderer общается через `window.*` (preload) или `src/services/ipc/*`.

---

## Multi-instance заметки

- Приложение может запускаться в нескольких инстансах (dev или prod). Для второго инстанса `userData` получает суффикс (например `_2`).
- **Не используем жёстко фиксированные порты**. Любые локальные сервера должны выводить порт из “слота” инстанса.
  - Пример: локальный auth mock (для `authlib-injector`) слушает:
    - slot 1: `http://127.0.0.1:25530`
    - slot 2: `http://127.0.0.1:25531`
    - и т.д.

---

## Где что лежит сейчас

### Electron

- **IPC wiring**: `electron/ipc/ipcManager.ts`
- **IPC handlers по доменам**: `electron/ipc/handlers/*Handlers.ts`
- **Троттлинг логов**: `electron/ipc/logThrottler.ts`
- **Preload surface**:
  - сборщик: `electron/preload.ts`
  - домены: `electron/preload/bridges/*Bridge.ts`
- **Утилиты (низкоуровневое/инфра)**: `electron/utils/*`
- **Launcher-домен**: `electron/services/launcher/*` (инсталлеры/типы/launch flow)
  - Forge-хелперы: `electron/services/launcher/forge/*`
  - Инсталлеры модлоадеров: `electron/services/launcher/modLoaders/*`
- **Network-домен (Hyperswarm core + helpers)**: `electron/services/network/*`
  - core: `electron/services/network/networkManager.ts`
  - helpers: `electron/services/network/{hostPeer,joinPeer,muxer,types}.ts`
- **Сервисы (домены)**: `electron/services/*` (download/modpacks/java/launcher/mirrors/mods/network/runtime/updater/versions)
  - modpacks разнесён: `electron/services/instances/{paths,types,indexStore,configStore}.ts` (примечание: имя папки оставлено для совместимости, но сервис - ModpackService)
  - mods platform разнесён: `electron/services/mods/platform/{loaderMapping,modrinthUtils,fsUtils}.ts`

### Renderer

- **Слой IPC (предпочтительно)**: `src/services/ipc/*`
- **Сервисы (чистые, без React)**: `src/services/*` (например `src/services/versions/*`)
- **UI**: `src/components/*`
  - настройки разнесены: `src/components/settings/tabs/*` + `src/components/settings/utils/*`
  - заголовок табов настроек: `src/components/settings/SettingsTabsHeader.tsx`
  - части layout: `src/components/layout/*`
  - части sidebar: `src/components/sidebar/*`
- **Состояние (contexts)**:
  - обёртки: `src/contexts/*Context.tsx`
  - доменные модули: `src/contexts/instances/*` (примечание: имя папки оставлено, но контекст - ModpackContext), `src/contexts/settings/*`
- **App composition**:
  - корень: `src/App.tsx`
  - app-хуки: `src/app/hooks/*`

---

## Направление зависимостей (безопасный дефолт)

Electron:

- `electron/ipc/*` → `electron/services/*`, `electron/* managers`
- `electron/app/*` (bootstrap/lifecycle) → `electron/services/*`, `electron/utils/*`
- `electron/services/*` → **не импортируют** из `electron/ipc/*` и `electron/preload/*` (wiring остаётся “тонким”)
- `electron/utils/*` → низкоуровневые патчи/хелперы без доменной логики

Renderer:

- `src/components/*`, `src/contexts/*`, `src/features/*/hooks/*`, `src/app/hooks/*` → `src/services/ipc/*` → `window.*` (preload)

---

## Имена и владение

- **Имена IPC каналов** — часть публичного API: менять их = breaking change.
- **`window.*` API** — часть публичного API: менять имена/сигнатуры = breaking change.
- Каноничная карта контрактов: `docs/ru/contracts-map.md` и `docs/en/contracts-map.md`.

