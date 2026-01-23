export type DownloadProviderId = 'mojang' | 'bmcl' | 'auto';

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
export const BMCL_ROOT = 'https://bmclapi2.bangbang93.com';
const BMCL_MAVEN_MIRRORS = [
    `${BMCL_ROOT}/maven`,
    'https://bmclapi.bangbang93.com/maven',
    'https://forge.fastmcmirror.org',
    // Российские и ближайшие зеркала (приоритет для пользователей из России)
    'https://mirror.sjtu.edu.cn/bmclapi/maven',
    'https://mirrors.tuna.tsinghua.edu.cn/bmclapi/maven',
    'https://mirrors.bfsu.edu.cn/bmclapi/maven',
    // Дополнительные альтернативные зеркала
    'https://maven.aliyun.com/repository/public',
    'https://repo.huaweicloud.com/repository/maven'
];

const BMCL_REPLACEMENTS: Array<[string, string]> = [
    ['https://bmclapi2.bangbang93.com', BMCL_ROOT],
    ['https://launchermeta.mojang.com', BMCL_ROOT],
    ['https://piston-meta.mojang.com', BMCL_ROOT],
    ['https://piston-data.mojang.com', BMCL_ROOT],
    ['https://launcher.mojang.com', BMCL_ROOT],
    ['https://libraries.minecraft.net', `${BMCL_ROOT}/libraries`],
    ['http://files.minecraftforge.net/maven', `${BMCL_ROOT}/maven`],
    ['https://files.minecraftforge.net/maven', `${BMCL_ROOT}/maven`],
    ['https://maven.minecraftforge.net', `${BMCL_ROOT}/maven`],
    ['https://maven.neoforged.net/releases/', `${BMCL_ROOT}/maven/`],
    ['https://meta.fabricmc.net', `${BMCL_ROOT}/fabric-meta`],
    ['https://maven.fabricmc.net', `${BMCL_ROOT}/maven`],
    ['https://authlib-injector.yushi.moe', `${BMCL_ROOT}/mirrors/authlib-injector`],
    ['https://repo1.maven.org/maven2', 'https://mirrors.cloud.tencent.com/nexus/repository/maven-public'],
    ['https://repo.maven.apache.org/maven2', 'https://mirrors.cloud.tencent.com/nexus/repository/maven-public'],
    ['https://hmcl.glavo.site/metadata/cleanroom', 'https://alist.8mi.tech/d/mirror/HMCL-Metadata/Auto/cleanroom'],
    ['https://hmcl.glavo.site/metadata/fmllibs', 'https://alist.8mi.tech/d/mirror/HMCL-Metadata/Auto/fmllibs'],
    ['https://zkitefly.github.io/unlisted-versions-of-minecraft', 'https://alist.8mi.tech/d/mirror/unlisted-versions-of-minecraft/Auto'],
    [OFFICIAL_ASSETS_ROOT, `${BMCL_ROOT}/assets`]
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

type MirrorScore = {
    samples: number;
    avgLatency: number;
    failures: number;
    lastFailure?: number;
    lastSuccess?: number;
};

const mirrorScores = new Map<string, MirrorScore>();

const getOrigin = (url: string) => {
    try {
        return new URL(url).origin;
    } catch {
        return url;
    }
};

export const reportMirrorSuccess = (url: string, latencyMs: number) => {
    const origin = getOrigin(url);
    const score = mirrorScores.get(origin) ?? { samples: 0, avgLatency: 0, failures: 0 };
    const samples = score.samples + 1;
    const avgLatency = samples === 1 ? latencyMs : (score.avgLatency * score.samples + latencyMs) / samples;
    mirrorScores.set(origin, { ...score, samples, avgLatency, lastSuccess: Date.now() });
};

export const reportMirrorFailure = (url: string) => {
    const origin = getOrigin(url);
    const score = mirrorScores.get(origin) ?? { samples: 0, avgLatency: 0, failures: 0 };
    mirrorScores.set(origin, { ...score, failures: score.failures + 1, lastFailure: Date.now() });
};

export const orderCandidatesByScore = (urls: string[]) => {
    const ranked = urls.map((url, index) => {
        const origin = getOrigin(url);
        const score = mirrorScores.get(origin);
        const avgLatency = score?.avgLatency ?? 5000;
        const failures = score?.failures ?? 0;
        return { url, index, rank: avgLatency + failures * 10000 };
    });
    ranked.sort((a, b) => a.rank - b.rank || a.index - b.index);
    return ranked.map((item) => item.url);
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
    public id: DownloadProviderId = 'bmcl';
    private replacements = BMCL_REPLACEMENTS;

    getVersionListURLs(): string[] {
        return this.injectURLWithCandidates(OFFICIAL_VERSION_MANIFEST_URL);
    }

    getAssetObjectCandidates(assetPath: string): string[] {
        return uniq([`${BMCL_ROOT}/assets/${assetPath}`, `${OFFICIAL_ASSETS_ROOT}/${assetPath}`]);
    }

    injectURL(url: string): string {
        return applyReplacement(url, this.replacements) ?? url;
    }

    injectURLWithCandidates(url: string): string[] {
        const mavenCandidates = BMCL_MAVEN_MIRRORS.map((root) => replaceMavenUrl(url, root)).filter(Boolean) as string[];
        if (mavenCandidates.length > 0) {
            return uniq([...mavenCandidates, url]);
        }
        const replaced = applyReplacement(url, this.replacements);
        return replaced ? uniq([replaced, url]) : [url];
    }
}

export class AutoProvider implements DownloadProvider {
    public id: DownloadProviderId = 'auto';
    private bmcl = new BmclProvider();
    private official = new OfficialProvider();

    getVersionListURLs(): string[] {
        const candidates = uniq([
            ...this.bmcl.getVersionListURLs(),
            ...this.official.getVersionListURLs()
        ]);
        return orderCandidatesByScore(candidates);
    }

    getAssetObjectCandidates(assetPath: string): string[] {
        const candidates = uniq([
            ...this.bmcl.getAssetObjectCandidates(assetPath),
            ...this.official.getAssetObjectCandidates(assetPath)
        ]);
        return orderCandidatesByScore(candidates);
    }

    injectURL(url: string): string {
        return this.bmcl.injectURL(url);
    }

    injectURLWithCandidates(url: string): string[] {
        const candidates = uniq([
            ...this.bmcl.injectURLWithCandidates(url),
            ...this.official.injectURLWithCandidates(url)
        ]);
        return orderCandidatesByScore(candidates);
    }
}

let activeProvider: DownloadProvider = new OfficialProvider();

export function getActiveProvider(): DownloadProvider {
    return activeProvider;
}

export function setActiveProvider(provider: DownloadProvider) {
    activeProvider = provider;
}

export function getProviderById(id: DownloadProviderId): DownloadProvider {
    switch (id) {
        case 'bmcl':
            return new BmclProvider();
        case 'auto':
            return new AutoProvider();
        default:
            return new OfficialProvider();
    }
}
