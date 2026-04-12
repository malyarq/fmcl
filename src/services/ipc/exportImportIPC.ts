export interface ExportOptions {
    includeSaves?: boolean;
    includeScreenshots?: boolean;
    includeResourcePacks?: boolean;
    includeShaders?: boolean;
    includeMods?: boolean; // Default true
}

export const exportImportIPC = {
    exportInstance: (
        instanceId: string,
        format: 'multimc' | 'zip' | 'curseforge' | 'modrinth',
        outputPath: string,
        options?: ExportOptions
    ) => window.api.ipcRenderer.invoke('modpacks:export', instanceId, format, outputPath, options),

    importInstance: (filePath: string, targetName?: string) =>
        window.api.ipcRenderer.invoke('modpacks:import', filePath, targetName),
};
