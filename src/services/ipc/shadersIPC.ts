import type { ShadersAPI } from '../../../shared/contracts/shaders';

// Use the preload bridge instead of importing ipcRenderer directly (context isolation)
const ipc = () => window.api.ipcRenderer;

export const shadersIPC: ShadersAPI = {
    list: (instancePath) => ipc().invoke('shaders:list', instancePath),
    setActive: (shaderName, instancePath) => ipc().invoke('shaders:setActive', shaderName, instancePath),
    disable: (instancePath) => ipc().invoke('shaders:disable', instancePath),
    delete: (fileName, instancePath) => ipc().invoke('shaders:delete', fileName, instancePath),
    openFolder: (instancePath) => ipc().invoke('shaders:openFolder', instancePath),
    add: (instancePath) => ipc().invoke('shaders:add', instancePath),
};
