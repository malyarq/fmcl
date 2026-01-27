## Карта публичных контрактов (Русский)

Цель: держать стабильную публичную поверхность, чтобы рефакторинги не ломали приложение.

**Источники истины**

- Регистрация IPC: `electron/ipc/ipcManager.ts` + `electron/ipc/handlers/*`
- Preload surface: `electron/preload.ts` + `electron/preload/bridges/*`
- Типы `window.*` в renderer: `src/vite-env.d.ts`
- Использование в UI: поиск по `src/**` на `window.` (предпочтительно использовать `src/services/ipc/*`)

Дата снимка: **2026-01-26**

---

## 1) IPC контракты

### 1.1 `ipcMain.handle(...)` (renderer → main)

- **window**
  - `window:minimize`
  - `window:close`

- **launcher**
  - `launcher:launch`
  - `launcher:getVersionList`
  - `launcher:getForgeSupportedVersions`
  - `launcher:getFabricSupportedVersions`
  - `launcher:getOptiFineSupportedVersions`
  - `launcher:getNeoForgeSupportedVersions`
  - `launcher:clearCache`
  - `launcher:reload`

- **mods**
  - `mods:searchMods`
  - `mods:getModVersions`
  - `mods:installModFile`

- **modpacks**
  - `modpacks:list`
  - `modpacks:listWithMetadata`
  - `modpacks:bootstrap`
  - `modpacks:getSelected`
  - `modpacks:setSelected`
  - `modpacks:create`
  - `modpacks:rename`
  - `modpacks:duplicate`
  - `modpacks:delete`
  - `modpacks:getConfig`
  - `modpacks:saveConfig`
  - `modpacks:getMetadata`
  - `modpacks:updateMetadata`
  - `modpacks:searchCurseForge`
  - `modpacks:searchModrinth`
  - `modpacks:getCurseForgeVersions`
  - `modpacks:getModrinthVersions`
  - `modpacks:installCurseForge`
  - `modpacks:installModrinth`
  - `modpacks:exportFromInstance` (Фаза 4)
  - `modpacks:createLocal` (Фаза 4)
  - `modpacks:export` (Фаза 4)
  - `modpacks:import` (Фаза 4)
  - `modpacks:addMod` (Фаза 4)
  - `modpacks:removeMod` (Фаза 4)
  - `modpacks:updateOverrides` (Фаза 4)
  - `modpacks:getModpackInfoFromFile`
  - `modpacks:getMods`
  - `modpacks:backup`

- **network**
  - `network:host`
  - `network:join`
  - `network:stop`
  - `network:getMode`
  - `network:setMode`
  - `network:ping`
  - `network:lanStart`
  - `network:lanStop`
  - `network:lanBroadcast`
  - `network:upnpMapTcp`
  - `network:upnpUnmapTcp`

- **settings**
  - `settings:selectMinecraftPath`
  - `settings:openMinecraftPath`
  - `settings:getDefaultMinecraftPath`

- **assets**
  - `assets:getIconPath`

- **dialog**
  - `dialog:showOpenDialog`
  - `dialog:showSaveDialog`

- **instances**
  - `instances:list`
  - `instances:bootstrap`
  - `instances:getSelected`
  - `instances:setSelected`
  - `instances:create`
  - `instances:rename`
  - `instances:duplicate`
  - `instances:delete`
  - `instances:getConfig`
  - `instances:saveConfig`

### 1.2 `webContents.send(...)` (main → renderer, события)

- **launcher**
  - `launcher:log`
  - `launcher:progress`
  - `launcher:close`

- **network**
  - `network:lan-discover` (LAN discovery events)

- **modpacks**
  - `modpacks:updateProgress` (события прогресса установки/обновления модпака)

---

## 2) Публичное `window.*` (preload)

### 2.1 Высокоуровневые API (предпочтительно)

- **`window.networkAPI`**
  - calls → `ipcRenderer.invoke(...)`:
    - `network:host`, `network:join`, `network:stop`
    - `network:getMode`, `network:setMode`
    - `network:ping`
    - `network:lanStart`, `network:lanStop`, `network:lanBroadcast`
    - `network:upnpMapTcp`, `network:upnpUnmapTcp`
  - events:
    - `onLanDiscover(cb)` ← `network:lan-discover`

- **`window.launcher`**
  - calls → `ipcRenderer.invoke(...)`:
    - `launcher:launch`
    - `launcher:getVersionList`
    - `launcher:getForgeSupportedVersions`
    - `launcher:getFabricSupportedVersions`
    - `launcher:getOptiFineSupportedVersions`
    - `launcher:getNeoForgeSupportedVersions`
    - (legacy alias) `mods:*`, `modpacks:*` — см. `window.mods` и `window.modpacks`
  - events:
    - `onLog(cb)` ← `launcher:log`
    - `onProgress(cb)` ← `launcher:progress`
    - `onClose(cb)` ← `launcher:close`

- **`window.modpacks`**
  - calls → `ipcRenderer.invoke(...)`:
    - `modpacks:list`, `modpacks:listWithMetadata`, `modpacks:bootstrap`
    - `modpacks:getSelected`, `modpacks:setSelected`
    - `modpacks:create`, `modpacks:rename`, `modpacks:duplicate`, `modpacks:delete`
    - `modpacks:getConfig`, `modpacks:saveConfig`
    - `modpacks:getMetadata`, `modpacks:updateMetadata`
    - `modpacks:searchCurseForge`, `modpacks:searchModrinth`
    - `modpacks:getCurseForgeVersions`, `modpacks:getModrinthVersions`
    - `modpacks:installCurseForge`, `modpacks:installModrinth`
    - `modpacks:exportFromInstance`, `modpacks:createLocal` (Фаза 4)
    - `modpacks:export`, `modpacks:import` (Фаза 4)
    - `modpacks:addMod`, `modpacks:removeMod`, `modpacks:updateOverrides` (Фаза 4)

- **`window.mods`**
  - calls → `ipcRenderer.invoke(...)`:
    - `mods:searchMods`, `mods:getModVersions`, `mods:installModFile`

- **`window.windowControls`**
  - `minimize()` → `window:minimize`
  - `close()` → `window:close`

- **`window.cache`**
  - `clear()` → `launcher:clearCache`
  - `reload()` → `launcher:reload`

- **`window.settings`**
  - `selectMinecraftPath()` → `settings:selectMinecraftPath`
  - `openMinecraftPath(path?)` → `settings:openMinecraftPath`
  - `getDefaultMinecraftPath()` → `settings:getDefaultMinecraftPath`

- **`window.assets`**
  - `getIconPath()` → `assets:getIconPath`

### 2.2 Updater API

IPC handlers регистрируются в `electron/ipc/ipcManager.ts`, а события обновления прокидываются из `electron/services/updater/appUpdater.ts`.

- **`window.updater`**
  - `sync(manifestUrl, optionsOrRootPath?)` → `updater:sync`
  - `onProgress(cb)` ← `updater:progress`

- **`window.appUpdater`**
  - `check()` → `app-updater:check`
  - `quitAndInstall()` → `app-updater:quit-and-install`
  - events:
    - `app-updater:status`
    - `app-updater:available`
    - `app-updater:not-available`
    - `app-updater:error`
    - `app-updater:progress`
    - `app-updater:downloaded`

### 2.3 Unified namespace (предпочтительно для нового кода)

- **`window.api`**
  - Объединенный namespace со всеми доменными API
  - `window.api.launcher` → `window.launcher`
  - `window.api.modpacks` → `window.modpacks`
  - `window.api.mods` → `window.mods`
  - `window.api.network` → `window.networkAPI`
  - `window.api.updater` → `window.updater`
  - `window.api.appUpdater` → `window.appUpdater`
  - `window.api.windowControls` → `window.windowControls`
  - `window.api.cache` → `window.cache`
  - `window.api.settings` → `window.settings`
  - `window.api.assets` → `window.assets`
  - `window.api.ipcRenderer` → `window.ipcRenderer`
  - **Рекомендация:** В новом коде используй `window.api.*` вместо прямых `window.*` глобалов

### 2.4 Raw bridge (escape hatch)

- **`window.ipcRenderer`**
  - `on/off/send/invoke`
  - Ограничение: каналы ограничены allowlist’ом (см. `shared/contracts/ipcChannels.ts`), но всё равно избегай в пользу `src/services/ipc/*` и доменных `window.*`.

---

## 3) Карта использования в renderer (`src/`)

### 3.1 Клиенты preload (`window.<bridge>.*` или `window.api.*`)

- `src/services/ipc/settingsIPC.ts` → `window.api.settings.*` (или `window.settings.*`)
- `src/services/ipc/cacheIPC.ts` → `window.api.cache.*` (или `window.cache.*`)
- `src/services/ipc/assetsIPC.ts` → `window.api.assets.*` (или `window.assets.*`)
- `src/services/ipc/networkIPC.ts` → `window.api.network.*` (или `window.networkAPI.*`)
- `src/services/ipc/launcherIPC.ts` → `window.api.launcher.*` (или `window.launcher.*`)
- `src/services/ipc/modpacksIPC.ts` → `window.api.modpacks.*` (или `window.modpacks.*`, fallback: `window.launcher.*`)
  - Использует методы: `list`, `bootstrap`, `getSelected`, `setSelected`, `create`, `rename`, `duplicate`, `remove`, `getConfig`, `saveConfig`
  - Новые методы: `searchCurseForge`, `searchModrinth`, `getCurseForgeVersions`, `getModrinthVersions`, `installCurseForge`, `installModrinth`
- `src/services/ipc/appUpdaterIPC.ts` → `window.api.appUpdater.*` (или `window.appUpdater.*`)
- `src/services/ipc/windowControlsIPC.ts` → `window.api.windowControls.*` (или `window.windowControls.*`)

### 3.2 Нативный браузерный `window.*` (НЕ preload contracts)

Это стандартные браузерные API (без Electron bridge):

- `src/App.tsx`: `window.addEventListener/removeEventListener`
- `src/components/ui/Modal.tsx`: `window.addEventListener/removeEventListener`
- `src/components/Sidebar.tsx`: `window.location.reload()`
- `src/components/ErrorBoundary.tsx`: `window.location.reload()`
- `src/components/SettingsPage.tsx`: `window.confirm(...)`

