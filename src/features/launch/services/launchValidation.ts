import type { LoaderType } from '../types';

export function isLoaderSupported(params: {
  loaderType: LoaderType;
  mcVersion: string;
  forgeVersions: string[];
  fabricVersions: string[];
  neoForgeVersions: string[];
}) {
  const { loaderType, mcVersion, forgeVersions, fabricVersions, neoForgeVersions } = params;
  if (loaderType === 'forge') return forgeVersions.includes(mcVersion);
  if (loaderType === 'fabric') return fabricVersions.includes(mcVersion);
  if (loaderType === 'neoforge') return neoForgeVersions.includes(mcVersion);
  return true;
}

export function computeLaunchVersion(params: { loaderType: LoaderType; mcVersion: string }) {
  const { loaderType, mcVersion } = params;
  // Construct version string expected by backend.
  // Priority: NeoForge > Forge > Fabric (only one modloader can be active)
  if (loaderType === 'neoforge') return `${mcVersion}-NeoForge`;
  if (loaderType === 'forge') return `${mcVersion}-Forge`;
  if (loaderType === 'fabric') return `${mcVersion}-Fabric`;
  return mcVersion;
}

export function shouldDisableOptiFine(params: {
  useOptiFine: boolean;
  mcVersion: string;
  loaderType: LoaderType;
  optiFineVersions: string[];
}) {
  const { useOptiFine, mcVersion, loaderType, optiFineVersions } = params;
  if (!useOptiFine) return false;
  // OptiFine only works with Forge in this launcher
  if (loaderType !== 'forge') return true;
  if (!optiFineVersions.includes(mcVersion)) return true;
  return false;
}

