export interface ShaderPack {
    fileName: string;
    name: string;
    isActive: boolean;
}

export interface ShadersAPI {
    list: (instancePath: string) => Promise<ShaderPack[]>;
    setActive: (shaderName: string, instancePath: string) => Promise<void>;
    disable: (instancePath: string) => Promise<void>;
    delete(fileName: string, instancePath?: string): Promise<boolean>;
    openFolder(instancePath?: string): Promise<void>;
    add(instancePath?: string): Promise<boolean>;
}
