// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { clearLegacySessionTruth, loadHostPort, loadJoinCode, loadMode, saveHostPort, saveJoinCode, saveMode } from '../multiplayerPersistence';

describe('multiplayer persistence', () => {
  beforeEach(() => localStorage.clear());
  it('persists inputs but deletes legacy active-session truth', () => {
    saveMode('join'); saveHostPort('25570'); saveJoinCode('ab'.repeat(32));
    localStorage.setItem('mp_room_code', 'phantom');
    localStorage.setItem('mp_mapped_port', '12345');
    clearLegacySessionTruth();
    expect(loadMode()).toBe('join');
    expect(loadHostPort('25565')).toBe('25570');
    expect(loadJoinCode()).toBe('ab'.repeat(32));
    expect(localStorage.getItem('mp_room_code')).toBeNull();
    expect(localStorage.getItem('mp_mapped_port')).toBeNull();
  });
});

