import type { ShadersAPI } from '../../../shared/contracts/shaders';

export const shadersIPC: ShadersAPI = {
    list: (instanceId) => window.api.shaders.list(instanceId),
    setActive: (shaderName, instanceId) => window.api.shaders.setActive(shaderName, instanceId),
    disable: (instanceId) => window.api.shaders.disable(instanceId),
    delete: (fileName, instanceId) => window.api.shaders.delete(fileName, instanceId),
    openFolder: (instanceId) => window.api.shaders.openFolder(instanceId),
    add: (instanceId) => window.api.shaders.add(instanceId),
};
