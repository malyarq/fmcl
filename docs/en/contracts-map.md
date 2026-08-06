# IPC contract map

Goal: document the live IPC, preload, and renderer contract surface for FMCL.

**Sources of truth**

- IPC registration: `electron/ipc/ipcManager.ts` + `electron/ipc/handlers/*`
- Boundary validation: `electron/ipc/validation/*`
- Preload surface: `electron/preload.ts` + `electron/preload/bridges/*`
- Allowlist: `shared/contracts/ipcChannels.ts`
- Unified renderer API type: `shared/contracts/windowApi.ts`
- Renderer wrappers: `src/services/ipc/*`

Snapshot: **current main development line, 2026-08-06**. `npm run contracts:check` verifies that each language map contains exactly the allowlisted channels; `npm run architecture:check` verifies the renderer boundary.

---

## 1) Preload surface

### 1.1 Supported API for renderer code

`electron/preload.ts` exposes exactly one global: `window.api`. It contains:

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

There is no generic `invoke/send/on/off` capability and no top-level Electron alias. UI components normally use the typed wrappers in `src/services/ipc/*`.

---

## 2) Renderer wrappers

### 2.1 Namespaced and domain wrappers

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

### 2.2 Native browser `window.*` usage (not Electron contracts)

- `window.addEventListener` / `window.removeEventListener`
- `window.location.reload()`
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

`window.api.launcher.launch` accepts a logical `instanceId` plus bounded launch preferences. Launcher roots, instance paths, Java executables, VM options, and the retired `modpackId` alias are not part of the renderer contract; main resolves native launch authority from the composition root and canonical instance record.

### 3.3 Mods

- `mods:searchMods`
- `mods:getModVersions`
- `mods:installModFile`

`window.api.mods.installModFile` accepts only an opaque instance ID, content type, and provider platform/project/version identifiers. The main process validates them, resolves the approved launcher root, and returns a path-free install outcome.

### 3.4 Instances

- `instances:list`
- `instances:snapshot`
- `instances:select`
- `instances:create`
- `instances:rename`
- `instances:config`
- `instances:metadata`
- `instances:prepare`

### 3.4.1 Instance mods

- `instance-mods:list`
- `instance-mods:remove`
- `instance-mods:setEnabled`
- `instance-mods:register`

`window.api.instanceMods` accepts only an opaque instance ID plus logical mod filenames or provider project/version identifiers for manifest registration. The main process resolves the launcher root and instance directory; no filesystem paths cross the preload boundary.

On the first registration for a newly created instance, main derives the manifest from the canonical `InstanceApplication` record. It does not require or recreate a legacy instance configuration store.

### 3.4.2 Java runtime

- `javaRuntime:scan`
- `javaRuntime:select`

`window.api.javaRuntime` returns opaque, short-lived installation IDs with runtime metadata and accepts only an ID when selecting Java for the canonical selected instance. Java executable details and launcher roots remain in the main process.

### 3.4.3 Archive inspection

- `archiveInspection:select`

`window.api.archiveInspection` opens and inspects a local archive in the main process. Its selected response contains manifest metadata and an opaque, sender-bound, expiring single-use archive reference; it never exposes a filesystem path.

### 3.4.4 Storage maintenance

- `storageMaintenance:getStats`
- `storageMaintenance:cleanup`

`window.api.storageMaintenance` returns aggregate content-store statistics and cleanup results only. Storage roots, file paths, and deletion policy remain in the main process.

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

`window.api.network` contains three focused capabilities. FriendTunnel, LAN discovery and UPnP expose independent typed lifecycle snapshots and subscriptions; there is no mutable main-process network mode. Native errors, gateway details and peer identities do not cross the preload boundary.

### 3.6 Settings and dialogs

- `settings:selectMinecraftPath`
- `settings:openMinecraftPath`
- `settings:getDefaultMinecraftPath`
- `settings:exportBackup`
- `settings:importBackup`
- `dialog:showSaveDialog`
- `dialog:showOpenDialog`
- `dialog:getDesktopPath`

Settings backup accepts only an explicit, size-bounded allowlist of launcher preferences and recent launch choices. Main owns the native file dialogs, atomic write, schema validation, and import size limit. Accounts, tokens, analytics identity, FriendTunnel invitations, local filesystem paths, and game content are excluded.

### 3.7 Assets and cache

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

### 3.9 Provider catalog

- `providerCatalog:search`
- `providerCatalog:versions`

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

Outcome notes:

- `resourcePacks:import` and `resourcePacks:add` now return `ResourcePackAcquisitionResult` with named statuses instead of booleans.
- `shaders:add` now returns `ShaderPackAcquisitionResult` with named statuses instead of booleans.
- Shader calls accept an opaque instance ID; the main process resolves the shaderpacks directory.
- Worlds and Datapacks accept only opaque instance IDs and logical child names; their former path methods are removed.

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

### 3.13 Transactional operations

- `operations:start`
- `operations:get`
- `operations:listRecovered`
- `operations:cancel`
- `operations:subscribe`
- `operations:unsubscribe`
- `operations:update`

`window.api.operations` exposes typed start, read, cancellation and subscription calls. `OperationStartRequest` and the renderer wrapper cannot contain `rootPath` or `filePath`; main resolves the approved root for every request. Import consumes the opaque `archiveRef` created by `archiveInspection` and resolves its path only after sender and lifetime validation.

Archive `outputPath` is the narrow exception: it is an untrusted value returned by a main-owned native save dialog, accepted only while the sender-bound one-time authorization is live, and consumed before the operation starts. It is not general renderer filesystem authority.

Active operations are readable, cancellable and subscribable only by their originating renderer. Recovered terminal snapshots are sanitized read-only records available after restart: internal roots, inputs, archive paths, output paths, and recovery data are not returned, and recovered operations cannot be cancelled or replayed.

---

## 4) Maintenance checklist

- Use typed wrappers from `src/services/ipc/*` when possible.
- Keep `shared/contracts/ipcChannels.ts`, this document, and `docs/ru/contracts-map.md` aligned.
- When adding or removing preload globals, update both `electron/preload.ts` and the renderer typing story (`shared/contracts/*`, `src/vite-env.d.ts`, or local wrapper augmentation) in the same change.
- Run `npm run contracts:check`, `npm run ipc:check`, and TypeScript before committing.
