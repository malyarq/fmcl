import type { DownloadProviderId } from '../mirrors/providers';
import type { VersionEntry } from './types';
import { discoverForgeSupportedVersions } from './versionDiscovery/forge';
import { discoverFabricSupportedVersions } from './versionDiscovery/fabric';
import { discoverOptiFineSupportedVersions } from './versionDiscovery/optifine';
import { discoverNeoForgeSupportedVersions } from './versionDiscovery/neoforge';

export async function getForgeSupportedVersions(params: {
  getVersionList: (providerId?: DownloadProviderId) => Promise<{ versions: VersionEntry[] }>;
  providerId?: DownloadProviderId;
}): Promise<string[]> {
  return await discoverForgeSupportedVersions({
    getVersionList: params.getVersionList as unknown as (id?: DownloadProviderId) => Promise<{ versions: VersionEntry[] }>,
    providerId: params.providerId,
  });
}

export async function getFabricSupportedVersions(params: {
  getVersionList: () => Promise<{ versions: VersionEntry[] }>;
}): Promise<string[]> {
  return await discoverFabricSupportedVersions({
    getVersionList: params.getVersionList as unknown as () => Promise<{ versions: VersionEntry[] }>,
  });
}

export async function getOptiFineSupportedVersions(params: {
  getVersionList: () => Promise<{ versions: VersionEntry[] }>;
}): Promise<string[]> {
  return await discoverOptiFineSupportedVersions({
    getVersionList: params.getVersionList as unknown as () => Promise<{ versions: VersionEntry[] }>,
  });
}

export async function getNeoForgeSupportedVersions(params: {
  getVersionList: (providerId?: DownloadProviderId) => Promise<{ versions: VersionEntry[] }>;
  providerId?: DownloadProviderId;
}): Promise<string[]> {
  return await discoverNeoForgeSupportedVersions({
    getVersionList: params.getVersionList as unknown as (id?: DownloadProviderId) => Promise<{ versions: VersionEntry[] }>,
    providerId: params.providerId,
  });
}

