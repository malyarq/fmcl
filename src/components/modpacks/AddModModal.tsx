import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { useToast } from '../../contexts/ToastContext';
import { useDebounce } from '../../hooks/useDebounce';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { LazyImage } from '../ui/LazyImage';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { DegradedStateView } from '../layout/DegradedStateView';
import { cn } from '../../utils/cn';
import { modsIPC } from '../../services/ipc/modsIPC';
import { modpacksIPC } from '../../services/ipc/modpacksIPC';
import type { ModpackMetadata } from '@shared/types/modpack';
import { MINECRAFT_VERSIONS } from '../../utils/minecraftVersionsList';
import { PackagePlus } from 'lucide-react';
import { sanitizeUiText } from '../../utils/safeUiText';
import { toDisplayErrorMessage } from '../../utils/displayError';

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
type FlowNoticeTone = 'warning' | 'error';
type ModRecoveryStatus = 'install-failure' | 'manifest-failure';

interface ModRecoveryIssue {
  label: string;
  status: ModRecoveryStatus;
}

function getSafeModVersionLabel(version: ModVersion, fallback: string) {
  return sanitizeUiText(
    version.name,
    sanitizeUiText(version.versionNumber, sanitizeUiText(version.versionId, fallback)),
  );
}

function formatRecoveryItems(labels: string[]): string {
  return labels.join(', ');
}

export const AddModModal: React.FC<AddModModalProps> = ({
  modpackId,
  isOpen,
  onClose,
  onAdded,
  defaultMCVersion,
  defaultLoader,
}) => {
  const { t, getAccentStyles, formatNumber, minecraftPath } = useSettings();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [platform, setPlatform] = useState<'curseforge' | 'modrinth'>('modrinth');
  const [searchResults, setSearchResults] = useState<ModSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [checkedMods, setCheckedMods] = useState<Map<string, CheckedEntry>>(new Map());
  const [installing, setInstalling] = useState(false);
  const [modpackMetadata, setModpackMetadata] = useState<ModpackMetadata | null>(null);
  const [filtersReadyFor, setFiltersReadyFor] = useState<string | null>(null);
  const [filterMCVersion, setFilterMCVersion] = useState<string>('');
  const [filterLoader, setFilterLoader] = useState<string>('');
  const [filterSort, setFilterSort] = useState<'popularity' | 'date' | 'alphabetical'>('popularity');
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [flowNotice, setFlowNotice] = useState<{ tone: FlowNoticeTone; message: string } | null>(null);
  const resultsScrollRef = useRef<HTMLDivElement>(null);
  const searchRequestIdRef = useRef(0);
  const metadataRequestIdRef = useRef(0);
  const PAGE_SIZE = 20;
  const filterContextKey = [modpackId, minecraftPath, defaultMCVersion ?? '', defaultLoader ?? ''].join('\0');

  const effectiveLoader = filterLoader || defaultLoader || modpackMetadata?.modLoader?.type || '';
  const effectiveMCVersion = filterMCVersion || defaultMCVersion || modpackMetadata?.minecraftVersion || '';

  const loadModpackMetadataAndConfig = useCallback(async () => {
    const requestId = metadataRequestIdRef.current + 1;
    metadataRequestIdRef.current = requestId;
    setFiltersReadyFor(null);
    try {
      const [metadata, config] = await Promise.all([
        modpacksIPC.getMetadata(modpackId, minecraftPath),
        modpacksIPC.getConfig(modpackId, minecraftPath),
      ]);
      if (requestId !== metadataRequestIdRef.current) return;
      setModpackMetadata(metadata);
      const mcVersion = defaultMCVersion || config?.runtime?.minecraft || metadata?.minecraftVersion || '';
      const loader = defaultLoader || config?.runtime?.modLoader?.type || metadata?.modLoader?.type || '';
      setFilterMCVersion(mcVersion);
      setFilterLoader(loader);
    } catch (error) {
      if (requestId !== metadataRequestIdRef.current) return;
      console.error('Error loading modpack metadata:', error);
      if (defaultMCVersion) setFilterMCVersion(defaultMCVersion);
      if (defaultLoader) setFilterLoader(defaultLoader);
    } finally {
      if (requestId === metadataRequestIdRef.current) {
        setFiltersReadyFor(filterContextKey);
      }
    }
  }, [modpackId, minecraftPath, defaultMCVersion, defaultLoader, filterContextKey]);

  useEffect(() => {
    if (!isOpen) return;
    loadModpackMetadataAndConfig();
  }, [isOpen, loadModpackMetadataAndConfig]);

  const resetTransientState = useCallback(() => {
    metadataRequestIdRef.current += 1;
    setFiltersReadyFor(null);
    setQuery('');
    setSearchResults([]);
    setSearchError(null);
    setCheckedMods(new Map());
    setTotal(0);
    setFlowNotice(null);
    setPlatform('modrinth');
  }, []);

  useEffect(() => {
    if (!isOpen) {
      resetTransientState();
    }
  }, [isOpen, resetTransientState]);

  const debouncedQuery = useDebounce(query, 500);
  const searchErrorDescription =
    t('modpacks.add_mod_search_error_desc') || 'We could not load catalog results right now.';

  const buildModRecoveryNotice = useCallback((params: {
    issues: ModRecoveryIssue[];
    addedCount?: number;
  }): { tone: FlowNoticeTone; message: string } | null => {
    const { issues, addedCount = 0 } = params;

    if (issues.length === 0) {
      return null;
    }

    const grouped = issues.reduce<Record<ModRecoveryStatus, string[]>>((acc, issue) => {
      acc[issue.status].push(issue.label);
      return acc;
    }, {
      'install-failure': [],
      'manifest-failure': [],
    });

    const messageParts: string[] = [];

    if (addedCount > 0) {
      messageParts.push(
        (t('modpacks.add_mod_recovery_partial_intro')
          || 'Added {{added}} mods. The remaining picks stayed selected here so you can retry only the blocked ones.')
          .replace('{{added}}', String(addedCount)),
      );
    }

    if (grouped['install-failure'].length > 0) {
      messageParts.push(
        (t('modpacks.add_mod_recovery_install_failure')
          || 'FMCL could not download or place these mods right now: {{items}}. Retry from this screen or keep browsing.')
          .replace('{{items}}', formatRecoveryItems(grouped['install-failure'])),
      );
    }

    if (grouped['manifest-failure'].length > 0) {
      messageParts.push(
        (t('modpacks.add_mod_recovery_manifest_failure')
          || 'FMCL downloaded these mods but could not write them into this modpack manifest: {{items}}. Retry from this screen before leaving or inspect the manifest if it keeps failing.')
          .replace('{{items}}', formatRecoveryItems(grouped['manifest-failure'])),
      );
    }

    if (messageParts.length === 0) {
      return null;
    }

    return {
      tone: addedCount > 0 ? 'warning' : 'error',
      message: messageParts.join(' '),
    };
  }, [t]);

  const searchMods = useCallback(async (offset: number, append: boolean) => {
    const requestId = searchRequestIdRef.current + 1;
    searchRequestIdRef.current = requestId;

    if (offset === 0) setLoading(true);
    else setLoadingMore(true);
    try {
      if (!append) {
        setSearchError(null);
        setSearchResults([]);
        setTotal(0);
        setCheckedMods(new Map());
        setFlowNotice(null);
      }
      const result = await modsIPC.searchMods({
        platform,
        query: debouncedQuery.trim() || '',
        mcVersion: effectiveMCVersion || undefined,
        loader: effectiveLoader || undefined,
        sort: filterSort,
        offset,
        limit: PAGE_SIZE,
      });
      if (requestId !== searchRequestIdRef.current) {
        return;
      }
      const data = result as { items: ModSearchResult[]; total?: number };
      setSearchResults((prev) => (append ? [...prev, ...(data.items || [])] : (data.items || [])));
      setTotal(data.total ?? 0);
    } catch (error) {
      if (requestId !== searchRequestIdRef.current) {
        return;
      }
      console.error('Error searching mods:', error);
      if (!append) {
        setSearchResults([]);
        setTotal(0);
        setSearchError(
          toDisplayErrorMessage(
            error,
            searchErrorDescription,
          ),
        );
      }
    } finally {
      if (requestId === searchRequestIdRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [debouncedQuery, platform, effectiveMCVersion, effectiveLoader, filterSort, searchErrorDescription]);

  useEffect(() => {
    if (!isOpen || filtersReadyFor !== filterContextKey) return;
    searchMods(0, false);
  }, [isOpen, filtersReadyFor, filterContextKey, debouncedQuery, platform, filterMCVersion, filterLoader, filterSort, searchMods]);

  useEffect(() => {
    setCheckedMods(new Map());
  }, [platform]);

  useEffect(() => {
    setFlowNotice(null);
  }, [platform, filterMCVersion, filterLoader, filterSort, debouncedQuery]);

  const visibleResultKeys = useMemo(
    () => new Set(searchResults.map((mod) => `${mod.platform}:${mod.projectId}`)),
    [searchResults],
  );

  const handleScroll = useCallback(() => {
    const el = resultsScrollRef.current;
    if (!el || loading || loadingMore) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollTop + clientHeight >= scrollHeight - 100) {
      const currentLen = searchResults.length;
      if (currentLen < total) searchMods(currentLen, true);
    }
  }, [loading, loadingMore, searchResults.length, total, searchMods]);

  useEffect(() => {
    const el = resultsScrollRef.current;
    if (!el || loading || loadingMore) return;
    if (searchResults.length === 0 || searchResults.length >= total) return;

    if (el.scrollHeight <= el.clientHeight + 48) {
      void searchMods(searchResults.length, true);
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
        setCheckedMods((prev) => {
          if (prev.get(key) !== 'loading') {
            return prev;
          }

          return new Map(prev).set(key, { mod, version: versionsList[0] });
        });
      } else {
        setCheckedMods((prev) => {
          if (!prev.has(key)) {
            return prev;
          }
          const next = new Map(prev);
          next.delete(key);
          return next;
        });
        toast.error(`${mod.title}: ${t('modpacks.no_versions') || 'Нет доступных версий'}`);
      }
    } catch {
      setCheckedMods((prev) => {
        if (!prev.has(key)) {
          return prev;
        }
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
      toast.error(`${mod.title}: ${t('modpacks.add_mod_error') || 'Ошибка'}`);
    }
  };

  const readyToAdd = Array.from(checkedMods.entries()).flatMap(([key, value]) => {
    if (!visibleResultKeys.has(key) || value === 'loading') {
      return [];
    }

    return [value];
  });
  const hasLoading = Array.from(checkedMods.entries()).some(
    ([key, value]) => visibleResultKeys.has(key) && value === 'loading',
  );
  const activeStateBackground = getAccentStyles('soft-bg');
  const activeStateBorder = getAccentStyles('soft-border');
  const activeStateLabel = getAccentStyles('title');
  const unavailableVersionLabel = t('modpacks.version_unavailable') || 'Version unavailable';

  const handleAddBulk = async () => {
    if (readyToAdd.length === 0) return;
    setInstalling(true);
    setFlowNotice(null);
    let added = 0;
    let failed = 0;
    try {
      const retainedSelections = new Map<string, CheckedEntry>();
      const recoveryIssues: ModRecoveryIssue[] = [];

      for (const { mod, version } of readyToAdd) {
        let installedToInstance = false;
        try {
          await modsIPC.installModFile({
            platform: mod.platform,
            projectId: mod.projectId,
            versionId: version.versionId,
            instanceId: modpackId,
            rootPath: minecraftPath,
          });
          installedToInstance = true;
          await modpacksIPC.addMod(modpackId, {
            platform: mod.platform,
            projectId: mod.platform === 'curseforge' ? Number(mod.projectId) : mod.projectId,
            versionId: mod.platform === 'curseforge' ? Number(version.versionId) : version.versionId,
          }, minecraftPath);
          added++;
        } catch {
          failed++;
          const key = `${mod.platform}:${mod.projectId}`;
          retainedSelections.set(key, { mod, version });
          recoveryIssues.push({
            label: mod.title,
            status: installedToInstance ? 'manifest-failure' : 'install-failure',
          });
        }
      }
      setCheckedMods(retainedSelections);
      if (added > 0 && failed === 0) {
        setCheckedMods(new Map());
        onAdded?.();
        resetTransientState();
        onClose();
        return;
      }

      if (added > 0 && failed > 0) {
        const notice = buildModRecoveryNotice({ issues: recoveryIssues, addedCount: added });
        if (notice) {
          setFlowNotice(notice);
        }
        return;
      }

      if (failed > 0) {
        const notice = buildModRecoveryNotice({ issues: recoveryIssues });
        if (notice) {
          setFlowNotice(notice);
        }
        toast.error(t('modpacks.add_mod_error') || 'Ошибка при добавлении');
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
      closeDisabled={installing}
      title={
        <div className="flex items-center gap-3 flex-wrap min-w-0">
          <PackagePlus className="h-4 w-4 text-secondary" />
          <span className="truncate min-w-0">{t('modpacks.add_mod_title') || 'Add mods'}</span>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setPlatform('curseforge');
                setCheckedMods(new Map());
              }}
              disabled
              className={cn(
                'rounded-lg border border-border/60 bg-background/72 px-3 py-1.5 text-xs font-medium text-muted transition-colors',
                'cursor-not-allowed'
              )}
              title={t('modpacks.curseforge_wip') || 'CurseForge в разработке'}
            >
              {t('modpacks.platform_curseforge')} ({t('modpacks.coming_soon_short') || 'Soon'})
            </button>
            <button
              type="button"
              onClick={() => {
                setPlatform('modrinth');
                setCheckedMods(new Map());
              }}
              data-state={platform === 'modrinth' ? 'active' : 'inactive'}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                platform === 'modrinth'
                  ? cn(
                    'border-border bg-card/90 text-foreground',
                    activeStateBackground.className,
                    activeStateBorder.className,
                    activeStateLabel.className,
                  )
                  : 'border-border/60 bg-background/72 text-foreground hover:bg-card'
              )}
              style={platform === 'modrinth' ? {
                ...activeStateBackground.style,
                ...activeStateBorder.style,
                ...activeStateLabel.style,
              } : undefined}
            >
              {t('modpacks.platform_modrinth')}
            </button>
          </div>
        </div>
      }
      className="max-w-3xl"
      bodyClassName="flex min-h-0 flex-1 flex-col"
      bodyProps={{ style: { overflow: 'hidden' } }}
    >
      <div className="flex h-full min-h-0 flex-col gap-4">
        <div className="surface-muted flex flex-wrap items-center gap-4 p-4 text-sm text-secondary">
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-[0.18em] text-muted">
              {modpackMetadata?.name || t('modpacks.title') || 'Modpacks'}
            </p>
            <p className="mt-1 text-sm text-foreground">
              {effectiveMCVersion || t('general.unknown') || 'Unknown'} • {effectiveLoader || t('modpacks.loader_vanilla') || 'Vanilla'}
            </p>
          </div>
          {total > 0 && (
            <p className="text-xs text-secondary">
              {formatNumber(total)} {t('modpacks.results') || 'results'}
            </p>
          )}
        </div>

        {/* Filters */}
        <div className="surface-card flex gap-2 flex-wrap p-4">
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

        <div
          ref={resultsScrollRef}
          className="min-h-[14rem] flex-1 overflow-y-auto pr-1"
          onScroll={handleScroll}
          data-testid="add-mod-modal-results-scroll"
        >
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <LoadingSpinner size="lg" />
              <p className="text-sm text-secondary">
                {t('modpacks.loading')}
              </p>
            </div>
          )}

          {!loading && !searchError && searchResults.length > 0 && (
            <div
              className="space-y-2"
              data-testid="add-mod-modal-results"
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
                    data-state={isChecked ? 'active' : 'inactive'}
                    className={cn(
                      'surface-card flex items-start gap-3 p-3 transition-colors',
                      isChecked
                        ? cn(
                          'border-border bg-card/90',
                          activeStateBackground.className,
                          activeStateBorder.className,
                        )
                        : 'hover:border-border-active hover:bg-card'
                    )}
                    style={isChecked ? {
                      ...activeStateBackground.style,
                      ...activeStateBorder.style,
                    } : undefined}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isLoading || installing}
                      onChange={(e) => handleCheckChange(mod, e.target.checked)}
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        'mt-1 h-4 w-4 rounded border-border/70 bg-background/84',
                        getAccentStyles('accent').className,
                      )}
                      style={getAccentStyles('accent').style}
                    />
                    <LazyImage
                      src={mod.iconUrl}
                      alt={mod.title}
                      className="h-12 w-12 shrink-0 rounded-xl border border-border/70 object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="truncate font-medium text-foreground">
                        {mod.title}
                      </h4>
                      {version && (
                        <p className="mt-0.5 text-xs text-secondary">
                          {getSafeModVersionLabel(version, unavailableVersionLabel)} {version.mcVersions[0] && `(${version.mcVersions[0]})`}
                        </p>
                      )}
                      {mod.description && !version && (
                        <p className="mt-1 line-clamp-2 text-xs text-secondary">
                          {mod.description}
                        </p>
                      )}
                      {mod.downloads !== undefined && (
                        <p className="mt-1 text-xs text-secondary">
                          {t('modpacks.downloads')}: {formatNumber(mod.downloads)}
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
              {!loadingMore && searchResults.length > 0 && searchResults.length < total && (
                <p className="py-2 text-center text-xs text-secondary">
                  {t('modpacks.scroll_for_more') || 'Прокрутите вниз для загрузки'}
                </p>
              )}
            </div>
          )}

          {!loading && searchError ? (
            <DegradedStateView
              variant="error"
              layout="inline"
              label={t('degraded.error_label')}
              title={t('modpacks.add_mod_search_error_title') || 'Unable to search right now'}
              description={searchError}
              footer={(
                <Button variant="secondary" size="sm" onClick={() => void searchMods(0, false)}>
                  {t('modpacks.search_btn')}
                </Button>
              )}
            />
          ) : null}

          {!loading && !searchError && searchResults.length === 0 && (
            <DegradedStateView
              variant={query.trim() ? 'zero-results' : 'empty'}
              layout="inline"
              label={t(query.trim() ? 'degraded.zero_results_label' : 'degraded.empty_label')}
              title={
                query.trim()
                  ? t('modpacks.no_mod_results') || 'No mods found for the current filters'
                  : t('modpacks.add_mod_empty_title') || 'Search the catalog'
              }
              description={
                query.trim()
                  ? t('modpacks.mods_filter_hint') || 'Try a broader query or adjust the current filters.'
                  : t('modpacks.add_mod_empty_desc') || 'Use search and filters to find loader-compatible files for this modpack.'
              }
            />
          )}
        </div>

        <div
          className="surface-inline shrink-0 space-y-3 p-4"
          data-testid="add-mod-modal-actions"
        >
          {flowNotice && (
            <div
              className={cn(
                'rounded-2xl border px-4 py-3 text-sm',
                flowNotice.tone === 'warning'
                  ? 'border-amber-500/35 bg-amber-500/12 text-foreground'
                  : 'border-red-500/35 bg-red-500/12 text-foreground',
              )}
              data-testid="add-mod-modal-notice"
              data-tone={flowNotice.tone}
            >
              {flowNotice.message}
            </div>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={onClose}
              variant="secondary"
              disabled={installing}
              className="w-full sm:flex-1"
            >
              {t('general.cancel')}
            </Button>
            <Button
              onClick={handleAddBulk}
              disabled={readyToAdd.length === 0 || installing || hasLoading}
              className={cn("w-full text-white sm:flex-1", getAccentStyles('bg').className)}
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
      </div>
    </Modal>
  );
};
