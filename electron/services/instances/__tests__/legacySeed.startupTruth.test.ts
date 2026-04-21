// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { buildLegacySeedFromLocalStorage } from '../../../../src/contexts/instances/services/legacySeed';

describe('buildLegacySeedFromLocalStorage startup truth', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('migrates legacy RAM and launcher settings without inventing a legacy runtime', () => {
    localStorage.setItem('settings_ram', '8');
    localStorage.setItem('settings_javaPath', '/Library/Java/JavaVirtualMachines/temurin-21');
    localStorage.setItem('settings_networkMode', 'xmcl_lan');

    const seed = buildLegacySeedFromLocalStorage();

    expect(seed.runtime).toBeUndefined();
    expect(seed.memory).toEqual({ maxMb: 8192 });
    expect(seed.java).toEqual({ path: '/Library/Java/JavaVirtualMachines/temurin-21' });
    expect(seed.vmOptions).toEqual([]);
    expect(seed.networkMode).toBe('xmcl_lan');
  });

  it('falls back to 4 GB and hyperswarm when legacy values are missing or invalid', () => {
    localStorage.setItem('settings_ram', 'not-a-number');

    const seed = buildLegacySeedFromLocalStorage();

    expect(seed.runtime).toBeUndefined();
    expect(seed.memory).toEqual({ maxMb: 4096 });
    expect(seed.java).toBeUndefined();
    expect(seed.vmOptions).toEqual([]);
    expect(seed.networkMode).toBe('hyperswarm');
  });
});
