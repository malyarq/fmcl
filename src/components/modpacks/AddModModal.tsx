import React, { useState, useEffect, useCallback } from 'react';
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

export const AddModModal: React.FC<AddModModalProps> = ({
  modpackId,
  isOpen,
  onClose,
  onAdded,
}) => {
  const { t, getAccentStyles, minecraftPath } = useSettings();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [platform, setPlatform] = useState<'curseforge' | 'modrinth'>('modrinth');
  const [searchResults, setSearchResults] = useState<ModSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMod, setSelectedMod] = useState<ModSearchResult | null>(null);
  const [versions, setVersions] = useState<ModVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<ModVersion | null>(null);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [modpackMetadata, setModpackMetadata] = useState<ModpackMetadata | null>(null);
  const [filterMCVersion, setFilterMCVersion] = useState<string>('');
  const [filterLoader, setFilterLoader] = useState<string>('');

  const loadModpackMetadata = useCallback(async () => {
    try {
      const metadata = await modpacksIPC.getMetadata(modpackId, minecraftPath);
      setModpackMetadata(metadata);
      // Set default filters from modpack metadata
      if (metadata?.minecraftVersion) {
        setFilterMCVersion(metadata.minecraftVersion);
      }
      if (metadata?.modLoader?.type) {
        setFilterLoader(metadata.modLoader.type);
      }
    } catch (error) {
      console.error('Error loading modpack metadata:', error);
      // If modpack doesn't exist or is default, continue without metadata
    }
  }, [modpackId, minecraftPath]);

  useEffect(() => {
    if (!isOpen) return;
    loadModpackMetadata();
  }, [isOpen, loadModpackMetadata]);

  const searchMods = useCallback(async () => {
    setLoading(true);
    try {
      const mcVersion = filterMCVersion || modpackMetadata?.minecraftVersion || undefined;
      const loader = filterLoader || modpackMetadata?.modLoader?.type || undefined;
      
      const result = await modsIPC.searchMods({
        platform,
        query: query.trim() || '', // Allow empty query to show all results
        mcVersion,
        loader,
        limit: 20,
      });
      
      // Type assertion needed because the API returns unknown
      const searchResult = result as { items: ModSearchResult[] };
      setSearchResults(searchResult.items || []);
    } catch (error) {
      console.error('Error searching mods:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, platform, modpackMetadata, filterMCVersion, filterLoader]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchMods();
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [query, platform, filterMCVersion, filterLoader, searchMods]);

  const handleModSelect = async (mod: ModSearchResult) => {
    setSelectedMod(mod);
    setLoadingVersions(true);
    try {
      const mcVersion = filterMCVersion || modpackMetadata?.minecraftVersion || undefined;
      const loader = filterLoader || modpackMetadata?.modLoader?.type || undefined;
      
      const versionsResult = await modsIPC.getModVersions({
        platform: mod.platform,
        projectId: mod.projectId,
        mcVersion,
        loader,
      });
      
      // Type assertion needed
      const versionsList = versionsResult as ModVersion[];
      setVersions(versionsList);
      if (versionsList.length > 0) {
        setSelectedVersion(versionsList[0]);
      }
    } catch (error) {
      console.error('Error loading mod versions:', error);
      setVersions([]);
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleAdd = async () => {
    if (!selectedMod || !selectedVersion) return;

    setInstalling(true);
    try {
      // Install mod file
      await modsIPC.installModFile({
        platform: selectedMod.platform,
        projectId: selectedMod.projectId,
        versionId: selectedVersion.versionId,
        instanceId: modpackId,
        rootPath: minecraftPath,
      });

      // Add mod to modpack manifest
      await modpacksIPC.addMod(modpackId, {
        platform: selectedMod.platform,
        projectId: selectedMod.platform === 'curseforge' ? Number(selectedMod.projectId) : selectedMod.projectId,
        versionId: selectedMod.platform === 'curseforge' ? Number(selectedVersion.versionId) : selectedVersion.versionId,
      }, minecraftPath);

      onAdded?.();
      onClose();
      // Reset state
      setSelectedMod(null);
      setSelectedVersion(null);
      setVersions([]);
      setQuery('');
    } catch (error) {
      console.error('Error adding mod:', error);
      toast.error(t('modpacks.add_mod_error') || 'Ошибка при добавлении мода');
    } finally {
      setInstalling(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('modpacks.add_mod') || 'Добавить мод'}
      className="max-w-3xl"
    >
      <div className="space-y-4">
        {/* Platform Selection */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              setPlatform('curseforge');
              setSelectedMod(null);
              setVersions([]);
            }}
            disabled
            className={cn(
              "px-4 py-2 rounded-lg font-medium transition-colors",
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
              setSelectedMod(null);
              setVersions([]);
            }}
            className={cn(
              "px-4 py-2 rounded-lg font-medium transition-colors",
              platform === 'modrinth'
                ? cn("text-white", getAccentStyles('bg').className)
                : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600"
            )}
            style={platform === 'modrinth' ? getAccentStyles('bg').style : undefined}
          >
            {t('modpacks.platform_modrinth')}
          </button>
        </div>

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

        {!loading && !selectedMod && searchResults.length > 0 && (
          <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-2">
            {searchResults.map((mod) => (
              <div
                key={mod.projectId}
                onClick={() => handleModSelect(mod)}
                className="p-3 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900/50 cursor-pointer transition-colors"
              >
                <div className="flex gap-3">
                  {mod.iconUrl && (
                    <img
                      src={mod.iconUrl}
                      alt={mod.title}
                      className="w-12 h-12 rounded object-cover"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-zinc-900 dark:text-white truncate">
                      {mod.title}
                    </h4>
                    {mod.description && (
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
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Selected Mod and Version Selection */}
        {selectedMod && (
          <div className="space-y-4">
            <div className="p-4 bg-zinc-50 dark:bg-zinc-900/40 rounded-lg border border-zinc-200 dark:border-zinc-700">
              <div className="flex gap-3">
                {selectedMod.iconUrl && (
                  <img
                    src={selectedMod.iconUrl}
                    alt={selectedMod.title}
                    className="w-16 h-16 rounded object-cover"
                  />
                )}
                <div className="flex-1">
                  <h4 className="font-bold text-zinc-900 dark:text-white">{selectedMod.title}</h4>
                  {selectedMod.description && (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                      {selectedMod.description}
                    </p>
                  )}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSelectedMod(null);
                    setVersions([]);
                    setSelectedVersion(null);
                  }}
                >
                  {t('general.cancel')}
                </Button>
              </div>
            </div>

            {loadingVersions ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <LoadingSpinner size="md" />
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {t('modpacks.loading_versions') || 'Загрузка версий...'}
                </p>
              </div>
            ) : versions.length > 0 ? (
              <div>
                <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-2">
                  {t('modpacks.select_version')}
                </label>
                <Select
                  value={selectedVersion?.versionId || ''}
                  onChange={(e) => {
                    const version = versions.find((v) => v.versionId === e.target.value);
                    setSelectedVersion(version || null);
                  }}
                  disabled={installing}
                >
                  {versions.map((version) => (
                    <option key={version.versionId} value={version.versionId}>
                      {version.name} {version.mcVersions.length > 0 && `(${version.mcVersions[0]})`}
                    </option>
                  ))}
                </Select>
              </div>
            ) : (
              <div className="text-center py-4 text-zinc-500 dark:text-zinc-400">
                {t('modpacks.no_versions') || 'Нет доступных версий'}
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
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
            onClick={handleAdd}
            disabled={!selectedMod || !selectedVersion || installing}
            className={cn("flex-1 text-white", getAccentStyles('bg').className)}
            style={getAccentStyles('bg').style}
            isLoading={installing}
          >
            {installing ? t('modpacks.installing') : t('modpacks.add') || 'Добавить'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
