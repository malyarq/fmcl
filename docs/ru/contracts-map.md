# Карта IPC-контрактов

Цель: зафиксировать живую поверхность IPC, preload и renderer-контрактов FMCL.

**Источники истины**

- Регистрация IPC: `electron/ipc/ipcManager.ts` + `electron/ipc/handlers/*`
- Валидация на границе: `electron/ipc/validation/*`
- Preload surface: `electron/preload.ts` + `electron/preload/bridges/*`
- Allowlist: `shared/contracts/ipcChannels.ts`
- Тип объединённого renderer API: `shared/contracts/windowApi.ts`
- Renderer-обёртки: `src/services/ipc/*`

Снимок: **ветка разработки v0.8.0, 2026-08-03**. `npm run contracts:check` проверяет соответствие языковых карт allowlist каналов; `npm run architecture:check` проверяет границу renderer.

---

## 1) Preload surface

### 1.1 Поддерживаемый API для renderer-кода

`electron/preload.ts` экспортирует ровно один global — `window.api`. Он содержит:

- `window.api.launcher`
- `window.api.modpacks`
- `window.api.mods`
- `window.api.appUpdater`
- `window.api.windowControls`
- `window.api.network`
- `window.api.cache`
- `window.api.settings`
- `window.api.assets`
- `window.api.resourcePacks`
- `window.api.shaders`
- `window.api.screenshots`
- `window.api.worlds`
- `window.api.datapacks`
- `window.api.dialogs`
- `window.api.account`
- `window.api.mirrors`
- `window.api.statistics`
- `window.api.share`
- `window.api.externalLinks`
- `window.api.operations`

Универсальной capability `invoke/send/on/off` и верхнеуровневых Electron aliases нет. UI-компоненты обычно используют типизированные обёртки из `src/services/ipc/*`.

---

## 2) Renderer-обёртки

### 2.1 Namespaced и domain wrappers

- `src/services/ipc/accountIPC.ts` → `window.api.account`
- `src/services/ipc/appUpdaterIPC.ts` → `window.api.appUpdater`
- `src/services/ipc/assetsIPC.ts` → `window.api.assets`
- `src/services/ipc/cacheIPC.ts` → `window.api.cache`
- `src/services/ipc/datapacksIPC.ts` → `window.api.datapacks`
- `src/services/ipc/dialogIPC.ts` → `window.api.dialogs`
- `src/services/ipc/externalLinksIPC.ts` → `window.api.externalLinks`
- `src/services/ipc/launcherIPC.ts` → `window.api.launcher`
- `src/services/ipc/mirrorsIPC.ts` → `window.api.mirrors`
- `src/services/ipc/modpacksIPC.ts` → `window.api.modpacks`
- `src/services/ipc/operationsIPC.ts` → `window.api.operations`
- `src/services/ipc/modsIPC.ts` → `window.api.mods`
- `src/services/ipc/networkIPC.ts` → `window.api.network`
- `src/services/ipc/resourcePacksIPC.ts` → `window.api.resourcePacks`
- `src/services/ipc/screenshotsIPC.ts` → `window.api.screenshots`
- `src/services/ipc/settingsIPC.ts` → `window.api.settings`
- `src/services/ipc/shadersIPC.ts` → `window.api.shaders`
- `src/services/ipc/shareIPC.ts` → `window.api.share`
- `src/services/ipc/statisticsIPC.ts` → `window.api.statistics`
- `src/services/ipc/windowControlsIPC.ts` → `window.api.windowControls`
- `src/services/ipc/worldsIPC.ts` → `window.api.worlds`

### 2.2 Нативный браузерный `window.*` (не Electron contracts)

- `window.addEventListener` / `window.removeEventListener`
- `window.location.reload()`
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

### 3.8 App updater

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
- `modpacks:getConfig`
- `modpacks:saveConfig`
- `modpacks:getMetadata`
- `modpacks:updateMetadata`
- `modpacks:searchCurseForge`
- `modpacks:searchModrinth`
- `modpacks:getCurseForgeVersions`
- `modpacks:getModrinthVersions`
- `modpacks:createLocal`
- `modpacks:getModpackInfoFromFile`
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

### 3.13 Транзакционные операции

- `operations:start`
- `operations:get`
- `operations:listRecovered`
- `operations:cancel`
- `operations:subscribe`
- `operations:unsubscribe`
- `operations:update`

`window.api.operations` предоставляет типизированные вызовы запуска, чтения, отмены и подписки. Активная операция доступна для чтения, отмены и подписки только renderer-процессу, который её запустил. Восстановленные terminal-снимки после перезапуска отдаются только в sanitизированном read-only виде: их нельзя отменить или запустить повторно.

---

## 4) Чеклист поддержки

- По возможности используй типизированные обёртки из `src/services/ipc/*`.
- Держи синхронными `shared/contracts/ipcChannels.ts`, этот документ и `docs/en/contracts-map.md`.
- Если добавляешь или удаляешь preload globals, обновляй `electron/preload.ts` и всю историю типизации renderer-поверхности (`shared/contracts/*`, `src/vite-env.d.ts` или локальную аугментацию в wrapper-файле) в том же изменении.
- Перед коммитом запускай `npm run contracts:check`, `npm run ipc:check` и TypeScript.
