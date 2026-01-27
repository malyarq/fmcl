type WindowControlsApi = Window['windowControls'];
type NamespacedWindowControlsApi = Window['api']['windowControls'];

function hasWindowControls(): boolean {
  return typeof window !== 'undefined' && Boolean(window.api?.windowControls || window.windowControls);
}

function hasMethod<K extends keyof WindowControlsApi>(key: K): boolean {
  const api = (typeof window !== 'undefined' ? (window.api?.windowControls ?? window.windowControls) : undefined) as
    | NamespacedWindowControlsApi
    | WindowControlsApi
    | undefined;
  return Boolean(api && typeof api[key] === 'function');
}

function requireWindowControls(methodName: string): WindowControlsApi {
  const api = (typeof window !== 'undefined' ? (window.api?.windowControls ?? window.windowControls) : undefined) as
    | NamespacedWindowControlsApi
    | WindowControlsApi
    | undefined;
  if (!api) {
    throw new Error(`[windowControlsIPC] window controls API is not available (method: ${methodName})`);
  }
  return api;
}

export const windowControlsIPC = {
  isAvailable(): boolean {
    return hasWindowControls();
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
};

export type WindowControlsIPC = typeof windowControlsIPC;

