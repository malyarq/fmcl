import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ModpackMetadata } from '@shared/types/modpack';
import { useSettings } from '../../../contexts/SettingsContext';
import { useToast } from '../../../contexts/ToastContext';
import {
  fetchModpackMetadata,
  updateModpackMetadata,
} from '../../../contexts/instances/services/instancesService';
import { useModSupportedVersions } from '../../../features/launcher/hooks/useModSupportedVersions';
import { useVersions } from '../../../features/launcher/hooks/useVersions';
import { useModpackDetailsConfig } from '../../../features/modpacks/hooks/useModpackDetailsConfig';
import {
  resolveModpackUpdateInfo,
  type ModpackUpdateInfo,
} from '../../../features/modpacks/hooks/useModpackUpdates';
import { buildModpackRuntimeSummary } from '../../../features/modpacks/hooks/useModpackRuntimeSummary';
import { useModpackDetailsActionsController } from './useModpackDetailsActionsController';

export type ModpackDetailsMetadataState =
  | { status: 'loading'; metadata: ModpackMetadata | null }
  | { status: 'ready'; metadata: ModpackMetadata }
  | { status: 'error'; metadata: null };

export type ModpackDetailsUpdateState =
  | { status: 'idle'; update: null }
  | { status: 'loading'; update: null }
  | { status: 'ready'; update: ModpackUpdateInfo | null }
  | { status: 'error'; update: null };

interface UseModpackDetailsControllerParams {
  hydrateFromIpc: boolean;
  initialMetadata?: ModpackMetadata;
  modpackId: string;
  onBack: () => void;
  onLaunch?: () => void | Promise<void>;
  onMetadataUpdated?: (metadata: ModpackMetadata) => void;
}

export function useModpackDetailsController({
  hydrateFromIpc,
  initialMetadata,
  modpackId,
  onBack,
  onLaunch,
  onMetadataUpdated,
}: UseModpackDetailsControllerParams) {
  const { t } = useSettings();
  const toast = useToast();
  const actionController = useModpackDetailsActionsController({ modpackId, onBack, onLaunch });
  const {
    effectiveConfig,
    loadModpackConfig,
    setters,
  } = useModpackDetailsConfig({ modpackId });
  const { versions } = useVersions();
  const {
    forgeVersions,
    fabricVersions,
    neoForgeVersions,
    optiFineVersions,
  } = useModSupportedVersions();
  const [metadataState, setMetadataState] = useState<ModpackDetailsMetadataState>(() => (
    initialMetadata
      ? { status: 'ready', metadata: initialMetadata }
      : { status: 'loading', metadata: null }
  ));
  const [updateState, setUpdateState] = useState<ModpackDetailsUpdateState>({
    status: 'idle',
    update: null,
  });
  const [descriptionDraft, setDescriptionDraft] = useState(initialMetadata?.description || '');
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const detailsGenerationRef = useRef(0);
  const updateGenerationRef = useRef(0);
  const bootstrappedIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const modpack = actionController.modpack;
  const modpackName = modpack?.name;
  const metadata = metadataState.metadata;

  const checkForUpdate = useCallback(async (nextMetadata: ModpackMetadata) => {
    const generation = ++updateGenerationRef.current;
    setUpdateState({ status: 'loading', update: null });
    try {
      const update = await resolveModpackUpdateInfo({
        id: modpackId,
        name: modpackName ?? modpackId,
        metadata: nextMetadata,
      });
      if (mountedRef.current && generation === updateGenerationRef.current) {
        setUpdateState({ status: 'ready', update });
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
      if (mountedRef.current && generation === updateGenerationRef.current) {
        setUpdateState({ status: 'error', update: null });
      }
    }
  }, [modpackId, modpackName]);

  const loadDetails = useCallback(async () => {
    if (!hydrateFromIpc) {
      if (initialMetadata) {
        setMetadataState({ status: 'ready', metadata: initialMetadata });
      }
      return;
    }

    const generation = ++detailsGenerationRef.current;
    setMetadataState((current) => ({ status: 'loading', metadata: current.metadata }));
    try {
      const nextMetadata = await fetchModpackMetadata(modpackId);
      if (!mountedRef.current || generation !== detailsGenerationRef.current) return;
      setMetadataState({ status: 'ready', metadata: nextMetadata });
      setDescriptionDraft(nextMetadata.description || '');
      void checkForUpdate(nextMetadata);
    } catch (error) {
      console.error('Error loading modpack details:', error);
      if (!mountedRef.current || generation !== detailsGenerationRef.current) return;
      updateGenerationRef.current += 1;
      setMetadataState({ status: 'error', metadata: null });
      setUpdateState({ status: 'idle', update: null });
    }
  }, [checkForUpdate, hydrateFromIpc, initialMetadata, modpackId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    void loadModpackConfig();
  }, [loadModpackConfig]);

  useEffect(() => {
    if (!modpackId || bootstrappedIdRef.current === modpackId) return;
    bootstrappedIdRef.current = modpackId;
    void Promise.resolve().then(() => {
      if (!mountedRef.current) return;
      if (hydrateFromIpc) {
        void loadDetails();
      } else if (initialMetadata) {
        void checkForUpdate(initialMetadata);
      }
    });
  }, [checkForUpdate, hydrateFromIpc, initialMetadata, loadDetails, modpackId]);

  const runtimeSummary = useMemo(() => buildModpackRuntimeSummary({
    config: effectiveConfig,
    metadata,
    optiFineVersions: optiFineVersions.length > 0 ? optiFineVersions : undefined,
  }), [effectiveConfig, metadata, optiFineVersions]);
  const availableUpdate = updateState.update;
  const updateVersionLabel = availableUpdate
    ? availableUpdate.latestVersion.versionNumber
      || availableUpdate.latestVersion.name
      || availableUpdate.latestVersion.versionId
    : null;
  const updateVersionSummary = availableUpdate && updateVersionLabel
    ? (t('modpacks.update_version_summary') || '{{current}} → {{latest}}')
      .replace('{{current}}', availableUpdate.currentVersion)
      .replace('{{latest}}', updateVersionLabel)
    : null;

  const saveDescription = useCallback(async () => {
    try {
      await updateModpackMetadata(modpackId, {
        description: descriptionDraft.trim() || null,
      });
      const updated = await fetchModpackMetadata(modpackId);
      setMetadataState({ status: 'ready', metadata: updated });
      setDescriptionDraft(updated.description || '');
      onMetadataUpdated?.(updated);
      await loadModpackConfig();
    } catch (error) {
      console.error('Error updating modpack description:', error);
      toast.error(t('modpacks.update_error') || 'Error updating modpack');
    }
  }, [descriptionDraft, loadModpackConfig, modpackId, onMetadataUpdated, t, toast]);

  const retryUpdate = useCallback(() => {
    if (metadata) void checkForUpdate(metadata);
  }, [checkForUpdate, metadata]);

  return {
    modpack,
    metadataState,
    updateState,
    retryDetails: loadDetails,
    retryUpdate,
    overview: {
      metadata,
      runtimeSummary,
    },
    description: {
      draft: descriptionDraft,
      setDraft: setDescriptionDraft,
      save: saveDescription,
    },
    actions: {
      ...actionController.actions,
      showUpdate: () => setShowUpdateModal(true),
      updateVersionSummary,
    },
    operationNotices: actionController.operationNotices,
    updateDialog: {
      availableUpdate,
      close: () => setShowUpdateModal(false),
      isOpen: showUpdateModal,
      updated: async () => {
        await actionController.refresh();
        await loadDetails();
        setShowUpdateModal(false);
      },
    },
    config: {
      effectiveConfig,
      load: loadModpackConfig,
      setters,
    },
    catalogs: {
      versions,
      forgeVersions,
      fabricVersions,
      neoForgeVersions,
      optiFineVersions,
    },
  };
}

export type ModpackDetailsController = ReturnType<typeof useModpackDetailsController>;
