import fs from 'node:fs';
import { resolvePathWithinRoot } from '../../security/pathGuards';
import type { CanonicalInstanceRecord, InstanceEditableConfig, InstanceLoader } from '../../domains/instances/instanceTypes';

type JsonObject = Record<string, unknown>;
type MutableConfig = {
  runtime: InstanceEditableConfig['runtime'];
  java?: { executable?: string };
  memory?: { maxMb: number; minMb?: number };
  vmOptions?: string[];
  game?: { resolution?: { width?: number; height?: number; fullscreen?: boolean }; extraArgs?: string[] };
  server?: { host: string; port: number };
  networkMode?: InstanceEditableConfig['networkMode'];
};

function object(value: unknown, label: string): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as JsonObject;
}

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a non-empty string`);
  return value;
}

function optionalString(value: unknown, label: string): string | undefined {
  return value === undefined ? undefined : nonEmptyString(value, label);
}

function loader(value: unknown, label: string): Readonly<{ type: InstanceLoader; version?: string }> | undefined {
  if (value === undefined) return undefined;
  const candidate = object(value, label);
  const type = nonEmptyString(candidate.type, `${label}.type`);
  if (!['vanilla', 'forge', 'fabric', 'quilt', 'neoforge'].includes(type)) throw new Error(`${label}.type is unsupported`);
  const version = optionalString(candidate.version, `${label}.version`);
  return { type: type as InstanceLoader, ...(version === undefined ? {} : { version }) };
}

function configFromLegacy(value: unknown, expectedId: string): Readonly<{ name: string; createdAt: string; updatedAt: string; config: InstanceEditableConfig }> {
  const candidate = object(value, 'Staged modpack config');
  if (nonEmptyString(candidate.id, 'Staged modpack config id') !== expectedId) throw new Error('Staged modpack config id does not match destination');
  const name = nonEmptyString(candidate.name, 'Staged modpack config name');
  const runtime = object(candidate.runtime, 'Staged modpack runtime');
  const config: MutableConfig = {
    runtime: {
      minecraftVersion: nonEmptyString(runtime.minecraft, 'Staged modpack runtime minecraft'),
      ...(loader(runtime.modLoader, 'Staged modpack runtime modLoader') === undefined ? {} : { modLoader: loader(runtime.modLoader, 'Staged modpack runtime modLoader') }),
    },
  };
  if (candidate.java !== undefined) {
    const java = object(candidate.java, 'Staged modpack java');
    const executable = optionalString(java.path, 'Staged modpack java path');
    config.java = executable === undefined ? {} : { executable };
  }
  if (candidate.memory !== undefined) {
    const memory = object(candidate.memory, 'Staged modpack memory');
    if (typeof memory.maxMb !== 'number' || (memory.minMb !== undefined && typeof memory.minMb !== 'number')) throw new Error('Staged modpack memory is invalid');
    config.memory = { maxMb: memory.maxMb, ...(typeof memory.minMb === 'number' ? { minMb: memory.minMb } : {}) };
  }
  if (candidate.vmOptions !== undefined) {
    if (!Array.isArray(candidate.vmOptions) || candidate.vmOptions.some((entry) => typeof entry !== 'string')) throw new Error('Staged modpack vmOptions are invalid');
    config.vmOptions = [...candidate.vmOptions];
  }
  if (candidate.game !== undefined) {
    const game = object(candidate.game, 'Staged modpack game');
    const next: NonNullable<MutableConfig['game']> = {};
    if (game.resolution !== undefined) {
      const resolution = object(game.resolution, 'Staged modpack resolution');
      if ((resolution.width !== undefined && typeof resolution.width !== 'number')
        || (resolution.height !== undefined && typeof resolution.height !== 'number')
        || (resolution.fullscreen !== undefined && typeof resolution.fullscreen !== 'boolean')) throw new Error('Staged modpack resolution is invalid');
      next.resolution = {
        ...(typeof resolution.width === 'number' ? { width: resolution.width } : {}),
        ...(typeof resolution.height === 'number' ? { height: resolution.height } : {}),
        ...(typeof resolution.fullscreen === 'boolean' ? { fullscreen: resolution.fullscreen } : {}),
      };
    }
    if (game.extraArgs !== undefined) {
      if (!Array.isArray(game.extraArgs) || game.extraArgs.some((entry) => typeof entry !== 'string')) throw new Error('Staged modpack extraArgs are invalid');
      next.extraArgs = [...game.extraArgs];
    }
    config.game = next;
  }
  if (candidate.server !== undefined) {
    const server = object(candidate.server, 'Staged modpack server');
    if (typeof server.host !== 'string' || typeof server.port !== 'number') throw new Error('Staged modpack server is invalid');
    config.server = { host: server.host, port: server.port };
  }
  if (candidate.networkMode !== undefined) {
    if (!['hyperswarm', 'xmcl_lan', 'xmcl_upnp_host'].includes(String(candidate.networkMode))) throw new Error('Staged modpack network mode is invalid');
    config.networkMode = candidate.networkMode as InstanceEditableConfig['networkMode'];
  }
  const now = new Date().toISOString();
  return {
    name,
    createdAt: optionalString(candidate.createdAt, 'Staged modpack createdAt') ?? now,
    updatedAt: optionalString(candidate.updatedAt, 'Staged modpack updatedAt') ?? now,
    config,
  };
}

/** Converts only the verified staged/published content config into a canonical command record. */
export function readCanonicalRecordFromContent(instancePath: string, expectedId: string): CanonicalInstanceRecord {
  const configPath = resolvePathWithinRoot(instancePath, 'modpack.json', 'Staged modpack config');
  if (!fs.existsSync(configPath)) throw new Error('Staged modpack config is missing');
  const parsed = configFromLegacy(JSON.parse(fs.readFileSync(configPath, 'utf8')) as unknown, expectedId);
  return {
    id: expectedId,
    name: parsed.name,
    source: { source: 'local', createdAt: parsed.createdAt, updatedAt: parsed.updatedAt },
    config: parsed.config,
    summary: {
      minecraftVersion: parsed.config.runtime.minecraftVersion,
      ...(parsed.config.runtime.modLoader === undefined ? {} : { modLoader: { ...parsed.config.runtime.modLoader } }),
    },
  };
}
