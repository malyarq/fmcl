import { installFabric } from '@xmcl/installer';
import { getFabricLoaderVersion } from '../../versions/versionResolver';
import type { TaskProgressData } from '../types';

export async function installFabricClient(params: {
  rootPath: string;
  mcVersion: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  downloadOptions: any;
  onLog: (data: string) => void;
  onProgress: (data: TaskProgressData) => void;
}) {
  const { rootPath, mcVersion, downloadOptions, onLog, onProgress } = params;

  onLog('Resolving Fabric loader version...');
  const fabricLoaderVersion = await getFabricLoaderVersion(mcVersion, onLog);
  if (!fabricLoaderVersion) {
    throw new Error(`Fabric is not available for Minecraft ${mcVersion}`);
  }

  onLog(`Installing Fabric ${mcVersion} with loader ${fabricLoaderVersion}...`);
  onProgress({ type: 'Fabric', task: 0, total: 100 });

  try {
    const launchVersion = await installFabric({
      minecraft: rootPath,
      minecraftVersion: mcVersion,
      version: fabricLoaderVersion,
      side: 'client',
      ...downloadOptions,
    });
    onLog('[Fabric] ✓ Installed successfully!');
    onLog(`[Fabric] Version ID: ${launchVersion}`);
    onLog(`[Fabric] Loader version: ${fabricLoaderVersion}`);
    onProgress({ type: 'Fabric', task: 100, total: 100 });
    return launchVersion;
  } catch (err: unknown) {
    const errorMsg = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : String(err);
    onLog(`[Fabric] ✗ Installation error: ${errorMsg ?? err}`);
    throw err;
  }
}

