import type { FriendLauncherApi, ModpackSearchResultItem, ModpackVersionDescriptor } from '@shared/contracts';
import type { Account, Mirror, ModpackManifest, ModpackMetadata, StatisticsOverview } from '@shared/types';
import type { ModEntry } from '@shared/types/mods';
import type { ModpackConfig } from '../../contexts/instances/types';
import type { Screenshot } from '../../../electron/services/screenshots/screenshotService';

const ICON_PATH = '/icon.png';
const DESKTOP_PATH = '/Users/manual/Desktop';
const PHASE_17_POLISH_VIEW = 'phase-17-polish';

const baseConfigs: Record<string, ModpackConfig> = {
  alpha: {
    id: 'alpha',
    name: 'Alpha Pack',
    runtime: {
      minecraft: '1.20.1',
      modLoader: { type: 'fabric', version: '0.16.9' },
    },
    memory: { maxMb: 6144, minMb: 4096 },
    java: { path: '/Library/Java/JavaVirtualMachines/temurin-21.jdk/bin/java' },
    game: {
      resolution: { width: 1600, height: 900, fullscreen: false },
      extraArgs: ['--demo-mode=false'],
    },
    server: { host: 'play.friendlauncher.local', port: 25565 },
    networkMode: 'hyperswarm',
    createdAt: '2026-04-01T10:00:00.000Z',
    updatedAt: '2026-04-13T08:30:00.000Z',
  },
  classic: {
    id: 'classic',
    name: 'Classic',
    runtime: {
      minecraft: '1.20.1',
      modLoader: { type: 'fabric', version: '0.16.9' },
    },
    memory: { maxMb: 6144, minMb: 4096 },
    java: { path: '/Library/Java/JavaVirtualMachines/temurin-21.jdk/bin/java' },
    game: {
      resolution: { width: 1600, height: 900, fullscreen: false },
      extraArgs: ['--demo-mode=false'],
    },
    networkMode: 'hyperswarm',
    createdAt: '2026-04-01T10:00:00.000Z',
    updatedAt: '2026-04-13T08:30:00.000Z',
  },
};

const baseMetadata: Record<string, ModpackMetadata> = {
  alpha: {
    id: 'alpha',
    name: 'Alpha Pack',
    version: '1.4.2',
    source: 'modrinth',
    sourceId: 'alpha-pack',
    sourceVersionId: 'alpha-pack-1.4.2',
    minecraftVersion: '1.20.1',
    modLoader: { type: 'fabric', version: '0.16.9' },
    iconUrl: ICON_PATH,
    description: 'Route truth test pack with export, add-mod, and content flows.',
    author: 'FMCL',
    createdAt: '2026-04-01T10:00:00.000Z',
    updatedAt: '2026-04-13T08:30:00.000Z',
  },
  classic: {
    id: 'classic',
    name: 'Classic',
    version: '1.20.1',
    source: 'local',
    minecraftVersion: '1.20.1',
    modLoader: { type: 'fabric', version: '0.16.9' },
    iconUrl: ICON_PATH,
    description: 'Classic route fixture for manual launcher proof.',
    author: 'FMCL',
    createdAt: '2026-04-01T10:00:00.000Z',
    updatedAt: '2026-04-13T08:30:00.000Z',
  },
};

const baseAccounts: Account[] = [
  {
    id: 'account-1',
    type: 'third-party',
    name: 'PlayerOne',
    authServerUrl: 'https://littleskin.cn/api/yggdrasil',
    avatar: ICON_PATH,
    user: {
      id: 'player-one',
    },
    skinProvider: 'littleskin',
  },
  {
    id: 'account-2',
    type: 'offline',
    name: 'OfflineOnly',
  },
];

const browserResults: ModpackSearchResultItem[] = [
  {
    platform: 'modrinth',
    projectId: 'alpha-pack',
    slug: 'alpha-pack',
    title: 'Alpha Pack',
    description: 'Fast keyboard test pack',
    iconUrl: ICON_PATH,
    downloads: 1337,
    dateCreated: '2026-04-01T10:00:00.000Z',
    dateModified: '2026-04-13T08:30:00.000Z',
  },
  {
    platform: 'modrinth',
    projectId: 'nebula-pack',
    slug: 'nebula-pack',
    title: 'Nebula Pack',
    description: 'Secondary card for pagination truth',
    iconUrl: ICON_PATH,
    downloads: 512,
    dateCreated: '2026-03-25T10:00:00.000Z',
    dateModified: '2026-04-10T08:30:00.000Z',
  },
];

function getManualVerificationView() {
  return new URLSearchParams(window.location.search).get('view') ?? 'overview';
}

function getMetadataForView(view: string): Record<string, ModpackMetadata> {
  const metadata = structuredClone(baseMetadata);

  if (view !== PHASE_17_POLISH_VIEW) {
    return metadata;
  }

  metadata.alpha = {
    ...metadata.alpha,
    iconUrl: undefined,
    description: 'No-art fallback card for constrained catalog proof.',
  };

  return metadata;
}

function getBrowserResultsForView(view: string): ModpackSearchResultItem[] {
  const results = structuredClone(browserResults);

  if (view !== PHASE_17_POLISH_VIEW) {
    return results;
  }

  results[0] = {
    ...results[0],
    iconUrl: undefined,
    description: 'No-art launcher mark fallback fixture for the constrained browser state.',
  };

  return results;
}

const modpackVersions: ModpackVersionDescriptor[] = [
  {
    platform: 'modrinth',
    versionId: 'alpha-pack-1.4.2',
    name: 'Alpha Pack 1.4.2',
    versionNumber: '1.4.2',
    mcVersions: ['1.20.1'],
    loaders: ['fabric'],
    changelog: 'Stabilized the FMCL manual verification fixture.',
    files: [
      {
        url: 'https://example.invalid/alpha-pack-1.4.2.mrpack',
        filename: 'alpha-pack-1.4.2.mrpack',
      },
    ],
  },
];

const modEntries: ModEntry[] = [
  {
    id: 'alpha',
    name: 'Alpha Utilities',
    version: '1.0.0',
    loaders: ['fabric'],
    deps: [],
    file: {
      path: '/mock/.minecraft/mods/alpha.jar',
      name: 'alpha.jar',
      size: 1024,
      mtimeMs: Date.now() - 10_000,
    },
    hash: {
      sha1: 'alpha-sha1',
    },
    enabled: true,
  },
  {
    id: 'beta',
    name: 'Beta Tweaks',
    version: '2.0.0',
    loaders: ['fabric'],
    deps: [],
    file: {
      path: '/mock/.minecraft/mods/beta.jar.disabled',
      name: 'beta.jar.disabled',
      size: 768,
      mtimeMs: Date.now() - 7_500,
    },
    hash: {
      sha1: 'beta-sha1',
    },
    enabled: false,
  },
  {
    id: 'gamma',
    name: 'Gamma Runtime',
    version: '3.1.0',
    loaders: ['fabric'],
    deps: [
      { id: 'minecraft', versionRange: '[1.20.1]', kind: 'depends' },
      { id: 'fabricloader', versionRange: '[0.17.0]', kind: 'depends' },
      { id: 'alpha', versionRange: '[1.0.0]', kind: 'depends' },
      { id: 'beta', versionRange: '[2.0.0]', kind: 'depends' },
    ],
    file: {
      path: '/mock/.minecraft/mods/gamma.jar',
      name: 'gamma.jar',
      size: 1536,
      mtimeMs: Date.now() - 5_000,
    },
    hash: {
      sha1: 'gamma-sha1',
    },
    enabled: true,
  },
];

export function getManualVerificationModpackMetadata(view: string): ModpackMetadata {
  return structuredClone(getMetadataForView(view).alpha);
}

export function getManualVerificationModEntries(): ModEntry[] {
  return structuredClone(modEntries);
}

const statistics: StatisticsOverview = {
  global: {
    totalPlayTime: 7_200_000,
    totalLaunches: 18,
    lastPlayed: Date.now() - 3_600_000,
  },
  instances: {
    alpha: {
      name: 'Alpha Pack',
      playTime: 4_200_000,
      launches: 11,
      lastPlayed: Date.now() - 3_600_000,
    },
  },
  history: {
    '2026-04-11': { launches: 4, playTime: 1_200_000 },
    '2026-04-12': { launches: 6, playTime: 2_400_000 },
    '2026-04-13': { launches: 8, playTime: 3_600_000 },
  },
  popularModpacks: [
    {
      instanceId: 'alpha',
      name: 'Alpha Pack',
      playTime: 4_200_000,
      launches: 11,
      lastPlayed: Date.now() - 3_600_000,
    },
  ],
  usageTrend: [
    { date: '2026-04-11', launches: 4, playTime: 1_200_000 },
    { date: '2026-04-12', launches: 6, playTime: 2_400_000 },
    { date: '2026-04-13', launches: 8, playTime: 3_600_000 },
  ],
};

const sharedManifest: ModpackManifest = {
  formatVersion: 1,
  minecraft: {
    version: '1.20.1',
    modLoaders: [{ id: 'fabric-0.16.9', primary: true }],
  },
  name: 'Alpha Pack',
  version: '1.4.2',
  author: 'FMCL',
  files: [
    {
      projectId: 'sodium',
      versionId: 'sodium-1.0.0',
      path: 'mods/sodium.jar',
      downloads: ['https://example.invalid/sodium.jar'],
      hashes: { sha1: 'sodium-sha1' },
      fileSize: 1024,
      required: true,
      env: {
        client: 'required',
        server: 'optional',
      },
    },
  ],
  overrides: 'overrides',
};

const screenshots: Screenshot[] = [
  {
    name: 'mountain-sunrise.png',
    path: '/mock/.minecraft/instances/alpha/screenshots/mountain-sunrise.png',
    url: ICON_PATH,
    createdAt: Date.now() - 720_000,
    size: 256_000,
  },
  {
    name: 'village-evening.png',
    path: '/mock/.minecraft/instances/alpha/screenshots/village-evening.png',
    url: ICON_PATH,
    createdAt: Date.now() - 360_000,
    size: 248_000,
  },
];

const installedDatapacks = [
  {
    fileName: 'logic-tweaks.zip',
    name: 'Logic Tweaks',
    description: 'Adds world automation helpers for the Alpha fixture.',
    isEnabled: true,
    path: '/mock/.minecraft/instances/alpha/saves/AlphaWorld/datapacks/logic-tweaks.zip',
  },
  {
    fileName: 'adventure-rules.zip',
    name: 'Adventure Rules',
    description: 'Tighter progression rules for shared sessions.',
    isEnabled: false,
    path: '/mock/.minecraft/instances/alpha/saves/AlphaWorld/datapacks/adventure-rules.zip',
  },
];

const datapackSearchResults = {
  hits: [
    {
      project_id: 'immersive-world-events',
      title: 'Immersive World Events',
      description: 'Extra survival events tuned for multiplayer worlds.',
      icon_url: ICON_PATH,
    },
  ],
  total_hits: 1,
};

type ManualState = {
  selectedModpackId: string;
  selectedAccountId: string;
  modpacks: ModpackConfig[];
  metadata: Record<string, ModpackMetadata>;
  accounts: Account[];
};

function createState(view: string): ManualState {
  return {
    selectedModpackId: 'alpha',
    selectedAccountId: 'account-1',
    modpacks: [structuredClone(baseConfigs.alpha), structuredClone(baseConfigs.classic)],
    metadata: getMetadataForView(view),
    accounts: structuredClone(baseAccounts),
  };
}

function listItemsFromState(state: ManualState) {
  return state.modpacks.map((cfg) => ({
    id: cfg.id,
    name: cfg.name,
    path: `/mock/.minecraft/instances/${cfg.id}`,
    selected: cfg.id === state.selectedModpackId,
  }));
}

function findConfig(state: ManualState, modpackId: string) {
  return state.modpacks.find((cfg) => cfg.id === modpackId) ?? null;
}

function updateConfig(state: ManualState, nextConfig: ModpackConfig) {
  state.modpacks = state.modpacks.map((cfg) => (cfg.id === nextConfig.id ? structuredClone(nextConfig) : cfg));
}

function createSearchResponse(query: string, offset = 0, limit = 12, view = 'overview') {
  const availableResults = getBrowserResultsForView(view);
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? availableResults.filter((item) => item.title.toLowerCase().includes(normalizedQuery))
    : availableResults;
  const items = filtered.slice(offset, offset + limit);
  return {
    items,
    total: filtered.length,
    offset,
    limit,
  };
}

export function seedManualVerificationStorage(view: string) {
  const simpleViews = new Set(['welcome', 'tour', 'dashboard']);
  const isPhase17Polish = view === PHASE_17_POLISH_VIEW;
  const seededBrowserResults = getBrowserResultsForView(view);

  localStorage.setItem('settings_language', isPhase17Polish ? 'ru' : 'en');
  localStorage.setItem('settings_theme', 'dark');
  if (isPhase17Polish) {
    localStorage.setItem('settings_themePresetId', 'forest');
  } else {
    localStorage.removeItem('settings_themePresetId');
  }
  localStorage.setItem('settings_accentColor', 'emerald');
  localStorage.setItem('settings_minecraftPath', '/mock/.minecraft');
  localStorage.setItem('settings_uiMode', simpleViews.has(view) ? 'simple' : 'modpacks');
  localStorage.setItem('simple_play_welcome_dismissed', 'false');
  localStorage.setItem('onboarding_completed', simpleViews.has(view) ? 'false' : 'true');
  localStorage.setItem('first_launch', simpleViews.has(view) ? 'true' : 'false');
  if (view === 'modpack-browser') {
    localStorage.setItem('modpack-history', JSON.stringify([
      {
        platform: 'curseforge',
        projectId: '42',
        title: 'CurseForge Pack',
        description: 'Legacy import route preserved in history.',
        iconUrl: ICON_PATH,
      },
      seededBrowserResults[0],
    ]));
  } else if (isPhase17Polish) {
    localStorage.setItem('modpack-history', JSON.stringify([
      {
        platform: 'curseforge',
        projectId: '42',
        title: 'CurseForge Pack',
        description: 'Legacy import route preserved in history.',
        iconUrl: ICON_PATH,
      },
      seededBrowserResults[0],
    ]));
  } else {
    localStorage.removeItem('modpack-history');
  }
  localStorage.removeItem('modpack-favorites');
}

export function installManualVerificationEnvironment() {
  const view = getManualVerificationView();
  const state = createState(view);

  const modpacksApi = {
    listModpacks: async () => listItemsFromState(state),
    listModpacksWithMetadata: async () =>
      listItemsFromState(state).map((item) => ({
        ...item,
        metadata: structuredClone(state.metadata[item.id] ?? baseMetadata.alpha),
      })),
    bootstrapModpacks: async () => ({
      index: {},
      selectedId: state.selectedModpackId,
      config: structuredClone(findConfig(state, state.selectedModpackId) ?? baseConfigs.alpha),
    }),
    getSelectedModpack: async () => state.selectedModpackId,
    setSelectedModpack: async (modpackId: string) => {
      state.selectedModpackId = modpackId;
      return { ok: true };
    },
    createModpack: async (name: string) => {
      const id = `created-${state.modpacks.length + 1}`;
      const created: ModpackConfig = {
        ...structuredClone(baseConfigs.alpha),
        id,
        name,
      };
      state.modpacks.push(created);
      state.metadata[id] = {
        ...structuredClone(baseMetadata.alpha),
        id,
        name,
      };
      state.selectedModpackId = id;
      return { id, config: structuredClone(created) };
    },
    renameModpack: async (modpackId: string, name: string) => {
      const config = findConfig(state, modpackId);
      if (config) {
        updateConfig(state, { ...config, name });
      }
      if (state.metadata[modpackId]) {
        state.metadata[modpackId] = { ...state.metadata[modpackId], name };
      }
      return { ok: true };
    },
    duplicateModpack: async (sourceId: string, name?: string) => {
      const source = findConfig(state, sourceId);
      if (!source) {
        return { id: '' };
      }
      const id = `${sourceId}-copy`;
      const duplicated: ModpackConfig = {
        ...structuredClone(source),
        id,
        name: name?.trim() || `${source.name} Copy`,
      };
      state.modpacks.push(duplicated);
      state.metadata[id] = {
        ...structuredClone(state.metadata[sourceId] ?? baseMetadata.alpha),
        id,
        name: duplicated.name,
      };
      return { id, config: structuredClone(duplicated) };
    },
    deleteModpack: async (modpackId: string) => {
      state.modpacks = state.modpacks.filter((cfg) => cfg.id !== modpackId);
      delete state.metadata[modpackId];
      if (state.selectedModpackId === modpackId) {
        state.selectedModpackId = state.modpacks[0]?.id ?? 'classic';
      }
      return { ok: true };
    },
    getModpackConfig: async (modpackId: string) => structuredClone(findConfig(state, modpackId)),
    saveModpackConfig: async (cfg: unknown) => {
      const nextConfig = cfg as ModpackConfig;
      updateConfig(state, structuredClone(nextConfig));
      return { ok: true };
    },
    getModpackMetadata: async (modpackId: string) => structuredClone(state.metadata[modpackId] ?? baseMetadata.alpha),
    updateModpackMetadata: async (modpackId: string, updates: Partial<ModpackMetadata>) => {
      const current = state.metadata[modpackId] ?? baseMetadata.alpha;
      const next = { ...structuredClone(current), ...updates, updatedAt: new Date().toISOString() };
      state.metadata[modpackId] = next;
      return structuredClone(next);
    },
    searchCurseForgeModpacks: async (query: string, _mcVersion?: string, _loader?: string, _sort?: string, offset?: number, limit?: number) =>
      createSearchResponse(query, offset, limit, view),
    searchModrinthModpacks: async (query: string, _mcVersion?: string, _loader?: string, _sort?: string, offset?: number, limit?: number) =>
      createSearchResponse(query, offset, limit, view),
    getCurseForgeModpackVersions: async () => structuredClone(modpackVersions),
    getModrinthModpackVersions: async () => structuredClone(modpackVersions),
    installCurseForgeModpack: async () => ({
      modpackId: 'alpha',
      config: structuredClone(baseConfigs.alpha),
      metadata: structuredClone(baseMetadata.alpha),
    }),
    installModrinthModpack: async () => ({
      modpackId: 'alpha',
      config: structuredClone(baseConfigs.alpha),
      metadata: structuredClone(baseMetadata.alpha),
    }),
    exportModpackFromInstance: async () => structuredClone(baseMetadata.alpha),
    createLocalModpack: async () => ({
      id: 'alpha',
      config: structuredClone(baseConfigs.alpha),
      metadata: structuredClone(baseMetadata.alpha),
    }),
    createFromManifest: async () => ({ id: 'alpha' }),
    exportModpack: async () => ({ ok: true }),
    getModpackInfoFromFile: async () => ({ format: 'modrinth' as const, manifest: null }),
    importModpack: async () => ({
      id: 'alpha',
      config: structuredClone(baseConfigs.alpha),
      metadata: structuredClone(baseMetadata.alpha),
    }),
    addModToModpack: async () => ({ ok: true }),
    removeModFromModpack: async () => ({ ok: true }),
    setModEnabled: async () => ({ ok: true }),
    updateModpackOverrides: async () => ({ ok: true }),
    getModpackMods: async () => structuredClone(modEntries),
    backupModpack: async () => ({ backupPath: '/mock/.minecraft/backups/alpha.zip' }),
    resolvePath: async (modpackId: string) => `/mock/.minecraft/instances/${modpackId}`,
    scanJava: async () => [
      {
        path: '/Library/Java/JavaVirtualMachines/temurin-21.jdk/bin/java',
        version: '21.0.2',
        majorVersion: 21,
        valid: true,
      },
    ],
    getContentStats: async () => ({ totalSize: 2048, dedupedSize: 1024, totalFiles: 12, storedFiles: 8 }),
    cleanupContent: async () => ({ freedSize: 0, deletedFiles: 0 }),
  };

  const accountApi = {
    getAccounts: async () => structuredClone(state.accounts),
    getSelectedAccount: async () => structuredClone(state.accounts.find((account) => account.id === state.selectedAccountId) ?? null),
    addOfflineAccount: async (nickname: string) => {
      const account: Account = {
        id: `offline-${state.accounts.length + 1}`,
        type: 'offline',
        name: nickname,
      };
      state.accounts.push(account);
      state.selectedAccountId = account.id;
      return structuredClone(account);
    },
    addThirdPartyAccount: async (authServerUrl: string, username: string) => {
      const account: Account = {
        id: `third-party-${state.accounts.length + 1}`,
        type: 'third-party',
        name: username,
        authServerUrl,
        avatar: ICON_PATH,
        skinProvider: authServerUrl.includes('littleskin') ? 'littleskin' : 'blessing-skin',
      };
      state.accounts.push(account);
      state.selectedAccountId = account.id;
      return structuredClone(account);
    },
    getSkinState: async (accountId: string) => {
      const account = state.accounts.find((item) => item.id === accountId);
      if (!account || account.type === 'offline') {
        return {
          supported: false,
          providerLabel: 'Offline',
          reason: 'Offline accounts do not have a provider skin page.',
        };
      }
      return {
        supported: true,
        provider: account.skinProvider ?? 'littleskin',
        providerLabel: account.skinProvider === 'blessing-skin' ? 'Blessing Skin' : 'LittleSkin',
        avatarUrl: account.avatar ?? ICON_PATH,
        manageUrl: 'https://littleskin.cn/user',
      };
    },
    refreshSkinState: async (accountId: string) => {
      const account = state.accounts.find((item) => item.id === accountId);
      return {
        supported: Boolean(account && account.type === 'third-party'),
        provider: account?.skinProvider ?? 'littleskin',
        providerLabel: account?.skinProvider === 'blessing-skin' ? 'Blessing Skin' : 'LittleSkin',
        avatarUrl: account?.avatar ?? ICON_PATH,
        manageUrl: 'https://littleskin.cn/user',
      };
    },
    removeAccount: async (accountId: string) => {
      state.accounts = state.accounts.filter((account) => account.id !== accountId);
    },
    selectAccount: async (accountId: string) => {
      state.selectedAccountId = accountId;
    },
  };

  const externalLinksApi = {
    open: async (request: { url: string }) => ({ status: 'opened', url: request.url }),
  };

  const shareApi = {
    generateCode: async (modpackId: string) => `fmcl://share/${modpackId}?v=1.4.2`,
    importCode: async () => structuredClone(sharedManifest),
  };

  const modsApi = {
    searchMods: async () => ({
      items: [
        {
          platform: 'modrinth' as const,
          projectId: 'sodium',
          title: 'Sodium',
          description: 'Client performance improvements',
          iconUrl: ICON_PATH,
          downloads: 10_000,
        },
      ],
      total: 1,
    }),
    getModVersions: async () => [
      {
        platform: 'modrinth' as const,
        versionId: 'sodium-1.0.0',
        name: 'Sodium 1.0.0',
        versionNumber: '1.0.0',
        mcVersions: ['1.20.1'],
        loaders: ['fabric'],
      },
    ],
    installModFile: async () => ({ ok: true }),
  };

  const statisticsApi = {
    getStats: async () => structuredClone(statistics),
    exportStats: async (filePath: string) => ({
      filePath,
      exportedAt: new Date().toISOString(),
    }),
  };

  const mirrors: Mirror[] = [
    {
      id: 'official',
      name: 'Official',
      type: 'official',
      rootUrl: 'https://piston-meta.mojang.com',
      priority: 1,
      isActive: true,
    },
    {
      id: 'bmcl',
      name: 'BMCL',
      type: 'bmcl',
      rootUrl: 'https://bmclapi2.bangbang93.com',
      priority: 2,
      isActive: false,
    },
  ];

  const mirrorsApi = {
    getMirrors: async () => structuredClone(mirrors),
    getSelectedMirror: async () => structuredClone(mirrors[0]),
    addCustomMirror: async (name: string, rootUrl: string) => ({
      id: `custom-${mirrors.length + 1}`,
      name,
      type: 'custom' as const,
      rootUrl,
      priority: mirrors.length + 1,
      isActive: false,
    }),
    removeMirror: async () => undefined,
    selectMirror: async () => undefined,
    moveMirror: async () => undefined,
    testSpeed: async () => 42,
    setAutoSelect: async () => undefined,
    isAutoSelectEnabled: async () => false,
  };

  const ipcRenderer = {
    invoke: async <T,>(channel: string, ..._args: unknown[]): Promise<T> => {
      if (channel === 'dialog:showSaveDialog') {
        return {
          canceled: false,
          filePath: `${DESKTOP_PATH}/alpha-pack.zip`,
        } as T;
      }
      if (channel === 'dialog:showOpenDialog') {
        return {
          canceled: true,
          filePaths: [],
        } as T;
      }
      if (channel === 'dialog:getDesktopPath') {
        return DESKTOP_PATH as T;
      }
      if (channel === 'datapacks:list') {
        return structuredClone(installedDatapacks) as T;
      }
      if (channel === 'datapacks:enable' || channel === 'datapacks:disable' || channel === 'datapacks:delete') {
        return { ok: true } as T;
      }
      if (channel === 'datapacks:search') {
        return structuredClone(datapackSearchResults) as T;
      }
      if (channel === 'datapacks:getVersions') {
        return [{ id: 'immersive-world-events-1.0.0' }] as T;
      }
      if (channel === 'datapacks:install') {
        return { ok: true } as T;
      }
      throw new Error(`Unhandled manual verification ipc channel: ${channel}`);
    },
  };

  const windowControls = {
    minimize: () => Promise.resolve(),
    close: () => Promise.resolve(),
    openConsole: () => Promise.resolve(),
    closeConsole: () => Promise.resolve(),
  };

  const api = {
    modpacks: modpacksApi,
    account: accountApi,
    externalLinks: externalLinksApi,
    mods: modsApi,
    statistics: statisticsApi,
    mirrors: mirrorsApi,
    share: shareApi,
    windowControls,
    ipcRenderer,
  } as unknown as FriendLauncherApi;

  window.api = api;
  window.modpacks = modpacksApi as unknown as Window['modpacks'];
  window.account = accountApi as unknown as Window['account'];
  window.externalLinks = externalLinksApi as unknown as Window['externalLinks'];
  window.mods = modsApi as unknown as Window['mods'];
  window.mirrors = mirrorsApi as unknown as Window['mirrors'];
  window.share = shareApi as unknown as Window['share'];
  window.screenshots = {
    list: async () => structuredClone(screenshots),
    delete: async () => ({ ok: true }),
    rename: async () => ({ ok: true }),
    openFolder: async () => ({ ok: true }),
  };
  window.windowControls = windowControls;
}
