import fs from 'fs';
import path from 'path';
import { DownloadManager } from '../../download/downloadManager';
import type { DownloadProvider } from '../../mirrors/providers';

export async function prepareAuthInjector(params: {
  sourceInjectorPath: string;
  destInjectorPath: string;
  downloadProvider: DownloadProvider;
  maxSockets: number;
  onLog: (data: string) => void;
}) {
  const { sourceInjectorPath, destInjectorPath, downloadProvider, maxSockets, onLog } = params;

  try {
    if (fs.existsSync(sourceInjectorPath)) {
      onLog(`[Auth] Copying injector to safe path: ${destInjectorPath}`);
      if (fs.existsSync(destInjectorPath)) {
        try {
          fs.unlinkSync(destInjectorPath);
        } catch {
          // File deletion failed
        }
      }
      fs.mkdirSync(path.dirname(destInjectorPath), { recursive: true });
      fs.copyFileSync(sourceInjectorPath, destInjectorPath);
    } else {
      onLog(`[Auth Warning] Injector not found in resources. Downloading fallback...`);
      const mirrorCandidates = downloadProvider.injectURLWithCandidates('https://authlib-injector.yushi.moe/artifact/latest');
      const fallback = 'https://github.com/yushijinhun/authlib-injector/releases/download/v1.2.5/authlib-injector-1.2.5.jar';
      const candidates = [...mirrorCandidates, fallback];
      try {
        await DownloadManager.downloadSingle(candidates, destInjectorPath, { maxSockets, validateZip: true });
        onLog(`[Auth] Downloaded injector to: ${destInjectorPath}`);
      } catch (e: unknown) {
        const eObj = e && typeof e === 'object' ? (e as { code?: string }) : null;
        if ((eObj?.code === 'EBUSY' || eObj?.code === 'EPERM') && fs.existsSync(destInjectorPath)) {
          onLog(`[Auth Info] Injector file locked (already running?), reusing existing.`);
        } else {
          throw e;
        }
      }
    }
  } catch (e: unknown) {
    onLog(`[Auth Error] Failed to prepare injector: ${e}`);
  }

  return destInjectorPath;
}

