## Public contracts map (English)

Goal: keep a stable public API surface so refactors do not break the app.

**Sources of truth**

- IPC registration: `electron/ipc/ipcManager.ts` + `electron/ipc/handlers/*`
- Preload surface: `electron/preload.ts` + `electron/preload/bridges/*`
- Renderer typings for `window.*`: `src/vite-env.d.ts`
- Renderer usage: search in `src/**` for `window.` (prefer `src/services/ipc/*` instead)

Snapshot date: **2026-01-26**

---

## 1) IPC contracts

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
  - `modpacks:exportFromInstance` (Phase 4)
  - `modpacks:createLocal` (Phase 4)
  - `modpacks:export` (Phase 4)
  - `modpacks:import` (Phase 4)
  - `modpacks:addMod` (Phase 4)
  - `modpacks:removeMod` (Phase 4)
  - `modpacks:updateOverrides` (Phase 4)
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

### 1.2 `webContents.send(...)` (main → renderer events)

- **launcher**
  - `launcher:log`
  - `launcher:progress`
  - `launcher:close`

- **network**
  - `network:lan-discover` (LAN discovery events)

- **modpacks**
  - `modpacks:updateProgress` (modpack installation/update progress events)

---

## 2) Public `window.*` surface (preload)

### 2.1 High-level APIs (preferred)

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
    - (legacy alias) `mods:*`, `modpacks:*` — see `window.mods` and `window.modpacks`
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
    - `modpacks:exportFromInstance`, `modpacks:createLocal` (Phase 4)
    - `modpacks:export`, `modpacks:import` (Phase 4)
    - `modpacks:addMod`, `modpacks:removeMod`, `modpacks:updateOverrides` (Phase 4)

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

### 2.2 Updater APIs

IPC handlers are registered in `electron/ipc/ipcManager.ts`, while update events are forwarded from `electron/services/updater/appUpdater.ts`.

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

### 2.3 Unified namespace (preferred for new code)

- **`window.api`**
  - Unified namespace containing all domain APIs
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
  - **Recommendation:** In new code, use `window.api.*` instead of direct `window.*` globals

### 2.4 Raw bridge (escape hatch)

- **`window.ipcRenderer`**
  - `on/off/send/invoke`
  - Note: channels are restricted by an allowlist (see `shared/contracts/ipcChannels.ts`), but you should still avoid this in favor of `src/services/ipc/*` and domain `window.*` APIs.

---

## 3) Renderer usage map (`src/`)

### 3.1 Preload clients (`window.<bridge>.*` or `window.api.*`)

- `src/services/ipc/settingsIPC.ts` → `window.api.settings.*` (or `window.settings.*`)
- `src/services/ipc/cacheIPC.ts` → `window.api.cache.*` (or `window.cache.*`)
- `src/services/ipc/assetsIPC.ts` → `window.api.assets.*` (or `window.assets.*`)
- `src/services/ipc/networkIPC.ts` → `window.api.network.*` (or `window.networkAPI.*`)
- `src/services/ipc/launcherIPC.ts` → `window.api.launcher.*` (or `window.launcher.*`)
- `src/services/ipc/modpacksIPC.ts` → `window.api.modpacks.*` (or `window.modpacks.*`, fallback: `window.launcher.*`)
  - Uses methods: `list`, `bootstrap`, `getSelected`, `setSelected`, `create`, `rename`, `duplicate`, `remove`, `getConfig`, `saveConfig`
  - New methods: `searchCurseForge`, `searchModrinth`, `getCurseForgeVersions`, `getModrinthVersions`, `installCurseForge`, `installModrinth`
- `src/services/ipc/appUpdaterIPC.ts` → `window.api.appUpdater.*` (or `window.appUpdater.*`)
- `src/services/ipc/windowControlsIPC.ts` → `window.api.windowControls.*` (or `window.windowControls.*`)

### 3.2 Native browser `window.*` (NOT preload contracts)

These are standard browser APIs (no Electron bridge involved):

- `src/App.tsx`: `window.addEventListener/removeEventListener`
- `src/components/ui/Modal.tsx`: `window.addEventListener/removeEventListener`
- `src/components/Sidebar.tsx`: `window.location.reload()`
- `src/components/ErrorBoundary.tsx`: `window.location.reload()`
- `src/components/SettingsPage.tsx`: `window.confirm(...)`

