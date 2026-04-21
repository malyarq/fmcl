import { useState, useEffect } from 'react';
import { useModpack } from '../../../contexts/ModpackContext';
import { useSettings } from '../../../contexts/SettingsContext';
import { modpacksIPC } from '../../../services/ipc/modpacksIPC';
import type { ModpackVersionDescriptor } from '@shared/contracts';
import type { ModpackMetadata } from '@shared/types/modpack';

export interface ModpackUpdateInfo {
  modpackId: string;
  modpackName: string;
  currentVersion: string;
  latestVersion: ModpackVersionDescriptor;
  source: 'curseforge' | 'modrinth';
  sourceId: string;
}

type ModpackUpdateTarget = {
  id: string;
  name: string;
  metadata?: ModpackMetadata;
};

export async function resolveModpackUpdateInfo(
  target: ModpackUpdateTarget,
  minecraftPath: string,
): Promise<ModpackUpdateInfo | null> {
  const metadata = target.metadata ?? await modpacksIPC.getMetadata(target.id, minecraftPath);

  if (!metadata.source || metadata.source === 'local' || !metadata.sourceId) {
    return null;
  }

  let versions: ModpackVersionDescriptor[];

  if (metadata.source === 'curseforge') {
    versions = await modpacksIPC.getCurseForgeVersions(Number(metadata.sourceId));
  } else if (metadata.source === 'modrinth') {
    versions = await modpacksIPC.getModrinthVersions(metadata.sourceId);
  } else {
    return null;
  }

  if (versions.length === 0) {
    return null;
  }

  const latest = versions[0];
  const currentVersionId = metadata.sourceVersionId || metadata.version;

  if (latest.versionId === currentVersionId) {
    return null;
  }

  return {
    modpackId: target.id,
    modpackName: target.name,
    currentVersion: metadata.version || 'unknown',
    latestVersion: latest,
    source: metadata.source,
    sourceId: metadata.sourceId,
  };
}

export async function resolveInstalledModpackUpdates(
  modpacks: ModpackUpdateTarget[],
  minecraftPath: string,
): Promise<ModpackUpdateInfo[]> {
  const results = await Promise.all(
    modpacks.map(async (modpack) => {
      try {
        return await resolveModpackUpdateInfo(modpack, minecraftPath);
      } catch (error) {
        console.error(`Error checking updates for modpack ${modpack.id}:`, error);
        return null;
      }
    }),
  );

  return results.filter((update): update is ModpackUpdateInfo => update !== null);
}

export function useModpackUpdates(autoCheck = false) {
  const { modpacks } = useModpack();
  const { minecraftPath } = useSettings();
  const [updates, setUpdates] = useState<ModpackUpdateInfo[]>([]);
  const [checking, setChecking] = useState(false);

  const checkUpdates = async () => {
    setChecking(true);

    try {
      const availableUpdates = await resolveInstalledModpackUpdates(modpacks, minecraftPath);
      setUpdates(availableUpdates);
      return availableUpdates;
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (autoCheck && modpacks.length > 0) {
      checkUpdates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCheck, modpacks.length]);

  return { updates, checking, checkUpdates };
}
