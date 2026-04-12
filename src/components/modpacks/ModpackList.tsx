import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { useModpackListContext } from '../../contexts/ModpackContext';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { SkeletonLoader } from '../ui/SkeletonLoader';
import { LazyImage } from '../ui/LazyImage';
import { modpacksIPC } from '../../services/ipc/modpacksIPC';
import type { ModpackManifest, ModpackMetadata } from '@shared/types/modpack';
import { cn } from '../../utils/cn';
import { ShareModal } from '../../features/share/ShareModal';
import { ImportShareModal } from '../../features/share/ImportShareModal';
import { Download, MoreHorizontal, Share2 } from 'lucide-react';
import type { ModLoaderType } from '../../contexts/instances/types';

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
  const [isDragging, setIsDragging] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; modpackId: string } | null>(null);
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
    try {
      const list = await modpacksIPC.listWithMetadata(minecraftPath);
      setModpacks(list);
    } catch (error) {
      console.error('Error loading modpacks:', error);
      setModpacks([]);
    } finally {
      setLoading(false);
    }
  }, [minecraftPath]);

  // Load modpacks on mount and when minecraftPath changes
  useEffect(() => {
    loadModpacks();
  }, [loadModpacks]);

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
      toast.success(t('share.import_success') || 'Модпак успешно импортирован');
    } catch (error) {
      console.error('Error importing modpack from share code:', error);
      toast.error(t('share.import_error') || 'Ошибка при импорте');
    } finally {
      setLoading(false);
    }
  }, [refresh, loadModpacks, toast, t]);

  const getModpackIcon = useCallback((modpack: ModpackListItemWithMetadata) => {
    if (modpack.metadata?.iconUrl) {
      return modpack.metadata.iconUrl;
    }
    return '/icon.png';
  }, []);

  const getModpackSourceBadge = useCallback((source?: string) => {
    if (!source || source === 'local') return null;
    const badges = {
      curseforge: { text: 'CF', color: 'bg-orange-500' },
      modrinth: { text: 'MR', color: 'bg-green-500' },
    };
    const badge = badges[source as keyof typeof badges];
    if (!badge) return null;
    return (
      <span className={cn('text-xs px-1.5 py-0.5 rounded text-white font-bold', badge.color)}>
        {badge.text}
      </span>
    );
  }, []);

  const openContextMenu = useCallback((modpackId: string, x: number, y: number, trigger?: HTMLElement | null) => {
    contextMenuTriggerRef.current = trigger ?? null;
    setContextMenu({ x, y, modpackId });
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    openContextMenu(id, e.clientX, e.clientY);
  }, [openContextMenu]);

  const handleActionMenuOpen = useCallback((event: React.MouseEvent<HTMLButtonElement>, id: string) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    openContextMenu(id, Math.max(12, rect.right - 192), rect.bottom + 8, event.currentTarget);
  }, [openContextMenu]);

  const handleActionMenuOpenFromKeyboard = useCallback((anchor: HTMLElement, id: string) => {
    const rect = anchor.getBoundingClientRect();
    openContextMenu(id, Math.max(12, rect.right - 192), rect.bottom + 8, anchor);
  }, [openContextMenu]);

  // Skeleton loader для карточки модпака
  const ModpackCardSkeleton = React.memo(() => (
    <div role="listitem" className="p-5 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 min-h-[200px]">
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
    index: number;
    isSelected: boolean;
    isMenuOpen: boolean;
    onSelect: (id: string) => void;
    onShowDetails: (id: string) => void;
    onOpenActions: (event: React.MouseEvent<HTMLButtonElement>, id: string) => void;
    onOpenActionsFromKeyboard: (anchor: HTMLElement, id: string) => void;
    onContextMenu: (e: React.MouseEvent, id: string) => void;
  }

  const ModpackCard = React.memo<ModpackCardProps>(({
    modpack,
    index,
    isSelected,
    isMenuOpen,
    onSelect,
    onShowDetails,
    onOpenActions,
    onOpenActionsFromKeyboard,
    onContextMenu,
  }) => {
    const { t, getAccentStyles, getAccentHex } = useSettings();
    const iconSrc = useMemo(() => getModpackIcon(modpack), [modpack]);
    const sourceBadge = useMemo(() => getModpackSourceBadge(modpack.metadata?.source), [modpack.metadata?.source]);
    const actionMenuId = `modpack-actions-menu-${modpack.id}`;
    const actionMenuLabel = `${t('modpacks.settings_title') || 'More actions'}: ${modpack.name}`;

    return (
      <div
        className={cn(
          'relative p-5 rounded-xl border-2 transition-all duration-300 ease-out cursor-pointer flex flex-col min-h-[220px]',
          'transform hover:scale-[1.02] hover:shadow-lg',
          'hover:-translate-y-1',
          'animate-fade-in-up',
          'focus-within:ring-2 focus-within:ring-zinc-500 focus-within:ring-offset-2 dark:focus-within:ring-offset-zinc-900',
          isSelected
            ? cn('border-opacity-100 shadow-lg scale-[1.02]', getAccentStyles('border').className)
            : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
        )}
        style={{
          animationDelay: `${index * 50}ms`,
          ...(isSelected
            ? {
              borderColor: getAccentHex(),
              boxShadow: `0 4px 12px ${getAccentHex()}30`,
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

            if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
              event.preventDefault();
              onOpenActionsFromKeyboard(event.currentTarget, modpack.id);
            }
          }}
          className="absolute inset-0 rounded-xl focus:outline-none"
        />

        {/* Icon */}
        <div className="relative z-10 flex items-start gap-4 mb-3">
          <div className="w-20 h-20 flex-shrink-0">
            <LazyImage
              src={iconSrc}
              alt={modpack.name}
              className="w-full h-full rounded-lg object-cover border border-zinc-200 dark:border-zinc-700"
              fallback="/icon.png"
              placeholder={
                <SkeletonLoader variant="rounded" width={80} height={80} />
              }
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white truncate flex-1 min-w-0">
                {modpack.name}
              </h3>
              {sourceBadge}
              {/* Selected Badge */}
              {isSelected && (
                <div
                  className="px-2 py-1 rounded text-xs font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: getAccentHex() }}
                >
                  {t('modpacks.active')}
                </div>
              )}
            </div>
            {modpack.metadata?.version && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {t('modpacks.version')}: {modpack.metadata.version}
              </p>
            )}
            {modpack.metadata?.minecraftVersion && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                MC {modpack.metadata.minecraftVersion}
              </p>
            )}
          </div>
        </div>

        {/* Description */}
        {modpack.metadata?.description && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2 mb-3 flex-shrink-0">
            {modpack.metadata.description}
          </p>
        )}

        {/* Actions - всегда снизу */}
        <div className="relative z-10 flex flex-wrap gap-2 mt-auto pt-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant={isSelected ? 'secondary' : 'primary'}
            size="md"
            onClick={() => {
              if (!isSelected) {
                onSelect(modpack.id);
              }
            }}
            disabled={isSelected}
            className="flex-1 min-w-0 transition-all duration-200"
            style={!isSelected ? getAccentStyles('bg').style : undefined}
          >
            {isSelected ? t('modpacks.selected') : t('modpacks.select')}
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() => onShowDetails(modpack.id)}
            className="shrink-0 transition-all duration-200"
          >
            {t('general.settings')}
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={(event) => onOpenActions(event, modpack.id)}
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            aria-controls={isMenuOpen ? actionMenuId : undefined}
            aria-label={actionMenuLabel}
            className="shrink-0 px-3 transition-all duration-200"
            title={t('modpacks.settings_title') || 'More actions'}
          >
            <MoreHorizontal className="w-4 h-4" />
          </Button>
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
      prevProps.modpack.metadata?.description === nextProps.modpack.metadata?.description &&
      prevProps.modpack.metadata?.source === nextProps.modpack.metadata?.source
    );
  });
  ModpackCard.displayName = 'ModpackCard';


  return (
    <>
      <div
        className={cn(
          "flex-1 flex flex-col p-8 overflow-y-auto transition-all",
          isDragging && "bg-zinc-100/50 dark:bg-zinc-800/50 border-2 border-dashed border-zinc-400 dark:border-zinc-600"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white mb-1">
              {t('modpacks.title')}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
              {t('modpacks.desc')}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button
              variant="secondary"
              onClick={() => setImportShareModalOpen(true)}
              className="w-full sm:w-auto"
              title={t('share.import_title') || 'Импорт по коду'}
            >
              <Download className="w-4 h-4 mr-2" />
              {t('share.import_btn') || 'Импорт'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => onCreateWizard?.()}
              className="w-full sm:w-auto"
            >
              {t('modpacks.create')}
            </Button>
            <Button
              variant="primary"
              onClick={() => onNavigate?.({ type: 'browser' })}
              className={cn("w-full sm:w-auto", getAccentStyles('bg').className)}
              style={getAccentStyles('bg').style}
            >
              {t('modpacks.browser')}
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('modpacks.search_placeholder') || 'Поиск модпаков...'}
            aria-label={t('modpacks.search_placeholder') || 'Search modpacks'}
            className="flex-1"
          />
          <div className="flex gap-2">
            <Select
              value={sortOption}
              onChange={(e) => {
                const nextSortOption = e.target.value;
                if (SORT_OPTIONS.includes(nextSortOption as SortOption)) {
                  setSortOption(nextSortOption as SortOption);
                }
              }}
              aria-label={t('modpacks.sort_name') || 'Sort modpacks'}
              className="w-[140px]"
            >
              <option value="name">{t('modpacks.sort_name') || 'По имени'}</option>
              <option value="created">{t('modpacks.sort_created') || 'По дате создания'}</option>
              <option value="updated">{t('modpacks.sort_updated') || 'По обновлению'}</option>
            </Select>
            <div className="w-px bg-zinc-200 dark:bg-zinc-700 mx-1" />
            <Select
              value={filterMCVersion}
              onChange={(e) => setFilterMCVersion(e.target.value)}
              aria-label={t('modpacks.filter_all_versions') || 'Filter by Minecraft version'}
              className="w-[140px]"
            >
              <option value="all">{t('modpacks.filter_all_versions') || 'Все версии'}</option>
              {availableVersions.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </Select>
            <Select
              value={filterLoader}
              onChange={(e) => setFilterLoader(e.target.value)}
              aria-label={t('modpacks.filter_all_loaders') || 'Filter by modloader'}
              className="w-[140px]"
            >
              <option value="all">{t('modpacks.filter_all_loaders') || 'Все лоадеры'}</option>
              {availableLoaders.map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </Select>
          </div>
        </div>

        {/* Drag & Drop Zone */}
        {isDragging && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-100/90 dark:bg-zinc-800/90 backdrop-blur-sm z-50 border-2 border-dashed border-zinc-400 dark:border-zinc-600 rounded-lg">
            <div className="text-center">
              <p className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
                {t('modpacks.drop_file') || 'Перетащите файл модпака сюда'}
              </p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
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
        ) : filteredModpacks.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-400 py-12 px-4">
            <div className="text-6xl mb-4 opacity-50">📦</div>
            <h3 className="text-xl font-bold text-zinc-700 dark:text-zinc-300 mb-2">
              {searchQuery || filterMCVersion !== 'all' || filterLoader !== 'all'
                ? (t('modpacks.no_results') || 'Ничего не найдено')
                : (t('modpacks.no_modpacks_title') || 'Нет модпаков')}
            </h3>
            <p className="text-sm mb-2 text-center max-w-md">
              {searchQuery || filterMCVersion !== 'all' || filterLoader !== 'all'
                ? (t('modpacks.try_changing_filters') || 'Попробуйте изменить параметры поиска')
                : (t('modpacks.no_modpacks_desc') || 'Начните с выбора модпака из браузера или создайте свой собственный')}
            </p>
            {!searchQuery && filterMCVersion === 'all' && filterLoader === 'all' && (
              <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center">
                {t('modpacks.drag_drop_hint') || 'Или перетащите файл модпака (.mrpack, .zip, .curseforge) в это окно'}
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3 gap-5" role="list" aria-label={t('modpacks.title') || 'Modpacks'}>
            {sortedModpacks.map((modpack, index) => (
              <ModpackCard
                key={modpack.id}
                modpack={modpack}
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
          <div
            ref={contextMenuRef}
            id={`modpack-actions-menu-${contextMenu.modpackId}`}
            role="menu"
            aria-label={`${t('modpacks.settings_title') || 'More actions'}: ${modpacks.find((modpack) => modpack.id === contextMenu.modpackId)?.name || contextMenu.modpackId}`}
            className="fixed z-50 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg py-1 min-w-[150px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              role="menuitem"
              className="w-full px-4 py-2 text-left text-sm text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-700"
              onClick={() => {
                handleSelect(contextMenu!.modpackId);
                closeContextMenu();
              }}
            >
              {t('modpacks.select')}
            </button>
            <button
              type="button"
              role="menuitem"
              className="w-full px-4 py-2 text-left text-sm text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-700"
              onClick={() => {
                // Same as clicking "Play" but from context menu we just select for now or maybe implement Launch later
                // For now, let's just Select + Settings like the card buttons
                handleSelect(contextMenu!.modpackId);
                closeContextMenu();
              }}
            >
              {/* TODO: Implement direct launch action if possible */}
              {t('general.play') || 'Играть'}
            </button>
            <div className="h-px bg-zinc-200 dark:bg-zinc-700 my-1" />
            <button
              type="button"
              role="menuitem"
              className="w-full px-4 py-2 text-left text-sm text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-700"
              onClick={() => {
                onNavigate?.({ type: 'details', modpackId: contextMenu!.modpackId });
                closeContextMenu();
              }}
            >
              {t('general.settings')}
            </button>
            <button
              type="button"
              role="menuitem"
              className="w-full px-4 py-2 text-left text-sm text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center"
              onClick={() => {
                setShareModpackId(contextMenu!.modpackId);
                setShareModalOpen(true);
                closeContextMenu();
              }}
            >
              <Share2 className="w-4 h-4 mr-2" />
              {t('share.context_btn') || 'Поделиться'}
            </button>
            <button
              type="button"
              role="menuitem"
              className="w-full px-4 py-2 text-left text-sm text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-700"
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
              className="w-full px-4 py-2 text-left text-sm text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-700"
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
              className="w-full px-4 py-2 text-left text-sm text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-700"
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
            <div className="h-px bg-zinc-200 dark:bg-zinc-700 my-1" />
            <button
              type="button"
              role="menuitem"
              className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
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
