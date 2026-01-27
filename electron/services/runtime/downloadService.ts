import path from 'node:path';
import type { Dispatcher } from 'undici';
import { DefaultRangePolicy } from '@xmcl/file-transfer';
import { getVersionList, type MinecraftVersionList } from '@xmcl/installer';
import { BMCL_ROOT, getProviderById, type DownloadProvider, type DownloadProviderId } from '../mirrors/providers';
import { reportMirrorFailure, reportMirrorSuccess } from '../mirrors/scoring';
import { DEFAULT_USER_AGENT } from '@shared/constants';
import type { LibraryEntry, VersionEntry } from '@shared/types';

/**
 * Owns download/mirror state (e.g. bad hosts blacklist) and constructs XMCL installer options.
 *
 * Step-0 note:
 * - This is a thin extraction of logic previously embedded in `LauncherManager`.
 * - Behavior should remain identical.
 */
export class RuntimeDownloadService {
  private badDownloadHosts = new Set<string>();

  public getDownloadProvider(providerId?: DownloadProviderId): DownloadProvider {
    return getProviderById(providerId ?? 'auto');
  }

  /**
   * Get Minecraft version manifest via XMCL `getVersionList`.
   *
   * Mirrors support:
   * - We pass candidate manifest urls via `remote`.
   * - `auto` provider already returns candidates ordered by observed score.
   */
  public async getVersionList(provider: DownloadProvider): Promise<MinecraftVersionList> {
    const urls = provider.getVersionListURLs();
    let lastError: unknown;
    for (const remote of urls) {
      try {
        return await getVersionList({ remote, fetch });
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError ?? new Error('Failed to fetch version list');
  }

  private async probeUrl(url: string, timeoutMs = 2500) {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method: 'GET', signal: controller.signal, cache: 'no-store' });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      reportMirrorSuccess(url, Date.now() - startedAt);
    } catch {
      clearTimeout(timer);
      reportMirrorFailure(url);
    }
  }

  public async warmupMirrors(provider: DownloadProvider) {
    if (provider.id !== 'auto') return;
    const probes = new Set<string>();
    for (const url of provider.getVersionListURLs()) probes.add(url);
    for (const url of provider.injectURLWithCandidates('https://resources.download.minecraft.net')) probes.add(url);
    for (const url of provider.injectURLWithCandidates('https://libraries.minecraft.net')) probes.add(url);
    for (const url of provider.injectURLWithCandidates('https://maven.minecraftforge.net/')) probes.add(url);
    await Promise.allSettled(Array.from(probes).map((url) => this.probeUrl(url)));
  }

  private getOrigin(url: string) {
    try {
      return new URL(url).origin;
    } catch {
      return url;
    }
  }

  public blacklistOrigins(originsOrUrls: string[], onLog: (data: string) => void) {
    for (const value of originsOrUrls) {
      const origin = this.getOrigin(value);
      if (!this.badDownloadHosts.has(origin)) {
        this.badDownloadHosts.add(origin);
        onLog(`[Download] Blacklisted host (manual): ${origin}`);
      }
    }
  }

  public recordBadHosts(err: unknown, onLog: (data: string) => void) {
    const errObj = err && typeof err === 'object' ? (err as { errors?: unknown[]; url?: string }) : null;
    const errors = Array.isArray(errObj?.errors) ? errObj.errors : [err];
    for (const item of errors) {
      const itemObj = item && typeof item === 'object' ? (item as { url?: string }) : null;
      const url = itemObj?.url;
      if (typeof url !== 'string') continue;
      const origin = this.getOrigin(url);
      if (!this.badDownloadHosts.has(origin)) {
        this.badDownloadHosts.add(origin);
        onLog(`[Download] Blacklisted slow/bad host: ${origin}`);
      }
    }
  }

  public buildInstallerOptions(
    provider: DownloadProvider,
    dispatcher: Dispatcher,
    rangePolicy: DefaultRangePolicy,
    concurrency: number
  ) {
    const uniq = (values: Array<string | undefined>) => {
      const seen = new Set<string>();
      const result: string[] = [];
      for (const value of values) {
        if (!value || seen.has(value)) continue;
        seen.add(value);
        result.push(value);
      }
      return result;
    };

    const filterBadHosts = (urls: string[]) => {
      const filtered = urls.filter((candidate) => !this.badDownloadHosts.has(this.getOrigin(candidate)));
      return filtered.length > 0 ? filtered : urls;
    };

    const injectCandidates = (url: string | undefined) => {
      if (!url) return [];
      const injected = provider.injectURLWithCandidates(url);
      return injected.filter((u) => typeof u === 'string' && u.length > 0);
    };

    const getForgeInstallerCandidates = (pathValue: string, url: string) => {
      const normalizedPath = pathValue.replace(/\\/g, '/');
      if (!normalizedPath.includes('net/minecraftforge/forge/') || !normalizedPath.endsWith('-installer.jar')) {
        return null;
      }
      const fileName = path.posix.basename(normalizedPath);
      const prefix = 'forge-';
      const suffix = '-installer.jar';
      if (!fileName.startsWith(prefix) || !fileName.endsWith(suffix)) return null;
      const classifier = fileName.slice(prefix.length, -suffix.length);
      const parts = classifier.split('-');
      if (parts.length < 2) return null;
      const [mcversion, version, ...branchParts] = parts;
      const branch = branchParts.join('-');
      const query = new URLSearchParams({
        mcversion,
        version,
        category: 'installer',
        format: 'jar',
      });
      if (branch) query.set('branch', branch);
      const bmcl = `${BMCL_ROOT}/forge/download?${query.toString()}`;
      return uniq([bmcl, ...injectCandidates(url)]);
    };

    const headers = {
      'user-agent': DEFAULT_USER_AGENT,
      accept: '*/*',
      'accept-encoding': 'identity',
    };
    const assetsHost = filterBadHosts(injectCandidates('https://resources.download.minecraft.net'));
    return {
      // Type conflict between undici versions - @xmcl/file-transfer uses different undici types
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dispatcher: dispatcher as any,
      rangePolicy,
      headers,
      assetsHost,
      assetsIndexUrl: (version: VersionEntry) => filterBadHosts(injectCandidates(version.assetIndex?.url)),
      // Type mismatch: VersionEntry vs MinecraftVersionBaseInfo - both are compatible at runtime
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      json: (version: any) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return filterBadHosts(injectCandidates((version as VersionEntry).url)) as any;
      },
      client: (version: VersionEntry) => {
        const url = version.downloads?.client?.url;
        return url ? filterBadHosts(injectCandidates(url)) : [];
      },
      server: (version: VersionEntry) => {
        const url = version.downloads?.server?.url;
        return url ? filterBadHosts(injectCandidates(url)) : [];
      },
      libraryHost: (library: LibraryEntry) => {
        const url = library.download?.url;
        if (!url) return undefined;
        if (provider.id !== 'mojang') {
          const pathValue = library.download?.path;
          if (pathValue) {
            const forgeCandidates = getForgeInstallerCandidates(pathValue, url);
            if (forgeCandidates) return forgeCandidates;
          }
        }
        return filterBadHosts(injectCandidates(url));
      },
      librariesDownloadConcurrency: concurrency,
      assetsDownloadConcurrency: concurrency,
    };
  }
}

