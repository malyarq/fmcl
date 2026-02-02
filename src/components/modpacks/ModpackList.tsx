import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { useModpackListContext } from '../../contexts/ModpackContext';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { Button } from '../ui/Button';
import { SkeletonLoader } from '../ui/SkeletonLoader';
import { LazyImage } from '../ui/LazyImage';
import { modpacksIPC } from '../../services/ipc/modpacksIPC';
import type { ModpackMetadata } from '@shared/types/modpack';
import { cn } from '../../utils/cn';

interface ModpackListItemWithMetadata {
  id: string;
  name: string;
  path: string;
  selected: boolean;
  metadata?: ModpackMetadata;
}

// Uses ModpackListContext — only updates when modpacks/selectedId change, not when config changes (downloads).
function useModpackListValues() {
  const { modpacks, selectedId, select, remove, refresh } = useModpackListContext();
  const modpacksKey = useMemo(() => modpacks.map(m => m.id).sort().join(','), [modpacks]);
  return useMemo(() => ({
    modpacks,
    selectedId,
    select,
    remove,
    refresh,
    modpacksKey,
  }), [modpacks, selectedId, select, remove, refresh, modpacksKey]);
}

// Internal component that doesn't re-render when context config changes
const ModpackListComponentInternal: React.FC<{
  contextModpacks: ReturnType<typeof useModpackListValues>['modpacks'];
  selectedId: string;
  select: ReturnType<typeof useModpackListValues>['select'];
  remove: ReturnType<typeof useModpackListValues>['remove'];
  refresh: ReturnType<typeof useModpackListValues>['refresh'];
  modpacksKey: string;
  onNavigate?: (view: { type: 'browser' } | { type: 'details'; modpackId: string }) => void;
  onCreateWizard?: () => void;
}> = ({ contextModpacks: _contextModpacks, selectedId, select, remove, refresh, modpacksKey, onNavigate, onCreateWizard }) => {
  const { t, getAccentStyles, minecraftPath } = useSettings();
  const toast = useToast();
  const confirm = useConfirm();
  const [modpacks, setModpacks] = useState<ModpackListItemWithMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; modpackId: string } | null>(null);

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

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    if (contextMenu) {
      window.addEventListener('click', handleClickOutside);
      return () => window.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu]);

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

  const handleContextMenu = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, modpackId: id });
  }, []);

  // Skeleton loader для карточки модпака
  const ModpackCardSkeleton = React.memo(() => (
    <div className="p-5 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 min-h-[200px]">
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
    canDelete: boolean; // Whether delete button should be shown
    onSelect: (id: string) => void;
    onDelete: (id: string, name: string) => void;
    onShowDetails: (id: string) => void;
    onContextMenu: (e: React.MouseEvent, id: string) => void;
  }

  const ModpackCard = React.memo<ModpackCardProps>(({
    modpack,
    index,
    isSelected,
    canDelete,
    onSelect,
    onDelete,
    onShowDetails,
    onContextMenu,
  }) => {
    const { t, getAccentStyles, getAccentHex } = useSettings();
    const iconSrc = useMemo(() => getModpackIcon(modpack), [modpack]);
    const sourceBadge = useMemo(() => getModpackSourceBadge(modpack.metadata?.source), [modpack.metadata?.source]);

    return (
      <div
        className={cn(
          'relative p-5 rounded-xl border-2 transition-all duration-300 ease-out cursor-pointer flex flex-col min-h-[220px]',
          'transform hover:scale-[1.02] hover:shadow-lg',
          'hover:-translate-y-1',
          'animate-fade-in-up',
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
        onClick={() => onSelect(modpack.id)}
        onContextMenu={(e) => onContextMenu(e, modpack.id)}
      >
        {/* Icon */}
        <div className="flex items-start gap-4 mb-3">
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
        <div className="flex flex-wrap gap-2 mt-auto pt-1" onClick={(e) => e.stopPropagation()}>
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
          {canDelete && (
            <Button
              variant="danger"
              size="md"
              onClick={() => onDelete(modpack.id, modpack.name)}
              className="shrink-0 transition-all duration-200"
            >
              {t('modpacks.delete')}
            </Button>
          )}
        </div>
      </div>
    );
  }, (prevProps, nextProps) => {
    // Custom comparison function for React.memo
    return (
      prevProps.modpack.id === nextProps.modpack.id &&
      prevProps.modpack.selected === nextProps.modpack.selected &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.canDelete === nextProps.canDelete &&
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, index) => (
              <ModpackCardSkeleton key={index} />
            ))}
          </div>
        ) : modpacks.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-400 py-12 px-4">
            <div className="text-6xl mb-4 opacity-50">📦</div>
            <h3 className="text-xl font-bold text-zinc-700 dark:text-zinc-300 mb-2">
              {t('modpacks.no_modpacks_title') || 'Нет модпаков'}
            </h3>
            <p className="text-sm mb-2 text-center max-w-md">
              {t('modpacks.no_modpacks_desc') || 'Начните с выбора модпака из браузера или создайте свой собственный'}
            </p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center">
              {t('modpacks.drag_drop_hint') || 'Или перетащите файл модпака (.mrpack, .zip, .curseforge) в это окно'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3 gap-5">
            {modpacks.map((modpack, index) => (
              <ModpackCard
                key={modpack.id}
                modpack={modpack}
                index={index}
                isSelected={modpack.id === selectedId}
                canDelete={true}
                onSelect={handleSelect}
                onDelete={handleDelete}
                onShowDetails={(id) => onNavigate?.({ type: 'details', modpackId: id })}
                onContextMenu={handleContextMenu}
              />
            ))}
          </div>
        )}
      </div>

      
      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg py-1 min-w-[150px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full px-4 py-2 text-left text-sm text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-700"
            onClick={() => {
              handleSelect(contextMenu.modpackId);
              setContextMenu(null);
            }}
          >
            {t('modpacks.select')}
          </button>
          <button
            className="w-full px-4 py-2 text-left text-sm text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-700"
            onClick={() => {
              onNavigate?.({ type: 'details', modpackId: contextMenu.modpackId });
              setContextMenu(null);
            }}
          >
            {t('general.settings')}
          </button>
          <button
            className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
            onClick={() => {
              const modpack = modpacks.find((m) => m.id === contextMenu.modpackId);
              if (modpack) {
                handleDelete(contextMenu.modpackId, modpack.name);
              }
              setContextMenu(null);
            }}
          >
            {t('modpacks.delete')}
          </button>
        </div>
      )}
    </>
  );
};

// Memoize internal component to prevent re-renders when props haven't changed
// Only re-render if modpacks list or selectedId actually changed
// Functions are compared by reference - if they're stable, this will work
const MemoizedModpackListInternal = React.memo(ModpackListComponentInternal);

// Wrapper component that extracts values from context
const ModpackListComponent: React.FC<{
  onNavigate?: (view: { type: 'browser' } | { type: 'details'; modpackId: string }) => void;
  onCreateWizard?: () => void;
}> = ({ onNavigate, onCreateWizard }) => {
  const values = useModpackListValues();

  return <MemoizedModpackListInternal
    contextModpacks={values.modpacks}
    selectedId={values.selectedId}
    select={values.select}
    remove={values.remove}
    refresh={values.refresh}
    modpacksKey={values.modpacksKey}
    onNavigate={onNavigate}
    onCreateWizard={onCreateWizard}
  />;
};

export const ModpackList = ModpackListComponent;
