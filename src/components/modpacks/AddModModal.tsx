import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { useToast } from '../../contexts/ToastContext';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { cn } from '../../utils/cn';
import { modsIPC } from '../../services/ipc/modsIPC';
import { modpacksIPC } from '../../services/ipc/modpacksIPC';
import type { ModpackMetadata } from '@shared/types/modpack';
import { MINECRAFT_VERSIONS } from '../../utils/minecraftVersionsList';

interface AddModModalProps {
  modpackId: string;
  isOpen: boolean;
  onClose: () => void;
  onAdded?: () => void;
  defaultMCVersion?: string;
  defaultLoader?: string;
}

interface ModSearchResult {
  platform: 'curseforge' | 'modrinth';
  projectId: string;
  slug?: string;
  title: string;
  description?: string;
  iconUrl?: string;
  downloads?: number;
}

interface ModVersion {
  platform: 'curseforge' | 'modrinth';
  versionId: string;
  name: string;
  versionNumber?: string;
  mcVersions: string[];
  loaders: string[];
}

type CheckedEntry = { mod: ModSearchResult; version: ModVersion } | 'loading';

export const AddModModal: React.FC<AddModModalProps> = ({
  modpackId,
  isOpen,
  onClose,
  onAdded,
  defaultMCVersion,
  defaultLoader,
}) => {
  const { t, getAccentStyles, minecraftPath } = useSettings();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [platform, setPlatform] = useState<'curseforge' | 'modrinth'>('modrinth');
  const [searchResults, setSearchResults] = useState<ModSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkedMods, setCheckedMods] = useState<Map<string, CheckedEntry>>(new Map());
  const [installing, setInstalling] = useState(false);
  const [modpackMetadata, setModpackMetadata] = useState<ModpackMetadata | null>(null);
  const [filterMCVersion, setFilterMCVersion] = useState<string>('');
  const [filterLoader, setFilterLoader] = useState<string>('');
  const [filterSort, setFilterSort] = useState<'popularity' | 'date' | 'alphabetical'>('popularity');
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const resultsScrollRef = useRef<HTMLDivElement>(null);
  const PAGE_SIZE = 20;

  const effectiveLoader = filterLoader || defaultLoader || modpackMetadata?.modLoader?.type || '';
  const effectiveMCVersion = filterMCVersion || defaultMCVersion || modpackMetadata?.minecraftVersion || '';

  const loadModpackMetadataAndConfig = useCallback(async () => {
    try {
      const [metadata, config] = await Promise.all([
        modpacksIPC.getMetadata(modpackId, minecraftPath),
        modpacksIPC.getConfig(modpackId, minecraftPath),
      ]);
      setModpackMetadata(metadata);
      const mcVersion = defaultMCVersion || metadata?.minecraftVersion || config?.runtime?.minecraft || '';
      const loader = defaultLoader || config?.runtime?.modLoader?.type || metadata?.modLoader?.type || '';
      setFilterMCVersion(mcVersion);
      setFilterLoader(loader);
    } catch (error) {
      console.error('Error loading modpack metadata:', error);
      if (defaultMCVersion) setFilterMCVersion(defaultMCVersion);
      if (defaultLoader) setFilterLoader(defaultLoader);
    }
  }, [modpackId, minecraftPath, defaultMCVersion, defaultLoader]);

  useEffect(() => {
    if (!isOpen) return;
    loadModpackMetadataAndConfig();
  }, [isOpen, loadModpackMetadataAndConfig]);

  const searchMods = useCallback(async (offset: number, append: boolean) => {
    if (offset === 0) setLoading(true);
    else setLoadingMore(true);
    try {
      const result = await modsIPC.searchMods({
        platform,
        query: query.trim() || '',
        mcVersion: effectiveMCVersion || undefined,
        loader: effectiveLoader || undefined,
        sort: filterSort,
        offset,
        limit: PAGE_SIZE,
      });
      const data = result as { items: ModSearchResult[]; total?: number };
      setSearchResults((prev) => (append ? [...prev, ...(data.items || [])] : (data.items || [])));
      setTotal(data.total ?? 0);
    } catch (error) {
      console.error('Error searching mods:', error);
      if (!append) setSearchResults([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [query, platform, effectiveMCVersion, effectiveLoader, filterSort]);

  useEffect(() => {
    if (!isOpen) return;
    const timeoutId = setTimeout(() => {
      searchMods(0, false);
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [isOpen, query, platform, filterMCVersion, filterLoader, filterSort, searchMods]);

  useEffect(() => {
    setCheckedMods(new Map());
  }, [platform]);

  const handleScroll = useCallback(() => {
    const el = resultsScrollRef.current;
    if (!el || loading || loadingMore) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollTop + clientHeight >= scrollHeight - 100) {
      const currentLen = searchResults.length;
      if (currentLen < total) searchMods(currentLen, true);
    }
  }, [loading, loadingMore, searchResults.length, total, searchMods]);

  const handleCheckChange = async (mod: ModSearchResult, checked: boolean) => {
    const key = `${mod.platform}:${mod.projectId}`;
    if (!checked) {
      setCheckedMods((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
      return;
    }
    setCheckedMods((prev) => new Map(prev).set(key, 'loading'));
    try {
      const mcVersion = filterMCVersion || defaultMCVersion || modpackMetadata?.minecraftVersion || undefined;
      const loader = filterLoader || defaultLoader || modpackMetadata?.modLoader?.type || undefined;
      const versionsResult = await modsIPC.getModVersions({
        platform: mod.platform,
        projectId: mod.projectId,
        mcVersion,
        loader,
      });
      const versionsList = versionsResult as ModVersion[];
      if (versionsList.length > 0) {
        setCheckedMods((prev) => new Map(prev).set(key, { mod, version: versionsList[0] }));
      } else {
        setCheckedMods((prev) => {
          const next = new Map(prev);
          next.delete(key);
          return next;
        });
        toast.error(`${mod.title}: ${t('modpacks.no_versions') || 'Нет доступных версий'}`);
      }
    } catch {
      setCheckedMods((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
      toast.error(`${mod.title}: ${t('modpacks.add_mod_error') || 'Ошибка'}`);
    }
  };

  const readyToAdd = Array.from(checkedMods.values()).filter((v): v is { mod: ModSearchResult; version: ModVersion } => v !== 'loading');
  const hasLoading = Array.from(checkedMods.values()).some((v) => v === 'loading');

  const handleAddBulk = async () => {
    if (readyToAdd.length === 0) return;
    setInstalling(true);
    let added = 0;
    try {
      for (const { mod, version } of readyToAdd) {
        try {
          await modsIPC.installModFile({
            platform: mod.platform,
            projectId: mod.projectId,
            versionId: version.versionId,
            instanceId: modpackId,
            rootPath: minecraftPath,
          });
          await modpacksIPC.addMod(modpackId, {
            platform: mod.platform,
            projectId: mod.platform === 'curseforge' ? Number(mod.projectId) : mod.projectId,
            versionId: mod.platform === 'curseforge' ? Number(version.versionId) : version.versionId,
          }, minecraftPath);
          added++;
        } catch {
          toast.error(`${mod.title}: ${t('modpacks.add_mod_error') || 'Ошибка'}`);
        }
      }
      if (added > 0) {
        onAdded?.();
        onClose();
        setCheckedMods(new Map());
        setQuery('');
      }
    } finally {
      setInstalling(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-3 flex-wrap min-w-0">
          <span className="truncate min-w-0">{t('modpacks.add_mod') || 'Добавить мод'}</span>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => {
                setPlatform('curseforge');
                setCheckedMods(new Map());
              }}
              disabled
              className={cn(
                "px-3 py-1.5 rounded-lg font-medium transition-colors text-xs",
                "bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-500",
                "cursor-not-allowed opacity-60"
              )}
              title={t('modpacks.curseforge_wip') || 'CurseForge в разработке'}
            >
              {t('modpacks.platform_curseforge')} (WIP)
            </button>
            <button
              onClick={() => {
                setPlatform('modrinth');
                setCheckedMods(new Map());
              }}
              className={cn(
                "px-3 py-1.5 rounded-lg font-medium transition-colors text-xs",
                platform === 'modrinth'
                  ? cn("text-white", getAccentStyles('bg').className)
                  : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600"
              )}
              style={platform === 'modrinth' ? getAccentStyles('bg').style : undefined}
            >
              {t('modpacks.platform_modrinth')}
            </button>
          </div>
        </div>
      }
      className="max-w-3xl"
    >
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <Select
            value={filterMCVersion}
            onChange={(e) => setFilterMCVersion(e.target.value)}
            className="flex-1 min-w-[150px]"
          >
            <option value="">{t('modpacks.filter_all') || 'Все версии MC'}</option>
            {MINECRAFT_VERSIONS.filter(v => v.type === 'release').map((v) => (
              <option key={v.id} value={v.id}>
                {v.id}
              </option>
            ))}
          </Select>
          
          <Select
            value={filterLoader}
            onChange={(e) => setFilterLoader(e.target.value)}
            className="flex-1 min-w-[150px]"
          >
            <option value="">{t('modpacks.filter_all_loaders') || 'Все модлоадеры'}</option>
            <option value="forge">Forge</option>
            <option value="fabric">Fabric</option>
            <option value="neoforge">NeoForge</option>
          </Select>
          <Select
            value={filterSort}
            onChange={(e) => setFilterSort(e.target.value as 'popularity' | 'date' | 'alphabetical')}
            className="flex-1 min-w-[150px]"
          >
            <option value="popularity">{t('modpacks.sort_popularity') || 'Популярность'}</option>
            <option value="date">{t('modpacks.sort_date') || 'Дата'}</option>
            <option value="alphabetical">{t('modpacks.sort_alphabetical') || 'По алфавиту'}</option>
          </Select>
        </div>

        {/* Search */}
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('modpacks.search_mod_placeholder') || 'Поиск модов...'}
          className="w-full"
        />

        {/* Search Results */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <LoadingSpinner size="lg" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {t('modpacks.loading')}
            </p>
          </div>
        )}

        {!loading && searchResults.length > 0 && (
          <div
            ref={resultsScrollRef}
            className="max-h-64 overflow-y-auto custom-scrollbar space-y-2"
            onScroll={handleScroll}
          >
            {searchResults.map((mod) => {
              const key = `${mod.platform}:${mod.projectId}`;
              const entry = checkedMods.get(key);
              const isChecked = entry !== undefined;
              const isLoading = entry === 'loading';
              const version = entry !== 'loading' && entry ? entry.version : null;
              return (
                <div
                  key={key}
                  className={cn(
                    'p-3 border rounded-lg transition-colors flex gap-3 items-start',
                    isChecked
                      ? 'border-zinc-400 dark:border-zinc-500 bg-zinc-50 dark:bg-zinc-900/60'
                      : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900/50'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={isLoading || installing}
                    onChange={(e) => handleCheckChange(mod, e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1 w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 focus:ring-2 focus:ring-zinc-500"
                  />
                  {mod.iconUrl && (
                    <img
                      src={mod.iconUrl}
                      alt={mod.title}
                      className="w-12 h-12 rounded object-cover shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-zinc-900 dark:text-white truncate">
                      {mod.title}
                    </h4>
                    {version && (
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                        {version.name} {version.mcVersions[0] && `(${version.mcVersions[0]})`}
                      </p>
                    )}
                    {mod.description && !version && (
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 mt-1">
                        {mod.description}
                      </p>
                    )}
                    {mod.downloads !== undefined && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                        {t('modpacks.downloads')}: {mod.downloads.toLocaleString()}
                      </p>
                    )}
                  </div>
                  {isLoading && <LoadingSpinner size="sm" className="shrink-0" />}
                </div>
              );
            })}
            {loadingMore && (
              <div className="flex justify-center py-4">
                <LoadingSpinner size="md" />
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-700">
          <Button
            onClick={onClose}
            variant="secondary"
            disabled={installing}
            className="flex-1"
          >
            {t('general.cancel')}
          </Button>
          <Button
            onClick={handleAddBulk}
            disabled={readyToAdd.length === 0 || installing || hasLoading}
            className={cn("flex-1 text-white", getAccentStyles('bg').className)}
            style={getAccentStyles('bg').style}
            isLoading={installing}
          >
            {installing
              ? t('modpacks.installing')
              : readyToAdd.length > 0
                ? (t('modpacks.add_selected') || 'Добавить выбранные') + ` (${readyToAdd.length})`
                : t('modpacks.add') || 'Добавить'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
