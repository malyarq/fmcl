import { CLASSIC_MODPACK_ID } from '../../shared/constants';
import type { CanonicalInstanceRecord } from '../domains/instances/instanceTypes';
import type { OperationRunner } from '../services/operations/operationRunner';

export async function recoverOperationsAndEnsureClassic(
  operations: OperationRunner,
  defaultRootPath: string,
): Promise<void> {
  await operations.recoverRegistered(defaultRootPath);
  const state = await operations.readControlPlane(defaultRootPath);
  if ('code' in state) throw new Error(state.message);
  if (hasClassic(state)) return;

  const seeded = await operations.commitControlPlane(defaultRootPath, {
    version: 1,
    type: 'commit-published',
    record: createClassicRecord(),
    // An empty snapshot selects its first record automatically. Keeping this
    // false preserves a selection created by another process after the read.
    select: false,
  });
  if (!('code' in seeded)) return;

  // A concurrent first start may publish Classic with different timestamps.
  // Treat the conflict as success only after a fresh canonical read proves it.
  const current = await operations.readControlPlane(defaultRootPath);
  if (!('code' in current) && hasClassic(current)) return;
  throw new Error(seeded.message);
}

function hasClassic(state: Awaited<ReturnType<OperationRunner['readControlPlane']>>): boolean {
  return !('code' in state)
    && state.status === 'ready'
    && state.snapshot.records.some(({ id }) => id === CLASSIC_MODPACK_ID);
}

function createClassicRecord(): CanonicalInstanceRecord {
  const now = new Date().toISOString();
  return {
    id: CLASSIC_MODPACK_ID,
    name: 'Classic',
    source: { source: 'local', createdAt: now, updatedAt: now },
    config: {
      runtime: { minecraftVersion: '1.12.2', modLoader: { type: 'vanilla' } },
      memory: { maxMb: 4096 },
      vmOptions: [],
    },
    summary: { minecraftVersion: '1.12.2', modLoader: { type: 'vanilla' } },
  };
}
