import { ipcRenderer } from 'electron';
import { JAVA_RUNTIME_CHANNELS, type JavaRuntimeAPI } from '@shared/contracts';

/** Dedicated preload capability for opaque Java runtime discovery and selection. */
export const javaRuntime: JavaRuntimeAPI = {
  scan: () => ipcRenderer.invoke(JAVA_RUNTIME_CHANNELS.scan, {}),
  select: (request) => ipcRenderer.invoke(JAVA_RUNTIME_CHANNELS.select, request),
};
