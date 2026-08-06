import { isSettingsBackupKey, type SettingsBackupValues } from '@shared/contracts/settings';

export function collectSettingsBackup(storage: Pick<Storage, 'key' | 'getItem' | 'length'> = localStorage): SettingsBackupValues {
  const values: Record<string, string> = {};
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key || !isSettingsBackupKey(key)) continue;
    const value = storage.getItem(key);
    if (value !== null) values[key] = value;
  }
  return Object.fromEntries(Object.entries(values).sort(([left], [right]) => left.localeCompare(right)));
}

export function applySettingsBackup(
  values: SettingsBackupValues,
  storage: Pick<Storage, 'key' | 'removeItem' | 'setItem' | 'length'> = localStorage,
): void {
  const existingKeys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && isSettingsBackupKey(key)) existingKeys.push(key);
  }
  for (const key of existingKeys) storage.removeItem(key);
  for (const [key, value] of Object.entries(values)) {
    if (isSettingsBackupKey(key) && typeof value === 'string') storage.setItem(key, value);
  }
}
