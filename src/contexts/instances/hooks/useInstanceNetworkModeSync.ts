import { useEffect } from 'react';
import { networkIPC } from '../../../services/ipc/networkIPC';
import type { NetworkMode } from '../types';

export function useInstanceNetworkModeSync(networkMode: NetworkMode | undefined) {
  // Keep main process network mode aligned with selected modpack (best-effort).
  useEffect(() => {
    const mode = networkMode ?? 'hyperswarm';
    if (!mode) return;
    try {
      if (networkIPC.has('setMode')) {
        void networkIPC.setMode(mode).catch(() => {});
      }
    } catch {
      // ignore
    }
  }, [networkMode]);
}

