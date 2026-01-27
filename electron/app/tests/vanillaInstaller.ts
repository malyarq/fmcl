import type { VanillaService } from '../../services/runtime/vanillaService';
import type { DownloadProvider } from '../../services/mirrors/providers';
import type { VanillaResult } from './types';

export async function installVanillaVersion(params: {
  mcVersion: string;
  rootPath: string;
  vanilla: VanillaService;
  downloadProvider: DownloadProvider;
  downloadOptions: Record<string, unknown>;
  onLog: (line: string) => void;
}): Promise<VanillaResult> {
  const { mcVersion, rootPath, vanilla, downloadProvider, downloadOptions, onLog } = params;
  const startedAt = Date.now();

  try {
    onLog(`[Vanilla] Installing ${mcVersion}...`);
    await vanilla.ensureVanillaInstalled(mcVersion, rootPath, onLog, () => {}, downloadProvider, downloadOptions);
    const ms = Date.now() - startedAt;
    onLog(`[Vanilla] ${mcVersion} installed ✓ (${ms}ms)`);
    return { mcVersion, ok: true, ms };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const ms = Date.now() - startedAt;
    onLog(`[Vanilla] ${mcVersion} failed: ${msg}`);
    return { mcVersion, ok: false, error: msg, ms };
  }
}
