import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const downloadSingle = vi.hoisted(() => vi.fn());

vi.mock('../../../download/downloadManager', () => ({
  DownloadManager: { downloadSingle },
}));

import {
  AUTHLIB_INJECTOR_SHA256,
  AUTHLIB_INJECTOR_VERSION,
  prepareAuthInjector,
} from '../prepareAuthInjector';

const roots: string[] = [];
const bundledInjector = path.resolve(process.cwd(), 'resources/authlib-injector.jar');
const provider = {
  injectURLWithCandidates: (url: string) => [url],
};

function createPaths() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-authlib-'));
  roots.push(root);
  return {
    sourceInjectorPath: path.join(root, 'source.jar'),
    destInjectorPath: path.join(root, 'runtime', 'authlib-injector.jar'),
  };
}

afterEach(() => {
  downloadSingle.mockReset();
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe('prepareAuthInjector', () => {
  it('copies the pinned bundled injector without a network request', async () => {
    const paths = createPaths();
    fs.copyFileSync(bundledInjector, paths.sourceInjectorPath);

    await prepareAuthInjector({
      ...paths,
      downloadProvider: provider as never,
      maxSockets: 1,
      onLog: vi.fn(),
    });

    expect(fs.readFileSync(paths.destInjectorPath)).toEqual(fs.readFileSync(bundledInjector));
    expect(downloadSingle).not.toHaveBeenCalled();
  });

  it('downloads the exact pinned release when the bundled copy is invalid', async () => {
    const paths = createPaths();
    fs.writeFileSync(paths.sourceInjectorPath, 'invalid');
    downloadSingle.mockImplementation(async (_urls: string[], destination: string) => {
      fs.copyFileSync(bundledInjector, destination);
    });

    await prepareAuthInjector({
      ...paths,
      downloadProvider: provider as never,
      maxSockets: 1,
      onLog: vi.fn(),
    });

    expect(downloadSingle).toHaveBeenCalledWith(
      [`https://github.com/yushijinhun/authlib-injector/releases/download/v${AUTHLIB_INJECTOR_VERSION}/authlib-injector-${AUTHLIB_INJECTOR_VERSION}.jar`],
      paths.destInjectorPath,
      { maxSockets: 1, validateZip: true },
    );
    expect(AUTHLIB_INJECTOR_SHA256).toHaveLength(64);
  });

  it('rejects and removes a downloaded injector with the wrong digest', async () => {
    const paths = createPaths();
    downloadSingle.mockImplementation(async (_urls: string[], destination: string) => {
      fs.writeFileSync(destination, 'invalid');
    });

    await expect(prepareAuthInjector({
      ...paths,
      downloadProvider: provider as never,
      maxSockets: 1,
      onLog: vi.fn(),
    })).rejects.toThrow(/SHA-256/);
    expect(fs.existsSync(paths.destInjectorPath)).toBe(false);
  });
});
