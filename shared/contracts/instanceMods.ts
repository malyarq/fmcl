import type { ModEntry } from '../types/mods';

export const INSTANCE_MODS_CHANNELS = [
  'instance-mods:list',
  'instance-mods:remove',
  'instance-mods:setEnabled',
  'instance-mods:register',
] as const;

export type InstanceModsChannel = (typeof INSTANCE_MODS_CHANNELS)[number];

/** Logical provider identifiers for a manifest entry; no filesystem path is accepted. */
export interface InstanceModRegistrationRequest {
  platform: 'curseforge' | 'modrinth';
  projectId: string;
  versionId: string;
}

/** Path-free mod-content capability bound to an opaque canonical instance ID. */
export interface InstanceModsAPI {
  list: (instanceId: string) => Promise<ModEntry[]>;
  remove: (instanceId: string, fileName: string) => Promise<{ ok: boolean }>;
  setEnabled: (instanceId: string, fileName: string, enabled: boolean) => Promise<{ ok: boolean }>;
  register: (instanceId: string, request: InstanceModRegistrationRequest) => Promise<{ ok: boolean }>;
}
