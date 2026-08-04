import { ipcMain } from 'electron';
import { INSTANCE_MODS_CHANNELS, type InstanceModRegistrationRequest } from '../../../shared/contracts/instanceMods';
import type { InstanceModContentService } from '../../services/mods/instanceModContentService';
import { assertChildName } from '../../security/pathGuards';
import { validateBoolean, validateEnum, validateIdentifier } from '../validation/privilegedPayloads';

type InstanceModsService = Pick<
  InstanceModContentService,
  'list' | 'remove' | 'setEnabled' | 'register'
>;

function instanceId(value: unknown): string {
  return assertChildName(validateIdentifier(value, 'Instance ID'), 'Instance ID');
}

function modFileName(value: unknown): string {
  return assertChildName(validateIdentifier(value, 'Mod filename'), 'Mod filename');
}

function registration(value: unknown): InstanceModRegistrationRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Mod registration must be an object');
  }
  const record = value as Record<string, unknown>;
  const allowedKeys = ['platform', 'projectId', 'versionId'];
  const unsupported = Object.keys(record).filter((key) => !allowedKeys.includes(key));
  if (unsupported.length > 0) {
    throw new Error(`Mod registration contains unsupported fields: ${unsupported.join(', ')}`);
  }
  return {
    platform: validateEnum(record.platform, 'Mod platform', ['curseforge', 'modrinth'] as const),
    projectId: assertChildName(validateIdentifier(record.projectId, 'Mod project ID'), 'Mod project ID'),
    versionId: assertChildName(validateIdentifier(record.versionId, 'Mod version ID'), 'Mod version ID'),
  };
}

/** Registers the path-free mod-content boundary for canonical instance IDs. */
export function registerInstanceModsHandlers(deps: { instanceMods: InstanceModsService }) {
  const { instanceMods } = deps;

  for (const channel of INSTANCE_MODS_CHANNELS) {
    ipcMain.removeHandler(channel);
  }

  ipcMain.handle('instance-mods:list', async (_event, rawInstanceId: unknown) => {
    return instanceMods.list(instanceId(rawInstanceId));
  });

  ipcMain.handle('instance-mods:remove', async (_event, rawInstanceId: unknown, rawFileName: unknown) => {
    instanceMods.remove(instanceId(rawInstanceId), modFileName(rawFileName));
    return { ok: true };
  });

  ipcMain.handle('instance-mods:setEnabled', async (
    _event,
    rawInstanceId: unknown,
    rawFileName: unknown,
    rawEnabled: unknown,
  ) => {
    instanceMods.setEnabled(
      instanceId(rawInstanceId),
      modFileName(rawFileName),
      validateBoolean(rawEnabled, 'Mod enabled'),
    );
    return { ok: true };
  });

  ipcMain.handle('instance-mods:register', async (_event, rawInstanceId: unknown, rawRegistration: unknown) => {
    await instanceMods.register(instanceId(rawInstanceId), registration(rawRegistration));
    return { ok: true };
  });
}
