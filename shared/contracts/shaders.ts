export interface ShaderPack {
    fileName: string;
    name: string;
    isActive: boolean;
}

export type ShaderPackAcquisitionStatus =
    | 'success'
    | 'partial-success'
    | 'cancelled'
    | 'duplicate'
    | 'invalid-archive'
    | 'runtime-blocked'
    | 'failure';

export type ShaderPackAcquisitionIssueStatus = Exclude<
    ShaderPackAcquisitionStatus,
    'success' | 'partial-success' | 'cancelled'
>;

export interface ShaderPackAcquisitionIssue {
    fileName: string;
    status: ShaderPackAcquisitionIssueStatus;
    message: string;
}

export interface ShaderPackAcquisitionResult {
    status: ShaderPackAcquisitionStatus;
    importedFileNames: string[];
    issues: ShaderPackAcquisitionIssue[];
}

export interface ShadersAPI {
    list: (instancePath: string) => Promise<ShaderPack[]>;
    setActive: (shaderName: string, instancePath: string) => Promise<void>;
    disable: (instancePath: string) => Promise<void>;
    delete(fileName: string, instancePath?: string): Promise<boolean>;
    openFolder(instancePath?: string): Promise<void>;
    add(instancePath?: string): Promise<ShaderPackAcquisitionResult>;
}
