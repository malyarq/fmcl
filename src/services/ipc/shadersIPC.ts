import type { ShadersAPI } from '../../../shared/contracts/shaders';

function getLegacyShadersApi(): ShadersAPI {
    const ipc = window.api.ipcRenderer;

    return {
        list: (instancePath) => ipc.invoke('shaders:list', instancePath),
        setActive: (shaderName, instancePath) => ipc.invoke('shaders:setActive', shaderName, instancePath),
        disable: (instancePath) => ipc.invoke('shaders:disable', instancePath),
        delete: (fileName, instancePath) => ipc.invoke('shaders:delete', fileName, instancePath),
        openFolder: (instancePath) => ipc.invoke('shaders:openFolder', instancePath),
        add: (instancePath) => ipc.invoke('shaders:add', instancePath),
    };
}

function getShadersApi(): ShadersAPI {
    return window.api?.shaders ?? getLegacyShadersApi();
}

export const shadersIPC: ShadersAPI = {
    list: (instancePath) => getShadersApi().list(instancePath),
    setActive: (shaderName, instancePath) => getShadersApi().setActive(shaderName, instancePath),
    disable: (instancePath) => getShadersApi().disable(instancePath),
    delete: (fileName, instancePath) => getShadersApi().delete(fileName, instancePath),
    openFolder: (instancePath) => getShadersApi().openFolder(instancePath),
    add: (instancePath) => getShadersApi().add(instancePath),
};
