import type { InstancesAPI } from '@shared/contracts';
import type { ModpackMetadata } from '@shared/types/modpack';

type LegacyListFixture = Readonly<{
  id: string;
  name: string;
  selected: boolean;
  metadata: Partial<ModpackMetadata>;
}>;

/** Projects existing installed-list fixture data through the canonical instances capability. */
export function instancesFromListFixture(load: () => Promise<LegacyListFixture[]>): InstancesAPI {
  let listed: LegacyListFixture[] = [];
  let loaded = false;
  let pending: Promise<void> | null = null;

  const ensureListed = async () => {
    if (loaded) return;
    if (!pending) {
      pending = load().then((items) => {
        listed = items;
        loaded = true;
      }).finally(() => {
        pending = null;
      });
    }
    await pending;
  };

  return {
    list: async () => {
      await ensureListed();
      return {
        ok: true,
        value: {
          status: 'ready',
          instances: listed.map((item) => ({
            id: item.id,
            name: item.name,
            selected: item.selected,
            summary: {
              minecraftVersion: item.metadata.minecraftVersion ?? '1.20.1',
              ...(item.metadata.modLoader === undefined ? {} : { modLoader: item.metadata.modLoader }),
            },
          })),
        },
      };
    },
    metadata: async ({ id }) => {
      await ensureListed();
      const item = listed.find((candidate) => candidate.id === id);
      if (!item) return { ok: false, error: { code: 'INSTANCE_NOT_FOUND', message: 'missing fixture instance' } };

      return {
        ok: true,
        value: {
          source: item.metadata.source ?? 'local',
          ...(item.metadata.sourceId === undefined ? {} : { sourceId: item.metadata.sourceId }),
          ...(item.metadata.sourceVersionId === undefined ? {} : { sourceVersionId: item.metadata.sourceVersionId }),
          ...(item.metadata.version === undefined ? {} : { version: item.metadata.version }),
          ...(item.metadata.iconUrl === undefined ? {} : { iconUrl: item.metadata.iconUrl }),
          ...(item.metadata.description === undefined ? {} : { description: item.metadata.description }),
          ...(item.metadata.author === undefined ? {} : { author: item.metadata.author }),
          createdAt: item.metadata.createdAt ?? '2026-04-20T00:00:00.000Z',
          updatedAt: item.metadata.updatedAt ?? '2026-04-20T00:00:00.000Z',
        },
      };
    },
    snapshot: async () => ({ ok: false, error: { code: 'INSTANCE_NOT_FOUND', message: 'not used by this fixture' } }),
    select: async () => ({ ok: false, error: { code: 'INSTANCE_NOT_FOUND', message: 'not used by this fixture' } }),
    create: async () => ({ ok: false, error: { code: 'INSTANCE_NOT_FOUND', message: 'not used by this fixture' } }),
    rename: async () => ({ ok: false, error: { code: 'INSTANCE_NOT_FOUND', message: 'not used by this fixture' } }),
    config: async () => ({ ok: false, error: { code: 'INSTANCE_NOT_FOUND', message: 'not used by this fixture' } }),
    prepare: async () => ({ ok: true, value: { status: 'ready' } }),
  };
}
