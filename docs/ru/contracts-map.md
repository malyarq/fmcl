## Карта публичных контрактов (Русский)

Цель: зафиксировать живую поверхность IPC, preload и renderer-контрактов для shipped-релиза FMCL.

**Источники истины**

- Регистрация IPC: `electron/ipc/ipcManager.ts` + `electron/ipc/handlers/*`
- Preload surface: `electron/preload.ts` + `electron/preload/bridges/*`
- Allowlist: `shared/contracts/ipcChannels.ts`
- Тип объединённого renderer API: `shared/contracts/windowApi.ts`
- Renderer-обёртки: `src/services/ipc/*`

Дата снимка: **2026-04-21**

---

## 1) Preload surface

### 1.1 Legacy globals, которые реально экспонируются в `electron/preload.ts`

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

Примечания:

- `window.screenshots` — это живой legacy bridge из preload, который используется через `src/services/ipc/screenshotsIPC.ts`.
- Статистика доступна только через namespaced API: используй `window.api.statistics`. Top-level `window.statistics` в preload нет.

### 1.2 Поддерживаемый namespaced API для renderer-кода

`window.api` содержит:

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

Предпочтительное правило: новый renderer-код должен использовать `window.api.*` или типизированные обёртки из `src/services/ipc/*`, а не raw `window.*`.

---

## 2) Renderer-обёртки

### 2.1 Базовые обёртки

- `src/services/ipc/launcherIPC.ts` → `window.api.launcher`
- `src/services/ipc/modpacksIPC.ts` → `window.api.modpacks`
- `src/services/ipc/networkIPC.ts` → `window.api.network`
- `src/services/ipc/settingsIPC.ts` → `window.api.settings`
- `src/services/ipc/cacheIPC.ts` → `window.api.cache`
- `src/services/ipc/assetsIPC.ts` → `window.api.assets`
- `src/services/ipc/appUpdaterIPC.ts` → `window.api.appUpdater`
- `src/services/ipc/windowControlsIPC.ts` → `window.api.windowControls`

### 2.2 Release-critical typed wrappers из поздних фаз

- `src/services/ipc/accountIPC.ts` → `window.api.account`
- `src/services/ipc/mirrorsIPC.ts` → `window.api.mirrors`
- `src/services/ipc/statisticsIPC.ts` → `window.api.statistics`
- `src/services/ipc/shareIPC.ts` → `window.api.share`
- `src/services/ipc/externalLinksIPC.ts` → `window.api.externalLinks`
- `src/services/ipc/screenshotsIPC.ts` → `window.screenshots`
- `src/services/ipc/resourcePacksIPC.ts` → `window.api.resourcePacks`
- `src/services/ipc/shadersIPC.ts` → `window.api.shaders`

### 2.3 Нативный браузерный `window.*` (не Electron contracts)

- `window.addEventListener` / `window.removeEventListener`
- `window.location.reload()`
- `window.confirm(...)`
- `window.matchMedia(...)`

---

## 3) Снимок allowlist IPC-каналов

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

### 3.6 Settings и dialogs

- `settings:selectMinecraftPath`
- `settings:openMinecraftPath`
- `settings:getDefaultMinecraftPath`
- `dialog:showSaveDialog`
- `dialog:showOpenDialog`
- `dialog:getDesktopPath`

### 3.7 Assets и cache

- `assets:getIconPath`
- `cache:getImageState`
- `cache:setImageLimit`
- `cache:cleanupImage`
- `cache:resolveImage`

### 3.8 Updaters

- `updater:sync`
- `updater:progress`
- `app-updater:check`
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

### 3.10 Ресурспаки, шейдеры, миры, датапаки

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

Примечания по результатам:

- `resourcePacks:import` и `resourcePacks:add` теперь возвращают `ResourcePackAcquisitionResult` с именованными статусами вместо boolean.
- `shaders:add` теперь возвращает `ShaderPackAcquisitionResult` с именованными статусами вместо boolean.

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

## 4) Release notes для контрактных потребителей

- По возможности используй типизированные обёртки из `src/services/ipc/*`.
- Держи синхронными `shared/contracts/ipcChannels.ts`, этот документ и `docs/en/contracts-map.md`.
- Если добавляешь или удаляешь preload globals, обновляй `electron/preload.ts` и всю историю типизации renderer-поверхности (`shared/contracts/*`, `src/vite-env.d.ts` или локальную аугментацию в wrapper-файле) в том же изменении.
