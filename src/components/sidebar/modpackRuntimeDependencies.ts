import type { ModLoaderType } from '../../contexts/instances/types';

export type RuntimeDependencyWarning =
  | 'optifine_requires_forge'
  | 'optifine_requires_supported_version';

export interface RuntimeDependencyState {
  minecraftVersion: string;
  modLoader?: {
    type: ModLoaderType;
    version?: string;
  };
  useOptiFine: boolean;
  dependencyCount: number;
  warnings: RuntimeDependencyWarning[];
}

export interface RuntimeDependencyWarningGuidance {
  warning: RuntimeDependencyWarning;
  message: string;
  nextStep: string;
}

export interface BuildRuntimeDependencyStateInput {
  minecraftVersion: string;
  modLoaderType: ModLoaderType;
  modLoaderVersion?: string;
  useOptiFine?: boolean;
  isOptiFineSupported?: boolean;
}

function translateWithFallback(t: (key: string) => string, key: string, fallback: string) {
  const translated = t(key);
  return translated === key ? fallback : translated;
}

function resolveRuntimeDependencyInput(
  inputOrMinecraftVersion: string | BuildRuntimeDependencyStateInput,
  modLoaderType?: ModLoaderType,
  modLoaderVersion?: string,
): BuildRuntimeDependencyStateInput {
  if (typeof inputOrMinecraftVersion === 'string') {
    return {
      minecraftVersion: inputOrMinecraftVersion,
      modLoaderType: modLoaderType ?? 'vanilla',
      modLoaderVersion,
    };
  }

  return inputOrMinecraftVersion;
}

export function shouldKeepOptiFineEnabled(params: {
  useOptiFine: boolean;
  modLoaderType: ModLoaderType;
  isOptiFineSupported: boolean;
}): boolean {
  const { useOptiFine, modLoaderType, isOptiFineSupported } = params;
  return useOptiFine && modLoaderType === 'forge' && isOptiFineSupported;
}

export function buildRuntimeDependencyState(
  inputOrMinecraftVersion: string | BuildRuntimeDependencyStateInput,
  modLoaderType?: ModLoaderType,
  modLoaderVersion?: string,
): RuntimeDependencyState {
  const input = resolveRuntimeDependencyInput(
    inputOrMinecraftVersion,
    modLoaderType,
    modLoaderVersion,
  );
  const requestedOptiFine = Boolean(input.useOptiFine);
  const optiFineWarnings: RuntimeDependencyWarning[] = [];
  const isOptiFineSupported = input.isOptiFineSupported ?? true;

  if (requestedOptiFine && input.modLoaderType !== 'forge') {
    optiFineWarnings.push('optifine_requires_forge');
  }
  if (requestedOptiFine && !isOptiFineSupported) {
    optiFineWarnings.push('optifine_requires_supported_version');
  }

  const useOptiFine = shouldKeepOptiFineEnabled({
    useOptiFine: requestedOptiFine,
    modLoaderType: input.modLoaderType,
    isOptiFineSupported,
  });
  const modLoader =
    input.modLoaderType === 'vanilla'
      ? undefined
      : {
          type: input.modLoaderType,
          version: input.modLoaderVersion,
        };

  return {
    minecraftVersion: input.minecraftVersion,
    modLoader,
    useOptiFine,
    dependencyCount: 1 + (modLoader ? 1 : 0) + (useOptiFine ? 1 : 0),
    warnings: optiFineWarnings,
  };
}

export function getModloaderDisplayLabel(
  modLoader: RuntimeDependencyState['modLoader'],
  t: (key: string) => string,
): string {
  if (!modLoader) {
    return translateWithFallback(t, 'modpacks.loader_vanilla', 'Vanilla');
  }

  switch (modLoader.type) {
    case 'forge':
      return translateWithFallback(t, 'modpacks.loader_forge', 'Forge');
    case 'fabric':
      return translateWithFallback(t, 'modpacks.loader_fabric', 'Fabric');
    case 'quilt':
      return translateWithFallback(t, 'modpacks.loader_quilt', 'Quilt');
    case 'neoforge':
      return translateWithFallback(t, 'modpacks.loader_neoforge', 'NeoForge');
    default:
      return modLoader.type;
  }
}

export function getRuntimeDependencyLoaderLabel(
  runtime: Pick<RuntimeDependencyState, 'modLoader'>,
  t: (key: string) => string,
): string {
  const baseLabel = getModloaderDisplayLabel(runtime.modLoader, t);
  if (!runtime.modLoader?.version) {
    return baseLabel;
  }

  return `${baseLabel} ${runtime.modLoader.version}`;
}

export function getRuntimeDependencyWarningMessage(
  warning: RuntimeDependencyWarning,
  t: (key: string) => string,
): string {
  switch (warning) {
    case 'optifine_requires_forge':
      return translateWithFallback(
        t,
        'modpacks.optifine_requires_forge',
        'OptiFine requires Forge in this launcher.',
      );
    case 'optifine_requires_supported_version':
      return translateWithFallback(
        t,
        'modpacks.optifine_requires_supported_version',
        'OptiFine is only available for supported Minecraft versions.',
      );
    default:
      return warning;
  }
}

export function getRuntimeDependencyWarningNextStep(
  warning: RuntimeDependencyWarning,
  t: (key: string) => string,
): string {
  switch (warning) {
    case 'optifine_requires_forge':
      return translateWithFallback(
        t,
        'modpacks.runtime_warning_fix_optifine_requires_forge',
        'Switch the modloader to Forge or turn off OptiFine in this draft.',
      );
    case 'optifine_requires_supported_version':
      return translateWithFallback(
        t,
        'modpacks.runtime_warning_fix_optifine_requires_supported_version',
        'Choose a Minecraft version with OptiFine support or turn off OptiFine in this draft.',
      );
    default:
      return translateWithFallback(t, 'modpacks.create_error', 'Error creating modpack');
  }
}

export function getRuntimeDependencyWarningGuidance(
  warning: RuntimeDependencyWarning,
  t: (key: string) => string,
): RuntimeDependencyWarningGuidance {
  return {
    warning,
    message: getRuntimeDependencyWarningMessage(warning, t),
    nextStep: getRuntimeDependencyWarningNextStep(warning, t),
  };
}

export function getCreateRuntimeDependencyErrorMessage(
  runtime: Pick<RuntimeDependencyState, 'warnings'>,
  t: (key: string) => string,
): string | null {
  const warning = runtime.warnings[0];
  if (!warning) {
    return null;
  }

  const guidance = getRuntimeDependencyWarningGuidance(warning, t);
  const template = translateWithFallback(
    t,
    'modpacks.create_runtime_warning',
    'FMCL still sees a runtime issue in this draft: {{warning}} {{nextStep}}',
  );

  return template
    .replace('{{warning}}', guidance.message)
    .replace('{{nextStep}}', guidance.nextStep);
}
