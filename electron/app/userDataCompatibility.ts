import fs from 'node:fs';
import path from 'node:path';

export const LEGACY_USER_DATA_DIRECTORY = '.fmcl';

export function resolveCompatibleUserDataPath(params: {
  appDataPath: string;
  currentUserDataPath: string;
  exists?: (target: string) => boolean;
}): string {
  const exists = params.exists ?? fs.existsSync;
  const legacyUserDataPath = path.join(params.appDataPath, LEGACY_USER_DATA_DIRECTORY);

  // Existing FriendLauncher installations keep their proven data directory so
  // upgrades and rollbacks cannot strand accounts, settings, or game data.
  if (!exists(params.currentUserDataPath) && exists(legacyUserDataPath)) {
    return legacyUserDataPath;
  }

  return params.currentUserDataPath;
}
