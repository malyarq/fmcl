import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import type { DownloadProvider } from '../mirrors/providers';
import type { InstanceReadPort, LauncherRootResolver } from '../../domains/instances/ports';
import type { LaunchAdapters } from '../../infrastructure/instances/launchAdapters';
import { resolveLaunchInstance } from './launchFlow/resolveModpack';
import { loadCanonicalLaunchConfig } from './launchFlow/loadCanonicalLaunchConfig';
import { computeEffectiveLaunchOptions } from './launchFlow/computeEffectiveLaunchOptions';
import { prepareAuthInjector } from './launchFlow/prepareAuthInjector';
import { createOfflineUser } from './launchFlow/createOfflineUser';
import type { LaunchGameOptions } from './orchestratorTypes';

export async function prepareLaunchContext(params: {
  instances: InstanceReadPort;
  rootResolver: LauncherRootResolver;
  native: LaunchAdapters;
  launcherRootPath: string;
  options: LaunchGameOptions;
}) {
  const { instances, rootResolver, native, launcherRootPath, options } = params;

  const launchInstance = await resolveLaunchInstance({
    instances,
    rootResolver,
    native,
    launcherRootPath,
    options,
  });
  const config = loadCanonicalLaunchConfig(launchInstance.record);
  const effective = computeEffectiveLaunchOptions({ options, config });

  return {
    ...launchInstance,
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
