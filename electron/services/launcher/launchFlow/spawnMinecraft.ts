import { launch, type LaunchOption } from '@xmcl/core';
import { getLegacyWindowsDpiJvmArgs, withWindowsDpiCompatLayer } from './dpiCompat';

export async function spawnMinecraft(params: {
  launchOptions: LaunchOption;
  requiredJava: 8 | 17 | 21;
  effectiveVmOptions: string[];
  onLog: (data: string) => void;
  onClose: (code: number) => void;
  onGameStart?: () => void;
}) {
  const { launchOptions, requiredJava, effectiveVmOptions, onLog, onClose, onGameStart } = params;

  const legacyWindowsDpiFix = getLegacyWindowsDpiJvmArgs({ requiredJava });
  const extraJVMArgs = [
    ...effectiveVmOptions,
    ...legacyWindowsDpiFix,
    '-XX:-UseAdaptiveSizePolicy',
    '-XX:-OmitStackTraceInFastThrow',
  ];
  // Temporary high-signal diagnostics for Forge 1.6.x crashes (ClassPatchManager NPEs).
  // This adds minimal extra logs that help pinpoint the missing class being patched.
  try {
    const version = (launchOptions as unknown as { version?: string }).version ?? '';
    if (requiredJava === 8 && /^(1\.6\.)/.test(version) && /forge/i.test(version)) {
      extraJVMArgs.push('-Dfml.debugClassPatchManager=true');
    }
  } catch {
    // ignore
  }

  const proc = await withWindowsDpiCompatLayer({
    requiredJava,
    onLog,
    run: async () => {
      return await launch({
        ...launchOptions,
        extraJVMArgs,
      });
    },
  });

  // Diagnostics for legacy modloaders: helps catch missing classpath deps (e.g. LZMA) that cause
  // Forge 1.6.x patching crashes without clear errors.
  try {
    const args = (proc as unknown as { spawnargs?: string[] }).spawnargs ?? [];
    const joined = args.join(' ');
    if (joined) {
      const versionId = (launchOptions as unknown as { version?: string }).version ?? '';
      const baseMc = (versionId.match(/^(\d+\.\d+(?:\.\d+)?)/)?.[1] ?? '').trim();
      const baseJarMarker = baseMc ? `\\versions\\${baseMc}\\${baseMc}.jar` : '';
      onLog(`[LAUNCH] CP has minecraftforge: ${joined.includes('minecraftforge-')}`);
      onLog(`[LAUNCH] CP has lzma: ${joined.includes('lzma-0.0.1.jar')}`);
      onLog(`[LAUNCH] CP has base jar: ${baseJarMarker ? joined.includes(baseJarMarker) : false}`);
    }
  } catch {
    // ignore diagnostic errors
  }

  let gameStarted = false;
  proc.stdout?.on('data', (data) => {
    onLog(`[GAME] ${data.toString().trim()}`);
    if (!gameStarted) {
      gameStarted = true;
      if (onGameStart) onGameStart();
    }
  });
  proc.stderr?.on('data', (data) => {
    onLog(`[GAME] ${data.toString().trim()}`);
  });
  proc.on('close', (code) => {
    const exitCode = typeof code === 'number' ? code : 0;
    onLog(`[EXIT] Game closed with code ${exitCode}`);
    onClose(exitCode);
  });
  proc.on('error', (err) => {
    onLog(`[ERROR] Game process error: ${err}`);
  });

  return proc;
}

