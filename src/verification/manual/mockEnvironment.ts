import type {
  FriendLauncherApi,
  InstanceConfigDto,
  InstanceListItemDto,
  InstanceMetadataDto,
  InstanceMutationResponse,
  InstanceResult,
  InstanceSnapshotDto,
  InstancesAPI,
  ProviderCatalogSearchResultItem,
  ProviderCatalogVersionDescriptor,
} from '@shared/contracts';
import type { ResourcePackAcquisitionResult } from '@shared/contracts/resourcePacks';
import type { ShaderPack, ShaderPackAcquisitionResult } from '@shared/contracts/shaders';
import type { Account, Mirror, ModpackManifest, ModpackMetadata, StatisticsOverview } from '@shared/types';
import type { ModEntry } from '@shared/types/mods';
import type { ResourcePack } from '@shared/types/resourcePack';
import type { ModpackConfig } from '../../contexts/instances/types';
import type { Screenshot } from '@shared/types/screenshots';
import { APP_ICON_PATH } from '../../app/assets/branding';

const ICON_PATH = APP_ICON_PATH;
const DESKTOP_PATH = '/Users/manual/Desktop';
const PHASE_17_POLISH_VIEW = 'phase-17-polish';
const PHASE_21_BROWSER_DENSITY_VIEW = 'phase-21-browser-density';
const PHASE_21_DETAILS_DENSITY_VIEW = 'phase-21-details-density';
const PHASE_21_RUNTIME_EDIT_VIEW = 'phase-21-runtime-edit';
const PHASE_21_SECONDARY_DENSITY_VIEW = 'phase-21-secondary-density';
const PHASE_22_THEME_DARK_VIEW = 'phase-22-theme-dark';
const PHASE_22_THEME_LIGHT_VIEW = 'phase-22-theme-light';
const PHASE_22_LOCALE_RU_VIEW = 'phase-22-locale-ru';
const PHASE_24_HOME_CLOSEOUT_VIEW = 'phase-24-home-closeout';
const PHASE_24_MODPACKS_CLOSEOUT_VIEW = 'phase-24-modpacks-closeout';
const PHASE_24_DEGRADED_CLOSEOUT_VIEW = 'phase-24-degraded-closeout';
const PHASE_24_THEME_DARK_VIEW = 'phase-24-theme-dark';
const PHASE_24_THEME_LIGHT_VIEW = 'phase-24-theme-light';
const PHASE_24_LOCALE_EN_VIEW = 'phase-24-locale-en';
const PHASE_24_LOCALE_RU_VIEW = 'phase-24-locale-ru';
const GUIDED_RESOURCEPACKS_RECOVERY_VIEW = 'guided-resourcepacks-recovery';
const GUIDED_SHADERS_RECOVERY_VIEW = 'guided-shaders-recovery';

const PHASE_21_DETAIL_VIEWS = new Set([PHASE_21_DETAILS_DENSITY_VIEW, PHASE_21_RUNTIME_EDIT_VIEW]);
const PHASE_24_CLOSEOUT_VIEWS = new Set([
  PHASE_24_HOME_CLOSEOUT_VIEW,
  PHASE_24_MODPACKS_CLOSEOUT_VIEW,
  PHASE_24_DEGRADED_CLOSEOUT_VIEW,
  PHASE_24_THEME_DARK_VIEW,
  PHASE_24_THEME_LIGHT_VIEW,
  PHASE_24_LOCALE_EN_VIEW,
  PHASE_24_LOCALE_RU_VIEW,
]);
const PHASE_24_SIMPLE_VIEWS = new Set([
  PHASE_24_HOME_CLOSEOUT_VIEW,
  PHASE_24_THEME_DARK_VIEW,
  PHASE_24_THEME_LIGHT_VIEW,
]);
const PHASE_24_BROWSER_PROOF_VIEWS = new Set([
  PHASE_24_MODPACKS_CLOSEOUT_VIEW,
  PHASE_24_LOCALE_EN_VIEW,
  PHASE_24_LOCALE_RU_VIEW,
]);

const FIXTURE_NOW_MS = Date.parse('2026-04-19T12:00:00.000Z');
const secondsAgo = (seconds: number) => FIXTURE_NOW_MS - seconds * 1_000;
const minutesAgo = (minutes: number) => FIXTURE_NOW_MS - minutes * 60_000;
const hoursAgo = (hours: number) => FIXTURE_NOW_MS - hours * 3_600_000;

export const PHASE_21_RUNTIME_FIXTURE = {
  name: 'Atlas Control Room Longform Runtime Review Pack',
  description:
    'Shared Phase 21 runtime summary fixture with intentionally long metadata so create and edit truth can be compared under real shell density.',
  version: '2.6.0-rc.12',
  minecraftVersion: '1.20.1',
  modLoader: {
    type: 'fabric' as const,
    version: '0.16.9',
  },
};

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

const browserResults: ProviderCatalogSearchResultItem[] = [
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

type ManualContentType = 'mod' | 'resourcepack' | 'shader';

interface ManualModSearchResult {
  platform: 'curseforge' | 'modrinth';
  projectId: string;
  title: string;
  description?: string;
  iconUrl?: string;
  downloads?: number;
}

interface ManualModSearchQuery {
  contentType?: ManualContentType;
  query?: string;
  offset?: number;
  limit?: number;
}

interface ManualModVersionQuery {
  contentType?: ManualContentType;
  projectId: string;
}

interface ManualModVersion {
  platform: 'curseforge' | 'modrinth';
  versionId: string;
  name: string;
  versionNumber?: string;
  mcVersions: string[];
  loaders: string[];
}

interface ManualModInstallRequest {
  contentType?: ManualContentType;
  platform?: 'curseforge' | 'modrinth';
  projectId: string;
  versionId: string;
}

const guidedResourcePackResults: ManualModSearchResult[] = [
  {
    platform: 'modrinth',
    projectId: 'painterly-depth-reloaded',
    title: 'Painterly Depth Reloaded',
    description: 'Painterly proof fixture for guided resource-pack browsing and local fallback review.',
    iconUrl: undefined,
    downloads: 22_410,
  },
  {
    platform: 'modrinth',
    projectId: 'grid-notes-ultra',
    title: 'Grid Notes Ultra',
    description: 'Secondary resource-pack fixture with enough metadata to keep the guided route from collapsing into generic mod copy.',
    iconUrl: ICON_PATH,
    downloads: 14_128,
  },
];

const guidedShaderResults: ManualModSearchResult[] = [
  {
    platform: 'modrinth',
    projectId: 'photon-bloom-lite',
    title: 'Photon Bloom Lite',
    description: 'Shader proof fixture for capability guidance and runtime-blocked recovery review.',
    iconUrl: undefined,
    downloads: 31_904,
  },
  {
    platform: 'modrinth',
    projectId: 'signal-bloom-night',
    title: 'Signal Bloom Night',
    description: 'Secondary shader fixture for the guided-browser proof route.',
    iconUrl: ICON_PATH,
    downloads: 12_604,
  },
];

const phase21BrowserResults: ProviderCatalogSearchResultItem[] = [
  {
    platform: 'modrinth',
    projectId: 'atlas-control-room',
    slug: 'atlas-control-room',
    title: 'Atlas Control Room Longform Runtime Review Pack',
    description: 'Crowded card with layered compatibility, activity, and install metadata for dense browser proof.',
    iconUrl: undefined,
    downloads: 91_234,
    dateCreated: '2026-03-29T10:00:00.000Z',
    dateModified: '2026-04-16T08:30:00.000Z',
  },
  {
    platform: 'modrinth',
    projectId: 'signal-overwatch',
    slug: 'signal-overwatch',
    title: 'Signal Overwatch Operations Board',
    description: 'Long-title follow-up card with enough copy to expose wrapped metadata and CTA drift.',
    iconUrl: ICON_PATH,
    downloads: 48_302,
    dateCreated: '2026-03-25T09:15:00.000Z',
    dateModified: '2026-04-15T12:00:00.000Z',
  },
  {
    platform: 'modrinth',
    projectId: 'archive-telemetry',
    slug: 'archive-telemetry',
    title: 'Archive Telemetry and Recovery Procedures',
    description: 'Secondary dense browser result with stacked copy and a long project name.',
    iconUrl: undefined,
    downloads: 27_118,
    dateCreated: '2026-03-19T07:10:00.000Z',
    dateModified: '2026-04-14T16:45:00.000Z',
  },
  {
    platform: 'modrinth',
    projectId: 'night-transit',
    slug: 'night-transit',
    title: 'Night Transit Lighting Review',
    description: 'Compact but still long enough to stress horizontal card rhythm in the same result set.',
    iconUrl: ICON_PATH,
    downloads: 14_280,
    dateCreated: '2026-03-11T12:00:00.000Z',
    dateModified: '2026-04-12T10:00:00.000Z',
  },
  {
    platform: 'modrinth',
    projectId: 'dense-ui-observer',
    slug: 'dense-ui-observer',
    title: 'Dense UI Observer Toolkit for Multiplayer Crews',
    description: 'Supportive metadata block meant to produce visible card stacking instead of single-line happy paths.',
    iconUrl: undefined,
    downloads: 12_084,
    dateCreated: '2026-02-28T10:00:00.000Z',
    dateModified: '2026-04-10T08:30:00.000Z',
  },
  {
    platform: 'modrinth',
    projectId: 'relay-ops',
    slug: 'relay-ops',
    title: 'Relay Operations Map Pack',
    description: 'Shorter trailing card to make the dense browser view feel like a real mixed catalog.',
    iconUrl: ICON_PATH,
    downloads: 9_816,
    dateCreated: '2026-02-17T15:20:00.000Z',
    dateModified: '2026-04-09T18:20:00.000Z',
  },
];

function getManualVerificationView() {
  return new URLSearchParams(window.location.search).get('view') ?? 'overview';
}

function getMetadataForView(view: string): Record<string, ModpackMetadata> {
  const metadata = structuredClone(baseMetadata);

  if (PHASE_21_DETAIL_VIEWS.has(view)) {
    metadata.alpha = {
      ...metadata.alpha,
      name: PHASE_21_RUNTIME_FIXTURE.name,
      version: PHASE_21_RUNTIME_FIXTURE.version,
      minecraftVersion: PHASE_21_RUNTIME_FIXTURE.minecraftVersion,
      modLoader: structuredClone(PHASE_21_RUNTIME_FIXTURE.modLoader),
      description:
        'Constrained-width details proof with intentionally long metadata, crowded supporting copy, and the shared runtime truth fixture.',
      author: 'FMCL Dense Surface Validation Crew',
      updatedAt: '2026-04-18T08:30:00.000Z',
    };
  }

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

function getBrowserResultsForView(view: string): ProviderCatalogSearchResultItem[] {
  if (view === PHASE_21_BROWSER_DENSITY_VIEW) {
    return structuredClone(phase21BrowserResults);
  }

  const results = structuredClone(browserResults);

  if (view === PHASE_17_POLISH_VIEW) {
    results[0] = {
      ...results[0],
      iconUrl: undefined,
      description: 'No-art launcher mark fallback fixture for the constrained browser state.',
    };

    return results;
  }

  if (view === 'modpack-browser' || view === PHASE_21_BROWSER_DENSITY_VIEW || PHASE_24_BROWSER_PROOF_VIEWS.has(view)) {
    results[0] = {
      ...results[0],
      iconUrl: undefined,
      description: PHASE_24_BROWSER_PROOF_VIEWS.has(view)
        ? 'Phase 24 closeout browser fixture with deterministic neutral artwork fallback for final review.'
        : 'Phase 20 neutral artwork fallback fixture for the shell-integrated browser proof.',
    };
  }

  return results;
}

function getGuidedContentResults(contentType: ManualContentType): ManualModSearchResult[] {
  switch (contentType) {
    case 'resourcepack':
      return structuredClone(guidedResourcePackResults);
    case 'shader':
      return structuredClone(guidedShaderResults);
    case 'mod':
    default:
      return [
        {
          platform: 'modrinth',
          projectId: 'sodium',
          title: 'Sodium',
          description: 'Client performance improvements',
          iconUrl: ICON_PATH,
          downloads: 10_000,
        },
      ];
  }
}

function createGuidedContentSearchResponse(query: ManualModSearchQuery) {
  const contentType = query.contentType ?? 'mod';
  const availableResults = getGuidedContentResults(contentType);
  const normalizedQuery = query.query?.trim().toLowerCase() ?? '';
  const filtered = normalizedQuery
    ? availableResults.filter((item) => item.title.toLowerCase().includes(normalizedQuery))
    : availableResults;
  const offset = query.offset ?? 0;
  const limit = query.limit ?? 20;

  return {
    items: filtered.slice(offset, offset + limit),
    total: filtered.length,
  };
}

function getGuidedContentVersions(query: ManualModVersionQuery): ManualModVersion[] {
  const contentType = query.contentType ?? 'mod';
  const baseVersion =
    contentType === 'resourcepack'
      ? {
          versionId: `${query.projectId}-34`,
          name: 'Pack Format 34',
          versionNumber: '34',
          mcVersions: ['1.20.1'],
          loaders: [],
        }
      : contentType === 'shader'
        ? {
            versionId: `${query.projectId}-1.20.1`,
            name: 'Runtime-ready build',
            versionNumber: '1.20.1',
            mcVersions: ['1.20.1'],
            loaders: ['forge', 'fabric'],
          }
        : {
            versionId: 'sodium-1.0.0',
            name: 'Sodium 1.0.0',
            versionNumber: '1.0.0',
            mcVersions: ['1.20.1'],
            loaders: ['fabric'],
          };

  return [
    {
      platform: 'modrinth',
      ...baseVersion,
    },
  ];
}

function createResourcePackAcquisitionResult(view: string): ResourcePackAcquisitionResult {
  if (view === GUIDED_RESOURCEPACKS_RECOVERY_VIEW) {
    return {
      status: 'partial-success',
      importedFileNames: ['Painterly Depth Reloaded.zip'],
      issues: [
        {
          fileName: 'Broken Painterly Draft.zip',
          status: 'invalid-archive',
          message: 'The selected archive does not contain a valid resource pack payload.',
        },
      ],
    };
  }

  return {
    status: 'success',
    importedFileNames: ['Painterly Depth Reloaded.zip'],
    issues: [],
  };
}

function createShaderAcquisitionResult(): ShaderPackAcquisitionResult {
  return {
    status: 'success',
    importedFileNames: ['Photon Bloom Lite.zip'],
    issues: [],
  };
}

const modpackVersions: ProviderCatalogVersionDescriptor[] = [
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
      mtimeMs: secondsAgo(10),
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
      mtimeMs: secondsAgo(7.5),
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
      mtimeMs: secondsAgo(5),
    },
    hash: {
      sha1: 'gamma-sha1',
    },
    enabled: true,
  },
];

const phase21DenseModEntries: ModEntry[] = [
  {
    id: 'atlas-bootstrap',
    name: 'Atlas Bootstrap Sequencer',
    version: '4.2.1',
    loaders: ['fabric'],
    deps: [],
    file: {
      path: '/mock/.minecraft/mods/atlas-bootstrap.jar',
      name: 'atlas-bootstrap.jar',
      size: 2_048,
      mtimeMs: secondsAgo(12),
    },
    hash: {
      sha1: 'atlas-bootstrap-sha1',
    },
    enabled: true,
  },
  {
    id: 'signal-panels',
    name: 'Signal Panels and Dense Status Labels',
    version: '2.9.0',
    loaders: ['fabric'],
    deps: [],
    file: {
      path: '/mock/.minecraft/mods/signal-panels.jar',
      name: 'signal-panels.jar',
      size: 1_536,
      mtimeMs: secondsAgo(10.5),
    },
    hash: {
      sha1: 'signal-panels-sha1',
    },
    enabled: true,
  },
  {
    id: 'crowded-routing',
    name: 'Crowded Routing Diagnostics Companion',
    version: '1.7.3',
    loaders: ['fabric'],
    deps: [
      { id: 'minecraft', versionRange: '[1.20.1]', kind: 'depends' },
      { id: 'fabricloader', versionRange: '[0.16.9]', kind: 'depends' },
      { id: 'atlas-bootstrap', versionRange: '[4.2.1]', kind: 'depends' },
    ],
    file: {
      path: '/mock/.minecraft/mods/crowded-routing.jar',
      name: 'crowded-routing.jar',
      size: 2_560,
      mtimeMs: secondsAgo(9),
    },
    hash: {
      sha1: 'crowded-routing-sha1',
    },
    enabled: true,
  },
  {
    id: 'overworld-reports',
    name: 'Overworld Reports and Warning Panels',
    version: '6.0.4',
    loaders: ['fabric'],
    deps: [],
    file: {
      path: '/mock/.minecraft/mods/overworld-reports.jar.disabled',
      name: 'overworld-reports.jar.disabled',
      size: 1_280,
      mtimeMs: secondsAgo(7.5),
    },
    hash: {
      sha1: 'overworld-reports-sha1',
    },
    enabled: false,
  },
];

export function getManualVerificationModpackMetadata(view: string): ModpackMetadata {
  return structuredClone(getMetadataForView(view).alpha);
}

function getModEntriesForView(view: string): ModEntry[] {
  if (PHASE_21_DETAIL_VIEWS.has(view)) {
    return structuredClone(phase21DenseModEntries);
  }

  return structuredClone(modEntries);
}

export function getManualVerificationModEntries(view = 'overview'): ModEntry[] {
  return getModEntriesForView(view);
}

const statistics: StatisticsOverview = {
  global: {
    totalPlayTime: 7_200_000,
    totalLaunches: 18,
    lastPlayed: hoursAgo(1),
  },
  instances: {
    alpha: {
      name: 'Alpha Pack',
      playTime: 4_200_000,
      launches: 11,
      lastPlayed: hoursAgo(1),
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
      lastPlayed: hoursAgo(1),
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
    path: 'screenshots/mountain-sunrise.png',
    url: ICON_PATH,
    createdAt: minutesAgo(12),
    size: 256_000,
  },
  {
    name: 'village-evening.png',
    path: 'screenshots/village-evening.png',
    url: ICON_PATH,
    createdAt: minutesAgo(6),
    size: 248_000,
  },
];

const installedDatapacks = [
  {
    fileName: 'logic-tweaks.zip',
    name: 'Logic Tweaks',
    description: 'Adds world automation helpers for the Alpha fixture.',
    isEnabled: true,
    path: 'datapacks/logic-tweaks.zip',
  },
  {
    fileName: 'adventure-rules.zip',
    name: 'Adventure Rules',
    description: 'Tighter progression rules for shared sessions.',
    isEnabled: false,
    path: 'datapacks/adventure-rules.zip',
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

const resourcePacks: ResourcePack[] = [
  {
    fileName: 'painterly-depth.zip',
    name: 'Painterly Depth',
    description: 'Missing-art proof pack for the Phase 20 brand fallback route.',
    packFormat: 34,
    iconUrl: undefined,
    isEnabled: true,
    size: 1_572_864,
  },
  {
    fileName: 'grid-notes.zip',
    name: 'Grid Notes',
    description: 'Secondary pack with bundled art for reorder and state contrast.',
    packFormat: 34,
    iconUrl: ICON_PATH,
    isEnabled: false,
    size: 1_048_576,
  },
];

const phase21DenseResourcePacks: ResourcePack[] = [
  {
    fileName: 'painterly-depth-annotated-ui-pack.zip',
    name: 'Painterly Depth Annotated UI Pack',
    description: 'Missing-art proof pack with a deliberately long label for dense secondary-content review.',
    packFormat: 34,
    iconUrl: undefined,
    isEnabled: true,
    size: 1_572_864,
  },
  {
    fileName: 'status-ribbon-contrast-calibration-sheets.zip',
    name: 'Status Ribbon Contrast Calibration Sheets',
    description: 'Long secondary label used to expose multi-line list rhythm and CTA stacking.',
    packFormat: 34,
    iconUrl: ICON_PATH,
    isEnabled: true,
    size: 1_848_320,
  },
  {
    fileName: 'dense-inventory-labels-companion.zip',
    name: 'Dense Inventory Labels Companion',
    description: 'Support pack with enough metadata to keep the secondary route visibly busy.',
    packFormat: 34,
    iconUrl: undefined,
    isEnabled: false,
    size: 1_228_800,
  },
  {
    fileName: 'night-transit-lighting-proof.zip',
    name: 'Night Transit Lighting Proof',
    description: 'Trailing pack that keeps reorder and enable controls visible under density pressure.',
    packFormat: 34,
    iconUrl: ICON_PATH,
    isEnabled: false,
    size: 1_009_664,
  },
];

const shaderPacks: ShaderPack[] = [
  {
    fileName: 'photon-bloom-lite.zip',
    name: 'Photon Bloom Lite',
    isActive: true,
  },
  {
    fileName: 'signal-bloom-night.zip',
    name: 'Signal Bloom Night',
    isActive: false,
  },
];

function getResourcePacksForView(view: string): ResourcePack[] {
  if (view === PHASE_21_SECONDARY_DENSITY_VIEW) {
    return structuredClone(phase21DenseResourcePacks);
  }

  return structuredClone(resourcePacks);
}

function getShadersForView(): ShaderPack[] {
  return structuredClone(shaderPacks);
}

type ManualState = {
  selectedModpackId: string;
  selectedAccountId: string;
  modpacks: ModpackConfig[];
  metadata: Record<string, ModpackMetadata>;
  accounts: Account[];
};

function getConfigsForView(view: string): Record<string, ModpackConfig> {
  const configs = structuredClone(baseConfigs);

  if (PHASE_21_DETAIL_VIEWS.has(view)) {
    configs.alpha = {
      ...configs.alpha,
      name: PHASE_21_RUNTIME_FIXTURE.name,
      runtime: {
        minecraft: PHASE_21_RUNTIME_FIXTURE.minecraftVersion,
        modLoader: structuredClone(PHASE_21_RUNTIME_FIXTURE.modLoader),
      },
      memory: { maxMb: 8192, minMb: 6144 },
      updatedAt: '2026-04-18T08:30:00.000Z',
    };
  }

  if (view === GUIDED_SHADERS_RECOVERY_VIEW) {
    configs.alpha = {
      ...configs.alpha,
      game: {
        ...configs.alpha.game,
        useOptiFine: true,
      },
    };
  }

  return configs;
}

function createState(view: string): ManualState {
  const configs = getConfigsForView(view);

  return {
    selectedModpackId: 'alpha',
    selectedAccountId: 'account-1',
    modpacks: [structuredClone(configs.alpha), structuredClone(configs.classic)],
    metadata: getMetadataForView(view),
    accounts: structuredClone(baseAccounts),
  };
}

function findConfig(state: ManualState, modpackId: string) {
  return state.modpacks.find((cfg) => cfg.id === modpackId) ?? null;
}

function updateConfig(state: ManualState, nextConfig: ModpackConfig) {
  state.modpacks = state.modpacks.map((cfg) => (cfg.id === nextConfig.id ? structuredClone(nextConfig) : cfg));
}

function toInstanceConfig(config: ModpackConfig): InstanceConfigDto {
  return {
    runtime: {
      minecraftVersion: config.runtime.minecraft,
      ...(config.runtime.modLoader === undefined ? {} : { modLoader: { ...config.runtime.modLoader } }),
    },
    ...(config.memory === undefined ? {} : { memory: { ...config.memory } }),
    ...(config.vmOptions === undefined ? {} : { vmOptions: [...config.vmOptions] }),
    ...(config.game === undefined ? {} : {
      game: {
        ...(config.game.resolution === undefined ? {} : { resolution: { ...config.game.resolution } }),
        ...(config.game.extraArgs === undefined ? {} : { extraArgs: [...config.game.extraArgs] }),
        ...(config.game.useOptiFine === undefined ? {} : { useOptiFine: config.game.useOptiFine }),
      },
    }),
    ...(config.server === undefined ? {} : { server: { ...config.server } }),
    ...(config.networkMode === undefined ? {} : { networkMode: config.networkMode }),
  };
}

function toModpackConfig(id: string, name: string, config: InstanceConfigDto, metadata?: InstanceMetadataDto): ModpackConfig {
  return {
    id,
    name,
    runtime: {
      minecraft: config.runtime.minecraftVersion,
      ...(config.runtime.modLoader === undefined ? {} : { modLoader: { ...config.runtime.modLoader } }),
    },
    ...(config.memory === undefined ? {} : { memory: { ...config.memory } }),
    ...(config.vmOptions === undefined ? {} : { vmOptions: [...config.vmOptions] }),
    ...(config.game === undefined ? {} : {
      game: {
        ...(config.game.resolution === undefined ? {} : { resolution: { ...config.game.resolution } }),
        ...(config.game.extraArgs === undefined ? {} : { extraArgs: [...config.game.extraArgs] }),
        ...(config.game.useOptiFine === undefined ? {} : { useOptiFine: config.game.useOptiFine }),
      },
    }),
    ...(config.server === undefined ? {} : { server: { ...config.server } }),
    ...(config.networkMode === undefined ? {} : { networkMode: config.networkMode }),
    ...(metadata === undefined ? {} : { createdAt: metadata.createdAt, updatedAt: metadata.updatedAt }),
  };
}

function toInstanceMetadata(metadata: ModpackMetadata): InstanceMetadataDto {
  return {
    source: metadata.source,
    ...(metadata.sourceId === undefined ? {} : { sourceId: metadata.sourceId }),
    ...(metadata.sourceVersionId === undefined ? {} : { sourceVersionId: metadata.sourceVersionId }),
    ...(metadata.version === undefined ? {} : { version: metadata.version }),
    ...(metadata.iconUrl === undefined ? {} : { iconUrl: metadata.iconUrl }),
    ...(metadata.description === undefined ? {} : { description: metadata.description }),
    ...(metadata.author === undefined ? {} : { author: metadata.author }),
    createdAt: metadata.createdAt,
    updatedAt: metadata.updatedAt,
  };
}

function instanceListItems(state: ManualState): InstanceListItemDto[] {
  return state.modpacks.map((config) => ({
    id: config.id,
    name: config.name,
    selected: config.id === state.selectedModpackId,
    summary: {
      minecraftVersion: config.runtime.minecraft,
      ...(config.runtime.modLoader === undefined ? {} : { modLoader: { ...config.runtime.modLoader } }),
    },
  }));
}

function instanceMutation(state: ManualState, status: 'committed' | 'noop' = 'committed'): InstanceMutationResponse {
  return {
    status,
    selectedId: state.selectedModpackId,
    instances: instanceListItems(state),
  };
}

function instanceResult<T>(value: T): InstanceResult<T> {
  return { ok: true, value };
}

function missingInstance<T>(id: string): InstanceResult<T> {
  return {
    ok: false,
    error: {
      code: 'INSTANCE_NOT_FOUND',
      message: `Instance '${id}' was not found in the manual verification fixture.`,
    },
  };
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
  const simpleViews = new Set(['welcome', 'tour', 'dashboard', ...PHASE_24_SIMPLE_VIEWS]);
  const isPhase17Polish = view === PHASE_17_POLISH_VIEW;
  const isPhase22ThemeDark = view === PHASE_22_THEME_DARK_VIEW;
  const isPhase22ThemeLight = view === PHASE_22_THEME_LIGHT_VIEW;
  const isPhase22LocaleRu = view === PHASE_22_LOCALE_RU_VIEW;
  const isPhase24ThemeDark = view === PHASE_24_THEME_DARK_VIEW;
  const isPhase24ThemeLight = view === PHASE_24_THEME_LIGHT_VIEW;
  const isPhase24LocaleRu = view === PHASE_24_LOCALE_RU_VIEW;
  const seededBrowserResults = getBrowserResultsForView(view);

  localStorage.setItem('settings_language', isPhase17Polish || isPhase22LocaleRu || isPhase24LocaleRu ? 'ru' : 'en');
  localStorage.setItem('settings_theme', isPhase22ThemeLight || isPhase24ThemeLight ? 'light' : 'dark');
  if (isPhase17Polish || isPhase22ThemeDark || isPhase24ThemeDark) {
    localStorage.setItem('settings_themePresetId', 'forest');
  } else {
    localStorage.removeItem('settings_themePresetId');
  }
  localStorage.setItem('settings_accentColor', isPhase22ThemeLight || isPhase24ThemeLight ? 'rose' : 'emerald');
  localStorage.setItem('settings_disableAnimations', PHASE_24_CLOSEOUT_VIEWS.has(view) ? 'true' : 'false');
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

  const instancesApi: InstancesAPI = {
    list: async () => instanceResult({ status: 'ready', instances: instanceListItems(state) }),
    snapshot: async ({ id }) => {
      const config = findConfig(state, id);
      const metadata = state.metadata[id];
      if (!config || !metadata) return missingInstance<InstanceSnapshotDto>(id);

      return instanceResult({
        id,
        name: config.name,
        metadata: toInstanceMetadata(metadata),
        config: toInstanceConfig(config),
        summary: {
          minecraftVersion: config.runtime.minecraft,
          ...(config.runtime.modLoader === undefined ? {} : { modLoader: { ...config.runtime.modLoader } }),
        },
      });
    },
    select: async ({ id }) => {
      if (!findConfig(state, id)) return missingInstance<InstanceMutationResponse>(id);

      if (state.selectedModpackId === id) return instanceResult(instanceMutation(state, 'noop'));
      state.selectedModpackId = id;
      return instanceResult(instanceMutation(state));
    },
    create: async ({ name, source, config }) => {
      const id = `created-${state.modpacks.length + 1}`;
      const createdAt = new Date().toISOString();
      state.modpacks.push(toModpackConfig(id, name, config, {
        source: source.source,
        ...(source.sourceId === undefined ? {} : { sourceId: source.sourceId }),
        ...(source.sourceVersionId === undefined ? {} : { sourceVersionId: source.sourceVersionId }),
        ...(source.version === undefined ? {} : { version: source.version }),
        ...(source.iconUrl === undefined ? {} : { iconUrl: source.iconUrl }),
        ...(source.description === undefined ? {} : { description: source.description }),
        ...(source.author === undefined ? {} : { author: source.author }),
        createdAt,
        updatedAt: createdAt,
      }));
      state.metadata[id] = {
        id,
        name,
        source: source.source,
        ...(source.sourceId === undefined ? {} : { sourceId: source.sourceId }),
        ...(source.sourceVersionId === undefined ? {} : { sourceVersionId: source.sourceVersionId }),
        ...(source.version === undefined ? {} : { version: source.version }),
        ...(source.iconUrl === undefined ? {} : { iconUrl: source.iconUrl }),
        ...(source.description === undefined ? {} : { description: source.description }),
        ...(source.author === undefined ? {} : { author: source.author }),
        minecraftVersion: config.runtime.minecraftVersion,
        ...(config.runtime.modLoader === undefined ? {} : { modLoader: { ...config.runtime.modLoader } }),
        createdAt,
        updatedAt: createdAt,
      };
      state.selectedModpackId = id;
      return instanceResult(instanceMutation(state));
    },
    rename: async ({ id, name }) => {
      const config = findConfig(state, id);
      const metadata = state.metadata[id];
      if (!config || !metadata) return missingInstance<InstanceMutationResponse>(id);

      updateConfig(state, { ...config, name });
      state.metadata[id] = { ...metadata, name, updatedAt: new Date().toISOString() };
      return instanceResult(instanceMutation(state));
    },
    config: async (request) => {
      const current = findConfig(state, request.id);
      const metadata = state.metadata[request.id];
      if (!current || !metadata) return missingInstance<InstanceConfigDto | InstanceMutationResponse>(request.id);

      if (request.action === 'get') return instanceResult(toInstanceConfig(current));

      updateConfig(state, toModpackConfig(request.id, current.name, request.config, toInstanceMetadata(metadata)));
      state.metadata[request.id] = { ...metadata, updatedAt: new Date().toISOString() };
      return instanceResult(instanceMutation(state));
    },
    metadata: async ({ id }) => {
      const metadata = state.metadata[id];
      return metadata
        ? instanceResult(toInstanceMetadata(metadata))
        : missingInstance<InstanceMetadataDto>(id);
    },
    prepare: async () => instanceResult({ status: 'ready' }),
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
    generateCode: async (modpackId: string) => {
      if (view === PHASE_24_DEGRADED_CLOSEOUT_VIEW) {
        throw new Error('[shareIPC] generateCode failed: ${file.jarVersion}');
      }
      return `fmcl://share/${modpackId}?v=1.4.2`;
    },
  };

  const resourcePacksApi = {
    list: async () => getResourcePacksForView(view),
    enable: async () => ({ ok: true }),
    disable: async () => ({ ok: true }),
    reorder: async () => ({ ok: true }),
    delete: async () => ({ ok: true }),
    openFolder: async () => ({ ok: true }),
    add: async () => createResourcePackAcquisitionResult(view),
  };

  const shadersApi = {
    list: async () => getShadersForView(),
    setActive: async () => undefined,
    disable: async () => undefined,
    delete: async () => true,
    openFolder: async () => undefined,
    add: async () => createShaderAcquisitionResult(),
  };

  const modsApi = {
    searchMods: async (query: unknown) => {
      if (view === PHASE_24_DEGRADED_CLOSEOUT_VIEW) {
        throw new Error('[modsIPC] searchMods failed: ${file.jarVersion}');
      }

      return createGuidedContentSearchResponse(query as ManualModSearchQuery);
    },
    getModVersions: async (query: unknown) => getGuidedContentVersions(query as ManualModVersionQuery),
    installModFile: async (request: unknown) => {
      const parsedRequest = request as ManualModInstallRequest;

      if (view === GUIDED_RESOURCEPACKS_RECOVERY_VIEW && parsedRequest.contentType === 'resourcepack') {
        return {
          status: 'failure',
          issues: [
            {
              fileName: 'Painterly Depth Reloaded.zip',
              status: 'failure',
              message: 'FMCL could not add this resource pack right now.',
            },
          ],
        };
      }

      if (view === GUIDED_SHADERS_RECOVERY_VIEW && parsedRequest.contentType === 'shader') {
        return {
          status: 'runtime-blocked',
          issues: [
            {
              fileName: 'Photon Bloom Lite.zip',
              status: 'runtime-blocked',
              message: 'Shader runtime is blocked for the current modpack fixture.',
            },
          ],
        };
      }

      return { status: 'success' as const, filename: 'fixture-content.jar', issues: [] };
    },
  };

  const instanceModsApi = {
    list: async () => getModEntriesForView(view),
    remove: async () => ({ ok: true }),
    setEnabled: async () => ({ ok: true }),
    register: async () => ({ ok: true }),
  };

  const providerCatalogApi = {
    search: async ({ query, offset, limit }: { query: string; offset?: number; limit?: number }) => (
      createSearchResponse(query, offset, limit, view)
    ),
    versions: async ({ platform, projectId }: { platform: 'curseforge' | 'modrinth'; projectId: string }) => (
      structuredClone(modpackVersions).filter((version) => version.platform === platform && projectId === 'alpha-pack')
    ),
  };

  const statisticsApi = {
    getStats: async () => {
      if (view === PHASE_24_DEGRADED_CLOSEOUT_VIEW) {
        throw new Error('[IPC] getStats failed: Statistics store unavailable');
      }
      return structuredClone(statistics);
    },
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

  const dialogsApi = {
    showSaveDialog: async () => ({
      canceled: false,
      filePath: `${DESKTOP_PATH}/alpha-pack.zip`,
    }),
    showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
    getDesktopPath: async () => DESKTOP_PATH,
    saveFile: async () => ({ ok: true }),
  };

  const worldsApi = {
    listByInstanceId: async () => [{
      name: 'Alpha World',
      folderName: 'AlphaWorld',
      lastPlayed: hoursAgo(2),
      sizeBytes: 128 * 1024 * 1024,
    }],
    deleteByInstanceId: async () => undefined,
    backupByInstanceId: async () => undefined,
    duplicateByInstanceId: async (folderName: string) => `${folderName}-copy`,
    openFolderByInstanceId: async () => undefined,
  };

  const datapacksApi = {
    listByInstanceId: async () => structuredClone(installedDatapacks),
    enableByInstanceId: async () => ({ ok: true }),
    disableByInstanceId: async () => ({ ok: true }),
    deleteByInstanceId: async () => ({ ok: true }),
    search: async () => structuredClone(datapackSearchResults),
    installByInstanceId: async () => ({ ok: true }),
    getVersions: async () => [{ id: 'immersive-world-events-1.0.0' }],
  };

  const windowControls = {
    minimize: () => Promise.resolve(),
    close: () => Promise.resolve(),
    openConsole: () => Promise.resolve(),
    closeConsole: () => Promise.resolve(),
  };

  let nextOperationId = 0;
  const archiveReferences = new Map<string, number>();
  const archiveInspection = {
    select: async () => {
      const archiveRef = `manual-archive-${crypto.randomUUID()}`;
      archiveReferences.set(archiveRef, Date.now() + 5 * 60 * 1_000);
      return { status: 'selected' as const, archiveRef, format: 'modrinth' as const, manifest: structuredClone(sharedManifest) };
    },
  };
  const operationSnapshots = new Map<string, Record<string, unknown>>();
  const operations = {
    start: async (request: { kind: string; instanceId?: string; archiveRef?: string }) => {
      if (request.kind === 'import') {
        const expiresAt = request.archiveRef ? archiveReferences.get(request.archiveRef) : undefined;
        if (!request.archiveRef || !expiresAt || expiresAt <= Date.now()) {
          throw new Error('Archive reference was not authorized by a recent native archive selection');
        }
        archiveReferences.delete(request.archiveRef);
      }
      const id = `manual-operation-${++nextOperationId}`;
      if (request.kind === 'delete' && request.instanceId) {
        state.modpacks = state.modpacks.filter((cfg) => cfg.id !== request.instanceId);
        delete state.metadata[request.instanceId];
        if (state.selectedModpackId === request.instanceId) {
          state.selectedModpackId = state.modpacks[0]?.id ?? 'classic';
        }
      }
      const snapshot = {
        id,
        kind: request.kind,
        status: request.kind === 'delete' ? 'succeeded' : 'queued',
        phase: request.kind === 'delete' ? 'completed' : 'started',
        progress: { completed: request.kind === 'delete' ? 1 : 0, total: 1 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        result: request.kind === 'delete' && request.instanceId
          ? { status: 'succeeded', instanceId: request.instanceId }
          : undefined,
      };
      operationSnapshots.set(id, snapshot);
      return snapshot;
    },
    get: async (operationId: string) => operationSnapshots.get(operationId) ?? null,
    listRecovered: async () => [],
    cancel: async () => ({ cancelled: false }),
    subscribe: async (operationId: string, listener: (snapshot: unknown) => void) => {
      const snapshot = operationSnapshots.get(operationId);
      if (snapshot) listener(snapshot);
      return () => undefined;
    },
  };

  const api = {
    instances: instancesApi,
    instanceMods: instanceModsApi,
    providerCatalog: providerCatalogApi,
    archiveInspection,
    operations,
    account: accountApi,
    externalLinks: externalLinksApi,
    mods: modsApi,
    statistics: statisticsApi,
    mirrors: mirrorsApi,
    share: shareApi,
    windowControls,
    resourcePacks: resourcePacksApi,
    shaders: shadersApi,
    dialogs: dialogsApi,
    worlds: worldsApi,
    datapacks: datapacksApi,
    screenshots: {
      list: async (_instanceId: string) => {
        if (view === PHASE_24_DEGRADED_CLOSEOUT_VIEW) {
          throw new Error('[IPC] screenshots failed: Screenshots folder unavailable');
        }
        return structuredClone(screenshots);
      },
      delete: async (_fileName: string, _instanceId: string) => ({ ok: true }),
      rename: async (_oldName: string, _newName: string, _instanceId: string) => ({ ok: true }),
      openFolder: async (_instanceId: string) => ({ ok: true }),
    },
  } as unknown as FriendLauncherApi;

  window.api = api;
}
