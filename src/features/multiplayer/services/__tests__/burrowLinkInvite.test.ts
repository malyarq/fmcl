import { describe, expect, it } from 'vitest';
import {
  createBurrowLinkInvite,
  formatBurrowLinkCode,
  normalizeBurrowLinkInvite,
} from '../burrowLinkInvite';

const roomCode = '0123456789abcdef'.repeat(4);

describe('Burrow Link invitations', () => {
  it('formats a room code into readable groups without changing its value', () => {
    const formatted = formatBurrowLinkCode(roomCode);

    expect(formatted).toBe('01234567-89abcdef-01234567-89abcdef-01234567-89abcdef-01234567-89abcdef');
    expect(normalizeBurrowLinkInvite(formatted)).toBe(roomCode);
  });

  it('accepts raw codes, grouped invitations, and Burrow invite links', () => {
    expect(normalizeBurrowLinkInvite(roomCode.toUpperCase())).toBe(roomCode);
    expect(normalizeBurrowLinkInvite(`BURROW-${formatBurrowLinkCode(roomCode)}`)).toBe(roomCode);
    expect(normalizeBurrowLinkInvite(createBurrowLinkInvite(roomCode))).toBe(roomCode);
  });

  it('rejects partial, malformed, and decorated invitations', () => {
    expect(normalizeBurrowLinkInvite(roomCode.slice(1))).toBeNull();
    expect(normalizeBurrowLinkInvite(`code: ${roomCode}`)).toBeNull();
    expect(normalizeBurrowLinkInvite(`burrow://host/${roomCode}`)).toBeNull();
    expect(normalizeBurrowLinkInvite(`burrow://join/${roomCode}?source=chat`)).toBeNull();
  });
});
