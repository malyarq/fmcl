const ROOM_CODE = /^[0-9a-f]{64}$/;
const GROUP_SIZE = 8;

export function normalizeBurrowLinkInvite(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;

  if (trimmed.startsWith('burrow://') || trimmed.startsWith('fmcl://')) {
    try {
      const url = new URL(trimmed);
      if (url.hostname !== 'join' || url.search || url.hash) return null;
      const code = url.pathname.replace(/^\/+|\/+$/g, '');
      return ROOM_CODE.test(code) ? code : null;
    } catch {
      return null;
    }
  }

  const withoutPrefix = trimmed.startsWith('burrow-')
    ? trimmed.slice('burrow-'.length)
    : trimmed.startsWith('fmcl-')
      ? trimmed.slice('fmcl-'.length)
      : trimmed;
  const code = withoutPrefix.replaceAll('-', '').replaceAll(' ', '');
  return ROOM_CODE.test(code) ? code : null;
}

export function formatBurrowLinkCode(roomCode: string): string {
  const normalized = normalizeBurrowLinkInvite(roomCode);
  if (!normalized) return roomCode;

  const groups: string[] = [];
  for (let index = 0; index < normalized.length; index += GROUP_SIZE) {
    groups.push(normalized.slice(index, index + GROUP_SIZE));
  }
  return groups.join('-');
}

export function createBurrowLinkInvite(roomCode: string): string {
  const normalized = normalizeBurrowLinkInvite(roomCode);
  if (!normalized) throw new Error('Burrow Link room code is invalid.');
  return `BURROW-${formatBurrowLinkCode(normalized)}`;
}
