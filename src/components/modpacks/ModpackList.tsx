import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { useModpackListContext } from '../../contexts/ModpackContext';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { AnchoredOverlay } from '../ui/AnchoredOverlay';
import { rectFromElement, type AnchoredAlign, type AnchoredRect } from '../ui/anchoredOverlayLayout';
import { SkeletonLoader } from '../ui/SkeletonLoader';
import { LazyImage } from '../ui/LazyImage';
import { modpacksIPC } from '../../services/ipc/modpacksIPC';
import type { ModpackManifest, ModpackMetadata } from '@shared/types/modpack';
import { cn } from '../../utils/cn';
import { ShareModal } from '../../features/share/ShareModal';
import { ImportShareModal } from '../../features/share/ImportShareModal';
import { Compass, Download, FolderOpen, MoreHorizontal, PackagePlus, Share2 } from 'lucide-react';
import type { ModLoaderType } from '../../contexts/instances/types';
import { DegradedStateView } from '../layout/DegradedStateView';
import { toDisplayErrorMessage } from '../../utils/displayError';
import { ModpackCatalogControls } from './ModpackCatalogControls';
import { buildModpackRuntimeSummary } from '../../features/modpacks/hooks/useModpackRuntimeSummary';
import {
  resolveInstalledModpackUpdates,
  type ModpackUpdateInfo,
} from '../../features/modpacks/hooks/useModpackUpdates';

interface ModpackListItemWithMetadata {
  id: string;
  name: string;
  path: string;
  selected: boolean;
  metadata?: ModpackMetadata;
}

const SORT_OPTIONS = ['name', 'created', 'updated'] as const;
type SortOption = (typeof SORT_OPTIONS)[number];

function isActivationKey(key: string) {
  return key === 'Enter' || key === ' ';
}

function isContextMenuShortcut(event: React.KeyboardEvent<HTMLElement>) {
  return (
    event.key === 'ContextMenu'
    || event.code === 'ContextMenu'
    || event.key === 'F10'
    || event.code === 'F10'
  );
}

function translateWithFallback(
  t: (key: string, params?: Record<string, string | number>) => string,
  key: string,
  fallback: string,
  params?: Record<string, string | number>,
): string {
  const value = t(key, params);
  return value === key ? fallback : value;
}

function formatDateLabel(
  value: string | undefined,
  formatDate: (timestamp: number | undefined, unknownText?: string, options?: Intl.DateTimeFormatOptions) => string,
): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return formatDate(date.getTime(), '', { dateStyle: 'medium' }) || null;
}

function formatLoaderLabel(
  t: (key: string, params?: Record<string, string | number>) => string,
  loader: string,
): string {
  const normalizedLoader = loader.toLowerCase();

  switch (normalizedLoader) {
    case 'forge':
      return translateWithFallback(t, 'modpacks.loader_forge', 'Forge');
    case 'fabric':
      return translateWithFallback(t, 'modpacks.loader_fabric', 'Fabric');
    case 'quilt':
      return translateWithFallback(t, 'modpacks.loader_quilt', 'Quilt');
    case 'neoforge':
      return translateWithFallback(t, 'modpacks.loader_neoforge', 'NeoForge');
    case 'vanilla':
      return translateWithFallback(t, 'modpacks.loader_vanilla', 'Vanilla (no modloader)');
    default:
      return loader;
  }
}

// Uses ModpackListContext — only updates when modpacks/selectedId change, not when config changes (downloads).
function useModpackListValues() {
  const { modpacks, selectedId, select, remove, rename, duplicate, refresh } = useModpackListContext();
  const modpacksKey = useMemo(() => modpacks.map(m => m.id).sort().join(','), [modpacks]);
  return useMemo(() => ({
    modpacks,
    selectedId,
    select,
    remove,
    rename,
    duplicate,
    refresh,
    modpacksKey,
  }), [modpacks, selectedId, select, remove, rename, duplicate, refresh, modpacksKey]);
}

// Internal component that doesn't re-render when context config changes
const ModpackListComponentInternal: React.FC<{
  contextModpacks: ReturnType<typeof useModpackListValues>['modpacks'];
  selectedId: string;
  select: ReturnType<typeof useModpackListValues>['select'];
  remove: ReturnType<typeof useModpackListValues>['remove'];
  rename: ReturnType<typeof useModpackListValues>['rename'];
  duplicate: ReturnType<typeof useModpackListValues>['duplicate'];
  refresh: ReturnType<typeof useModpackListValues>['refresh'];
  modpacksKey: string;
  onNavigate?: (view: { type: 'browser' } | { type: 'details'; modpackId: string } | { type: 'export'; modpackId: string }) => void;
  onCreateWizard?: () => void;
}> = ({ contextModpacks: _contextModpacks, selectedId, select, remove, rename, duplicate, refresh, modpacksKey, onNavigate, onCreateWizard }) => {
  const { t, getAccentStyles, minecraftPath } = useSettings();
  const toast = useToast();
  const confirm = useConfirm();
  const [modpacks, setModpacks] = useState<ModpackListItemWithMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown | null>(null);
  const [availableUpdatesById, setAvailableUpdatesById] = useState<Record<string, ModpackUpdateInfo>>({});
  const [isDragging, setIsDragging] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    anchorRect: AnchoredRect;
    align: AnchoredAlign;
    modpackId: string;
  } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const contextMenuTriggerRef = useRef<HTMLElement | null>(null);

  // Share state
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareModpackId, setShareModpackId] = useState<string | null>(null);
  const [importShareModalOpen, setImportShareModalOpen] = useState(false);

  // Search and Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMCVersion, setFilterMCVersion] = useState<string>('all');
  const [filterLoader, setFilterLoader] = useState<string>('all');
  const [sortOption, setSortOption] = useState<SortOption>('name');

  const loadModpacks = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await modpacksIPC.listWithMetadata(minecraftPath);
      setModpacks(list);
    } catch (error) {
      console.error('Error loading modpacks:', error);
      setLoadError(error);
      setModpacks([]);
    } finally {
      setLoading(false);
    }
  }, [minecraftPath]);

  // Load modpacks on mount and when minecraftPath changes
  useEffect(() => {
    loadModpacks();
  }, [loadModpacks]);

  useEffect(() => {
    let cancelled = false;

    if (loading || loadError || modpacks.length === 0) {
      setAvailableUpdatesById({});
      return;
    }

    void resolveInstalledModpackUpdates(modpacks, minecraftPath).then((updates) => {
      if (cancelled) {
        return;
      }

      setAvailableUpdatesById(
        Object.fromEntries(updates.map((update) => [update.modpackId, update])),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [loadError, loading, minecraftPath, modpacks]);

  // Sync with context modpacks list changes (only when list actually changes, not config)
  // Use a ref to track previous modpacks list to avoid unnecessary reloads
  const prevModpacksKeyForReloadRef = useRef<string>('');
  const loadModpacksStableRef = useRef(loadModpacks);
  loadModpacksStableRef.current = loadModpacks;

  useEffect(() => {
    const currentKey = modpacksKey;
    const prevKey = prevModpacksKeyForReloadRef.current;

    // Only reload if the actual list of modpack IDs changed
    if (currentKey !== prevKey && prevKey !== '') {
      loadModpacksStableRef.current();
    }
    prevModpacksKeyForReloadRef.current = currentKey;
  }, [modpacksKey]); // Remove loadModpacks from deps to prevent re-runs when it changes

  // Hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        onCreateWizard?.();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        onNavigate?.({ type: 'browser' });
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        if (selectedId) {
          onNavigate?.({ type: 'details', modpackId: selectedId });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, onNavigate, onCreateWizard]);

  const closeContextMenu = useCallback((restoreFocus = false) => {
    setContextMenu(null);

    if (restoreFocus && contextMenuTriggerRef.current) {
      const trigger = contextMenuTriggerRef.current;
      requestAnimationFrame(() => {
        trigger.focus();
      });
    }
  }, []);

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = () => closeContextMenu();
    if (contextMenu) {
      window.addEventListener('click', handleClickOutside);
      return () => window.removeEventListener('click', handleClickOutside);
    }
  }, [closeContextMenu, contextMenu]);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    const focusFirstMenuItem = () => {
      const firstMenuItem = contextMenuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]');
      firstMenuItem?.focus();
    };

    const frameId = requestAnimationFrame(focusFirstMenuItem);

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      event.preventDefault();
      closeContextMenu(true);
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [closeContextMenu, contextMenu]);

  const handleSelect = useCallback(async (id: string) => {
    // Optimistic update: immediately update local state
    setModpacks(prev => prev.map(m => ({ ...m, selected: m.id === id })));

    try {
      await select(id);
      await refresh();
      await loadModpacks();
    } catch (error) {
      // Rollback on error
      console.error('Error selecting modpack:', error);
      toast.error(t('modpacks.select_error') || 'Ошибка при выборе модпака');
      await loadModpacks(); // Reload to restore correct state
    }
  }, [select, refresh, loadModpacks, toast, t]);

  const handleDelete = useCallback(async (id: string, name: string) => {
    const confirmText = t('modpacks.delete_confirm')?.replace('{{name}}', name) || `Удалить модпак "${name}"?`;
    const confirmed = await confirm.confirm({
      title: t('modpacks.delete') || 'Удалить модпак',
      message: confirmText,
      variant: 'danger',
      confirmText: t('modpacks.delete') || 'Удалить',
      cancelText: t('general.cancel') || 'Отмена',
    });
    if (confirmed) {
      // Optimistic update: immediately remove from UI
      const deletedModpack = modpacks.find(m => m.id === id);
      setModpacks(prev => prev.filter(m => m.id !== id));

      try {
        await remove(id);
        await refresh();
        // Reload to ensure consistency
        await loadModpacks();
      } catch (error) {
        // Rollback on error
        console.error('Error deleting modpack:', error);
        toast.error(t('modpacks.delete_error') || 'Ошибка при удалении модпака');
        if (deletedModpack) {
          setModpacks(prev => [...prev, deletedModpack].sort((a, b) => a.name.localeCompare(b.name)));
        }
        await loadModpacks(); // Reload to restore correct state
      }
    }
  }, [remove, refresh, loadModpacks, toast, t, confirm, modpacks]);

  const handleRename = useCallback(async (id: string, currentName: string) => {
    const nextName = await confirm.prompt({
      title: t('modpacks.rename') || 'Переименовать',
      message: t('modpacks.rename_prompt') || 'Введите новое название:',
      confirmText: t('modpacks.rename') || 'Переименовать',
      cancelText: t('general.cancel') || 'Отмена',
      input: {
        initialValue: currentName,
        placeholder: currentName,
        requireNonEmpty: true,
      },
    });
    const newName = nextName?.trim();
    if (newName && newName !== currentName) {
      try {
        await rename(id, newName);
        await refresh();
        await loadModpacks();
      } catch (error) {
        console.error('Error renaming modpack:', error);
        toast.error(t('modpacks.rename_error') || 'Ошибка при переименовании');
      }
    }
  }, [confirm, loadModpacks, refresh, rename, t, toast]);

  const handleDuplicate = useCallback(async (id: string, currentName: string) => {
    const suggestedName = `${currentName} - Copy`;
    const nextName = await confirm.prompt({
      title: t('modpacks.duplicate') || 'Дублировать',
      message: t('modpacks.duplicate_prompt') || 'Введите название копии:',
      confirmText: t('modpacks.duplicate') || 'Дублировать',
      cancelText: t('general.cancel') || 'Отмена',
      input: {
        initialValue: suggestedName,
        placeholder: suggestedName,
        requireNonEmpty: true,
      },
    });
    const newName = nextName?.trim();
    if (newName) {
      try {
        await duplicate(id, newName);
        await refresh();
        await loadModpacks();
      } catch (error) {
        console.error('Error duplicating modpack:', error);
        toast.error(t('modpacks.duplicate_error') || 'Ошибка при дублировании');
      }
    }
  }, [confirm, duplicate, loadModpacks, refresh, t, toast]);

  const filteredModpacks = useMemo(() => {
    return modpacks.filter(m => {
      const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesVersion = filterMCVersion === 'all' || m.metadata?.minecraftVersion === filterMCVersion;
      const matchesLoader = filterLoader === 'all' || m.metadata?.modLoader?.type === filterLoader;

      return matchesSearch && matchesVersion && matchesLoader;
    });
  }, [modpacks, searchQuery, filterMCVersion, filterLoader]);

  const sortedModpacks = useMemo(() => {
    return [...filteredModpacks].sort((a, b) => {
      if (sortOption === 'created') {
        const dateA = a.metadata?.createdAt ? new Date(a.metadata.createdAt).getTime() : 0;
        const dateB = b.metadata?.createdAt ? new Date(b.metadata.createdAt).getTime() : 0;
        return dateB - dateA; // Newest first
      }
      if (sortOption === 'updated') {
        const dateA = a.metadata?.updatedAt ? new Date(a.metadata.updatedAt).getTime() : 0;
        const dateB = b.metadata?.updatedAt ? new Date(b.metadata.updatedAt).getTime() : 0;
        return dateB - dateA; // Newest first
      }
      // Default: name, alphabetical
      return a.name.localeCompare(b.name);
    });
  }, [filteredModpacks, sortOption]);

  const hasActiveFilters =
    searchQuery.trim().length > 0
    || filterMCVersion !== 'all'
    || filterLoader !== 'all'
    || sortOption !== 'name';
  const hasSearchFilters =
    searchQuery.trim().length > 0
    || filterMCVersion !== 'all'
    || filterLoader !== 'all';
  const listErrorTitle = t('error.inline_fallback');
  const listErrorDescription = loadError
    ? (() => {
      const detail = toDisplayErrorMessage(loadError, listErrorTitle);
      return detail !== listErrorTitle ? detail : t('modpacks.desc');
    })()
    : '';
  const activeFilterTokens = useMemo(() => {
    const tokens: string[] = [];

    if (searchQuery.trim().length > 0) {
      tokens.push(`${translateWithFallback(t, 'modpacks.search', 'Search modpacks')}: "${searchQuery.trim()}"`);
    }
    if (filterMCVersion !== 'all') {
      tokens.push(`${translateWithFallback(t, 'modpacks.minecraft_version', 'Minecraft Version')}: ${filterMCVersion}`);
    }
    if (filterLoader !== 'all') {
      tokens.push(`${translateWithFallback(t, 'modpacks.loader', 'Modloader')}: ${formatLoaderLabel(t, filterLoader)}`);
    }
    if (sortOption !== 'name') {
      tokens.push(
        sortOption === 'created'
          ? translateWithFallback(t, 'modpacks.sort_created', 'By creation date')
          : translateWithFallback(t, 'modpacks.sort_updated', 'By update date'),
      );
    }

    return tokens;
  }, [filterLoader, filterMCVersion, searchQuery, sortOption, t]);
  const handleResetFilters = useCallback(() => {
    setSearchQuery('');
    setFilterMCVersion('all');
    setFilterLoader('all');
    setSortOption('name');
  }, []);

  // Derived lists for filter dropdowns
  const availableVersions = useMemo(() => {
    const versions = new Set(
      modpacks
        .map((modpack) => modpack.metadata?.minecraftVersion)
        .filter((version): version is string => Boolean(version))
    );
    return Array.from(versions).sort().reverse();
  }, [modpacks]);

  const availableLoaders = useMemo(() => {
    const loaders = new Set(
      modpacks
        .map((modpack) => modpack.metadata?.modLoader?.type)
        .filter((loader): loader is ModLoaderType => Boolean(loader))
    );
    return Array.from(loaders).sort();
  }, [modpacks]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const modpackFiles = files.filter((f) =>
      f.name.endsWith('.mrpack') ||
      f.name.endsWith('.zip') ||
      f.name.endsWith('.curseforge')
    );

    if (modpackFiles.length === 0) {
      toast.warning(t('modpacks.invalid_file') || 'Пожалуйста, перетащите файл модпака (.mrpack, .zip, .curseforge)');
      return;
    }

    for (const file of modpackFiles) {
      try {
        // In Electron, file objects from drag & drop have a path property
        const filePath = (file as unknown as { path?: string }).path || file.name;
        await modpacksIPC.import(filePath);
        await refresh();
        await loadModpacks();
      } catch (error) {
        console.error('Error importing modpack:', error);
        toast.error(t('modpacks.import_error') || `Ошибка при импорте модпака: ${file.name}`);
      }
    }
  }, [refresh, loadModpacks, toast, t]);

  const handleImportShareCode = useCallback(async (manifest: ModpackManifest) => {
    try {
      setLoading(true);
      await modpacksIPC.createFromManifest(manifest);
      await refresh();
      await loadModpacks();
      toast.success(t('share.import_success'));
    } catch (error) {
      console.error('Error importing modpack from share code:', error);
      toast.error(t('share.import_error'));
    } finally {
      setLoading(false);
    }
  }, [refresh, loadModpacks, toast, t]);

  const getModpackIcon = useCallback((modpack: ModpackListItemWithMetadata) => {
    return modpack.metadata?.iconUrl;
  }, []);

  const openContextMenu = useCallback((
    modpackId: string,
    anchorRect: AnchoredRect,
    trigger?: HTMLElement | null,
    align: AnchoredAlign = 'end',
  ) => {
    contextMenuTriggerRef.current = trigger ?? null;
    setContextMenu({ anchorRect, align, modpackId });
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    openContextMenu(
      id,
      {
        top: e.clientY,
        left: e.clientX,
        right: e.clientX,
        bottom: e.clientY,
        width: 0,
        height: 0,
      },
      null,
      'start',
    );
  }, [openContextMenu]);

  const handleActionMenuOpen = useCallback((event: React.MouseEvent<HTMLButtonElement>, id: string) => {
    event.preventDefault();
    event.stopPropagation();
    openContextMenu(id, rectFromElement(event.currentTarget), event.currentTarget, 'end');
  }, [openContextMenu]);

  const handleActionMenuOpenFromKeyboard = useCallback((anchor: HTMLElement, id: string) => {
    openContextMenu(id, rectFromElement(anchor), anchor, 'end');
  }, [openContextMenu]);

  // Skeleton loader для карточки модпака
  const ModpackCardSkeleton = React.memo(() => (
    <div role="listitem" className="surface-card min-h-[200px] p-5">
      <div className="flex items-start gap-4 mb-3">
        <SkeletonLoader variant="rounded" width={80} height={80} />
        <div className="flex-1 min-w-0 space-y-2">
          <SkeletonLoader variant="text" width="60%" height={20} />
          <SkeletonLoader variant="text" width="40%" height={16} />
          <SkeletonLoader variant="text" width="35%" height={16} />
        </div>
      </div>
      <SkeletonLoader variant="text" lines={2} className="mb-3" />
      <div className="flex gap-2 mt-3">
        <SkeletonLoader variant="rounded" width="100%" height={40} />
        <SkeletonLoader variant="rounded" width={90} height={40} />
        <SkeletonLoader variant="rounded" width={90} height={40} />
      </div>
    </div>
  ));
  ModpackCardSkeleton.displayName = 'ModpackCardSkeleton';

  // Мемоизированный компонент карточки модпака
  interface ModpackCardProps {
    modpack: ModpackListItemWithMetadata;
    availableUpdate?: ModpackUpdateInfo;
    index: number;
    isSelected: boolean;
    isMenuOpen: boolean;
    onSelect: (id: string) => void;
    onShowDetails: (id: string) => void;
    onOpenActions: (event: React.MouseEvent<HTMLButtonElement>, id: string) => void;
    onOpenActionsFromKeyboard: (anchor: HTMLElement, id: string) => void;
    onContextMenu: (e: React.MouseEvent, id: string) => void;
  }

  const ModpackCard = useMemo(() => React.memo<ModpackCardProps>(({
    modpack,
    availableUpdate,
    index,
    isSelected,
    isMenuOpen,
    onSelect,
    onShowDetails,
    onOpenActions,
    onOpenActionsFromKeyboard,
    onContextMenu,
  }) => {
    const { t, getAccentStyles, formatDate } = useSettings();
    const iconSrc = useMemo(() => getModpackIcon(modpack), [modpack]);
    const iconFallbackKind = 'content-artwork';
    const runtimeSummary = useMemo(
      () => buildModpackRuntimeSummary({ metadata: modpack.metadata ?? null }),
      [modpack.metadata],
    );
    const updatedLabel = useMemo(
      () => formatDateLabel(modpack.metadata?.updatedAt ?? modpack.metadata?.createdAt, formatDate),
      [formatDate, modpack.metadata?.createdAt, modpack.metadata?.updatedAt],
    );
    const activeBackground = useMemo(() => getAccentStyles('soft-bg'), [getAccentStyles]);
    const activeBorder = useMemo(() => getAccentStyles('soft-border'), [getAccentStyles]);
    const activeLabel = useMemo(() => getAccentStyles('title'), [getAccentStyles]);
    const actionMenuId = `modpack-actions-menu-${modpack.id}`;
    const actionMenuLabel = `${translateWithFallback(t, 'modpacks.actions_title', 'More actions')}: ${modpack.name}`;
    const openDetailsText = translateWithFallback(t, 'modpacks.open_details', 'Open details');
    const makeActiveText = translateWithFallback(t, 'modpacks.make_active', 'Make active');
    const activeNowText = translateWithFallback(t, 'modpacks.active_now', 'Active now');
    const updateBadgeText = translateWithFallback(t, 'modpacks.update_available', 'Update available');

    return (
      <div
        className={cn(
          'surface-card relative flex min-h-[17rem] cursor-pointer flex-col p-4 transition-all duration-300 ease-out',
          'transform hover:scale-[1.02] hover:shadow-lg',
          'hover:-translate-y-1',
          'animate-fade-in-up',
          'focus-within:ring-2 focus-within:ring-[rgb(var(--accent-main))] focus-within:ring-offset-2 focus-within:ring-offset-background',
          isSelected
            ? cn(
              'scale-[1.02] border-border bg-card/90 shadow-[0_18px_36px_rgba(0,0,0,0.18)]',
              activeBackground.className,
              activeBorder.className,
            )
            : 'hover:border-border-active hover:bg-card'
        )}
        data-state={isSelected ? 'active' : 'inactive'}
        style={{
          animationDelay: `${index * 50}ms`,
          ...(isSelected
            ? {
              ...activeBackground.style,
              ...activeBorder.style,
            }
            : undefined),
        }}
        role="listitem"
        onClick={() => onSelect(modpack.id)}
        onContextMenu={(e) => onContextMenu(e, modpack.id)}
      >
        <div
          role="button"
          tabIndex={0}
          aria-label={modpack.name}
          aria-pressed={isSelected}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(modpack.id);
          }}
          onKeyDown={(event) => {
            if (isActivationKey(event.key)) {
              event.preventDefault();
              onSelect(modpack.id);
              return;
            }

            if (isContextMenuShortcut(event)) {
              event.preventDefault();
              onOpenActionsFromKeyboard(event.currentTarget, modpack.id);
            }
          }}
          className="absolute inset-0 rounded-xl focus:outline-none"
        />

        <div className="relative z-10 flex h-full flex-col gap-4">
          <div className="flex items-start gap-4">
            <div className="w-20 h-20 flex-shrink-0">
              <LazyImage
                src={iconSrc}
                alt={modpack.name}
                fallbackKind={iconFallbackKind}
                className="h-full w-full rounded-2xl border border-border/70 object-cover"
                placeholder={
                  <SkeletonLoader variant="rounded" width={80} height={80} />
                }
              />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="truncate text-base font-semibold text-foreground">
                {modpack.name}
              </h3>
              {isSelected && (
                <div
                  className={cn(
                    'mt-1 text-xs font-medium',
                    activeLabel.className,
                  )}
                  style={activeLabel.style}
                >
                  {t('modpacks.active')}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-3 text-xs text-secondary">
            {runtimeSummary.minecraftVersion && (
              <div className="min-w-[8rem]">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                  {translateWithFallback(t, 'modpacks.minecraft_version', 'Minecraft Version')}
                </div>
                <div className="mt-1 text-sm font-medium text-foreground">
                  {runtimeSummary.minecraftVersion}
                </div>
              </div>
            )}
            {updatedLabel && (
              <div className="min-w-[8rem]">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                  {translateWithFallback(t, 'modpacks.updated', 'Updated')}
                </div>
                <div className="mt-1 text-sm font-medium text-foreground">
                  {updatedLabel}
                </div>
              </div>
            )}
          </div>

          {availableUpdate && (
            <div
              data-testid={`installed-modpack-update-indicator-${modpack.id}`}
              data-update-scope="modpack-local"
              className="text-xs font-medium text-secondary"
            >
              {updateBadgeText}
            </div>
          )}

          <div
            className="relative z-10 mt-auto grid grid-cols-[minmax(0,1fr)_auto] gap-2 pt-1"
            onClick={(e) => e.stopPropagation()}
            data-testid={`installed-modpack-actions-${modpack.id}`}
          >
            <Button
              variant="primary"
              size="sm"
              geometry="catalog-primary"
              onClick={() => onShowDetails(modpack.id)}
              className="col-span-2 min-w-0 justify-center transition-all duration-200"
              style={getAccentStyles('bg').style}
              aria-label={`${openDetailsText}: ${modpack.name}`}
            >
              <FolderOpen className="h-4 w-4" />
              {openDetailsText}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              geometry="catalog-primary"
              onClick={() => {
                if (!isSelected) {
                  onSelect(modpack.id);
                }
              }}
              disabled={isSelected}
              className="min-w-[8.5rem] transition-all duration-200"
              aria-label={`${isSelected ? activeNowText : makeActiveText}: ${modpack.name}`}
            >
              {isSelected ? activeNowText : makeActiveText}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              geometry="catalog-primary"
              onClick={(event) => onOpenActions(event, modpack.id)}
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              aria-controls={isMenuOpen ? actionMenuId : undefined}
              aria-label={actionMenuLabel}
              className="px-3 transition-all duration-200"
              title={t('modpacks.actions_title') || 'More actions'}
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }, (prevProps, nextProps) => {
    // Custom comparison function for React.memo
    return (
      prevProps.modpack.id === nextProps.modpack.id &&
      prevProps.modpack.selected === nextProps.modpack.selected &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.isMenuOpen === nextProps.isMenuOpen &&
      prevProps.modpack.name === nextProps.modpack.name &&
      prevProps.modpack.metadata?.version === nextProps.modpack.metadata?.version &&
      prevProps.modpack.metadata?.minecraftVersion === nextProps.modpack.metadata?.minecraftVersion &&
      prevProps.modpack.metadata?.modLoader?.type === nextProps.modpack.metadata?.modLoader?.type &&
      prevProps.modpack.metadata?.updatedAt === nextProps.modpack.metadata?.updatedAt &&
      prevProps.modpack.metadata?.createdAt === nextProps.modpack.metadata?.createdAt &&
      prevProps.modpack.metadata?.description === nextProps.modpack.metadata?.description &&
      prevProps.modpack.metadata?.source === nextProps.modpack.metadata?.source &&
      prevProps.availableUpdate?.latestVersion.versionId === nextProps.availableUpdate?.latestVersion.versionId
    );
  }), [getModpackIcon]);
  ModpackCard.displayName = 'ModpackCard';

  return (
    <>
      <div
        className={cn(
          "flex-1 flex flex-col p-8 overflow-y-auto transition-all",
          isDragging && "bg-background/60 border-2 border-dashed border-border-active"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <ModpackCatalogControls
          rootTestId="installed-modpack-filters"
          headerTestId="installed-modpack-catalog-header"
          controlsTestId="installed-modpack-filter-controls"
          header={(
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <h2 className="text-base font-semibold text-foreground">
                {t('modpacks.title')}
              </h2>
              <div className="flex flex-wrap items-center gap-2" data-testid="installed-modpack-primary-actions">
                <Button
                  variant="secondary"
                  size="sm"
                  geometry="catalog-primary"
                  onClick={() => setImportShareModalOpen(true)}
                  className="min-h-10 flex-1 justify-center gap-2 px-4 sm:flex-none"
                  title={t('share.import_title')}
                >
                  <Download className="h-4 w-4 shrink-0" />
                  {t('modpacks.import_code_btn')}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  geometry="catalog-primary"
                  onClick={() => onCreateWizard?.()}
                  className="min-h-10 flex-1 justify-center gap-2 px-4 sm:flex-none"
                >
                  <PackagePlus className="h-4 w-4 shrink-0" />
                  {t('modpacks.create')}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  geometry="catalog-primary"
                  onClick={() => onNavigate?.({ type: 'browser' })}
                  className={cn(
                    'min-h-10 flex-1 justify-center gap-2 px-4 sm:flex-none',
                    getAccentStyles('bg').className,
                  )}
                  style={getAccentStyles('bg').style}
                >
                  <Compass className="h-4 w-4 shrink-0" />
                  {t('modpacks.browser')}
                </Button>
              </div>
            </div>
          )}
          searchLabel={t('modpacks.search') || 'Search modpacks'}
          searchControl={(
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('modpacks.search_placeholder') || 'Поиск модпаков...'}
              aria-label={t('modpacks.search_placeholder') || 'Search modpacks'}
              className="w-full"
              data-testid="installed-modpack-search"
            />
          )}
          controls={[
            {
              key: 'sort',
              label:
                sortOption === 'created'
                  ? translateWithFallback(t, 'modpacks.sort_created', 'By creation date')
                  : sortOption === 'updated'
                    ? translateWithFallback(t, 'modpacks.sort_updated', 'By update date')
                    : translateWithFallback(t, 'modpacks.sort_name', 'By name'),
              control: (
                <Select
                  value={sortOption}
                  onChange={(e) => {
                    const nextSortOption = e.target.value;
                    if (SORT_OPTIONS.includes(nextSortOption as SortOption)) {
                      setSortOption(nextSortOption as SortOption);
                    }
                  }}
                  aria-label={t('modpacks.sort_name') || 'Sort modpacks'}
                  className="w-full"
                  data-testid="installed-modpack-sort"
                >
                  <option value="name">{t('modpacks.sort_name') || 'По имени'}</option>
                  <option value="created">{t('modpacks.sort_created') || 'По дате создания'}</option>
                  <option value="updated">{t('modpacks.sort_updated') || 'По обновлению'}</option>
                </Select>
              ),
            },
            {
              key: 'version',
              label: translateWithFallback(t, 'modpacks.minecraft_version', 'Minecraft Version'),
              control: (
                <Select
                  value={filterMCVersion}
                  onChange={(e) => setFilterMCVersion(e.target.value)}
                  aria-label={t('modpacks.filter_all_versions') || 'Filter by Minecraft version'}
                  className="w-full"
                  data-testid="installed-modpack-version-filter"
                >
                  <option value="all">{t('modpacks.filter_all_versions') || 'Все версии'}</option>
                  {availableVersions.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </Select>
              ),
            },
            {
              key: 'loader',
              label: translateWithFallback(t, 'modpacks.loader', 'Modloader'),
              control: (
                <Select
                  value={filterLoader}
                  onChange={(e) => setFilterLoader(e.target.value)}
                  aria-label={t('modpacks.filter_all_loaders') || 'Filter by modloader'}
                  className="w-full"
                  data-testid="installed-modpack-loader-filter"
                >
                  <option value="all">{t('modpacks.filter_all_loaders') || 'Все лоадеры'}</option>
                  {availableLoaders.map((l) => (
                    <option key={l} value={l}>{formatLoaderLabel(t, l)}</option>
                  ))}
                </Select>
              ),
            },
          ]}
          activeFilterTokens={activeFilterTokens}
          onReset={hasActiveFilters ? handleResetFilters : undefined}
          resetLabel={translateWithFallback(t, 'modpacks.clear_filters', 'Clear filters')}
          className="mb-6"
        />

        {/* Drag & Drop Zone */}
        {isDragging && (
          <div className="surface-panel absolute inset-0 z-50 flex items-center justify-center border-2 border-dashed border-border-active bg-background/86 backdrop-blur-sm">
            <div className="text-center">
              <p className="mb-2 text-xl font-bold text-foreground">
                {t('modpacks.drop_file') || 'Перетащите файл модпака сюда'}
              </p>
              <p className="text-sm text-secondary">
                {t('modpacks.supported_formats') || 'Поддерживаемые форматы: .mrpack, .zip, .curseforge'}
              </p>
            </div>
          </div>
        )}

        {/* Modpacks Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3 gap-5" role="list" aria-label={t('modpacks.title') || 'Modpacks'}>
            {Array.from({ length: 6 }).map((_, index) => (
              <ModpackCardSkeleton key={index} />
            ))}
          </div>
        ) : loadError ? (
          <DegradedStateView
            variant="error"
            label={t('degraded.error_label')}
            title={listErrorTitle}
            description={listErrorDescription}
            footer={(
              <Button variant="secondary" size="sm" onClick={() => void loadModpacks()}>
                {t('modpacks.world_refresh')}
              </Button>
            )}
          />
        ) : filteredModpacks.length === 0 ? (
          hasSearchFilters ? (
            <DegradedStateView
              variant="zero-results"
              label={t('degraded.zero_results_label')}
              title={t('modpacks.no_results')}
              description={t('modpacks.try_changing_filters')}
              footer={(
                <Button variant="secondary" size="sm" onClick={handleResetFilters}>
                  {t('modpacks.clear_filters')}
                </Button>
              )}
            />
          ) : (
            <DegradedStateView
              variant="empty"
              label={t('degraded.empty_label')}
              title={t('modpacks.no_modpacks_title')}
              description={t('modpacks.no_modpacks_desc')}
              footer={(
                <Button variant="secondary" size="sm" onClick={() => onNavigate?.({ type: 'browser' })}>
                  <Compass className="h-4 w-4" />
                  {t('modpacks.browser')}
                </Button>
              )}
            >
              <p className="text-center text-xs text-muted">{t('modpacks.drag_drop_hint')}</p>
            </DegradedStateView>
          )
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3 gap-5" role="list" aria-label={t('modpacks.title') || 'Modpacks'}>
            {sortedModpacks.map((modpack, index) => (
              <ModpackCard
                key={modpack.id}
                modpack={modpack}
                availableUpdate={availableUpdatesById[modpack.id]}
                index={index}
                isSelected={modpack.id === selectedId}
                isMenuOpen={contextMenu?.modpackId === modpack.id}
                onSelect={handleSelect}
                onShowDetails={(id) => onNavigate?.({ type: 'details', modpackId: id })}
                onOpenActions={handleActionMenuOpen}
                onOpenActionsFromKeyboard={handleActionMenuOpenFromKeyboard}
                onContextMenu={handleContextMenu}
              />
            ))}
          </div>
        )}
      </div >


      {/* Context Menu */}
      {
        contextMenu && (
          <AnchoredOverlay
            open={true}
            anchorRect={contextMenu.anchorRect}
            placement="bottom"
            align={contextMenu.align}
            offset={8}
            padding={12}
            className="z-50"
          >
            <div
              ref={contextMenuRef}
              id={`modpack-actions-menu-${contextMenu.modpackId}`}
              role="menu"
              aria-label={`${t('modpacks.actions_title') || 'More actions'}: ${modpacks.find((modpack) => modpack.id === contextMenu.modpackId)?.name || contextMenu.modpackId}`}
              className="surface-card min-w-[176px] py-1"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-foreground hover:bg-background/70"
                onClick={() => {
                  onNavigate?.({ type: 'details', modpackId: contextMenu!.modpackId });
                  closeContextMenu();
                }}
              >
                <FolderOpen className="h-4 w-4" />
                {translateWithFallback(t, 'modpacks.open_details', 'Open details')}
              </button>
              <button
                type="button"
                role="menuitem"
                className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-background/70"
                disabled={selectedId === contextMenu.modpackId}
                aria-disabled={selectedId === contextMenu.modpackId}
                onClick={() => {
                  handleSelect(contextMenu!.modpackId);
                  closeContextMenu();
                }}
              >
                {selectedId === contextMenu.modpackId
                  ? translateWithFallback(t, 'modpacks.active_now', 'Active now')
                  : translateWithFallback(t, 'modpacks.make_active', 'Make active')}
              </button>
              <div className="my-1 h-px bg-border/60" />
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-foreground hover:bg-background/70"
                onClick={() => {
                  setShareModpackId(contextMenu!.modpackId);
                  setShareModalOpen(true);
                  closeContextMenu();
                }}
              >
                <Share2 className="mr-2 h-4 w-4" />
                {t('modpacks.share_btn')}
              </button>
              <button
                type="button"
                role="menuitem"
                className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-background/70"
                onClick={() => {
                  onNavigate?.({ type: 'export', modpackId: contextMenu!.modpackId });
                  closeContextMenu();
                }}
              >
                {t('modpacks.export') || 'Экспорт'}
              </button>
              <button
                type="button"
                role="menuitem"
                className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-background/70"
                onClick={() => {
                  const modpack = modpacks.find((m) => m.id === contextMenu!.modpackId);
                  if (modpack) {
                    handleRename(contextMenu!.modpackId, modpack.name);
                  }
                  closeContextMenu();
                }}
              >
                {t('modpacks.rename') || 'Переименовать'}
              </button>
              <button
                type="button"
                role="menuitem"
                className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-background/70"
                onClick={() => {
                  const modpack = modpacks.find((m) => m.id === contextMenu!.modpackId);
                  if (modpack) {
                    handleDuplicate(contextMenu!.modpackId, modpack.name);
                  }
                  closeContextMenu();
                }}
              >
                {t('modpacks.duplicate') || 'Дублировать'}
              </button>
              <div className="my-1 h-px bg-border/60" />
              <button
                type="button"
                role="menuitem"
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-background/70 dark:text-red-400"
                onClick={() => {
                  const modpack = modpacks.find((m) => m.id === contextMenu!.modpackId);
                  if (modpack) {
                    handleDelete(contextMenu!.modpackId, modpack.name);
                  }
                  closeContextMenu();
                }}
              >
                {t('modpacks.delete')}
              </button>
            </div>
          </AnchoredOverlay>
        )
      }

      {/* Share Modals */}
      {shareModpackId && (
        <ShareModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          modpackId={shareModpackId}
        />
      )}

      <ImportShareModal
        isOpen={importShareModalOpen}
        onClose={() => setImportShareModalOpen(false)}
        onImport={handleImportShareCode}
      />
    </>
  );
};

// Memoize internal component to prevent re-renders when props haven't changed
// Only re-render if modpacks list or selectedId actually changed
// Functions are compared by reference - if they're stable, this will work
const MemoizedModpackListInternal = React.memo(ModpackListComponentInternal);

// Wrapper component that extracts values from context
const ModpackListComponent: React.FC<{
  onNavigate?: (view: { type: 'browser' } | { type: 'details'; modpackId: string } | { type: 'export'; modpackId: string }) => void;
  onCreateWizard?: () => void;
}> = ({ onNavigate, onCreateWizard }) => {
  const values = useModpackListValues();

  return <MemoizedModpackListInternal
    contextModpacks={values.modpacks}
    selectedId={values.selectedId}
    select={values.select}
    remove={values.remove}
    rename={values.rename}
    duplicate={values.duplicate}
    refresh={values.refresh}
    modpacksKey={values.modpacksKey}
    onNavigate={onNavigate}
    onCreateWizard={onCreateWizard}
  />;
};

export const ModpackList = ModpackListComponent;
