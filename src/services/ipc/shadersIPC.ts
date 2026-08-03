import type { ShadersAPI } from '../../../shared/contracts/shaders';

export const shadersIPC: ShadersAPI = {
    list: (instancePath) => window.api.shaders.list(instancePath),
    setActive: (shaderName, instancePath) => window.api.shaders.setActive(shaderName, instancePath),
    disable: (instancePath) => window.api.shaders.disable(instancePath),
    delete: (fileName, instancePath) => window.api.shaders.delete(fileName, instancePath),
    openFolder: (instancePath) => window.api.shaders.openFolder(instancePath),
    add: (instancePath) => window.api.shaders.add(instancePath),
};
