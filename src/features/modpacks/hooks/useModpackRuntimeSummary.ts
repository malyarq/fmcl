import type { ModpackMetadata } from '@shared/types/modpack';
import type { ModpackConfig, ModLoaderType } from '../../../contexts/instances/types';
import {
  buildRuntimeDependencyState,
  getModloaderDisplayLabel,
  getRuntimeDependencyWarningMessage,
  type RuntimeDependencyState,
  type RuntimeDependencyWarning,
} from '../../../components/sidebar/modpackRuntimeDependencies';

export type ModpackRuntimeSummarySource = 'config' | 'metadata' | 'fallback' | 'unknown';
export type ModpackRuntimeSummaryStatus = 'healthy' | 'warning' | 'error';
export type ModpackShaderCapabilityStatus = 'supported' | 'needs-setup' | 'unsupported' | 'unverified';
export type ModpackShaderCapabilityReason =
  | RuntimeDependencyWarning
  | 'optifine_enabled'
  | 'runtime_source_unverified'
  | 'shader_runtime_not_configured';

export interface ModpackRuntimeSummaryInput {
  config?: ModpackConfig | null;
  metadata?: ModpackMetadata | null;
  fallback?: {
    minecraftVersion?: string;
    modLoader?: {
      type: ModLoaderType;
      version?: string;
    };
    useOptiFine?: boolean;
  };
  optiFineVersions?: string[];
}

export interface ModpackShaderCapability {
  status: ModpackShaderCapabilityStatus;
  reason: ModpackShaderCapabilityReason;
  warnings: RuntimeDependencyWarning[];
}

export interface ModpackRuntimeSummary {
  source: ModpackRuntimeSummarySource;
  status: ModpackRuntimeSummaryStatus;
  minecraftVersion: string;
  modLoader?: RuntimeDependencyState['modLoader'];
  requestedOptiFine: boolean;
  useOptiFine: boolean;
  warnings: RuntimeDependencyState['warnings'];
  shaderCapability: ModpackShaderCapability;
  runtime: RuntimeDependencyState;
}

export type ModpackShaderCapabilityTone = 'positive' | 'warning' | 'error' | 'neutral';

function translateWithFallback(t: (key: string) => string, key: string, fallback: string) {
  const translated = t(key);
  return translated === key ? fallback : translated;
}

function trimOrEmpty(value?: string | null): string {
  return value?.trim() ?? '';
}

function isRuntimeDependencyWarning(
  value: ModpackShaderCapabilityReason,
): value is RuntimeDependencyWarning {
  return value === 'optifine_requires_forge' || value === 'optifine_requires_supported_version';
}

function normalizeModLoader(
  modLoader?:
    | {
        type: ModLoaderType;
        version?: string;
      }
    | null,
) {
  if (!modLoader) {
    return undefined;
  }

  return {
    type: modLoader.type,
    version: trimOrEmpty(modLoader.version) || undefined,
  };
}

function buildShaderCapability(params: {
  source: ModpackRuntimeSummarySource;
  runtime: RuntimeDependencyState;
  requestedOptiFine: boolean;
}): ModpackShaderCapability {
  const { source, runtime, requestedOptiFine } = params;

  if (source !== 'config' || !runtime.minecraftVersion) {
    return {
      status: 'unverified',
      reason: 'runtime_source_unverified',
      warnings: [...runtime.warnings],
    };
  }

  if (runtime.useOptiFine) {
    return {
      status: 'supported',
      reason: 'optifine_enabled',
      warnings: [...runtime.warnings],
    };
  }

  if (requestedOptiFine && runtime.warnings.length > 0) {
    return {
      status: 'unsupported',
      reason: runtime.warnings[0],
      warnings: [...runtime.warnings],
    };
  }

  return {
    status: 'needs-setup',
    reason: 'shader_runtime_not_configured',
    warnings: [...runtime.warnings],
  };
}

export function buildModpackRuntimeSummary(input: ModpackRuntimeSummaryInput): ModpackRuntimeSummary {
  const configMinecraft = trimOrEmpty(input.config?.runtime.minecraft);
  const metadataMinecraft = trimOrEmpty(input.metadata?.minecraftVersion);
  const fallbackMinecraft = trimOrEmpty(input.fallback?.minecraftVersion);

  const configLoader = normalizeModLoader(input.config?.runtime.modLoader);
  const metadataLoader = normalizeModLoader(input.metadata?.modLoader);
  const fallbackLoader = normalizeModLoader(input.fallback?.modLoader);

  const minecraftVersion = configMinecraft || metadataMinecraft || fallbackMinecraft;
  const modLoader = configLoader ?? metadataLoader ?? fallbackLoader;
  const requestedOptiFine = Boolean(input.config?.game?.useOptiFine ?? input.fallback?.useOptiFine);
  const isOptiFineSupported =
    minecraftVersion && input.optiFineVersions
      ? input.optiFineVersions.includes(minecraftVersion)
      : true;

  const runtime = buildRuntimeDependencyState({
    minecraftVersion,
    modLoaderType: modLoader?.type ?? 'vanilla',
    modLoaderVersion: modLoader?.version,
    useOptiFine: requestedOptiFine,
    isOptiFineSupported,
  });

  let source: ModpackRuntimeSummarySource = 'unknown';
  if (configMinecraft || configLoader) {
    source = 'config';
  } else if (metadataMinecraft || metadataLoader) {
    source = 'metadata';
  } else if (fallbackMinecraft || fallbackLoader) {
    source = 'fallback';
  }

  const status: ModpackRuntimeSummaryStatus = !minecraftVersion
    ? 'error'
    : runtime.warnings.length > 0
      ? 'warning'
      : 'healthy';
  const shaderCapability = buildShaderCapability({
    source,
    runtime,
    requestedOptiFine,
  });

  return {
    source,
    status,
    minecraftVersion: runtime.minecraftVersion,
    modLoader: runtime.modLoader,
    requestedOptiFine,
    useOptiFine: runtime.useOptiFine,
    warnings: runtime.warnings,
    shaderCapability,
    runtime,
  };
}

export function getModpackRuntimeLoaderLabel(
  summary: Pick<ModpackRuntimeSummary, 'modLoader'>,
  t: (key: string) => string,
): string {
  const baseLabel = getModloaderDisplayLabel(summary.modLoader, t);
  if (!summary.modLoader?.version) {
    return baseLabel;
  }

  return `${baseLabel} ${summary.modLoader.version}`;
}

export function getModpackRuntimeContextLabel(
  summary: Pick<ModpackRuntimeSummary, 'minecraftVersion' | 'modLoader'>,
  t: (key: string) => string,
): string {
  const loaderLabel = getModpackRuntimeLoaderLabel(summary, t);
  if (!summary.minecraftVersion) {
    return loaderLabel;
  }

  return `${summary.minecraftVersion} • ${loaderLabel}`;
}

export function getModpackShaderCapabilityTone(
  status: ModpackShaderCapabilityStatus,
): ModpackShaderCapabilityTone {
  switch (status) {
    case 'supported':
      return 'positive';
    case 'needs-setup':
      return 'warning';
    case 'unsupported':
      return 'error';
    case 'unverified':
    default:
      return 'neutral';
  }
}

export function getModpackShaderCapabilityLabel(
  status: ModpackShaderCapabilityStatus,
  t: (key: string) => string,
): string {
  switch (status) {
    case 'supported':
      return translateWithFallback(t, 'modpacks.shader_capability_supported', 'Supported');
    case 'needs-setup':
      return translateWithFallback(t, 'modpacks.shader_capability_needs_setup', 'Needs setup');
    case 'unsupported':
      return translateWithFallback(t, 'modpacks.shader_capability_unsupported', 'Unsupported');
    case 'unverified':
    default:
      return translateWithFallback(t, 'modpacks.shader_capability_unverified', 'Unverified');
  }
}

export function getModpackShaderCapabilityDescription(
  summary: Pick<ModpackRuntimeSummary, 'source' | 'minecraftVersion' | 'modLoader' | 'shaderCapability'>,
  t: (key: string) => string,
): string {
  const runtimeLabel = getModpackRuntimeContextLabel(summary, t);

  if (isRuntimeDependencyWarning(summary.shaderCapability.reason)) {
    const warning = getRuntimeDependencyWarningMessage(summary.shaderCapability.reason, t);
    return translateWithFallback(
      t,
      'modpacks.shader_capability_unsupported_desc',
      '{{warning}} Current runtime: {{runtime}}. FMCL cannot claim shader support here yet.',
    )
      .replace('{{warning}}', warning)
      .replace('{{runtime}}', runtimeLabel);
  }

  switch (summary.shaderCapability.reason) {
    case 'optifine_enabled':
      return translateWithFallback(
        t,
        'modpacks.shader_capability_supported_desc',
        'FMCL sees shader runtime support configured for {{runtime}}. Individual shader packs can still be incompatible.',
      ).replace('{{runtime}}', runtimeLabel);
    case 'shader_runtime_not_configured':
      return translateWithFallback(
        t,
        'modpacks.shader_capability_needs_setup_desc',
        'FMCL can read this modpack runtime ({{runtime}}), but it does not see shader support configured there yet.',
      ).replace('{{runtime}}', runtimeLabel);
    case 'runtime_source_unverified': {
      const sourceLabel = translateWithFallback(
        t,
        summary.source === 'metadata'
          ? 'modpacks.shader_capability_source_metadata'
          : summary.source === 'fallback'
            ? 'modpacks.shader_capability_source_fallback'
            : 'modpacks.shader_capability_source_unknown',
        summary.source === 'metadata'
          ? 'metadata'
          : summary.source === 'fallback'
            ? 'launcher fallback data'
            : 'runtime details that are not confirmed yet',
      );

      return translateWithFallback(
        t,
        'modpacks.shader_capability_unverified_desc',
        'FMCL is only seeing {{source}} for {{runtime}}, so shader compatibility is still unverified.',
      )
        .replace('{{source}}', sourceLabel)
        .replace('{{runtime}}', runtimeLabel);
    }
    default:
      return translateWithFallback(
        t,
        'modpacks.shader_capability_missing_runtime_desc',
        'FMCL could not verify this modpack runtime yet, so shader compatibility is still unverified.',
      );
  }
}

export function getModpackRuntimeStatusLabel(
  status: ModpackRuntimeSummaryStatus,
  t: (key: string) => string,
): string {
  switch (status) {
    case 'healthy':
      return translateWithFallback(t, 'modpacks.runtime_status_healthy', 'Ready');
    case 'warning':
      return translateWithFallback(t, 'modpacks.runtime_status_warning', 'Warning');
    case 'error':
      return translateWithFallback(t, 'modpacks.runtime_status_error', 'Broken');
    default:
      return status;
  }
}
