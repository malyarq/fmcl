import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose some API to the Renderer process ---------
console.log('[Preload] SCRIPT STARTED');

console.log('[Preload] Exposing networkAPI...');
try {
  contextBridge.exposeInMainWorld('networkAPI', {
    host: (port: number) => ipcRenderer.invoke('network:host', port),
    join: (code: string) => ipcRenderer.invoke('network:join', code),
    stop: () => ipcRenderer.invoke('network:stop'),
  });
  console.log('[Preload] networkAPI exposed successfully');
} catch (error) {
  console.error('[Preload] FAILED to expose networkAPI:', error);
}

contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },

  // You can expose other APTs you need here.
  // ...
})

contextBridge.exposeInMainWorld('launcher', {
  launch: (options: any) => ipcRenderer.invoke('launcher:launch', options),
  onLog: (callback: (log: string) => void) => {
    const subscription = (_event: any, log: string) => callback(log)
    ipcRenderer.on('launcher:log', subscription)
    return () => ipcRenderer.removeListener('launcher:log', subscription)
  },
  onProgress: (callback: (progress: any) => void) => {
    const subscription = (_event: any, progress: any) => callback(progress)
    ipcRenderer.on('launcher:progress', subscription)
    return () => ipcRenderer.removeListener('launcher:progress', subscription)
  },
  onClose: (callback: (code: number) => void) => {
    const subscription = (_event: any, code: number) => callback(code)
    ipcRenderer.on('launcher:close', subscription)
    return () => ipcRenderer.removeListener('launcher:close', subscription)
  }
})

contextBridge.exposeInMainWorld('updater', {
  sync: (manifestUrl: string) => ipcRenderer.invoke('updater:sync', manifestUrl),
  onProgress: (callback: (data: { status: string, progress: number }) => void) => {
    const subscription = (_event: any, data: any) => callback(data)
    ipcRenderer.on('updater:progress', subscription)
    return () => ipcRenderer.removeListener('updater:progress', subscription)
  }
})

console.log('[Preload] Exposing windowControls...');
contextBridge.exposeInMainWorld('windowControls', {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  close: () => ipcRenderer.invoke('window:close')
})

console.log('[Preload] SCRIPT FINISHED');
