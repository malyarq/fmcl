export type Mode = 'host' | 'join';

const KEYS = {
  mode: 'mp_mode',
  hostPort: 'mp_host_port',
  joinCode: 'mp_join_code',
} as const;

export function loadMode(): Mode { return localStorage.getItem(KEYS.mode) === 'join' ? 'join' : 'host'; }
export function saveMode(mode: Mode): void { localStorage.setItem(KEYS.mode, mode); }
export function loadHostPort(fallback: string): string { return localStorage.getItem(KEYS.hostPort) || fallback; }
export function saveHostPort(port: string): void { localStorage.setItem(KEYS.hostPort, port); }
export function loadJoinCode(): string { return localStorage.getItem(KEYS.joinCode) || ''; }
export function saveJoinCode(code: string): void { localStorage.setItem(KEYS.joinCode, code); }

/** Remove session truth written by releases before 0.8.0. */
export function clearLegacySessionTruth(): void {
  localStorage.removeItem('mp_room_code');
  localStorage.removeItem('mp_mapped_port');
}

