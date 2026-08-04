import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import type { ModLoaderType } from '../../../contexts/instances/types';
import type { ModpackListItem } from '../../../contexts/instances/types';
import { useConfirm } from '../../../contexts/ConfirmContext';
import { useSettings } from '../../../contexts/SettingsContext';
import { useToast } from '../../../contexts/ToastContext';
import {
  loadInstalledModpackCatalog,
  selectInstalledModpackArchive,
  type InstalledModpackCatalogItem,
} from '../../../features/modpacks/services/installedModpackCatalogService';
import {
  resolveInstalledModpackUpdates,
  type ModpackUpdateInfo,
} from '../../../features/modpacks/hooks/useModpackUpdates';

export type InstalledModpackItem = InstalledModpackCatalogItem;

export const INSTALLED_MODPACK_SORT_OPTIONS = ['name', 'created', 'updated'] as const;
export type InstalledModpackSortOption = (typeof INSTALLED_MODPACK_SORT_OPTIONS)[number];

export interface UseInstalledModpackCatalogParams {
  modpacks: readonly ModpackListItem[];
  select: (id: string) => Promise<unknown>;
  remove: (id: string) => Promise<unknown>;
  rename: (id: string, name: string) => Promise<unknown>;
  duplicate: (sourceId: string, name?: string) => Promise<unknown>;
  refresh: () => Promise<unknown>;
  onImportArchive: (archive: {
    archiveRef: string;
    inspection: import('@shared/contracts/archiveInspection').ArchiveManifestMetadata;
  }) => void;
}

function dateValue(value: string | undefined): number {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function useInstalledModpackCatalog({
  modpacks,
  select,
  remove,
  rename,
  duplicate,
  refresh,
  onImportArchive,
}: UseInstalledModpackCatalogParams) {
  const { t } = useSettings();
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState<InstalledModpackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown | null>(null);
  const [availableUpdatesById, setAvailableUpdatesById] = useState<Record<string, ModpackUpdateInfo>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [minecraftVersion, setMinecraftVersion] = useState('all');
  const [loader, setLoader] = useState('all');
  const [sort, setSort] = useState<InstalledModpackSortOption>('name');
  const [isDragging, setIsDragging] = useState(false);
  const loadGenerationRef = useRef(0);
  const modpacksRef = useRef(modpacks);
  modpacksRef.current = modpacks;
  const modpacksKey = modpacks.map((item) => [
    item.id,
    item.name,
    item.selected,
    item.summary.minecraftVersion,
    item.summary.modLoader?.type ?? '',
    item.summary.modLoader?.version ?? '',
  ].join(':')).join('|');

  const reload = useCallback(async () => {
    const generation = ++loadGenerationRef.current;
    setLoading(true);
    setLoadError(null);

    try {
      const nextItems = await loadInstalledModpackCatalog(modpacksRef.current);

      if (generation === loadGenerationRef.current) setItems(nextItems);
    } catch (error) {
      console.error('Error loading modpacks:', error);
      if (generation === loadGenerationRef.current) {
        setLoadError(error);
        setItems([]);
      }
    } finally {
      if (generation === loadGenerationRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    return () => {
      loadGenerationRef.current += 1;
    };
  }, [modpacksKey, reload]);

  useEffect(() => {
    let cancelled = false;
    if (loading || loadError || items.length === 0) {
      setAvailableUpdatesById({});
      return;
    }

    void resolveInstalledModpackUpdates(items).then((updates) => {
      if (!cancelled) {
        setAvailableUpdatesById(Object.fromEntries(updates.map((update) => [update.modpackId, update])));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [items, loadError, loading]);

  const selectItem = useCallback(async (id: string) => {
    try {
      await select(id);
    } catch (error) {
      console.error('Error selecting modpack:', error);
      toast.error(t('modpacks.select_error') || 'Ошибка при выборе модпака');
    }
  }, [select, t, toast]);

  const deleteItem = useCallback(async (id: string, name: string) => {
    const confirmed = await confirm.confirm({
      title: t('modpacks.delete') || 'Удалить модпак',
      message: t('modpacks.delete_confirm')?.replace('{{name}}', name) || `Удалить модпак "${name}"?`,
      variant: 'danger',
      confirmText: t('modpacks.delete') || 'Удалить',
      cancelText: t('general.cancel') || 'Отмена',
    });
    if (!confirmed) return;

    try {
      await remove(id);
    } catch (error) {
      console.error('Error deleting modpack:', error);
      toast.error(t('modpacks.delete_error') || 'Ошибка при удалении модпака');
    }
  }, [confirm, remove, t, toast]);

  const renameItem = useCallback(async (id: string, currentName: string) => {
    const requestedName = await confirm.prompt({
      title: t('modpacks.rename') || 'Переименовать',
      message: t('modpacks.rename_prompt') || 'Введите новое название:',
      confirmText: t('modpacks.rename') || 'Переименовать',
      cancelText: t('general.cancel') || 'Отмена',
      input: { initialValue: currentName, placeholder: currentName, requireNonEmpty: true },
    });
    const nextName = requestedName?.trim();
    if (!nextName || nextName === currentName) return;

    try {
      await rename(id, nextName);
      await refresh();
      await reload();
    } catch (error) {
      console.error('Error renaming modpack:', error);
      toast.error(t('modpacks.rename_error') || 'Ошибка при переименовании');
    }
  }, [confirm, refresh, reload, rename, t, toast]);

  const duplicateItem = useCallback(async (id: string, currentName: string) => {
    const suggestedName = `${currentName} - Copy`;
    const requestedName = await confirm.prompt({
      title: t('modpacks.duplicate') || 'Дублировать',
      message: t('modpacks.duplicate_prompt') || 'Введите название копии:',
      confirmText: t('modpacks.duplicate') || 'Дублировать',
      cancelText: t('general.cancel') || 'Отмена',
      input: { initialValue: suggestedName, placeholder: suggestedName, requireNonEmpty: true },
    });
    const nextName = requestedName?.trim();
    if (!nextName) return;

    try {
      await duplicate(id, nextName);
    } catch (error) {
      console.error('Error duplicating modpack:', error);
      toast.error(t('modpacks.duplicate_error') || 'Ошибка при дублировании');
    }
  }, [confirm, duplicate, t, toast]);

  const visibleItems = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    const filtered = items.filter((item) => (
      (!query || item.name.toLocaleLowerCase().includes(query))
      && (minecraftVersion === 'all' || item.metadata.minecraftVersion === minecraftVersion)
      && (loader === 'all' || item.metadata.modLoader?.type === loader)
    ));

    return [...filtered].sort((left, right) => {
      if (sort === 'created') return dateValue(right.metadata.createdAt) - dateValue(left.metadata.createdAt);
      if (sort === 'updated') return dateValue(right.metadata.updatedAt) - dateValue(left.metadata.updatedAt);
      return left.name.localeCompare(right.name);
    });
  }, [items, loader, minecraftVersion, searchQuery, sort]);

  const availableVersions = useMemo(() => Array.from(new Set(
    items.map((item) => item.metadata.minecraftVersion).filter((value): value is string => Boolean(value)),
  )).sort().reverse(), [items]);
  const availableLoaders = useMemo(() => Array.from(new Set(
    items.map((item) => item.metadata.modLoader?.type).filter((value): value is ModLoaderType => Boolean(value)),
  )).sort(), [items]);

  const resetFilters = useCallback(() => {
    setSearchQuery('');
    setMinecraftVersion('all');
    setLoader('all');
    setSort('name');
  }, []);

  const handleDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  }, []);
  const handleDragLeave = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  }, []);
  const handleDrop = useCallback(async (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    if (event.dataTransfer.files.length === 0) {
      toast.warning(t('modpacks.invalid_file') || 'Пожалуйста, перетащите файл модпака (.mrpack, .zip, .curseforge)');
      return;
    }

    const selected = await selectInstalledModpackArchive();
    if (selected.status === 'selected') {
      onImportArchive({ archiveRef: selected.archiveRef, inspection: selected });
    }
  }, [onImportArchive, t, toast]);

  return {
    items,
    visibleItems,
    loading,
    loadError,
    availableUpdatesById,
    searchQuery,
    setSearchQuery,
    minecraftVersion,
    setMinecraftVersion,
    loader,
    setLoader,
    sort,
    setSort,
    availableVersions,
    availableLoaders,
    hasActiveFilters: Boolean(searchQuery.trim() || minecraftVersion !== 'all' || loader !== 'all' || sort !== 'name'),
    hasSearchFilters: Boolean(searchQuery.trim() || minecraftVersion !== 'all' || loader !== 'all'),
    resetFilters,
    reload,
    selectItem,
    deleteItem,
    renameItem,
    duplicateItem,
    isDragging,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}
