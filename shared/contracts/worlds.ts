export interface WorldInfo {
    name: string;
    folderName: string;
    lastPlayed?: number;
    sizeBytes?: number;
}

export interface WorldsAPI {
    listByInstanceId: (instanceId: string) => Promise<WorldInfo[]>;
    deleteByInstanceId: (folderName: string, instanceId: string) => Promise<void>;
    backupByInstanceId: (folderName: string, instanceId: string) => Promise<void>;
    duplicateByInstanceId: (folderName: string, instanceId: string) => Promise<string>;
    openFolderByInstanceId: (folderName: string, instanceId: string) => Promise<void>;
}
