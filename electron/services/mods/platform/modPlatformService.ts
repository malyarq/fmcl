import path from 'node:path';
import { download } from '@xmcl/file-transfer';
import { ModrinthV2Client } from '@xmcl/modrinth';
import { CurseforgeV1Client, type File as CurseforgeFile, type Mod as CurseforgeMod } from '@xmcl/curseforge';
import { ModpackService } from '../../modpacks/modpackService';
import { ensureDir } from './fsUtils';
import { CF_SORT_POPULARITY, CF_SORT_LAST_UPDATED, CF_SORT_NAME, mapLoaderToCurseforge, mapLoaderToModrinth } from './loaderMapping';
import { pickPrimaryModrinthFile } from './modrinthUtils';
import type { ModInstallRequest, ModInstallResult, ModSearchQuery, ModSearchResult, ModVersionDescriptor, ModVersionQuery } from './types';

export class ModPlatformService {
  private readonly modrinth: ModrinthV2Client;
  private readonly curseforge: CurseforgeV1Client | null;
  private readonly instances = new ModpackService();

  constructor(options?: { curseforgeApiKey?: string }) {
    this.modrinth = new ModrinthV2Client();
    const key = options?.curseforgeApiKey ?? process.env.CURSEFORGE_API_KEY;
    this.curseforge = key ? new CurseforgeV1Client(key) : null;
  }

  public async searchMods(query: ModSearchQuery): Promise<ModSearchResult> {
    if (query.platform === 'modrinth') {
      const facets: string[][] = [['project_type:mod']];
      const loader = mapLoaderToModrinth(query.loader);
      if (loader) facets.push([`categories:${loader}`]);
      if (query.mcVersion) facets.push([`versions:${query.mcVersion}`]);

      const result = await this.modrinth.searchProjects({
        query: query.query,
        facets: JSON.stringify(facets),
        offset: query.offset ?? 0,
        limit: query.limit ?? 20,
      });

      return {
        items: result.hits.map((h) => ({
          platform: 'modrinth',
          projectId: h.project_id,
          slug: h.slug,
          title: h.title,
          description: h.description,
          iconUrl: h.icon_url,
          downloads: h.downloads,
        })),
        total: result.total_hits,
        offset: result.offset,
        limit: result.limit,
      };
    }

    // curseforge
    if (!this.curseforge) {
      throw new Error('CurseForge API key is not configured. Set CURSEFORGE_API_KEY env var.');
    }

    const modLoaderType = mapLoaderToCurseforge(query.loader);
    const res = await this.curseforge.searchMods({
      gameId: 432,
      classId: 6, // "Mods"
      searchFilter: query.query,
      gameVersion: query.mcVersion,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      modLoaderType: modLoaderType as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sortField: CF_SORT_POPULARITY as any,
      sortOrder: 'desc',
      index: query.offset ?? 0,
      pageSize: query.limit ?? 20,
    });

    return {
      items: res.data.map((m: CurseforgeMod) => ({
        platform: 'curseforge',
        projectId: String(m.id),
        slug: m.slug,
        title: m.name,
        description: m.summary,
        iconUrl: m.logo?.thumbnailUrl,
        downloads: m.downloadCount,
      })),
      total: res.pagination.totalCount,
      offset: res.pagination.index,
      limit: res.pagination.pageSize,
    };
  }

  public async getModVersions(query: ModVersionQuery): Promise<ModVersionDescriptor[]> {
    if (query.platform === 'modrinth') {
      const projectId = query.projectId.startsWith('local-') ? query.projectId.slice('local-'.length) : query.projectId;
      const loaders = mapLoaderToModrinth(query.loader) ? [mapLoaderToModrinth(query.loader)!] : undefined;
      const versions = query.mcVersion ? [query.mcVersion] : undefined;
      const all = await this.modrinth.getProjectVersions(projectId, { loaders, gameVersions: versions });

      const sliced = (typeof query.offset === 'number' || typeof query.limit === 'number')
        ? all.slice(query.offset ?? 0, (query.offset ?? 0) + (query.limit ?? all.length))
        : all;

      return sliced.map((v) => ({
        platform: 'modrinth',
        versionId: v.id,
        name: v.name,
        versionNumber: v.version_number,
        mcVersions: v.game_versions,
        loaders: v.loaders,
        files: v.files.map((f) => ({
          url: f.url,
          filename: f.filename,
          size: f.size,
          hashes: f.hashes,
          sha1: f.hashes?.sha1,
        })),
      }));
    }

    // curseforge
    if (!this.curseforge) {
      throw new Error('CurseForge API key is not configured. Set CURSEFORGE_API_KEY env var.');
    }

    const modId = Number(query.projectId);
    if (!Number.isFinite(modId)) throw new Error(`Invalid CurseForge modId: ${query.projectId}`);

    const modLoaderType = mapLoaderToCurseforge(query.loader);
    const pageSize = query.limit ?? 20;
    const index = query.offset ?? 0;
    const res = await this.curseforge.getModFiles({
      modId,
      gameVersion: query.mcVersion,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      modLoaderType: modLoaderType as any,
      index,
      pageSize,
    });

    return res.data.map((f: CurseforgeFile) => ({
      platform: 'curseforge',
      versionId: String(f.id),
      name: f.displayName || f.fileName,
      versionNumber: undefined,
      mcVersions: f.gameVersions ?? [],
      loaders: [],
      files: [
        {
          url: f.downloadUrl ?? '',
          filename: f.fileName,
          size: f.fileLength,
          sha1: f.hashes?.find((h) => h.algo === 1 /* sha1 */)?.value,
        },
      ],
    }));
  }

  public async installModFile(req: ModInstallRequest): Promise<ModInstallResult> {
    const rootPath = req.rootPath ?? this.instances.getDefaultRootPath();
    // Per-instance installation:
    // - instancePath/mods (highest priority)
    // - instances/<id>/mods
    // - rootPath/mods (legacy fallback)
    this.instances.ensureModpacksMigrated(rootPath);
    const modsDir = req.instancePath
      ? path.join(req.instancePath, 'mods')
      : req.instanceId
        ? path.join(this.instances.getModpackDir(rootPath, req.instanceId), 'mods')
        : path.join(rootPath, 'mods');
    ensureDir(modsDir);

    if (req.platform === 'modrinth') {
      const version = await this.modrinth.getProjectVersion(req.versionId);
      const file = pickPrimaryModrinthFile(version);
      if (!file?.url || !file.filename) throw new Error('Modrinth version has no downloadable file.');

      const destination = path.join(modsDir, file.filename);
      const urls = [file.url, ...(req.fallbackUrls ?? [])];
      const sha1 = file.hashes?.sha1;

      await download({
        url: urls,
        destination,
        validator: sha1 ? { algorithm: 'sha1', hash: sha1 } : undefined,
      });

      return {
        destination,
        filename: file.filename,
        usedUrl: file.url,
      };
    }

    // curseforge
    if (!this.curseforge) {
      throw new Error('CurseForge API key is not configured. Set CURSEFORGE_API_KEY env var.');
    }

    const modId = Number(req.projectId);
    const fileId = Number(req.versionId);
    if (!Number.isFinite(modId)) throw new Error(`Invalid CurseForge modId: ${req.projectId}`);
    if (!Number.isFinite(fileId)) throw new Error(`Invalid CurseForge fileId: ${req.versionId}`);

    const file = await this.curseforge.getModFile(modId, fileId);
    const url = file.downloadUrl;
    if (!url) {
      throw new Error('CurseForge file has no downloadUrl (distribution might be disabled).');
    }
    const destination = path.join(modsDir, file.fileName);
    const sha1 = file.hashes?.find((h) => h.algo === 1 /* sha1 */)?.value;
    const urls = [url, ...(req.fallbackUrls ?? [])];

    await download({
      url: urls,
      destination,
      validator: sha1 ? { algorithm: 'sha1', hash: sha1 } : undefined,
    });

    return {
      destination,
      filename: file.fileName,
      usedUrl: url,
    };
  }

  /**
   * Поиск модпаков на CurseForge
   */
  public async searchCurseForgeModpacks(
    query: string,
    mcVersion?: string,
    loader?: string,
    sort: 'popularity' | 'date' | 'alphabetical' = 'popularity',
    offset: number = 0,
    limit: number = 20,
  ): Promise<ModSearchResult> {
    if (!this.curseforge) {
      throw new Error('CurseForge API key is not configured. Set CURSEFORGE_API_KEY env var.');
    }

    // Map sort option to CurseForge sortField
    let sortField: number;
    switch (sort) {
      case 'date':
        sortField = CF_SORT_LAST_UPDATED;
        break;
      case 'alphabetical':
        sortField = CF_SORT_NAME;
        break;
      case 'popularity':
      default:
        sortField = CF_SORT_POPULARITY;
        break;
    }

    // Map loader to CurseForge modLoaderType
    const modLoaderType = loader && loader !== 'all' ? mapLoaderToCurseforge(loader) : undefined;

    const res = await this.curseforge.searchMods({
      gameId: 432,
      classId: 4471, // Modpacks category
      searchFilter: query,
      gameVersion: mcVersion,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      modLoaderType: modLoaderType as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sortField: sortField as any,
      sortOrder: sort === 'alphabetical' ? 'asc' : 'desc',
      index: offset,
      pageSize: limit,
    });

    return {
      items: res.data.map((m: CurseforgeMod) => {
        // CurseForge Mod type may not include date fields in type definition
        // but they might be available at runtime
        const modWithDates = m as CurseforgeMod & { dateCreated?: string; dateModified?: string };
        return {
          platform: 'curseforge',
          projectId: String(m.id),
          slug: m.slug,
          title: m.name,
          description: m.summary,
          iconUrl: m.logo?.thumbnailUrl,
          downloads: m.downloadCount,
          dateCreated: modWithDates.dateCreated,
          dateModified: modWithDates.dateModified,
        };
      }),
      total: res.pagination.totalCount,
      offset: res.pagination.index,
      limit: res.pagination.pageSize,
    };
  }

  /**
   * Получить список версий модпака CurseForge
   */
  public async getCurseForgeModpackVersions(projectId: number): Promise<ModVersionDescriptor[]> {
    if (!this.curseforge) {
      throw new Error('CurseForge API key is not configured. Set CURSEFORGE_API_KEY env var.');
    }

    if (!Number.isFinite(projectId)) {
      throw new Error(`Invalid CurseForge projectId: ${projectId}`);
    }

    const res = await this.curseforge.getModFiles({
      modId: projectId,
      index: 0,
      pageSize: 50, // Get more versions for modpacks
    });

    return res.data.map((f: CurseforgeFile) => {
      // CurseForge File type may not include changelog in type definition
      // but it might be available at runtime, so we check safely
      const fileWithChangelog = f as CurseforgeFile & { changelog?: string };
      return {
        platform: 'curseforge' as const,
        versionId: String(f.id),
        name: f.displayName || f.fileName,
        versionNumber: undefined,
        mcVersions: f.gameVersions ?? [],
        loaders: [],
        fileId: f.id, // CurseForge fileId (same as versionId but as number)
        changelog: fileWithChangelog.changelog || undefined, // Changelog from CurseForge API (may not be in type definition)
        files: [
          {
            url: f.downloadUrl ?? '',
            filename: f.fileName,
            size: f.fileLength,
            sha1: f.hashes?.find((h) => h.algo === 1 /* sha1 */)?.value,
          },
        ],
      };
    });
  }

  /**
   * Поиск модпаков на Modrinth
   */
  public async searchModrinthModpacks(
    query: string,
    mcVersion?: string,
    loader?: string,
    sort: 'popularity' | 'date' | 'alphabetical' = 'popularity',
    offset: number = 0,
    limit: number = 20,
  ): Promise<ModSearchResult> {
    const facets: string[][] = [['project_type:modpack']];
    if (mcVersion && mcVersion !== 'all') {
      facets.push([`versions:${mcVersion}`]);
    }
    if (loader && loader !== 'all') {
      const modrinthLoader = mapLoaderToModrinth(loader);
      if (modrinthLoader) {
        facets.push([`categories:${modrinthLoader}`]);
      }
    }

    // Map sort option to Modrinth index
    let index: string;
    switch (sort) {
      case 'date':
        index = 'newest';
        break;
      case 'alphabetical':
        index = 'relevance'; // Modrinth doesn't have alphabetical index, we'll sort client-side
        break;
      case 'popularity':
      default:
        index = 'downloads';
        break;
    }

    // For alphabetical sorting, we need to fetch more results and sort them
    // Modrinth API doesn't support alphabetical sorting directly
    const fetchLimit = sort === 'alphabetical' ? Math.min(limit * 10, 100) : limit;
    
    const result = await this.modrinth.searchProjects({
      query,
      facets: JSON.stringify(facets),
      index,
      offset: sort === 'alphabetical' ? 0 : offset, // For alphabetical, we fetch from start
      limit: fetchLimit,
    });

    let items = result.hits.map((h) => ({
      platform: 'modrinth' as const,
      projectId: h.project_id,
      slug: h.slug,
      title: h.title,
      description: h.description,
      iconUrl: h.icon_url,
      downloads: h.downloads,
      dateCreated: h.date_created,
      dateModified: h.date_modified,
    }));

    // Apply alphabetical sorting if needed
    if (sort === 'alphabetical') {
      items.sort((a, b) => a.title.localeCompare(b.title));
      // Apply pagination after sorting
      const start = offset;
      items = items.slice(start, start + limit);
    }

    return {
      items,
      total: result.total_hits,
      offset: sort === 'alphabetical' ? offset : result.offset,
      limit: result.limit,
    };
  }

  /**
   * Получить список версий модпака Modrinth
   */
  public async getModrinthModpackVersions(projectId: string): Promise<ModVersionDescriptor[]> {
    const all = await this.modrinth.getProjectVersions(projectId);

    return all.map((v) => ({
      platform: 'modrinth',
      versionId: v.id,
      name: v.name,
      versionNumber: v.version_number,
      mcVersions: v.game_versions,
      loaders: v.loaders,
      changelog: v.changelog, // Changelog from Modrinth API
      files: v.files.map((f) => ({
        url: f.url,
        filename: f.filename,
        size: f.size,
        hashes: f.hashes,
        sha1: f.hashes?.sha1,
      })),
    }));
  }

  /**
   * Получить CurseForge клиент (для использования в установщиках)
   */
  public getCurseForgeClient(): CurseforgeV1Client | null {
    return this.curseforge;
  }

  /**
   * Получить Modrinth клиент (для использования в установщиках)
   */
  public getModrinthClient(): ModrinthV2Client {
    return this.modrinth;
  }
}

