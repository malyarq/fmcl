import type { InstanceEditableConfig } from '../../../domains/instances/instanceTypes';

export type EffectiveResolution = { width: number; height: number } | { fullscreen: true };
export type EffectiveServer = { ip: string; port: number };

export function computeEffectiveLaunchOptions(params: {
  options: {
    version: string;
    ram: number;
    useOptiFine?: boolean;
  };
  config: InstanceEditableConfig;
}) {
  const { options, config } = params;

  const runtimeMinecraft = config.runtime.minecraftVersion.trim();
  const runtimeLoader = config.runtime.modLoader?.type.toLowerCase();
  let requestedVersion = options.version;
  if (runtimeMinecraft) {
    if (runtimeLoader === 'neoforge') requestedVersion = `${runtimeMinecraft}-NeoForge`;
    else if (runtimeLoader === 'forge') requestedVersion = `${runtimeMinecraft}-Forge`;
    else if (runtimeLoader === 'fabric') requestedVersion = `${runtimeMinecraft}-Fabric`;
    else requestedVersion = runtimeMinecraft;
  }

  const ramGb = (() => {
    const mb = config.memory?.maxMb;
    if (typeof mb === 'number' && Number.isFinite(mb) && mb > 0) return mb / 1024;
    return options.ram;
  })();

  const minRamGb = (() => {
    const mb = config.memory?.minMb;
    if (typeof mb === 'number' && Number.isFinite(mb) && mb > 0) return mb / 1024;
    return undefined;
  })();

  const effectiveJavaPath = config.java?.executable?.trim() || '';
  const effectiveVmOptions = (config.vmOptions ?? []).filter(
    (s) => typeof s === 'string' && s.trim().length > 0
  );
  const effectiveMcArgs = (config.game?.extraArgs ?? []).filter((s) => typeof s === 'string' && s.trim().length > 0);

  const resolution = config.game?.resolution;
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
    const host = config.server?.host.trim();
    const port = config.server?.port;
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
    minRamGb,
  };
}
