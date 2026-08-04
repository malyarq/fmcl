import { assertChildName } from '../../security/pathGuards';
import type { LaunchGameOptions } from '../../services/launcher/orchestratorTypes';
import type { DownloadProviderId } from '../../services/mirrors/providers';
import {
  validateBoolean,
  validateBoundedString,
  validateEnum,
  validateInteger,
  validateOfflineNickname,
} from './privilegedPayloads';

const DOWNLOAD_PROVIDERS = ['mojang', 'bmcl', 'auto'] as const satisfies readonly DownloadProviderId[];
const LAUNCH_OPTION_KEYS = new Set([
  'nickname',
  'version',
  'ram',
  'hideLauncher',
  'instanceId',
  'downloadProvider',
  'autoDownloadThreads',
  'downloadThreads',
  'maxSockets',
  'useOptiFine',
]);

function optionalBoolean(value: unknown, label: string): boolean | undefined {
  return value === undefined ? undefined : validateBoolean(value, label);
}

function optionalChildName(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return assertChildName(validateBoundedString(value, label, { maxLength: 128 }), label);
}

function optionalInteger(value: unknown, label: string, min: number, max: number): number | undefined {
  return value === undefined ? undefined : validateInteger(value, label, { min, max });
}

export function validateLaunchGameOptions(value: unknown): LaunchGameOptions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Launch options must be an object');
  }
  const record = value as Record<string, unknown>;
  const unsupported = Object.keys(record).filter((key) => !LAUNCH_OPTION_KEYS.has(key));
  if (unsupported.length) throw new Error(`Launch options contain unsupported fields: ${unsupported.join(', ')}`);

  const version = validateBoundedString(record.version, 'Minecraft version', { maxLength: 128 });
  if (!/^[A-Za-z0-9][A-Za-z0-9._+-]*$/.test(version)) {
    throw new Error('Minecraft version contains unsupported characters');
  }

  return {
    nickname: validateOfflineNickname(record.nickname),
    version,
    ram: validateInteger(record.ram, 'RAM', { min: 1, max: 64 }),
    hideLauncher: optionalBoolean(record.hideLauncher, 'Hide launcher'),
    instanceId: optionalChildName(record.instanceId, 'Instance id'),
    downloadProvider: record.downloadProvider === undefined
      ? undefined
      : validateEnum(record.downloadProvider, 'Download provider', DOWNLOAD_PROVIDERS),
    autoDownloadThreads: optionalBoolean(record.autoDownloadThreads, 'Automatic download threads'),
    downloadThreads: optionalInteger(record.downloadThreads, 'Download threads', 1, 64),
    maxSockets: optionalInteger(record.maxSockets, 'Maximum sockets', 1, 256),
    useOptiFine: optionalBoolean(record.useOptiFine, 'Use OptiFine'),
  };
}

export function validateOptionalDownloadProvider(value: unknown): DownloadProviderId | undefined {
  return value === undefined ? undefined : validateEnum(value, 'Download provider', DOWNLOAD_PROVIDERS);
}
