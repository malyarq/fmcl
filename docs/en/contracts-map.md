## Public Contracts Map (English)

Goal: document the live IPC, preload, and renderer contract surface for the shipped FMCL release.

**Sources of truth**

- IPC registration: `electron/ipc/ipcManager.ts` + `electron/ipc/handlers/*`
- Preload surface: `electron/preload.ts` + `electron/preload/bridges/*`
- Allowlist: `shared/contracts/ipcChannels.ts`
- Unified renderer API type: `shared/contracts/windowApi.ts`
- Renderer wrappers: `src/services/ipc/*`

Snapshot date: **2026-04-21**

---

## 1) Preload surface

### 1.1 Legacy globals exposed in `electron/preload.ts`

- `window.networkAPI`
- `window.ipcRenderer`
- `window.launcher`
- `window.modpacks`
- `window.mods`
- `window.updater`
- `window.appUpdater`
- `window.windowControls`
- `window.cache`
- `window.settings`
- `window.assets`
- `window.screenshots`
- `window.account`
- `window.mirrors`
- `window.share`
- `window.externalLinks`

Notes:

- `window.screenshots` is a live legacy bridge exposed in preload and consumed through `src/services/ipc/screenshotsIPC.ts`.
- Statistics are exposed through the namespaced API only: use `window.api.statistics`. There is no top-level `window.statistics` global in preload.

### 1.2 Supported namespaced API for renderer code

`window.api` contains:

- `window.api.launcher`
- `window.api.modpacks`
- `window.api.mods`
- `window.api.updater`
- `window.api.appUpdater`
- `window.api.windowControls`
- `window.api.network`
- `window.api.cache`
- `window.api.settings`
- `window.api.assets`
- `window.api.resourcePacks`
- `window.api.shaders`
- `window.api.ipcRenderer`
- `window.api.account`
- `window.api.mirrors`
- `window.api.statistics`
- `window.api.share`
- `window.api.externalLinks`

Preferred rule: new renderer code should use `window.api.*` or the typed wrappers in `src/services/ipc/*`, not raw `window.*` calls.

---

## 2) Renderer wrappers

### 2.1 Core wrappers

- `src/services/ipc/launcherIPC.ts` → `window.api.launcher`
- `src/services/ipc/modpacksIPC.ts` → `window.api.modpacks`
- `src/services/ipc/networkIPC.ts` → `window.api.network`
- `src/services/ipc/settingsIPC.ts` → `window.api.settings`
- `src/services/ipc/cacheIPC.ts` → `window.api.cache`
- `src/services/ipc/assetsIPC.ts` → `window.api.assets`
- `src/services/ipc/appUpdaterIPC.ts` → `window.api.appUpdater`
- `src/services/ipc/windowControlsIPC.ts` → `window.api.windowControls`

### 2.2 Release-critical typed wrappers added in later phases

- `src/services/ipc/accountIPC.ts` → `window.api.account`
- `src/services/ipc/mirrorsIPC.ts` → `window.api.mirrors`
- `src/services/ipc/statisticsIPC.ts` → `window.api.statistics`
- `src/services/ipc/shareIPC.ts` → `window.api.share`
- `src/services/ipc/externalLinksIPC.ts` → `window.api.externalLinks`
- `src/services/ipc/screenshotsIPC.ts` → `window.screenshots`
- `src/services/ipc/resourcePacksIPC.ts` → `window.api.resourcePacks`
- `src/services/ipc/shadersIPC.ts` → `window.api.shaders`

### 2.3 Native browser `window.*` usage (not Electron contracts)

- `window.addEventListener` / `window.removeEventListener`
- `window.location.reload()`
- `window.confirm(...)`
- `window.matchMedia(...)`

---

## 3) Allowed IPC channels snapshot

### 3.1 Window

- `window:minimize`
- `window:close`
- `window:openConsole`
- `window:closeConsole`

### 3.2 Launcher

- `launcher:launch`
- `launcher:getVersionList`
- `launcher:getForgeSupportedVersions`
- `launcher:getFabricSupportedVersions`
- `launcher:getOptiFineSupportedVersions`
- `launcher:getNeoForgeSupportedVersions`
- `launcher:clearCache`
- `launcher:reload`
- `launcher:killAndRestart`
- `launcher:stdin`
- `launcher:log`
- `launcher:progress`
- `launcher:close`

### 3.3 Mods

- `mods:searchMods`
- `mods:getModVersions`
- `mods:installModFile`

### 3.4 Instances

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

### 3.5 Network

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
- `network:lan-discover`

### 3.6 Settings and dialogs

- `settings:selectMinecraftPath`
- `settings:openMinecraftPath`
- `settings:getDefaultMinecraftPath`
- `dialog:showSaveDialog`
- `dialog:showOpenDialog`
- `dialog:getDesktopPath`

### 3.7 Assets and cache

- `assets:getIconPath`
- `cache:getImageState`
- `cache:setImageLimit`
- `cache:cleanupImage`
- `cache:resolveImage`

### 3.8 Updaters

- `updater:sync`
- `updater:progress`
- `app-updater:check`
- `app-updater:download`
- `app-updater:quit-and-install`
- `app-updater:status`
- `app-updater:available`
- `app-updater:not-available`
- `app-updater:error`
- `app-updater:progress`
- `app-updater:downloaded`

### 3.9 Modpacks

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
- `modpacks:exportFromInstance`
- `modpacks:createLocal`
- `modpacks:export`
- `modpacks:getModpackInfoFromFile`
- `modpacks:import`
- `modpacks:addMod`
- `modpacks:removeMod`
- `modpacks:setModEnabled`
- `modpacks:updateOverrides`
- `modpacks:getMods`
- `modpacks:backup`
- `modpacks:createFromManifest`
- `modpacks:cleanupContent`
- `modpacks:getContentStats`
- `modpacks:resolvePath`
- `modpacks:scanJava`
- `modpacks:updateProgress`

### 3.10 Resource packs, shaders, worlds, datapacks

- `resourcePacks:list`
- `resourcePacks:enable`
- `resourcePacks:disable`
- `resourcePacks:reorder`
- `resourcePacks:import`
- `resourcePacks:delete`
- `resourcePacks:openFolder`
- `resourcePacks:add`
- `shaders:list`
- `shaders:setActive`
- `shaders:disable`
- `shaders:delete`
- `shaders:openFolder`
- `shaders:add`
- `worlds:list`
- `worlds:delete`
- `worlds:backup`
- `worlds:duplicate`
- `worlds:openFolder`
- `datapacks:list`
- `datapacks:enable`
- `datapacks:disable`
- `datapacks:delete`
- `datapacks:search`
- `datapacks:install`
- `datapacks:getVersions`

Outcome notes:

- `resourcePacks:import` and `resourcePacks:add` now return `ResourcePackAcquisitionResult` with named statuses instead of booleans.
- `shaders:add` now returns `ShaderPackAcquisitionResult` with named statuses instead of booleans.

### 3.11 App, account, mirrors, screenshots

- `app:saveFile`
- `account:getAccounts`
- `account:getSelectedAccount`
- `account:addOffline`
- `account:addThirdParty`
- `account:getSkinState`
- `account:refreshSkinState`
- `account:removeAccount`
- `account:selectAccount`
- `mirrors:getMirrors`
- `mirrors:getSelectedMirror`
- `mirrors:addCustomMirror`
- `mirrors:removeMirror`
- `mirrors:selectMirror`
- `mirrors:moveMirror`
- `mirrors:testSpeed`
- `mirrors:setAutoSelect`
- `mirrors:isAutoSelectEnabled`
- `screenshots:list`
- `screenshots:delete`
- `screenshots:rename`
- `screenshots:openFolder`

### 3.12 Share, statistics, external links

- `share:generateCode`
- `share:importCode`
- `stats:get`
- `stats:export`
- `externalLinks:open`

---

## 4) Release notes for contract consumers

- Use typed wrappers from `src/services/ipc/*` when possible.
- Keep `shared/contracts/ipcChannels.ts`, this document, and `docs/ru/contracts-map.md` aligned.
- When adding or removing preload globals, update both `electron/preload.ts` and the renderer typing story (`shared/contracts/*`, `src/vite-env.d.ts`, or local wrapper augmentation) in the same change.
