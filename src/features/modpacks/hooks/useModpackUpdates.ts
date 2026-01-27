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

export function useModpackUpdates(autoCheck = false) {
  const { modpacks } = useModpack();
  const { minecraftPath } = useSettings();
  const [updates, setUpdates] = useState<ModpackUpdateInfo[]>([]);
  const [checking, setChecking] = useState(false);

  const checkUpdates = async () => {
    setChecking(true);
    const availableUpdates: ModpackUpdateInfo[] = [];

    try {
      for (const modpack of modpacks) {
        try {
          const metadata: ModpackMetadata = await modpacksIPC.getMetadata(modpack.id, minecraftPath);
          
          if (metadata.source && metadata.source !== 'local' && metadata.sourceId) {
            let versions: ModpackVersionDescriptor[];
            
            if (metadata.source === 'curseforge') {
              versions = await modpacksIPC.getCurseForgeVersions(Number(metadata.sourceId));
            } else if (metadata.source === 'modrinth') {
              versions = await modpacksIPC.getModrinthVersions(metadata.sourceId);
            } else {
              continue;
            }

            if (versions.length > 0) {
              const latest = versions[0];
              const currentVersionId = metadata.sourceVersionId || metadata.version;

              if (latest.versionId !== currentVersionId) {
                availableUpdates.push({
                  modpackId: modpack.id,
                  modpackName: modpack.name,
                  currentVersion: metadata.version || 'unknown',
                  latestVersion: latest,
                  source: metadata.source,
                  sourceId: metadata.sourceId,
                });
              }
            }
          }
        } catch (error) {
          console.error(`Error checking updates for modpack ${modpack.id}:`, error);
          // Continue checking other modpacks
        }
      }
    } finally {
      setChecking(false);
    }

    setUpdates(availableUpdates);
    return availableUpdates;
  };

  useEffect(() => {
    if (autoCheck && modpacks.length > 0) {
      checkUpdates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCheck, modpacks.length]);

  return { updates, checking, checkUpdates };
}
