import type { ModpackConfig } from '../../modpacks/modpackService';

export type EffectiveResolution = { width: number; height: number } | { fullscreen: true };
export type EffectiveServer = { ip: string; port: number };

export function computeEffectiveLaunchOptions(params: {
  options: {
    version: string;
    ram: number;
    javaPath?: string;
    vmOptions?: string[];
    useOptiFine?: boolean;
  };
  instanceCfg?: ModpackConfig;
}) {
  const { options, instanceCfg } = params;

  const runtimeMinecraft = instanceCfg?.runtime?.minecraft?.trim();
  const runtimeLoader = instanceCfg?.runtime?.modLoader?.type?.toLowerCase();
  let requestedVersion = options.version;
  if (runtimeMinecraft) {
    if (runtimeLoader === 'neoforge') requestedVersion = `${runtimeMinecraft}-NeoForge`;
    else if (runtimeLoader === 'forge') requestedVersion = `${runtimeMinecraft}-Forge`;
    else if (runtimeLoader === 'fabric') requestedVersion = `${runtimeMinecraft}-Fabric`;
    else requestedVersion = runtimeMinecraft;
  }

  const ramGb = (() => {
    const mb = instanceCfg?.memory?.maxMb;
    if (typeof mb === 'number' && Number.isFinite(mb) && mb > 0) return mb / 1024;
    return options.ram;
  })();

  const effectiveJavaPath = (instanceCfg?.java?.path ?? options.javaPath)?.trim() || '';
  const effectiveVmOptions = (instanceCfg?.vmOptions ?? options.vmOptions ?? []).filter(
    (s) => typeof s === 'string' && s.trim().length > 0
  );
  const effectiveMcArgs = (instanceCfg?.game?.extraArgs ?? []).filter((s) => typeof s === 'string' && s.trim().length > 0);

  const resolution = instanceCfg?.game?.resolution;
  const effectiveResolution = (() => {
    const fullscreen = Boolean(resolution?.fullscreen);
    if (fullscreen) return { fullscreen: true } as const;
    const width = resolution?.width;
    const height = resolution?.height;
    const wOk = typeof width === 'number' && Number.isFinite(width) && width > 0;
    const hOk = typeof height === 'number' && Number.isFinite(height) && height > 0;
    if (wOk && hOk) return { width, height };
    return undefined;
  })();

  const effectiveServer = (() => {
    const host = instanceCfg?.server?.host?.trim();
    const port = instanceCfg?.server?.port;
    if (!host) return undefined;
    if (typeof port !== 'number' || !Number.isFinite(port) || port <= 0) return undefined;
    return { ip: host, port };
  })();

  return {
    requestedVersion,
    ramGb,
    effectiveJavaPath,
    effectiveVmOptions,
    effectiveMcArgs,
    effectiveResolution: effectiveResolution as EffectiveResolution | undefined,
    effectiveServer: effectiveServer as EffectiveServer | undefined,
  };
}

