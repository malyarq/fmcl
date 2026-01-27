import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import type { DownloadProvider } from '../mirrors/providers';
import type { ModpackService, ModpackConfig } from '../modpacks/modpackService';
import { resolveRootAndModpack } from './launchFlow/resolveModpack';
import { loadModpackConfig } from './launchFlow/loadModpackConfig';
import { computeEffectiveLaunchOptions } from './launchFlow/computeEffectiveLaunchOptions';
import { prepareAuthInjector } from './launchFlow/prepareAuthInjector';
import { createOfflineUser } from './launchFlow/createOfflineUser';
import type { LaunchGameOptions } from './orchestratorTypes';

export function prepareLaunchContext(params: {
  modpacks: ModpackService;
  options: LaunchGameOptions;
}) {
  const { modpacks, options } = params;

  const { rootPath, modpackId, modpackPath } = resolveRootAndModpack({
    modpacks,
    options: {
      gamePath: options.gamePath,
      modpackId: options.modpackId ?? options.instanceId,
      modpackPath: options.modpackPath ?? options.instancePath,
    },
  });

  const modpackCfg: ModpackConfig | undefined = loadModpackConfig({
    modpacks,
    rootPath,
    modpackId,
    modpackPath,
  });

  const effective = computeEffectiveLaunchOptions({ options, instanceCfg: modpackCfg });

  return {
    rootPath,
    modpackId,
    modpackPath,
    modpackCfg,
    // Legacy aliases for backward compatibility
    instanceId: modpackId,
    instancePath: modpackPath,
    instanceCfg: modpackCfg,
    effective,
  };
}

export async function ensureAuthInjector(params: {
  rootPath: string;
  modpackPath: string;
  downloadProvider: DownloadProvider;
  maxSockets: number;
  onLog: (data: string) => void;
}) {
  const { rootPath, modpackPath, downloadProvider, maxSockets, onLog } = params;

  const injectorBase = app.isPackaged ? process.resourcesPath : app.getAppPath();
  // In dev, the jar lives in repo `resources/`. In prod, electron-builder copies it to the resources root.
  const injectorCandidates = [
    path.join(injectorBase, 'authlib-injector.jar'),
    path.join(injectorBase, 'resources', 'authlib-injector.jar'),
  ];
  const sourceInjectorPath = injectorCandidates.find((p) => fs.existsSync(p)) ?? injectorCandidates[0];
  const destInjectorPath = path.join(rootPath, 'authlib-injector.jar');

  const modsPath = path.join(modpackPath, 'mods');
  try {
    fs.mkdirSync(modsPath, { recursive: true });
  } catch {
    // ignore
  }

  await prepareAuthInjector({
    sourceInjectorPath,
    destInjectorPath,
    downloadProvider,
    maxSockets,
    onLog,
  });

  return { destInjectorPath };
}

export function createOfflineSession(nickname: string) {
  return createOfflineUser(nickname);
}

