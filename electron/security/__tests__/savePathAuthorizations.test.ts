import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  authorizeSavePath,
  clearSavePathAuthorizationsForTests,
  consumeAuthorizedSavePath,
} from '../savePathAuthorizations';

describe('save path authorizations', () => {
  afterEach(() => clearSavePathAuthorizationsForTests());

  it('allows a native-dialog path exactly once', () => {
    const filePath = path.join(os.tmpdir(), 'fmcl-export.log');
    authorizeSavePath(filePath);

    expect(consumeAuthorizedSavePath(filePath)).toBe(path.normalize(filePath));
    expect(() => consumeAuthorizedSavePath(filePath)).toThrow('not authorized');
  });

  it('does not authorize neighboring paths', () => {
    const filePath = path.join(os.tmpdir(), 'fmcl-export.log');
    authorizeSavePath(filePath);

    expect(() => consumeAuthorizedSavePath(path.join(os.tmpdir(), 'other.log'))).toThrow('not authorized');
  });
});
