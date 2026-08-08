import { describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import { LEGACY_USER_DATA_DIRECTORY, resolveCompatibleUserDataPath } from '../userDataCompatibility';

describe('Burrow user-data compatibility', () => {
  const appDataPath = path.join(path.sep, 'users', 'player', 'app-data');
  const currentUserDataPath = path.join(appDataPath, 'Burrow');
  const legacyUserDataPath = path.join(appDataPath, LEGACY_USER_DATA_DIRECTORY);

  it('keeps an existing legacy profile when no Burrow profile exists', () => {
    const exists = vi.fn((target: string) => target === legacyUserDataPath);

    expect(resolveCompatibleUserDataPath({ appDataPath, currentUserDataPath, exists })).toBe(legacyUserDataPath);
  });

  it('uses the Burrow profile when both current and legacy profiles exist', () => {
    expect(resolveCompatibleUserDataPath({ appDataPath, currentUserDataPath, exists: () => true })).toBe(currentUserDataPath);
  });

  it('uses the Burrow profile for a fresh installation', () => {
    expect(resolveCompatibleUserDataPath({ appDataPath, currentUserDataPath, exists: () => false })).toBe(currentUserDataPath);
  });
});
