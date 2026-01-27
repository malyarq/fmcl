## Architecture (English)

FriendLauncher is an **Electron** app with a **React (Vite)** renderer. Keep the boundaries strict:

- **Electron main process (`electron/`)**: OS access, file system, networking, game launching.
- **Preload (`electron/preload.ts` + `electron/preload/bridges/*`)**: the *only* place that exposes a safe API to the renderer via `contextBridge`.
- **Renderer (`src/`)**: UI/state only. No Node/Electron imports.

---

## Layering rules (most important)

- **Renderer must not call IPC channels directly**.
  - Prefer `src/services/ipc/*` wrappers (typed, centralized error handling).
- Prefer `window.api.*` (namespaced preload surface) over legacy `window.*` globals in new code.
- **Services must not import IPC registration code**.
  - IPC is wiring; services contain business logic.
- **Do not couple renderer modules to Electron file layout**.
  - Renderer talks to `window.*` (via preload) or `src/services/ipc/*` only.

---

## Multi-instance notes

- The app may run in multiple instances (dev or prod). When a second instance is created, its `userData` path is suffixed (e.g. `_2`).
- **Do not bind fixed ports blindly**. Any local servers should derive their port from the instance "slot".
  - Example: the local auth mock (used by `authlib-injector`) runs on:
    - slot 1: `http://127.0.0.1:25530`
    - slot 2: `http://127.0.0.1:25531`
    - etc.

---

## Where things live now

### Electron

- **IPC wiring**: `electron/ipc/ipcManager.ts`
- **IPC handlers by domain**: `electron/ipc/handlers/*Handlers.ts`
- **Log throttling**: `electron/ipc/logThrottler.ts`
- **Preload surface**:
  - aggregator: `electron/preload.ts`
  - domains: `electron/preload/bridges/*Bridge.ts`
- **Launcher domain**: `electron/services/launcher/*` (installers/types/launch flow)
  - Forge helpers: `electron/services/launcher/forge/*`
  - Modloader installers: `electron/services/launcher/modLoaders/*`
- **Network domain (Hyperswarm core + helpers)**: `electron/services/network/*`
  - core: `electron/services/network/networkManager.ts`
  - helpers: `electron/services/network/{hostPeer,joinPeer,muxer,types}.ts`
- **Business services (domains)**: `electron/services/*` (download/modpacks/java/launcher/mirrors/mods/network/runtime/updater/versions)
  - modpacks split: `electron/services/instances/{paths,types,indexStore,configStore}.ts` (note: folder name kept for compatibility, but service is ModpackService)
  - mods platform split: `electron/services/mods/platform/{loaderMapping,modrinthUtils,fsUtils}.ts`

### Renderer

- **IPC access layer (preferred)**: `src/services/ipc/*`
- **UI pages/components**: `src/components/*`
  - settings split: `src/components/settings/tabs/*` + `src/components/settings/utils/*`
  - settings tab header: `src/components/settings/SettingsTabsHeader.tsx`
  - app layout parts: `src/components/layout/*`
  - sidebar parts: `src/components/sidebar/*`
- **App state (contexts)**:
  - wrappers: `src/contexts/*Context.tsx`
  - domain modules: `src/contexts/instances/*` (note: folder name kept, but context is ModpackContext), `src/contexts/settings/*`
- **App composition**:
  - app root: `src/App.tsx`
  - app hooks: `src/app/hooks/*`

---

## Dependency direction (safe default)

Electron:

- `electron/ipc/*` → `electron/services/*`, `electron/* managers`
- `electron/app/*` (bootstrap/lifecycle) → `electron/services/*`, `electron/utils/*`
- `electron/services/*` → must not import `electron/ipc/*` and `electron/preload/*` (keep wiring thin)

Renderer:

- `src/components/*`, `src/contexts/*`, `src/features/*/hooks/*`, `src/app/hooks/*` → `src/services/ipc/*` → `window.*` (preload)

---

## Naming and ownership

- **IPC channel names** are part of the public API: changing them is a breaking change.
- **`window.*` surface** is part of the public API: changing names/signatures is a breaking change.
- Canonical contract map: `docs/en/contracts-map.md` and `docs/ru/contracts-map.md`.

