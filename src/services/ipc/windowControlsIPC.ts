type WindowControlsApi = Window['api']['windowControls'];

function usesNativeMacWindowControls(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }

  return /(Mac|iPhone|iPad|iPod)/i.test(navigator.platform || navigator.userAgent || '');
}

function hasWindowControls(): boolean {
  return typeof window !== 'undefined' && Boolean(window.api?.windowControls);
}

function hasMethod<K extends keyof WindowControlsApi>(key: K): boolean {
  const api = typeof window !== 'undefined' ? window.api?.windowControls : undefined;
  return Boolean(api && typeof api[key] === 'function');
}

function requireWindowControls(methodName: string): WindowControlsApi {
  const api = typeof window !== 'undefined' ? window.api?.windowControls : undefined;
  if (!api) {
    throw new Error(`[windowControlsIPC] window controls API is not available (method: ${methodName})`);
  }
  return api;
}

export const windowControlsIPC = {
  isAvailable(): boolean {
    return hasWindowControls();
  },

  usesNativeWindowControls(): boolean {
    return usesNativeMacWindowControls();
  },

  shellContract(): 'native-macos' | 'renderer-controls' {
    return usesNativeMacWindowControls() ? 'native-macos' : 'renderer-controls';
  },

  has<K extends keyof WindowControlsApi>(key: K): boolean {
    return hasMethod(key);
  },

  minimize(): void {
    if (!hasMethod('minimize')) return;
    requireWindowControls('minimize').minimize();
  },

  close(): void {
    if (!hasMethod('close')) return;
    requireWindowControls('close').close();
  },

  openConsole(): void {
    if (!hasMethod('openConsole')) return;
    requireWindowControls('openConsole').openConsole();
  },

  closeConsole(): void {
    if (!hasMethod('closeConsole')) return;
    requireWindowControls('closeConsole').closeConsole();
  },
};

export type WindowControlsIPC = typeof windowControlsIPC;
