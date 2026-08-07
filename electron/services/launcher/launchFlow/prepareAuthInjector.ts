import fs from 'fs';
import path from 'path';
import { createHash } from 'node:crypto';
import { DownloadManager } from '../../download/downloadManager';
import type { DownloadProvider } from '../../mirrors/providers';

export const AUTHLIB_INJECTOR_VERSION = '1.2.8';
export const AUTHLIB_INJECTOR_SHA256 = '9c7f4343e6c82034958ffb48c14a2cb0c85928be7283103ce17da00c6d5a7b10';
const AUTHLIB_INJECTOR_URL = `https://github.com/yushijinhun/authlib-injector/releases/download/v${AUTHLIB_INJECTOR_VERSION}/authlib-injector-${AUTHLIB_INJECTOR_VERSION}.jar`;

function hasExpectedDigest(filePath: string) {
  if (!fs.existsSync(filePath)) return false;
  const digest = createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  return digest === AUTHLIB_INJECTOR_SHA256;
}

function removeIfPresent(filePath: string) {
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

export async function prepareAuthInjector(params: {
  sourceInjectorPath: string;
  destInjectorPath: string;
  downloadProvider: DownloadProvider;
  maxSockets: number;
  onLog: (data: string) => void;
}) {
  const { sourceInjectorPath, destInjectorPath, downloadProvider, maxSockets, onLog } = params;

  try {
    fs.mkdirSync(path.dirname(destInjectorPath), { recursive: true });

    if (hasExpectedDigest(sourceInjectorPath)) {
      onLog(`[Auth] Copying injector to safe path: ${destInjectorPath}`);
      if (!hasExpectedDigest(destInjectorPath)) {
        try {
          removeIfPresent(destInjectorPath);
          fs.copyFileSync(sourceInjectorPath, destInjectorPath);
        } catch (error: unknown) {
          const code = error && typeof error === 'object' ? (error as { code?: string }).code : undefined;
          if ((code !== 'EBUSY' && code !== 'EPERM') || !hasExpectedDigest(destInjectorPath)) throw error;
          onLog('[Auth] Reusing the verified injector already held by another process.');
        }
      }
    } else {
      onLog('[Auth Warning] Verified injector not found in resources. Downloading the pinned release...');
      removeIfPresent(destInjectorPath);
      const candidates = downloadProvider.injectURLWithCandidates(AUTHLIB_INJECTOR_URL);
      await DownloadManager.downloadSingle(candidates, destInjectorPath, { maxSockets, validateZip: true });
      if (!hasExpectedDigest(destInjectorPath)) {
        removeIfPresent(destInjectorPath);
        throw new Error('Downloaded authlib-injector failed the SHA-256 check');
      }
      onLog(`[Auth] Downloaded verified injector to: ${destInjectorPath}`);
    }
  } catch (e: unknown) {
    onLog(`[Auth Error] Failed to prepare injector: ${e}`);
    throw e;
  }

  return destInjectorPath;
}
