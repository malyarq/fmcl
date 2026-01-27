import type { ModpackConfig, NetworkMode } from '../types';
import { clamp, toMbFromGb } from '../utils/memory';

/**
 * Legacy migration seed: before instances.json existed, settings lived in localStorage.
 * This reads localStorage and constructs a default modpack seed for main-process bootstrap.
 */
export function buildLegacySeedFromLocalStorage(): Partial<ModpackConfig> {
  const legacyRamGb = parseFloat(localStorage.getItem('settings_ram') || '4');
  const legacyJavaPath = localStorage.getItem('settings_javaPath') || '';
  const legacyNetworkMode = (localStorage.getItem('settings_networkMode') as NetworkMode) || undefined;

  return {
    id: 'default',
    name: 'Default',
    runtime: { minecraft: '1.12.2', modLoader: { type: 'vanilla' } },
    memory: { maxMb: toMbFromGb(clamp(Number.isFinite(legacyRamGb) ? legacyRamGb : 4, 1, 64)) },
    java: legacyJavaPath ? { path: legacyJavaPath } : undefined,
    vmOptions: [],
    networkMode: legacyNetworkMode ?? 'hyperswarm',
  };
}

