import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { ModpackConfig } from '../types';
import {
  createModpack as createModpackSvc,
  deleteModpack as deleteModpackSvc,
  duplicateModpack as duplicateModpackSvc,
  fetchModpackConfig,
  renameModpack as renameModpackSvc,
  setSelectedModpackId,
} from '../services/instancesService';

export function useInstanceCrudActions(params: {
  rootPath?: string;
  selectedId: string;
  setSelectedId: (id: string) => void;
  setConfig: Dispatch<SetStateAction<ModpackConfig | null>>;
  refresh: () => Promise<void>;
  loadSelected: () => Promise<void>;
}) {
  const { rootPath, selectedId, setSelectedId, setConfig, refresh, loadSelected } = params;

  const select = useCallback(
    async (id: string) => {
      await setSelectedModpackId(id, rootPath);
      setSelectedId(id);
      const cfg = await fetchModpackConfig(id, rootPath);
      setConfig(cfg);
      await refresh();
    },
    [refresh, rootPath, setConfig, setSelectedId]
  );

  const create = useCallback(
    async (name: string) => {
      const created = await createModpackSvc(name, rootPath);
      if (created?.id) {
        await select(created.id);
      } else {
        await refresh();
        await loadSelected();
      }
    },
    [loadSelected, refresh, rootPath, select]
  );

  const rename = useCallback(
    async (id: string, name: string) => {
      await renameModpackSvc(id, name, rootPath);
      await refresh();
      if (id === selectedId) {
        const cfg = await fetchModpackConfig(id, rootPath);
        setConfig(cfg);
      }
    },
    [refresh, rootPath, selectedId, setConfig]
  );

  const duplicate = useCallback(
    async (sourceId: string, name?: string) => {
      const created = await duplicateModpackSvc(sourceId, name, rootPath);
      if (created?.id) {
        await select(created.id);
      } else {
        await refresh();
        await loadSelected();
      }
    },
    [loadSelected, refresh, rootPath, select]
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteModpackSvc(id, rootPath);
      await refresh();
      await loadSelected();
    },
    [loadSelected, refresh, rootPath]
  );

  return { select, create, rename, duplicate, remove };
}

