/**
 * Single source of truth for allowed IPC channel names.
 *
 * This is used to:
 * - document public contracts
 * - type `window.ipcRenderer` in renderer
 * - enforce a runtime allowlist in preload
 *
 * If you add/remove/rename IPC channels, update this list AND the contracts-map docs.
 */
export const allowedIpcChannels = [
  // window controls
  'window:minimize',
  'window:close',

  // launcher
  'launcher:launch',
  'launcher:getVersionList',
  'launcher:getForgeSupportedVersions',
  'launcher:getFabricSupportedVersions',
  'launcher:getOptiFineSupportedVersions',
  'launcher:getNeoForgeSupportedVersions',
  'launcher:clearCache',
  'launcher:reload',

  // launcher events
  'launcher:log',
  'launcher:progress',
  'launcher:close',

  // mods
  'mods:searchMods',
  'mods:getModVersions',
  'mods:installModFile',

  // instances
  'instances:list',
  'instances:bootstrap',
  'instances:getSelected',
  'instances:setSelected',
  'instances:create',
  'instances:rename',
  'instances:duplicate',
  'instances:delete',
  'instances:getConfig',
  'instances:saveConfig',

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

  // assets
  'assets:getIconPath',

  // instance updater (manifest sync)
  'updater:sync',
  'updater:progress',

  // app auto-updater (launcher updates)
  'app-updater:check',
  'app-updater:quit-and-install',
  'app-updater:status',
  'app-updater:available',
  'app-updater:not-available',
  'app-updater:error',
  'app-updater:progress',
  'app-updater:downloaded',

  // modpacks
  'modpacks:list',
  'modpacks:listWithMetadata',
  'modpacks:bootstrap',
  'modpacks:getSelected',
  'modpacks:setSelected',
  'modpacks:create',
  'modpacks:rename',
  'modpacks:duplicate',
  'modpacks:delete',
  'modpacks:getConfig',
  'modpacks:saveConfig',
  'modpacks:getMetadata',
  'modpacks:updateMetadata',
  'modpacks:searchCurseForge',
  'modpacks:searchModrinth',
  'modpacks:getCurseForgeVersions',
  'modpacks:getModrinthVersions',
  'modpacks:installCurseForge',
  'modpacks:installModrinth',
  'modpacks:exportFromInstance',
  'modpacks:createLocal',
  'modpacks:export',
  'modpacks:getModpackInfoFromFile',
  'modpacks:import',
  'modpacks:addMod',
  'modpacks:removeMod',
  'modpacks:updateOverrides',
  'modpacks:getMods',
  'modpacks:backup',

  // modpacks events
  'modpacks:updateProgress',
] as const;

export type AllowedIpcChannel = typeof allowedIpcChannels[number];

export const allowedIpcChannelSet: ReadonlySet<string> = new Set<string>(allowedIpcChannels);

