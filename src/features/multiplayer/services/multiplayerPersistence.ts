export type Mode = 'host' | 'join';

export const LS_KEYS = {
  mode: 'mp_mode',
  hostPort: 'mp_host_port',
  roomCode: 'mp_room_code',
  joinCode: 'mp_join_code',
  mappedPort: 'mp_mapped_port',
} as const;

export function loadMode(): Mode {
  return ((localStorage.getItem(LS_KEYS.mode) as Mode) || 'host');
}

export function saveMode(mode: Mode) {
  localStorage.setItem(LS_KEYS.mode, mode);
}

export function loadHostPort(fallback: string) {
  return localStorage.getItem(LS_KEYS.hostPort) || fallback;
}

export function saveHostPort(port: string) {
  localStorage.setItem(LS_KEYS.hostPort, port);
}

export function loadRoomCode() {
  return localStorage.getItem(LS_KEYS.roomCode) || '';
}

export function saveRoomCode(code: string) {
  localStorage.setItem(LS_KEYS.roomCode, code);
}

export function loadJoinCode() {
  return localStorage.getItem(LS_KEYS.joinCode) || '';
}

export function saveJoinCode(code: string) {
  localStorage.setItem(LS_KEYS.joinCode, code);
}

export function loadMappedPort(): number | null {
  const stored = localStorage.getItem(LS_KEYS.mappedPort);
  return stored ? parseInt(stored) : null;
}

export function saveMappedPort(mappedPort: number | null) {
  if (mappedPort) localStorage.setItem(LS_KEYS.mappedPort, mappedPort.toString());
  else localStorage.removeItem(LS_KEYS.mappedPort);
}

