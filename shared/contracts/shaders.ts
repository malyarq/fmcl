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
    list: (instanceId: string) => Promise<ShaderPack[]>;
    setActive: (shaderName: string, instanceId: string) => Promise<void>;
    disable: (instanceId: string) => Promise<void>;
    delete(fileName: string, instanceId: string): Promise<boolean>;
    openFolder(instanceId: string): Promise<void>;
    add(instanceId: string): Promise<ShaderPackAcquisitionResult>;
}
