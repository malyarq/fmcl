export function getLegacyWindowsDpiJvmArgs(params: { requiredJava: 8 | 17 | 21 }) {
  const { requiredJava } = params;
  // Legacy (Java 8) Minecraft on Windows is not DPI-aware by default, which can lead to:
  // - blurry rendering (Windows scaling stretches a lower internal resolution)
  // - broken exclusive fullscreen (only top-left quarter visible)
  // This flag makes the process DPI-aware and fixes scaling for many setups.
  return process.platform === 'win32' && requiredJava === 8 ? ['-Dsun.java2d.dpiaware=true'] : [];
}

export async function withWindowsDpiCompatLayer<T>(params: {
  requiredJava: 8 | 17 | 21;
  onLog: (data: string) => void;
  run: () => Promise<T>;
}) {
  const { requiredJava, onLog, run } = params;

  const originalCompatLayer = process.env.__COMPAT_LAYER;
  const shouldForceDpiAwareCompat = process.platform === 'win32' && requiredJava === 8;
  try {
    if (shouldForceDpiAwareCompat) {
      const current = (process.env.__COMPAT_LAYER ?? '').trim();
      if (!/\bHIGHDPIAWARE\b/i.test(current)) {
        process.env.__COMPAT_LAYER = current ? `${current} HIGHDPIAWARE` : 'HIGHDPIAWARE';
      }
      onLog(`[LAUNCH] DPI compat layer: ${process.env.__COMPAT_LAYER}`);
    }
    return await run();
  } finally {
    // Restore Electron's environment after spawning the game process.
    if (shouldForceDpiAwareCompat) {
      if (originalCompatLayer === undefined) delete process.env.__COMPAT_LAYER;
      else process.env.__COMPAT_LAYER = originalCompatLayer;
    }
  }
}

