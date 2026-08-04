/**
 * Single source of truth for allowed IPC channel names.
 *
 * This is used to:
 * - document public contracts
 * - keep the main/preload channel inventory auditable
 * - validate that typed preload bridges only use registered channels
 *
 * If you add/remove/rename IPC channels, update this list AND the contracts-map docs.
 */
export const allowedIpcChannels = [
  // window controls
  'window:minimize',
  'window:close',
  'window:openConsole',
  'window:closeConsole',

  // launcher
  'launcher:launch',
  'launcher:getVersionList',
  'launcher:getForgeSupportedVersions',
  'launcher:getFabricSupportedVersions',
  'launcher:getOptiFineSupportedVersions',
  'launcher:getNeoForgeSupportedVersions',
  'launcher:clearCache',
  'launcher:reload',
  'launcher:killAndRestart',
  'launcher:stdin',

  // launcher events
  'launcher:log',
  'launcher:progress',
  'launcher:close',

  // mods
  'mods:searchMods',
  'mods:getModVersions',
  'mods:installModFile',

  // instance mods
  'instance-mods:list',
  'instance-mods:remove',
  'instance-mods:setEnabled',
  'instance-mods:register',

  // provider catalog
  'providerCatalog:search',
  'providerCatalog:versions',

  // storage maintenance
  'storageMaintenance:getStats',
  'storageMaintenance:cleanup',

  // Java runtime
  'javaRuntime:scan',
  'javaRuntime:select',

  // instances
  'instances:list',
  'instances:snapshot',
  'instances:select',
  'instances:create',
  'instances:rename',
  'instances:config',
  'instances:metadata',
  'instances:prepare',

  // archive inspection
  'archiveInspection:select',

  // network
  'network:host',
  'network:join',
  'network:stop',
  'network:getMode',
  'network:setMode',
  'network:ping',
  'network:lanStart',
  'network:lanStop',
  'network:lanBroadcast',
  'network:upnpMapTcp',
  'network:upnpUnmapTcp',

  // network events
  'network:lan-discover',

  // settings
  'settings:selectMinecraftPath',
  'settings:openMinecraftPath',
  'settings:getDefaultMinecraftPath',

  // dialog
  'dialog:showSaveDialog',
  'dialog:showOpenDialog',
  'dialog:getDesktopPath',

  // assets
  'assets:getIconPath',

  // cache
  'cache:getImageState',
  'cache:setImageLimit',
  'cache:cleanupImage',
  'cache:resolveImage',

  // app auto-updater (launcher updates)
  'app-updater:check',
  'app-updater:download',
  'app-updater:quit-and-install',
  'app-updater:status',
  'app-updater:available',
  'app-updater:not-available',
  'app-updater:error',
  'app-updater:progress',
  'app-updater:downloaded',

  // resource packs
  'resourcePacks:list',
  'resourcePacks:enable',
  'resourcePacks:disable',
  'resourcePacks:reorder',
  'resourcePacks:import',
  'resourcePacks:delete',
  'resourcePacks:openFolder',
  'resourcePacks:add',

  // shaders
  'shaders:list',
  'shaders:setActive',
  'shaders:disable',
  'shaders:delete',
  'shaders:openFolder',
  'shaders:add',

  // worlds
  'worlds:listByInstanceId',
  'worlds:deleteByInstanceId',
  'worlds:backupByInstanceId',
  'worlds:duplicateByInstanceId',
  'worlds:openFolderByInstanceId',

  // datapacks
  'datapacks:search',
  'datapacks:getVersions',
  'datapacks:listByInstanceId',
  'datapacks:enableByInstanceId',
  'datapacks:disableByInstanceId',
  'datapacks:deleteByInstanceId',
  'datapacks:installByInstanceId',

  // app
  'app:saveFile',

  // accounts
  'account:getAccounts',
  'account:getSelectedAccount',
  'account:addOffline',
  'account:addThirdParty',
  'account:getSkinState',
  'account:refreshSkinState',
  'account:removeAccount',
  'account:selectAccount',

  // mirrors
  'mirrors:getMirrors',
  'mirrors:getSelectedMirror',
  'mirrors:addCustomMirror',
  'mirrors:removeMirror',
  'mirrors:selectMirror',
  'mirrors:moveMirror',
  'mirrors:testSpeed',
  'mirrors:setAutoSelect',
  'mirrors:isAutoSelectEnabled',

  // screenshots
  'screenshots:list',
  'screenshots:delete',
  'screenshots:rename',
  'screenshots:openFolder',

  // sharing
  'share:generateCode',

  // statistics
  'stats:get',
  'stats:export',

  // external links
  'externalLinks:open',

  // transactional operations
  'operations:start',
  'operations:get',
  'operations:listRecovered',
  'operations:cancel',
  'operations:subscribe',
  'operations:unsubscribe',
  'operations:update',
] as const;

export type AllowedIpcChannel = typeof allowedIpcChannels[number];

export const allowedIpcChannelSet: ReadonlySet<string> = new Set<string>(allowedIpcChannels);
