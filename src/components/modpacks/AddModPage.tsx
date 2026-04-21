import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { ResourcePackAcquisitionResult } from '@shared/contracts/resourcePacks';
import type { ShaderPackAcquisitionResult } from '@shared/contracts/shaders';
import { useSettings } from '../../contexts/SettingsContext';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Breadcrumbs } from '../ui/Breadcrumbs';
import { LazyImage } from '../ui/LazyImage';
import { DegradedStateView } from '../layout/DegradedStateView';
import { cn } from '../../utils/cn';
import { isGuidedContentInstallResult, modsIPC, type GuidedContentInstallIssueStatus } from '../../services/ipc/modsIPC';
import { modpacksIPC } from '../../services/ipc/modpacksIPC';
import { resourcePacksIPC } from '../../services/ipc/resourcePacksIPC';
import { shadersIPC } from '../../services/ipc/shadersIPC';
import { MINECRAFT_VERSIONS } from '../../utils/minecraftVersionsList';
import type { ModpackMetadata } from '@shared/types/modpack';
import type { ModpackConfig } from '../../contexts/instances/types';
import { sanitizeUiText } from '../../utils/safeUiText';
import { toDisplayErrorMessage } from '../../utils/displayError';
import { useModSupportedVersions } from '../../features/launcher/hooks/useModSupportedVersions';
import {
  buildModpackRuntimeSummary,
  getModpackRuntimeContextLabel,
  getModpackShaderCapabilityDescription,
  getModpackShaderCapabilityLabel,
  getModpackShaderCapabilityTone,
} from '../../features/modpacks/hooks/useModpackRuntimeSummary';

interface AddModPageProps {
  modpackId: string;
  onBack: () => void;
  /** Type of content to search/install. Defaults to 'mod'. */
  contentType?: 'mod' | 'resourcepack' | 'shader';
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
type LocalImportResult = ResourcePackAcquisitionResult | ShaderPackAcquisitionResult;
type GuidedContentType = 'resourcepack' | 'shader';
type NonModRecoveryStatus = GuidedContentInstallIssueStatus;

interface NonModRecoveryIssue {
  label: string;
  status: NonModRecoveryStatus;
}

function getSafeModVersionLabel(version: ModVersion, fallback: string) {
  return sanitizeUiText(
    version.name,
    sanitizeUiText(version.versionNumber, sanitizeUiText(version.versionId, fallback)),
  );
}

function isGuidedContentType(contentType: AddModPageProps['contentType']): contentType is GuidedContentType {
  return contentType === 'resourcepack' || contentType === 'shader';
}

function formatRecoveryItems(labels: string[]): string {
  return labels.join(', ');
}

export const AddModPage: React.FC<AddModPageProps> = ({ modpackId, onBack, contentType = 'mod' }) => {
  const { t, getAccentStyles, minecraftPath } = useSettings();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [platform, setPlatform] = useState<'curseforge' | 'modrinth'>('modrinth');
  const [searchResults, setSearchResults] = useState<ModSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [checkedMods, setCheckedMods] = useState<Map<string, CheckedEntry>>(new Map());
  const [installing, setInstalling] = useState(false);
  const [modpackMetadata, setModpackMetadata] = useState<ModpackMetadata | null>(null);
  const [modpackConfig, setModpackConfig] = useState<ModpackConfig | null>(null);
  const [filterMCVersion, setFilterMCVersion] = useState<string>('');
  const [filterLoader, setFilterLoader] = useState<string>('');
  const [filterSort, setFilterSort] = useState<'popularity' | 'date' | 'alphabetical'>('popularity');
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [flowNotice, setFlowNotice] = useState<{ tone: FlowNoticeTone; message: string } | null>(null);
  const [localImporting, setLocalImporting] = useState(false);
  const pageScrollRef = useRef<HTMLDivElement>(null);
  const searchRequestIdRef = useRef(0);
  const PAGE_SIZE = 20;
  const { optiFineVersions } = useModSupportedVersions();

  const effectiveLoader = contentType === 'mod' ? (filterLoader || modpackMetadata?.modLoader?.type || '') : '';
  const effectiveMCVersion = filterMCVersion || modpackMetadata?.minecraftVersion || '';
  const shouldPersistInstallToManifest = contentType === 'mod';
  const supportsLocalFallback = contentType === 'resourcepack' || contentType === 'shader';
  const isBusy = installing || localImporting;

  const loadModpackMetadataAndConfig = useCallback(async () => {
    try {
      const [metadata, config] = await Promise.all([
        modpacksIPC.getMetadata(modpackId, minecraftPath),
        modpacksIPC.getConfig(modpackId, minecraftPath),
      ]);
      setModpackMetadata(metadata);
      setModpackConfig(config);
      const mcVersion = config?.runtime?.minecraft || metadata?.minecraftVersion || '';
      const loader = config?.runtime?.modLoader?.type || metadata?.modLoader?.type || '';
      setFilterMCVersion(mcVersion);
      setFilterLoader(loader);
    } catch (error) {
      console.error('Error loading modpack metadata:', error);
    }
  }, [modpackId, minecraftPath]);

  useEffect(() => {
    loadModpackMetadataAndConfig();
  }, [loadModpackMetadataAndConfig]);

  const searchErrorDescription =
    t('modpacks.add_mod_search_error_desc') || 'We could not load catalog results right now.';
  const runtimeSummary = useMemo(
    () =>
      buildModpackRuntimeSummary({
        config: modpackConfig,
        metadata: modpackMetadata,
        optiFineVersions: optiFineVersions.length > 0 ? optiFineVersions : undefined,
      }),
    [modpackConfig, modpackMetadata, optiFineVersions],
  );
  const runtimeContextLabel = useMemo(
    () => getModpackRuntimeContextLabel(runtimeSummary, t),
    [runtimeSummary, t],
  );
  const shaderGuidance = useMemo(() => {
    if (contentType !== 'shader') {
      return null;
    }

    return {
      label: getModpackShaderCapabilityLabel(runtimeSummary.shaderCapability.status, t),
      description: getModpackShaderCapabilityDescription(runtimeSummary, t),
      tone: getModpackShaderCapabilityTone(runtimeSummary.shaderCapability.status),
      title:
        t('modpacks.shader_capability_heading')
        || 'Shader runtime',
      hint:
        (t('modpacks.shader_capability_catalog_hint')
          || 'Catalog metadata and downloaded archives are not compatibility guarantees on their own.')
          .replace('{{runtime}}', runtimeContextLabel),
    };
  }, [contentType, runtimeContextLabel, runtimeSummary, t]);
  const resourcePackScopeCopy = useMemo(() => {
    if (contentType !== 'resourcepack') {
      return null;
    }

    return {
      title:
        t('modpacks.resourcepack_scope_title')
        || 'Instance-scoped resource packs',
      description:
        t('modpacks.resourcepack_scope_desc')
        || 'Resource packs added here only affect this modpack. FMCL does not mark them compatible or incompatible for you.',
    };
  }, [contentType, t]);
  const localFallbackCopy = useMemo(() => {
    switch (contentType) {
      case 'resourcepack':
        return {
          title: t('modpacks.resourcepack_local_fallback_title') || 'Have a local resource pack .zip already?',
          description:
            t('modpacks.resourcepack_local_fallback_desc')
            || 'Import it straight into this modpack when browsing is not the right fit. This only affects the current instance.',
          action: t('modpacks.guided_local_fallback_action') || 'Import local .zip',
        };
      case 'shader':
        return {
          title: t('modpacks.shader_local_fallback_title') || 'Have a local shader pack .zip already?',
          description:
            t('modpacks.shader_local_fallback_desc')
            || 'Import it straight into this modpack when browsing is not the right fit. This only affects the current instance.',
          action: t('modpacks.guided_local_fallback_action') || 'Import local .zip',
        };
      default:
        return null;
    }
  }, [contentType, t]);

  const buildNonModRecoveryNotice = useCallback((params: {
    contentType: GuidedContentType;
    issues: NonModRecoveryIssue[];
    addedCount?: number;
  }): { tone: FlowNoticeTone; message: string } | null => {
    const { contentType: noticeContentType, issues, addedCount = 0 } = params;

    if (issues.length === 0) {
      return null;
    }

    const grouped = issues.reduce<Record<NonModRecoveryStatus, string[]>>((acc, issue) => {
      acc[issue.status].push(issue.label);
      return acc;
    }, {
      duplicate: [],
      'invalid-archive': [],
      'runtime-blocked': [],
      failure: [],
    });

    const messageParts: string[] = [];
    if (addedCount > 0) {
      const partialIntroKey = noticeContentType === 'resourcepack'
        ? 'modpacks.resourcepack_recovery_partial_intro'
        : 'modpacks.shader_recovery_partial_intro';
      const partialIntroFallback = noticeContentType === 'resourcepack'
        ? 'Added {{added}} resource packs. The remaining issues stayed on this screen.'
        : 'Added {{added}} shader packs. The remaining issues stayed on this screen.';

      messageParts.push(
        (t(partialIntroKey) || partialIntroFallback).replace('{{added}}', String(addedCount)),
      );
    }

    if (grouped.duplicate.length > 0) {
      const duplicateKey = noticeContentType === 'resourcepack'
        ? 'modpacks.resourcepack_recovery_duplicate'
        : 'modpacks.shader_recovery_duplicate';
      const duplicateFallback = noticeContentType === 'resourcepack'
        ? 'Already in this modpack: {{items}}. Review installed resource packs or choose a different pack.'
        : 'Already in this modpack: {{items}}. Review installed shader packs or choose a different pack.';

      messageParts.push(
        (t(duplicateKey) || duplicateFallback).replace('{{items}}', formatRecoveryItems(grouped.duplicate)),
      );
    }

    if (grouped['invalid-archive'].length > 0) {
      const invalidKey = noticeContentType === 'resourcepack'
        ? 'modpacks.resourcepack_recovery_invalid_archive'
        : 'modpacks.shader_recovery_invalid_archive';
      const invalidFallback = noticeContentType === 'resourcepack'
        ? 'FMCL could not treat these files as valid resource packs: {{items}}. Try another version or another local .zip.'
        : 'FMCL could not treat these files as valid shader packs: {{items}}. Try another version or another local .zip.';

      messageParts.push(
        (t(invalidKey) || invalidFallback).replace('{{items}}', formatRecoveryItems(grouped['invalid-archive'])),
      );
    }

    if (grouped['runtime-blocked'].length > 0) {
      const blockedKey = 'modpacks.shader_recovery_runtime_blocked';
      const blockedFallback = 'FMCL kept these shader installs blocked for the current runtime: {{items}}. Review the shader runtime card above, then retry.';
      messageParts.push(
        (t(blockedKey) || blockedFallback).replace('{{items}}', formatRecoveryItems(grouped['runtime-blocked'])),
      );
    }

    if (grouped.failure.length > 0) {
      const failureKey = noticeContentType === 'resourcepack'
        ? 'modpacks.resourcepack_recovery_failure'
        : 'modpacks.shader_recovery_failure';
      const failureFallback = noticeContentType === 'resourcepack'
        ? 'FMCL could not add these resource packs right now: {{items}}. Retry from this screen or keep browsing.'
        : 'FMCL could not add these shader packs right now: {{items}}. Retry from this screen or keep browsing.';

      messageParts.push(
        (t(failureKey) || failureFallback).replace('{{items}}', formatRecoveryItems(grouped.failure)),
      );
    }

    if (messageParts.length === 0) {
      return null;
    }

    const hasHardFailures = grouped['invalid-archive'].length > 0
      || grouped['runtime-blocked'].length > 0
      || grouped.failure.length > 0;

    return {
      tone: addedCount > 0 || !hasHardFailures ? 'warning' : 'error',
      message: messageParts.join(' '),
    };
  }, [t]);

  const getLocalImportNotice = useCallback((result: LocalImportResult): { tone: FlowNoticeTone; message: string } | null => {
    if (!isGuidedContentType(contentType) || result.status === 'cancelled' || result.status === 'success') {
      return null;
    }

    return buildNonModRecoveryNotice({
      contentType,
      issues: result.issues.map((issue) => ({
        label: issue.fileName,
        status: issue.status,
      })),
      addedCount: result.importedFileNames.length,
    });
  }, [buildNonModRecoveryNotice, contentType]);

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
        query: query.trim() || '',
        mcVersion: effectiveMCVersion || undefined,
        loader: effectiveLoader || undefined,
        sort: filterSort,
        offset,
        limit: PAGE_SIZE,
        contentType,
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
  }, [query, platform, effectiveMCVersion, effectiveLoader, filterSort, contentType, searchErrorDescription]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchMods(0, false);
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [query, platform, filterMCVersion, filterLoader, filterSort, searchMods]);

  useEffect(() => {
    setCheckedMods(new Map());
  }, [platform]);

  useEffect(() => {
    setFlowNotice(null);
  }, [platform, filterMCVersion, filterLoader, filterSort, query]);

  const visibleResultKeys = useMemo(
    () => new Set(searchResults.map((mod) => `${mod.platform}:${mod.projectId}`)),
    [searchResults],
  );

  const handleScroll = useCallback(() => {
    const el = pageScrollRef.current;
    if (!el || loading || loadingMore) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollTop + clientHeight >= scrollHeight - 100) {
      const currentLen = searchResults.length;
      if (currentLen < total) searchMods(currentLen, true);
    }
  }, [loading, loadingMore, searchResults.length, total, searchMods]);

  useEffect(() => {
    const el = pageScrollRef.current;
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
      const mcVersion = filterMCVersion || modpackMetadata?.minecraftVersion || undefined;
      const loader = filterLoader || modpackMetadata?.modLoader?.type || undefined;
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

    return [{ key, entry: value }];
  });
  const hasLoading = Array.from(checkedMods.entries()).some(
    ([key, value]) => visibleResultKeys.has(key) && value === 'loading',
  );

  const handleAddBulk = async () => {
    if (readyToAdd.length === 0) return;
    setInstalling(true);
    setFlowNotice(null);
    let added = 0;
    let failed = 0;

    if (isGuidedContentType(contentType)) {
      const retainedSelections = new Map<string, CheckedEntry>();
      const recoveryIssues: NonModRecoveryIssue[] = [];

      try {
        for (const { key, entry } of readyToAdd) {
          const { mod, version } = entry;

          if (contentType === 'shader' && runtimeSummary.shaderCapability.status === 'unsupported') {
            failed++;
            retainedSelections.set(key, entry);
            recoveryIssues.push({
              label: mod.title,
              status: 'runtime-blocked',
            });
            continue;
          }

          try {
            const installResult = await modsIPC.installModFile({
              platform: mod.platform,
              projectId: mod.projectId,
              versionId: version.versionId,
              instanceId: modpackId,
              rootPath: minecraftPath,
              contentType,
            });

            if (isGuidedContentInstallResult(installResult) && installResult.status !== 'success') {
              failed++;
              retainedSelections.set(key, entry);
              for (const issue of installResult.issues) {
                recoveryIssues.push({
                  label: mod.title,
                  status: issue.status,
                });
              }
              continue;
            }

            added++;
          } catch {
            failed++;
            retainedSelections.set(key, entry);
            recoveryIssues.push({
              label: mod.title,
              status: 'failure',
            });
          }
        }

        setCheckedMods(retainedSelections);

        if (added > 0 && failed === 0) {
          toast.success(
            contentType === 'resourcepack'
              ? (t('modpacks.resourcepack_add_success') || 'Resource packs added to this modpack.')
              : (t('modpacks.shader_add_success') || 'Shader packs added to this modpack.'),
          );
          onBack();
          return;
        }

        const notice = buildNonModRecoveryNotice({
          contentType,
          issues: recoveryIssues,
          addedCount: added,
        });

        if (notice) {
          setFlowNotice(notice);
        }

        if (failed > 0 && added === 0) {
          toast.error(
            contentType === 'resourcepack'
              ? (t('modpacks.resourcepack_add_error') || 'Could not add the selected resource packs.')
              : (t('modpacks.shader_add_error') || 'Could not add the selected shader packs.'),
          );
        }
      } finally {
        setInstalling(false);
      }

      return;
    }

    try {
      for (const { entry } of readyToAdd) {
        const { mod, version } = entry;
        try {
          await modsIPC.installModFile({
            platform: mod.platform,
            projectId: mod.projectId,
            versionId: version.versionId,
            instanceId: modpackId,
            rootPath: minecraftPath,
            contentType,
          });

          if (shouldPersistInstallToManifest) {
            await modpacksIPC.addMod(modpackId, {
              platform: mod.platform,
              projectId: mod.platform === 'curseforge' ? Number(mod.projectId) : mod.projectId,
              versionId: mod.platform === 'curseforge' ? Number(version.versionId) : version.versionId,
            }, minecraftPath);
          }

          added++;
        } catch {
          failed++;
        }
      }
      setCheckedMods(new Map());
      if (added > 0) {
        if (failed === 0) {
          toast.success(t('modpacks.add_mod') || 'Моды добавлены!');
        } else {
          setFlowNotice({
            tone: 'warning',
            message:
              (t('modpacks.add_mod_partial_recovery') || 'Added {{added}} items, but {{failed}} failed. Review the current results and retry only what you still need.')
                .replace('{{added}}', String(added))
                .replace('{{failed}}', String(failed)),
          });
        }
      }
      if (added > 0 && failed === 0) {
        onBack();
      }
      if (failed > 0 && added === 0) {
        setFlowNotice({
          tone: 'error',
          message:
            (t('modpacks.add_mod_failed_recovery') || 'Nothing was added. {{failed}} items failed. Review the current results and try again.')
              .replace('{{failed}}', String(failed)),
        });
        toast.error(t('modpacks.add_mod_error') || 'Ошибка при добавлении');
      }
    } finally {
      setInstalling(false);
    }
  };

  const handleLocalImport = useCallback(async () => {
    if (!supportsLocalFallback || !localFallbackCopy) {
      return;
    }

    setLocalImporting(true);
    setFlowNotice(null);

    try {
      const instancePath = await modpacksIPC.resolvePath(modpackId, minecraftPath);
      if (!instancePath) {
        setFlowNotice({
          tone: 'error',
          message:
            t('modpacks.guided_local_open_error')
            || 'FMCL could not open the local import picker for this modpack right now.',
        });
        return;
      }

      const result = contentType === 'resourcepack'
        ? await resourcePacksIPC.add(instancePath)
        : await shadersIPC.add(instancePath);

      if (result.status === 'success') {
        toast.success(
          contentType === 'resourcepack'
            ? (t('modpacks.resourcepack_add_success') || 'Resource packs added to this modpack.')
            : (t('modpacks.shader_add_success') || 'Shader packs added to this modpack.'),
        );
        onBack();
        return;
      }

      const notice = getLocalImportNotice(result);
      if (notice) {
        setFlowNotice(notice);
      }
    } catch (error) {
      console.error('Error importing local content fallback:', error);
      setFlowNotice({
        tone: 'error',
        message:
          toDisplayErrorMessage(
            error,
            t('modpacks.guided_local_open_error')
            || 'FMCL could not open the local import picker for this modpack right now.',
          ),
      });
    } finally {
      setLocalImporting(false);
    }
  }, [contentType, getLocalImportNotice, localFallbackCopy, minecraftPath, modpackId, onBack, supportsLocalFallback, t, toast]);

  const unavailableVersionLabel = t('modpacks.version_unavailable') || 'Version unavailable';

  const getTitle = () => {
    switch (contentType) {
      case 'resourcepack': return t('modpacks.add_resourcepack') || 'Добавить ресурспак';
      case 'shader': return t('modpacks.add_shader') || 'Добавить шейдер';
      default: return t('modpacks.add_mod') || 'Добавить мод';
    }
  };

  const getPlaceholder = () => {
    switch (contentType) {
      case 'resourcepack': return t('modpacks.search_resourcepack_placeholder') || 'Поиск ресурспаков...';
      case 'shader': return t('modpacks.search_shader_placeholder') || 'Поиск шейдеров...';
      default: return t('modpacks.search_mod_placeholder') || 'Поиск модов...';
    }
  };

  const getPrimaryActionLabel = () => {
    switch (contentType) {
      case 'resourcepack':
        return readyToAdd.length > 0
          ? `${t('modpacks.add_selected_resourcepacks') || 'Add selected resource packs'} (${readyToAdd.length})`
          : t('modpacks.add_resourcepack') || 'Add Resource Pack';
      case 'shader':
        return readyToAdd.length > 0
          ? `${t('modpacks.add_selected_shaders') || 'Add selected shaders'} (${readyToAdd.length})`
          : t('modpacks.add_shader') || 'Add Shader';
      default:
        return readyToAdd.length > 0
          ? `${t('modpacks.add_selected') || 'Добавить выбранные'} (${readyToAdd.length})`
          : t('modpacks.add') || 'Добавить';
    }
  };

  const getEmptyStateTitle = () => {
    switch (contentType) {
      case 'resourcepack':
        return t('modpacks.add_resourcepack_empty_title') || 'Browse resource packs';
      case 'shader':
        return t('modpacks.add_shader_empty_title') || 'Browse shaders';
      default:
        return t('modpacks.add_mod_empty_title') || 'Search the catalog';
    }
  };

  const getEmptyStateDescription = () => {
    switch (contentType) {
      case 'resourcepack':
        return t('modpacks.add_resourcepack_empty_desc') || 'Search Modrinth or import a local .zip to add a resource pack to this modpack.';
      case 'shader':
        return t('modpacks.add_shader_empty_desc') || 'Search Modrinth or import a local .zip to add a shader pack to this modpack.';
      default:
        return t('modpacks.add_mod_empty_desc') || 'Use search and filters to find loader-compatible files for this modpack.';
    }
  };

  const getNoResultsTitle = () => {
    switch (contentType) {
      case 'resourcepack':
        return t('modpacks.no_resourcepack_results') || 'No resource packs matched the current filters';
      case 'shader':
        return t('modpacks.no_shader_results') || 'No shaders matched the current filters';
      default:
        return t('modpacks.no_mod_results') || 'No mods found for the current filters';
    }
  };

  const getNoResultsDescription = () => {
    switch (contentType) {
      case 'resourcepack':
        return t('modpacks.resourcepack_filter_hint') || 'Try a broader query, adjust filters, or import a local .zip below.';
      case 'shader':
        return t('modpacks.shader_filter_hint') || 'Try a broader query, adjust filters, or import a local .zip below.';
      default:
        return t('modpacks.mods_filter_hint') || 'Try a broader query or adjust the current filters.';
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header with back button, title, platform tabs */}
      <div className="flex flex-col border-b border-zinc-200 dark:border-zinc-700 bg-white/60 dark:bg-zinc-900/40 px-6 py-4 gap-4">
        <Breadcrumbs
          items={[
            { label: t('modpacks.title') || 'Modpacks', onClick: isBusy ? undefined : onBack },
            { label: getTitle(), active: true }
          ]}
        />
        <div className="flex items-center gap-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={onBack}
            disabled={isBusy}
            className="flex items-center gap-2 shrink-0"
          >
            <span>←</span>
            {t('general.back') || 'Назад'}
          </Button>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white shrink-0 flex-1">
            {getTitle()}
          </h2>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => {
                setPlatform('curseforge');
                setCheckedMods(new Map());
              }}
              disabled
              className={cn(
                "px-4 py-2 rounded-lg font-medium transition-colors text-sm",
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
                "px-4 py-2 rounded-lg font-medium transition-colors text-sm",
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
      </div>

      <div
        ref={pageScrollRef}
        className="flex-1 overflow-y-auto p-6 min-h-0"
        onScroll={handleScroll}
        data-testid="add-mod-page-scroll"
      >
        <div className="space-y-4 max-w-4xl mx-auto">
          {flowNotice && (
            <div
              className={cn(
                'rounded-2xl border px-4 py-3 text-sm',
                flowNotice.tone === 'warning'
                  ? 'border-amber-500/35 bg-amber-500/12 text-foreground'
                  : 'border-red-500/35 bg-red-500/12 text-foreground',
              )}
              data-testid="add-mod-page-notice"
              data-tone={flowNotice.tone}
            >
              {flowNotice.message}
            </div>
          )}

          {shaderGuidance && (
            <div
              className={cn(
                'surface-inline space-y-3 rounded-2xl border p-4',
                shaderGuidance.tone === 'positive' && 'border-emerald-500/30 bg-emerald-500/10',
                shaderGuidance.tone === 'warning' && 'border-amber-500/35 bg-amber-500/12',
                shaderGuidance.tone === 'error' && 'border-red-500/35 bg-red-500/12',
                shaderGuidance.tone === 'neutral' && 'border-border/70 bg-card/72',
              )}
              data-testid="guided-content-shader-capability"
              data-status={runtimeSummary.shaderCapability.status}
            >
              <div className="flex flex-wrap items-center gap-2">
                <div className="kicker-label">
                  {shaderGuidance.title}
                </div>
                <span
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-xs font-medium',
                    shaderGuidance.tone === 'positive' && 'border-emerald-500/30 bg-emerald-500/12 text-emerald-300',
                    shaderGuidance.tone === 'warning' && 'border-amber-500/30 bg-amber-500/12 text-amber-200',
                    shaderGuidance.tone === 'error' && 'border-red-500/30 bg-red-500/12 text-red-200',
                    shaderGuidance.tone === 'neutral' && 'border-border/70 bg-background/70 text-secondary',
                  )}
                >
                  {shaderGuidance.label}
                </span>
              </div>
              <p className="text-sm text-foreground">{shaderGuidance.description}</p>
              <p className="text-xs text-secondary">{shaderGuidance.hint}</p>
            </div>
          )}

          {resourcePackScopeCopy && (
            <div
              className="surface-inline space-y-2 rounded-2xl border border-border/70 bg-card/72 p-4"
              data-testid="guided-content-resourcepack-scope"
            >
              <div className="kicker-label">
                {t('modpacks.tab_resourcepacks')}
              </div>
              <h3 className="text-sm font-semibold text-foreground">{resourcePackScopeCopy.title}</h3>
              <p className="text-sm text-secondary">{resourcePackScopeCopy.description}</p>
            </div>
          )}

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

            {contentType === 'mod' && (
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
            )}

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
            placeholder={getPlaceholder()}
            className="w-full"
          />

          {localFallbackCopy && (
            <div
              className="surface-inline flex flex-col gap-3 rounded-2xl border border-dashed border-border/70 bg-background/60 p-4 sm:flex-row sm:items-center sm:justify-between"
              data-testid="guided-content-local-fallback"
            >
              <div className="space-y-1">
                <div className="kicker-label">
                  {t('modpacks.guided_local_fallback_label') || 'Local .zip fallback'}
                </div>
                <h3 className="text-sm font-semibold text-foreground">{localFallbackCopy.title}</h3>
                <p className="text-sm text-secondary">{localFallbackCopy.description}</p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void handleLocalImport()}
                disabled={isBusy}
                isLoading={localImporting}
                className="sm:shrink-0"
              >
                {localFallbackCopy.action}
              </Button>
            </div>
          )}

          {/* Search Results */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <LoadingSpinner size="lg" />
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {t('modpacks.loading')}
              </p>
            </div>
          )}

          {!loading && !searchError && searchResults.length > 0 && (
            <div
              className="space-y-2"
              data-testid="add-mod-results"
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
                      disabled={isLoading || isBusy}
                      onChange={(e) => handleCheckChange(mod, e.target.checked)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 focus:ring-2 focus:ring-zinc-500"
                    />
                    <LazyImage
                      src={mod.iconUrl}
                      alt={mod.title}
                      className="w-12 h-12 rounded object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-zinc-900 dark:text-white truncate">
                        {mod.title}
                      </h4>
                      {version && (
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                          {getSafeModVersionLabel(version, unavailableVersionLabel)} {version.mcVersions[0] && `(${version.mcVersions[0]})`}
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
                    {isLoading && (
                      <LoadingSpinner size="sm" className="shrink-0" />
                    )}
                  </div>
                );
              })}
              {loadingMore && (
                <div className="flex justify-center py-4">
                  <LoadingSpinner size="md" />
                </div>
              )}
              {!loadingMore && searchResults.length > 0 && searchResults.length < total && (
                <p className="text-xs text-center text-zinc-500 dark:text-zinc-400 py-2">
                  {t('modpacks.scroll_for_more') || 'Прокрутите вниз для загрузки'}
                </p>
              )}
            </div>
          )}

          {!loading && searchError ? (
            <DegradedStateView
              variant="error"
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

          {!loading && !searchError && searchResults.length === 0 ? (
            <DegradedStateView
              variant={query.trim() ? 'zero-results' : 'empty'}
              label={t(query.trim() ? 'degraded.zero_results_label' : 'degraded.empty_label')}
              title={
                query.trim()
                  ? getNoResultsTitle()
                  : getEmptyStateTitle()
              }
              description={
                query.trim()
                  ? getNoResultsDescription()
                  : getEmptyStateDescription()
              }
            />
          ) : null}

          <div
            className="surface-card flex flex-col gap-2 p-4 sm:flex-row"
            data-testid="add-mod-page-actions"
          >
            <Button
              onClick={onBack}
              variant="secondary"
              disabled={isBusy}
              className="w-full sm:flex-1"
            >
              {t('general.cancel')}
            </Button>
            <Button
              onClick={handleAddBulk}
              disabled={readyToAdd.length === 0 || isBusy || hasLoading}
              className={cn("w-full text-white sm:flex-1", getAccentStyles('bg').className)}
              style={getAccentStyles('bg').style}
              isLoading={installing}
            >
              {installing ? t('modpacks.installing') : getPrimaryActionLabel()}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
