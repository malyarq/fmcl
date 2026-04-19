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
    return translateWithFallback(t, 'modpacks.loader_vanilla', 'Vanilla (no modloader)');
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
