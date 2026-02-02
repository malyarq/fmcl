export type LastGame = {
  versionId: string;
  nickname: string;
  loader: 'vanilla' | 'forge' | 'fabric' | 'neoforge';
  /** Resolved launch version (e.g. "1.20.1" or "forge-1.20.1-47.2.0") for Play Now. */
  launchVersion: string;
  timestamp: number;
};

const STORAGE_PREFIX = 'lastGame_';
const LEGACY_STORAGE_KEY = 'simple_play_lastGame';

export function loadLastGame(modpackId: string): LastGame | null {
  try {
    let raw = localStorage.getItem(STORAGE_PREFIX + modpackId);
    if (!raw && modpackId === 'classic') {
      raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as unknown;
          if (parsed && typeof parsed === 'object' && typeof (parsed as LastGame).timestamp === 'number') {
            saveLastGame(modpackId, parsed as LastGame);
            localStorage.removeItem(LEGACY_STORAGE_KEY);
          }
        } catch {
          /* ignore */
        }
      }
    }
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as LastGame).versionId === 'string' &&
      typeof (parsed as LastGame).nickname === 'string' &&
      typeof (parsed as LastGame).timestamp === 'number' &&
      typeof (parsed as LastGame).launchVersion === 'string'
    ) {
      const loader = (parsed as LastGame).loader;
      if (['vanilla', 'forge', 'fabric', 'neoforge'].includes(loader)) {
        return parsed as LastGame;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function saveLastGame(modpackId: string, data: LastGame): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + modpackId, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function formatLastLaunch(timestamp: number, t: (k: string) => string): string {
  const d = new Date(timestamp);
  const now = new Date();
  const timeStr = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    const label = t('dashboard.last_launch_today') || 'Today';
    return `${label}, ${timeStr}`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    const label = t('dashboard.last_launch_yesterday') || 'Yesterday';
    return `${label}, ${timeStr}`;
  }
  return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}
