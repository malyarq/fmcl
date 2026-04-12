export interface WorldInfo {
    name: string;
    folderName: string;
    lastPlayed?: number;
    sizeBytes?: number;
}

export interface WorldsAPI {
    list: (instancePath: string) => Promise<WorldInfo[]>;
    delete: (folderName: string, instancePath: string) => Promise<void>;
    backup: (folderName: string, instancePath: string) => Promise<string>;
    duplicate: (folderName: string, instancePath: string) => Promise<string>;
    openFolder: (folderName: string, instancePath: string) => Promise<void>;
}
