import type { ModLoaderType } from '../../contexts/instances/types';

export interface RuntimeDependencyState {
  minecraftVersion: string;
  modLoader?: {
    type: ModLoaderType;
    version?: string;
  };
}

function translateWithFallback(t: (key: string) => string, key: string, fallback: string) {
  const translated = t(key);
  return translated === key ? fallback : translated;
}

export function buildRuntimeDependencyState(
  minecraftVersion: string,
  modLoaderType: ModLoaderType,
  modLoaderVersion?: string,
): RuntimeDependencyState {
  return {
    minecraftVersion,
    modLoader:
      modLoaderType === 'vanilla'
        ? undefined
        : {
            type: modLoaderType,
            version: modLoaderVersion,
          },
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
