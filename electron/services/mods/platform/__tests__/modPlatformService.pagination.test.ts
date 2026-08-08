import { describe, expect, it, vi } from 'vitest';
import type { ModrinthV2Client } from '@xmcl/modrinth';
import type { InstanceApplication } from '../../../../domains/instances/instanceApplication';
import type { LauncherRoot } from '../../../../domains/instances/instanceTypes';
import { ModPlatformService } from '../modPlatformService';

type ModrinthSearchResult = Awaited<ReturnType<ModrinthV2Client['searchProjects']>>;
type ModrinthSearchHit = ModrinthSearchResult['hits'][number];

function createHit(index: number, title: string): ModrinthSearchHit {
  return {
    project_id: `project-${index}`,
    slug: `project-${index}`,
    title,
    description: `${title} description`,
    icon_url: `https://example.test/${index}.png`,
    downloads: 1_000 - index,
    date_created: `2026-01-${String((index % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
    date_modified: `2026-02-${String((index % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
  } as ModrinthSearchHit;
}

function createSearchResult(hits: ModrinthSearchHit[], offset: number, limit: number, totalHits: number): ModrinthSearchResult {
  return {
    hits,
    offset,
    limit,
    total_hits: totalHits,
  } as ModrinthSearchResult;
}

function createDescendingHits(total: number): ModrinthSearchHit[] {
  return Array.from({ length: total }, (_, index) => {
    const label = String(total - index).padStart(3, '0');
    return createHit(index, `Pack ${label}`);
  });
}

function createPlatformService(): ModPlatformService {
  return new ModPlatformService(
    {} as InstanceApplication,
    {
      resolveRoot: async () => ({} as LauncherRoot),
      getModpackDir: (_rootPath, instanceId) => `/tmp/burrow-platform-test/modpacks/${instanceId}`,
    },
  );
}

describe('ModPlatformService alphabetical modpack pagination', () => {
  it('rejects a provider install before network access when its canonical instance is absent', async () => {
    const root = {} as LauncherRoot;
    const application = {
      read: vi.fn(async () => ({ status: 'uninitialized' as const })),
    } as unknown as InstanceApplication;
    const content = {
      resolveRoot: vi.fn(async () => root),
      getModpackDir: vi.fn(),
    };
    const service = new ModPlatformService(application, content);

    await expect(service.installModFile({
      platform: 'modrinth',
      projectId: 'project',
      versionId: 'version',
      instanceId: 'missing',
      contentType: 'mod',
    }, '/tmp/burrow-platform-test')).rejects.toThrow('Canonical instance does not exist: missing');

    expect(application.read).toHaveBeenCalledWith(root);
    expect(content.getModpackDir).not.toHaveBeenCalled();
  });

  it('rejects path-shaped provider filenames before using them as a destination', async () => {
    const root = {} as LauncherRoot;
    const application = {
      read: vi.fn(async () => ({
        status: 'ready' as const,
        snapshot: { records: [{ id: 'alpha' }] },
      })),
    } as unknown as InstanceApplication;
    const content = {
      resolveRoot: vi.fn(async () => root),
      getModpackDir: vi.fn(() => '/tmp/burrow-platform-test/modpacks/alpha'),
    };
    const service = new ModPlatformService(application, content);
    vi.spyOn(service.getModrinthClient(), 'getProjectVersion').mockResolvedValueOnce({
      files: [{
        url: 'https://example.test/escape.jar',
        filename: '../escape.jar',
        primary: true,
        hashes: {},
      }],
    } as Awaited<ReturnType<ModrinthV2Client['getProjectVersion']>>);

    await expect(service.installModFile({
      platform: 'modrinth',
      projectId: 'project',
      versionId: 'version',
      instanceId: 'alpha',
      contentType: 'mod',
    }, '/tmp/burrow-platform-test')).rejects.toThrow(/provider filename/i);

    expect(content.getModpackDir).toHaveBeenCalledWith('/tmp/burrow-platform-test', 'alpha');
  });

  it('fetches enough Modrinth pages to serve later alphabetical pages correctly', async () => {
    const service = createPlatformService();
    const allHits = createDescendingHits(135);
    const searchProjectsMock = vi.spyOn(service.getModrinthClient(), 'searchProjects').mockImplementation(async ({ offset = 0, limit = 20 }) => {
      return createSearchResult(allHits.slice(offset, offset + limit), offset, limit, allHits.length);
    });

    const result = await service.searchModrinthModpacks('', undefined, undefined, 'alphabetical', 120, 10);

    expect(searchProjectsMock).toHaveBeenCalledTimes(2);
    expect(result.total).toBe(135);
    expect(result.offset).toBe(120);
    expect(result.limit).toBe(10);
    expect(result.items).toHaveLength(10);
    expect(result.items[0]?.title).toBe('Pack 121');
    expect(result.items.at(-1)?.title).toBe('Pack 130');
  });

  it('keeps larger alphabetical page sizes aligned with the fully sorted result set', async () => {
    const service = createPlatformService();
    const allHits = createDescendingHits(140);
    vi.spyOn(service.getModrinthClient(), 'searchProjects').mockImplementation(async ({ offset = 0, limit = 20 }) => {
      return createSearchResult(allHits.slice(offset, offset + limit), offset, limit, allHits.length);
    });

    const result = await service.searchModrinthModpacks('', undefined, undefined, 'alphabetical', 60, 48);

    expect(result.total).toBe(140);
    expect(result.limit).toBe(48);
    expect(result.items).toHaveLength(48);
    expect(result.items[0]?.title).toBe('Pack 061');
    expect(result.items.at(-1)?.title).toBe('Pack 108');
  });
});
