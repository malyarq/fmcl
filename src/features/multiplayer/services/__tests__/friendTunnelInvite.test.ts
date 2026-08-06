import { describe, expect, it } from 'vitest';
import {
  createFriendTunnelInvite,
  formatFriendTunnelCode,
  normalizeFriendTunnelInvite,
} from '../friendTunnelInvite';

const roomCode = '0123456789abcdef'.repeat(4);

describe('FriendTunnel invitations', () => {
  it('formats a room code into readable groups without changing its value', () => {
    const formatted = formatFriendTunnelCode(roomCode);

    expect(formatted).toBe('01234567-89abcdef-01234567-89abcdef-01234567-89abcdef-01234567-89abcdef');
    expect(normalizeFriendTunnelInvite(formatted)).toBe(roomCode);
  });

  it('accepts raw codes, grouped invitations, and FMCL invite links', () => {
    expect(normalizeFriendTunnelInvite(roomCode.toUpperCase())).toBe(roomCode);
    expect(normalizeFriendTunnelInvite(`FMCL-${formatFriendTunnelCode(roomCode)}`)).toBe(roomCode);
    expect(normalizeFriendTunnelInvite(createFriendTunnelInvite(roomCode))).toBe(roomCode);
  });

  it('rejects partial, malformed, and decorated invitations', () => {
    expect(normalizeFriendTunnelInvite(roomCode.slice(1))).toBeNull();
    expect(normalizeFriendTunnelInvite(`code: ${roomCode}`)).toBeNull();
    expect(normalizeFriendTunnelInvite(`fmcl://host/${roomCode}`)).toBeNull();
    expect(normalizeFriendTunnelInvite(`fmcl://join/${roomCode}?source=chat`)).toBeNull();
  });
});
