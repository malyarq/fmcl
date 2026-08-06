# Карта IPC-контрактов

Цель: зафиксировать живую поверхность IPC, preload и renderer-контрактов FMCL.

**Источники истины**

- Регистрация IPC: `electron/ipc/ipcManager.ts` + `electron/ipc/handlers/*`
- Валидация на границе: `electron/ipc/validation/*`
- Preload surface: `electron/preload.ts` + `electron/preload/bridges/*`
- Allowlist: `shared/contracts/ipcChannels.ts`
- Тип объединённого renderer API: `shared/contracts/windowApi.ts`
- Renderer-обёртки: `src/services/ipc/*`

Снимок: **текущая ветка разработки main, 2026-08-06**. `npm run contracts:check` проверяет соответствие языковых карт allowlist каналов; `npm run architecture:check` проверяет границу renderer.

---

## 1) Preload surface

### 1.1 Поддерживаемый API для renderer-кода

`electron/preload.ts` экспортирует ровно один global — `window.api`. Он содержит:

- `window.api.launcher`
- `window.api.instances`
- `window.api.archiveInspection`
- `window.api.providerCatalog`
- `window.api.storageMaintenance`
- `window.api.javaRuntime`
- `window.api.mods`
- `window.api.instanceMods`
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
- `src/services/ipc/archiveInspectionIPC.ts` → `window.api.archiveInspection`
- `src/services/ipc/assetsIPC.ts` → `window.api.assets`
- `src/services/ipc/cacheIPC.ts` → `window.api.cache`
- `src/services/ipc/datapacksIPC.ts` → `window.api.datapacks`
- `src/services/ipc/dialogIPC.ts` → `window.api.dialogs`
- `src/services/ipc/externalLinksIPC.ts` → `window.api.externalLinks`
- `src/services/ipc/launcherIPC.ts` → `window.api.launcher`
- `src/services/ipc/instancesIPC.ts` → `window.api.instances`
- `src/services/ipc/javaRuntimeIPC.ts` → `window.api.javaRuntime`
- `src/services/ipc/mirrorsIPC.ts` → `window.api.mirrors`
- `src/services/ipc/instanceModsIPC.ts` → `window.api.instanceMods`
- `src/services/ipc/operationsIPC.ts` → `window.api.operations`
- `src/services/ipc/modsIPC.ts` → `window.api.mods`
- `src/services/ipc/networkIPC.ts` → `window.api.network`
- `src/services/ipc/providerCatalogIPC.ts` → `window.api.providerCatalog`
- `src/services/ipc/resourcePacksIPC.ts` → `window.api.resourcePacks`
- `src/services/ipc/screenshotsIPC.ts` → `window.api.screenshots`
- `src/services/ipc/settingsIPC.ts` → `window.api.settings`
- `src/services/ipc/shadersIPC.ts` → `window.api.shaders`
- `src/services/ipc/shareIPC.ts` → `window.api.share`
- `src/services/ipc/statisticsIPC.ts` → `window.api.statistics`
- `src/services/ipc/storageMaintenanceIPC.ts` → `window.api.storageMaintenance`
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

`window.api.launcher.launch` принимает логический `instanceId` и ограниченные настройки запуска. Корни лаунчера, пути инстансов, Java executables, VM options и удалённый alias `modpackId` не входят в renderer-контракт: нативные полномочия main разрешает из composition root и канонической записи инстанса.

### 3.3 Mods

- `mods:searchMods`
- `mods:getModVersions`
- `mods:installModFile`

`window.api.mods.installModFile` принимает только непрозрачный ID инстанса, тип контента и логические идентификаторы platform/project/version. Main-процесс их валидирует, разрешает одобренный корень лаунчера и возвращает результат без путей файловой системы.

### 3.4 Instances

- `instances:list`
- `instances:snapshot`
- `instances:select`
- `instances:create`
- `instances:rename`
- `instances:config`
- `instances:metadata`
- `instances:prepare`

### 3.4.1 Моды инстанса

- `instance-mods:list`
- `instance-mods:remove`
- `instance-mods:setEnabled`
- `instance-mods:register`

`window.api.instanceMods` принимает только непрозрачный ID инстанса и логические имена файлов модов либо идентификаторы provider project/version для регистрации манифеста. Корень лаунчера и каталог инстанса разрешаются в main-процессе; пути файловой системы не пересекают preload-границу.

При первой регистрации мода для только что созданного инстанса main строит manifest из канонической записи `InstanceApplication`. Legacy-хранилище конфигураций для этого не требуется и не пересоздаётся.

### 3.4.2 Java runtime

- `javaRuntime:scan`
- `javaRuntime:select`

`window.api.javaRuntime` возвращает непрозрачные краткоживущие ID установок и метаданные рантайма; при выборе Java принимает только ID для канонического выбранного инстанса. Исполняемый файл Java и корни лаунчера остаются в main-процессе.

### 3.4.3 Проверка архива

- `archiveInspection:select`

`window.api.archiveInspection` открывает и проверяет локальный архив в main-процессе. Ответ на выбор содержит метаданные манифеста и непрозрачную sender-bound истекающую одноразовую ссылку на архив; путь файловой системы в нём не раскрывается.

### 3.4.4 Обслуживание хранилища

- `storageMaintenance:getStats`
- `storageMaintenance:cleanup`

`window.api.storageMaintenance` возвращает только агрегированную статистику content-store и результат очистки. Корни хранилища, пути файлов и политика удаления остаются в main-процессе.

### 3.5 Network

- `network:tunnel:get-state`
- `network:tunnel:host`
- `network:tunnel:join`
- `network:tunnel:stop`
- `network:tunnel:state`
- `network:lan:get-state`
- `network:lan:start`
- `network:lan:stop`
- `network:lan:broadcast`
- `network:lan:ping`
- `network:lan:state`
- `network:lan:discover`
- `network:upnp:get-state`
- `network:upnp:map-tcp`
- `network:upnp:unmap-tcp`
- `network:upnp:stop`
- `network:upnp:state`

`window.api.network` содержит три отдельные capability. FriendTunnel, LAN discovery и UPnP отдают независимые типизированные lifecycle-снимки и подписки; изменяемого network mode в main-процессе больше нет. Нативные ошибки, данные роутера и идентификаторы пиров не пересекают preload-границу.

### 3.6 Settings и dialogs

- `settings:selectMinecraftPath`
- `settings:openMinecraftPath`
- `settings:getDefaultMinecraftPath`
- `settings:exportBackup`
- `settings:importBackup`
- `dialog:showSaveDialog`
- `dialog:showOpenDialog`
- `dialog:getDesktopPath`

Резервная копия настроек принимает только явно перечисленные и ограниченные по размеру настройки лаунчера и последние варианты запуска. Нативные диалоги, атомарная запись, проверка схемы и лимит размера импорта остаются в main-процессе. Аккаунты, токены, идентификатор аналитики, приглашения FriendTunnel, локальные пути и игровые файлы исключены.

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

### 3.9 Каталог провайдеров

- `providerCatalog:search`
- `providerCatalog:versions`

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
- `worlds:listByInstanceId`
- `worlds:deleteByInstanceId`
- `worlds:backupByInstanceId`
- `worlds:duplicateByInstanceId`
- `worlds:openFolderByInstanceId`
- `datapacks:search`
- `datapacks:getVersions`
- `datapacks:listByInstanceId`
- `datapacks:enableByInstanceId`
- `datapacks:disableByInstanceId`
- `datapacks:deleteByInstanceId`
- `datapacks:installByInstanceId`

Примечания по результатам:

- `resourcePacks:import` и `resourcePacks:add` теперь возвращают `ResourcePackAcquisitionResult` с именованными статусами вместо boolean.
- `shaders:add` теперь возвращает `ShaderPackAcquisitionResult` с именованными статусами вместо boolean.
- Вызовы шейдеров принимают непрозрачный ID инстанса; каталог shaderpacks разрешает основной процесс.
- Worlds и Datapacks принимают только непрозрачные ID инстансов и логические дочерние имена; прежние path-методы удалены.

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

`window.api.operations` предоставляет типизированные вызовы запуска, чтения, отмены и подписки. `OperationStartRequest` и renderer wrapper не могут содержать `rootPath` или `filePath`: одобренный корень для каждого запроса разрешает main. Import потребляет непрозрачный `archiveRef` от `archiveInspection` и получает путь только после проверки sender и срока жизни.

Archive `outputPath` — узкое исключение: это недоверенное значение из нативного save dialog, принадлежащего main. Оно принимается только пока действует одноразовое sender-bound разрешение, и потребляется до запуска операции. Это не общая filesystem authority для renderer.

Активная операция доступна для чтения, отмены и подписки только renderer-процессу, который её запустил. Восстановленные terminal snapshots после перезапуска отдаются только в sanitised read-only виде: внутренние roots, inputs, archive paths, output paths и recovery data не возвращаются, а сами операции нельзя отменить или запустить повторно.

---

## 4) Чеклист поддержки

- По возможности используй типизированные обёртки из `src/services/ipc/*`.
- Держи синхронными `shared/contracts/ipcChannels.ts`, этот документ и `docs/en/contracts-map.md`.
- Если добавляешь или удаляешь preload globals, обновляй `electron/preload.ts` и всю историю типизации renderer-поверхности (`shared/contracts/*`, `src/vite-env.d.ts` или локальную аугментацию в wrapper-файле) в том же изменении.
- Перед коммитом запускай `npm run contracts:check`, `npm run ipc:check` и TypeScript.
