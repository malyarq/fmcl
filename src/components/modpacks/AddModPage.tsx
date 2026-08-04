import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ModpackMetadata } from '@shared/types/modpack';
import { useSettings } from '../../contexts/SettingsContext';
import { useToast } from '../../contexts/ToastContext';
import {
  fetchModpackConfig,
  fetchModpackMetadata,
} from '../../contexts/instances/services/instancesService';
import type { ModpackConfig } from '../../contexts/instances/types';
import { ModContentAcquisition } from '../../features/content/components/ModContentAcquisition';
import { ResourcePackContentAcquisition } from '../../features/content/components/ResourcePackContentAcquisition';
import { ShaderContentAcquisition } from '../../features/content/components/ShaderContentAcquisition';
import type { AcquisitionOutcome } from '../../features/content/contentAcquisitionTypes';
import { useInstanceInvalidation } from '../../features/instances/hooks/useInstanceInvalidation';
import { useInstanceSnapshot } from '../../features/instances/hooks/useInstanceSelectors';
import { useModSupportedVersions } from '../../features/launcher/hooks/useModSupportedVersions';
import {
  buildModpackRuntimeSummary,
  getModpackRuntimeContextLabel,
  getModpackShaderCapabilityDescription,
  getModpackShaderCapabilityLabel,
  getModpackShaderCapabilityTone,
} from '../../features/modpacks/hooks/useModpackRuntimeSummary';
import { cn } from '../../utils/cn';
import { toDisplayErrorMessage } from '../../utils/displayError';
import { Breadcrumbs } from '../ui/Breadcrumbs';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { DegradedStateView } from '../layout/DegradedStateView';
import { MODPACK_SECONDARY_CONTENT_WORKSPACE } from './ModpackCatalogControls';

interface AddModPageProps {
  modpackId: string;
  onBack: () => void;
  onCommitted?: (outcome: AcquisitionOutcome) => void | Promise<void>;
  /** Type of content to search/install. Defaults to 'mod'. */
  contentType?: 'mod' | 'resourcepack' | 'shader';
}

type ModRuntimeState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; metadata: ModpackMetadata; config: ModpackConfig };

function AddContentHeader({
  title,
  onBack,
  busy,
}: {
  title: string;
  onBack: () => void;
  busy: boolean;
}) {
  const { t } = useSettings();

  return (
    <div className="flex flex-col gap-4 border-b border-zinc-200 bg-white/60 px-6 py-4 dark:border-zinc-700 dark:bg-zinc-900/40">
      <Breadcrumbs items={[
        { label: t('modpacks.title') || 'Modpacks', onClick: busy ? undefined : onBack },
        { label: title, active: true },
      ]} />
      <div className="flex items-center gap-4">
        <Button variant="secondary" size="sm" onClick={onBack} disabled={busy} className="shrink-0">
          <span>←</span>
          {t('general.back') || 'Back'}
        </Button>
        <h2 className="min-w-0 flex-1 truncate text-xl font-bold text-foreground">{title}</h2>
      </div>
    </div>
  );
}

function RuntimeLoading() {
  const { t } = useSettings();
  return (
    <div className="flex h-full items-center justify-center gap-3" role="status">
      <LoadingSpinner size="lg" />
      <span className="text-sm text-secondary">{t('modpacks.loading')}</span>
    </div>
  );
}

function ModAddPage({ modpackId, onBack, onCommitted }: AddModPageProps) {
  const { t } = useSettings();
  const toast = useToast();
  const [runtimeState, setRuntimeState] = useState<ModRuntimeState>({ status: 'loading' });
  const [busy, setBusy] = useState(false);
  const generationRef = useRef(0);

  const loadRuntime = useCallback(async () => {
    const generation = ++generationRef.current;
    setRuntimeState({ status: 'loading' });
    try {
      const [metadata, config] = await Promise.all([
        fetchModpackMetadata(modpackId),
        fetchModpackConfig(modpackId),
      ]);
      if (generation !== generationRef.current) return;
      setRuntimeState({ status: 'ready', metadata, config });
    } catch (error) {
      if (generation === generationRef.current) setRuntimeState({ status: 'error', error });
    }
  }, [modpackId]);

  useEffect(() => {
    void Promise.resolve().then(loadRuntime);
    return () => {
      generationRef.current += 1;
    };
  }, [loadRuntime]);

  const handleSuccess = useCallback(() => {
    toast.success(t('modpacks.add_mod_success') || 'Mods added');
    onBack();
  }, [onBack, t, toast]);

  const runtime = runtimeState.status === 'ready' ? {
    instanceId: modpackId,
    minecraftVersion: runtimeState.config.runtime.minecraft || runtimeState.metadata.minecraftVersion,
    loader: runtimeState.config.runtime.modLoader?.type || runtimeState.metadata.modLoader?.type,
  } : null;
  const title = t('modpacks.add_mod_title') || 'Add mods';

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <AddContentHeader title={title} onBack={onBack} busy={busy} />
      <div className="min-h-0 flex-1 p-6" data-testid="add-mod-page-body">
        {runtimeState.status === 'loading' ? <RuntimeLoading /> : null}
        {runtimeState.status === 'error' ? (
          <DegradedStateView
            variant="error"
            layout="workspace"
            title={t('modpacks.add_mod_runtime_error') || 'Unable to load this modpack'}
            description={toDisplayErrorMessage(
              runtimeState.error,
              t('modpacks.add_mod_runtime_error_desc') || 'FMCL could not read the current Minecraft and modloader versions.',
            )}
            footer={<Button onClick={() => { void loadRuntime(); }}>{t('operations.retry') || 'Retry'}</Button>}
          />
        ) : null}
        {runtime ? (
          <ModContentAcquisition
            runtime={runtime}
            onCancel={onBack}
            onCommitted={onCommitted}
            onSuccess={handleSuccess}
            onBusyChange={setBusy}
            className={workspaceClassName}
            resultsClassName={resultsClassName}
            actionsClassName={actionsClassName}
            testIds={contentTestIds}
          />
        ) : null}
      </div>
    </div>
  );
}

function ResourcePackAddPage({ modpackId, onBack, onCommitted }: AddModPageProps) {
  const { t } = useSettings();
  const toast = useToast();
  const snapshot = useInstanceSnapshot(modpackId);
  const { invalidateInstance } = useInstanceInvalidation();
  const [busy, setBusy] = useState(false);

  const handleCommitted = useCallback(async (outcome: AcquisitionOutcome) => {
    await invalidateInstance(modpackId);
    await onCommitted?.(outcome);
  }, [invalidateInstance, modpackId, onCommitted]);

  const handleSuccess = useCallback(() => {
    toast.success(t('modpacks.resourcepack_add_success') || 'Resource packs added to this modpack.');
    onBack();
  }, [onBack, t, toast]);

  const title = t('modpacks.add_resourcepack') || 'Add Resource Pack';

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <AddContentHeader title={title} onBack={onBack} busy={busy} />
      <div className="min-h-0 flex-1 p-6" data-testid="add-mod-page-body">
        {snapshot.status === 'idle' || snapshot.status === 'loading' ? <RuntimeLoading /> : null}
        {snapshot.status === 'error' ? (
          <RuntimeFailure
            testId="resourcepack-runtime-error"
            variant="error"
            title={t('modpacks.add_resourcepack_runtime_error') || 'Unable to load this modpack'}
            description={toDisplayErrorMessage(
              readCanonicalErrorMessage(snapshot.error),
              t('modpacks.add_resourcepack_runtime_error_desc')
                || 'FMCL could not read the canonical Minecraft version for this resource-pack install.',
            )}
            retry={() => invalidateInstance(modpackId)}
          />
        ) : null}
        {snapshot.status === 'uninitialized' ? (
          <RuntimeFailure
            testId="resourcepack-runtime-unavailable"
            variant="unavailable"
            title={t('modpacks.add_resourcepack_runtime_unavailable') || 'This modpack is not initialized yet'}
            description={t('modpacks.add_resourcepack_runtime_unavailable_desc')
              || 'Initialize or refresh the modpack before adding resource packs.'}
            retry={() => invalidateInstance(modpackId)}
          />
        ) : null}
        {snapshot.status === 'ready' ? (
          <ResourcePackContentAcquisition
            runtime={{ instanceId: modpackId, minecraftVersion: snapshot.data.runtime.minecraft }}
            onCancel={onBack}
            onCommitted={handleCommitted}
            onSuccess={handleSuccess}
            onBusyChange={setBusy}
            className={workspaceClassName}
            resultsClassName={resultsClassName}
            actionsClassName={actionsClassName}
            testIds={localContentTestIds}
          />
        ) : null}
      </div>
    </div>
  );
}

function ShaderAddPage({ modpackId, onBack, onCommitted }: AddModPageProps) {
  const { t } = useSettings();
  const toast = useToast();
  const snapshot = useInstanceSnapshot(modpackId);
  const { invalidateInstance } = useInstanceInvalidation();
  const { optiFineVersions } = useModSupportedVersions();
  const [busy, setBusy] = useState(false);
  const config = snapshot.status === 'ready' ? snapshot.data : null;
  const runtimeSummary = useMemo(
    () => buildModpackRuntimeSummary({
      config,
      optiFineVersions: optiFineVersions.length > 0 ? optiFineVersions : undefined,
    }),
    [config, optiFineVersions],
  );
  const runtimeContextLabel = useMemo(
    () => getModpackRuntimeContextLabel(runtimeSummary, t),
    [runtimeSummary, t],
  );
  const guidance = useMemo(() => ({
    status: runtimeSummary.shaderCapability.status,
    tone: getModpackShaderCapabilityTone(runtimeSummary.shaderCapability.status),
    title: t('modpacks.shader_capability_heading') || 'Shader runtime',
    label: getModpackShaderCapabilityLabel(runtimeSummary.shaderCapability.status, t),
    description: getModpackShaderCapabilityDescription(runtimeSummary, t),
    hint: (t('modpacks.shader_capability_catalog_hint')
      || 'Catalog metadata and downloaded archives are not compatibility guarantees on their own.')
      .replace('{{runtime}}', runtimeContextLabel),
  }), [runtimeContextLabel, runtimeSummary, t]);

  const handleCommitted = useCallback(async (outcome: AcquisitionOutcome) => {
    await invalidateInstance(modpackId);
    await onCommitted?.(outcome);
  }, [invalidateInstance, modpackId, onCommitted]);

  const handleSuccess = useCallback(() => {
    toast.success(t('modpacks.shader_add_success') || 'Shader packs added to this modpack.');
    onBack();
  }, [onBack, t, toast]);

  const title = t('modpacks.add_shader') || 'Add Shader';

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <AddContentHeader title={title} onBack={onBack} busy={busy} />
      <div className="min-h-0 flex-1 p-6" data-testid="add-mod-page-body">
        {snapshot.status === 'idle' || snapshot.status === 'loading' ? <RuntimeLoading /> : null}
        {snapshot.status === 'error' ? (
          <RuntimeFailure
            testId="shader-runtime-error"
            variant="error"
            title={t('modpacks.add_shader_runtime_error') || 'Unable to load this modpack'}
            description={toDisplayErrorMessage(
              readCanonicalErrorMessage(snapshot.error),
              t('modpacks.add_shader_runtime_error_desc')
                || 'FMCL could not verify the canonical runtime for this shader install.',
            )}
            retry={() => invalidateInstance(modpackId)}
          />
        ) : null}
        {snapshot.status === 'uninitialized' ? (
          <RuntimeFailure
            testId="shader-runtime-unavailable"
            variant="unavailable"
            title={t('modpacks.add_shader_runtime_unavailable') || 'This modpack is not initialized yet'}
            description={t('modpacks.add_shader_runtime_unavailable_desc')
              || 'Initialize or refresh the modpack before adding shader packs.'}
            retry={() => invalidateInstance(modpackId)}
          />
        ) : null}
        {snapshot.status === 'ready' ? (
          <ShaderContentAcquisition
            runtime={{
              instanceId: modpackId,
              minecraftVersion: snapshot.data.runtime.minecraft,
              shaderSupport: shaderSupport(runtimeSummary.shaderCapability.status),
            }}
            guidance={guidance}
            onCancel={onBack}
            onCommitted={handleCommitted}
            onSuccess={handleSuccess}
            onBusyChange={setBusy}
            className={workspaceClassName}
            resultsClassName={resultsClassName}
            actionsClassName={actionsClassName}
            testIds={localContentTestIds}
          />
        ) : null}
      </div>
    </div>
  );
}

function RuntimeFailure({
  testId,
  variant,
  title,
  description,
  retry,
}: {
  testId: string;
  variant: 'error' | 'unavailable';
  title: string;
  description: string;
  retry: () => void | Promise<void>;
}) {
  const { t } = useSettings();
  return (
    <DegradedStateView
      variant={variant}
      layout="workspace"
      testId={testId}
      title={title}
      description={description}
      footer={<Button onClick={() => { void retry(); }}>{t('operations.retry') || 'Retry'}</Button>}
    />
  );
}

function readCanonicalErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return error;
}

function shaderSupport(status: 'supported' | 'needs-setup' | 'unsupported' | 'unverified') {
  if (status === 'supported' || status === 'unsupported') return status;
  return 'unknown' as const;
}

const workspaceClassName = cn(
  'flex h-full min-h-0 flex-col gap-4',
  MODPACK_SECONDARY_CONTENT_WORKSPACE.host,
);
const resultsClassName = 'min-h-[18rem] flex-1 overflow-y-auto pr-1';
const actionsClassName = 'surface-card shrink-0 space-y-3 p-4';
const contentTestIds = {
  resultsViewport: 'add-mod-results-scroll',
  results: 'add-mod-results',
  actions: 'add-mod-page-actions',
  outcome: 'add-mod-page-notice',
} as const;
const localContentTestIds = {
  ...contentTestIds,
  localImport: 'guided-local-fallback-action',
} as const;

export const AddModPage: React.FC<AddModPageProps> = (props) => {
  const contentType = props.contentType ?? 'mod';
  if (contentType === 'mod') return <ModAddPage {...props} contentType="mod" />;
  if (contentType === 'resourcepack') return <ResourcePackAddPage {...props} contentType="resourcepack" />;
  return <ShaderAddPage {...props} contentType="shader" />;
};
