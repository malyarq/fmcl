import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  authorizeSavePath,
  clearSavePathAuthorizationsForTests,
  consumeAuthorizedSavePath,
} from '../savePathAuthorizations';

describe('save path authorizations', () => {
  afterEach(() => clearSavePathAuthorizationsForTests());

  it('allows a native-dialog path exactly once', () => {
    const filePath = path.join(os.tmpdir(), 'burrow-export.log');
    authorizeSavePath(7, filePath);

    expect(consumeAuthorizedSavePath(7, filePath)).toBe(path.normalize(filePath));
    expect(() => consumeAuthorizedSavePath(7, filePath)).toThrow('not authorized');
  });

  it('does not authorize neighboring paths', () => {
    const filePath = path.join(os.tmpdir(), 'burrow-export.log');
    authorizeSavePath(7, filePath);

    expect(() => consumeAuthorizedSavePath(7, path.join(os.tmpdir(), 'other.log'))).toThrow('not authorized');
  });

  it('cannot be consumed by a different renderer', () => {
    const filePath = path.join(os.tmpdir(), 'burrow-export.log');
    authorizeSavePath(7, filePath);

    expect(() => consumeAuthorizedSavePath(8, filePath)).toThrow('not authorized');
    expect(consumeAuthorizedSavePath(7, filePath)).toBe(path.normalize(filePath));
  });

  it('expires a native-dialog authorization before it can be consumed', () => {
    vi.useFakeTimers();
    const filePath = path.join(os.tmpdir(), 'burrow-expired-export.log');
    authorizeSavePath(7, filePath);

    vi.advanceTimersByTime(5 * 60 * 1_000);

    expect(() => consumeAuthorizedSavePath(7, filePath)).toThrow('not authorized');
    vi.useRealTimers();
  });
});
