import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ensureJavaExecutablePermission, findJavaExecutable } from '../findJavaExecutable';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe('findJavaExecutable', () => {
  it('finds the native console executable in a nested downloaded runtime', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-java-runtime-'));
    roots.push(root);
    const executable = path.join(
      root,
      process.platform === 'darwin' ? 'jre.bundle/Contents/Home/bin' : 'runtime/bin',
      process.platform === 'win32' ? 'java.exe' : 'java',
    );
    fs.mkdirSync(path.dirname(executable), { recursive: true });
    fs.writeFileSync(executable, 'runtime');

    expect(findJavaExecutable(root)).toBe(executable);
  });

  it('returns null for missing or unrelated runtime content', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-java-runtime-'));
    roots.push(root);
    fs.writeFileSync(path.join(root, 'release'), 'JAVA_VERSION=21');

    expect(findJavaExecutable(root)).toBeNull();
    expect(findJavaExecutable(path.join(root, 'missing'))).toBeNull();
  });

  it.runIf(process.platform !== 'win32')('restores executable bits lost during runtime extraction', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-java-runtime-'));
    roots.push(root);
    const executable = path.join(root, 'bin', 'java');
    fs.mkdirSync(path.dirname(executable), { recursive: true });
    fs.writeFileSync(executable, 'runtime', { mode: 0o600 });

    ensureJavaExecutablePermission(executable);

    expect(fs.statSync(executable).mode & 0o111).toBe(0o111);
  });
});
