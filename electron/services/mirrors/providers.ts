import { orderCandidatesByScore } from './scoring';
import type { DownloadProviderId, Mirror } from '@shared/types';
export type { DownloadProviderId } from '@shared/types';

export interface DownloadProvider {
  id: DownloadProviderId;
  getVersionListURLs(): string[];
  getAssetObjectCandidates(assetPath: string): string[];
  injectURL(url: string): string;
  injectURLWithCandidates(url: string): string[];
}

const OFFICIAL_VERSION_MANIFEST_URL = 'https://launchermeta.mojang.com/mc/game/version_manifest.json';
const OFFICIAL_VERSION_MANIFEST_FALLBACK = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
const OFFICIAL_ASSETS_ROOT = 'https://resources.download.minecraft.net';
// BMCL has multiple domains; in some regions `bmclapi2` can be unstable/blocked.
// Prefer `bmclapi` first and keep `bmclapi2` as fallback.
export const BMCL_ROOT = 'https://bmclapi.bangbang93.com';
export const BMCL_ROOT_FALLBACK = 'https://bmclapi2.bangbang93.com';
// NOTE:
// Do NOT use generic Maven repository mirrors for Forge artifacts.
// Some of them return HTML placeholder pages like "文件准备中" ("file preparing"),
// which then gets saved as `.jar` and fails ZIP validation.
const BMCL_FORGE_MAVEN_MIRRORS = [
  `${BMCL_ROOT}/maven`,
  `${BMCL_ROOT_FALLBACK}/maven`,
  'https://forge.fastmcmirror.org',
  // Chinese and nearby mirrors (priority for users in China/Russia)
  'https://mirror.sjtu.edu.cn/bmclapi/maven',
  'https://mirrors.tuna.tsinghua.edu.cn/bmclapi/maven',
  'https://mirrors.bfsu.edu.cn/bmclapi/maven',
];

// Generic Maven mirrors can be useful for Maven Central artifacts, but are unsafe for Forge Maven
// due to HTML placeholder responses and aggressive caching behaviors.
// Generic Maven mirrors can be useful for Maven Central artifacts, but are unsafe for Forge Maven
// due to HTML placeholder responses and aggressive caching behaviors.
const BMCL_GENERIC_MAVEN_MIRRORS = [
  'https://maven.aliyun.com/repository/public',
  'https://repo.huaweicloud.com/repository/maven',
];

export const getBmclReplacements = (root: string): Array<[string, string]> => [
  // Normalize both BMCL domains to preferred root.
  ['https://bmclapi2.bangbang93.com', root],
  ['https://bmclapi.bangbang93.com', root],
  ['https://launchermeta.mojang.com', root],
  ['https://piston-meta.mojang.com', root],
  ['https://piston-data.mojang.com', root],
  ['https://launcher.mojang.com', root],
  ['https://libraries.minecraft.net', `${root}/libraries`],
  ['http://files.minecraftforge.net/maven', `${root}/maven`],
  ['https://files.minecraftforge.net/maven', `${root}/maven`],
  ['https://files.minecraftforge.net/maven', `${root}/maven`],
  ['https://maven.minecraftforge.net', `${root}/maven`],
  ['https://maven.neoforged.net/releases/', `${root}/maven/`],
  ['https://meta.fabricmc.net', `${root}/fabric-meta`],
  ['https://maven.fabricmc.net', `${root}/maven`],
  ['https://authlib-injector.yushi.moe', `${root}/mirrors/authlib-injector`],
  ['https://repo1.maven.org/maven2', 'https://mirrors.cloud.tencent.com/nexus/repository/maven-public'],
  ['https://repo.maven.apache.org/maven2', 'https://mirrors.cloud.tencent.com/nexus/repository/maven-public'],
  ['https://hmcl.glavo.site/metadata/cleanroom', 'https://alist.8mi.tech/d/mirror/HMCL-Metadata/Auto/cleanroom'],
  ['https://hmcl.glavo.site/metadata/fmllibs', 'https://alist.8mi.tech/d/mirror/HMCL-Metadata/Auto/fmllibs'],
  [
    'https://zkitefly.github.io/unlisted-versions-of-minecraft',
    'https://alist.8mi.tech/d/mirror/unlisted-versions-of-minecraft/Auto',
  ],
  [OFFICIAL_ASSETS_ROOT, `${root}/assets`],
];

const uniq = (values: string[]) => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
};

const applyReplacement = (url: string, replacements: Array<[string, string]>) => {
  for (const [from, to] of replacements) {
    if (url.startsWith(from)) {
      return `${to}${url.substring(from.length)}`;
    }
  }
  return null;
};

const flattenProviderCandidates = (
  providers: DownloadProvider[],
  resolveCandidates: (provider: DownloadProvider) => string[],
) => uniq(
  providers.flatMap((provider) => orderCandidatesByScore(resolveCandidates(provider))),
);

const replaceMavenUrl = (url: string, mirrorRoot: string) => {
  const forge = 'https://maven.minecraftforge.net';
  const forgeHttp = 'http://files.minecraftforge.net/maven';
  const forgeHttps = 'https://files.minecraftforge.net/maven';
  const neoForge = 'https://maven.neoforged.net/releases/';
  const fabric = 'https://maven.fabricmc.net';
  if (url.startsWith(forge)) return `${mirrorRoot}${url.substring(forge.length)}`;
  if (url.startsWith(forgeHttp)) return `${mirrorRoot}${url.substring(forgeHttp.length)}`;
  if (url.startsWith(forgeHttps)) return `${mirrorRoot}${url.substring(forgeHttps.length)}`;
  if (url.startsWith(neoForge)) return `${mirrorRoot}${url.substring(neoForge.length)}`;
  if (url.startsWith(fabric)) return `${mirrorRoot}${url.substring(fabric.length)}`;
  return null;
};

const isForgeMavenUrl = (url: string) => {
  return (
    url.startsWith('https://maven.minecraftforge.net') ||
    url.startsWith('https://files.minecraftforge.net/maven') ||
    url.startsWith('http://files.minecraftforge.net/maven')
  );
};

export class OfficialProvider implements DownloadProvider {
  public id: DownloadProviderId = 'mojang';

  getVersionListURLs(): string[] {
    return [OFFICIAL_VERSION_MANIFEST_URL, OFFICIAL_VERSION_MANIFEST_FALLBACK];
  }

  getAssetObjectCandidates(assetPath: string): string[] {
    return [`${OFFICIAL_ASSETS_ROOT}/${assetPath}`];
  }

  injectURL(url: string): string {
    return url;
  }

  injectURLWithCandidates(url: string): string[] {
    return [url];
  }
}

export class BmclProvider implements DownloadProvider {
  public id: DownloadProviderId;
  private replacements: Array<[string, string]>;
  private root: string;

  constructor(rootUrl: string = BMCL_ROOT, id: DownloadProviderId = 'bmcl') {
    this.root = rootUrl;
    this.id = id;
    this.replacements = getBmclReplacements(rootUrl);
  }

  getVersionListURLs(): string[] {
    return this.injectURLWithCandidates(OFFICIAL_VERSION_MANIFEST_URL);
  }

  getAssetObjectCandidates(assetPath: string): string[] {
    return uniq([`${this.root}/assets/${assetPath}`, `${OFFICIAL_ASSETS_ROOT}/${assetPath}`]);
  }

  injectURL(url: string): string {
    return applyReplacement(url, this.replacements) ?? url;
  }

  injectURLWithCandidates(url: string): string[] {
    // For custom mirrors, we might want to just rely on the root URL or generic mirrors
    // For now, let's keep the hardcoded maven mirrors but ideally these should be configurable or inferred
    const roots = isForgeMavenUrl(url) ? BMCL_FORGE_MAVEN_MIRRORS : [...BMCL_FORGE_MAVEN_MIRRORS, ...BMCL_GENERIC_MAVEN_MIRRORS];
    const mavenCandidates = roots.map((root) => replaceMavenUrl(url, root)).filter(Boolean) as string[];
    if (mavenCandidates.length > 0) {
      return uniq([...mavenCandidates, url]);
    }
    const replaced = applyReplacement(url, this.replacements);
    return replaced ? uniq([replaced, url]) : [url];
  }
}

export class AutoProvider implements DownloadProvider {
  public id: DownloadProviderId = 'auto';
  private readonly providers: DownloadProvider[];

  constructor(providers: DownloadProvider[] = [new BmclProvider(), new OfficialProvider()]) {
    this.providers = providers;
  }

  getVersionListURLs(): string[] {
    return flattenProviderCandidates(this.providers, (provider) => provider.getVersionListURLs());
  }

  getAssetObjectCandidates(assetPath: string): string[] {
    return flattenProviderCandidates(this.providers, (provider) => provider.getAssetObjectCandidates(assetPath));
  }

  injectURL(url: string): string {
    return this.providers[0]?.injectURL(url) ?? url;
  }

  injectURLWithCandidates(url: string): string[] {
    return flattenProviderCandidates(this.providers, (provider) => provider.injectURLWithCandidates(url));
  }
}

export class PriorityProvider extends AutoProvider {
  constructor(providers: DownloadProvider[]) {
    super(providers);
  }
}

export function createProviderForMirror(mirror: Mirror): DownloadProvider {
  if (mirror.type === 'official') {
    return new OfficialProvider();
  }

  return new BmclProvider(mirror.rootUrl);
}

// Custom mirrors will be created dynamically, so getProviderById might need to accept a config or be part of a service
// For now, keep it simple for backward compatibility but expose a way to create providers
export function getProviderById(id: DownloadProviderId, customRoot?: string): DownloadProvider {
  switch (id) {
    case 'bmcl':
      return new BmclProvider();
    case 'auto':
      return new AutoProvider();
    default:
      if (customRoot) {
        // Assuming custom mirrors use BMCL structure for now
        return new BmclProvider(customRoot, id);
      }
      return new OfficialProvider();
  }
}
