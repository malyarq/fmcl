import { launcherIPC } from '../ipc/launcherIPC';
import type { MCVersion } from './types';
import type { DownloadProvider } from '../../contexts/settings/types';

export async function fetchMinecraftVersionList(downloadProvider?: DownloadProvider) {
  if (!launcherIPC.has('getVersionList')) return null;
  return await launcherIPC.getVersionList(downloadProvider);
}

export async function fetchForgeSupportedVersions(downloadProvider?: DownloadProvider): Promise<string[] | null> {
  if (!launcherIPC.isAvailable()) return null;
  return await launcherIPC.getForgeSupportedVersions(downloadProvider);
}

export async function fetchFabricSupportedVersions(): Promise<string[] | null> {
  if (!launcherIPC.isAvailable()) return null;
  return await launcherIPC.getFabricSupportedVersions();
}

export async function fetchOptiFineSupportedVersions(): Promise<string[] | null> {
  if (!launcherIPC.isAvailable()) return null;
  return await launcherIPC.getOptiFineSupportedVersions();
}

export async function fetchNeoForgeSupportedVersions(downloadProvider?: DownloadProvider): Promise<string[] | null> {
  if (!launcherIPC.isAvailable()) return null;
  return await launcherIPC.getNeoForgeSupportedVersions(downloadProvider);
}

export function filterReleaseVersions(data: { versions: MCVersion[] }) {
  return data.versions.filter((v: MCVersion) => v.type === 'release');
}

