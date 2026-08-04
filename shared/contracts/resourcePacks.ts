import type { ResourcePack } from '../types/resourcePack';

export type ResourcePackAcquisitionStatus =
    | 'success'
    | 'partial-success'
    | 'cancelled'
    | 'duplicate'
    | 'invalid-archive'
    | 'runtime-blocked'
    | 'failure';

export type ResourcePackAcquisitionIssueStatus = Exclude<
    ResourcePackAcquisitionStatus,
    'success' | 'partial-success' | 'cancelled'
>;

export interface ResourcePackAcquisitionIssue {
    fileName: string;
    status: ResourcePackAcquisitionIssueStatus;
    message: string;
}

export interface ResourcePackAcquisitionResult {
    status: ResourcePackAcquisitionStatus;
    importedFileNames: string[];
    issues: ResourcePackAcquisitionIssue[];
}

export interface ResourcePacksAPI {
    /**
     * List all resource packs in the instance's resourcepacks folder.
     * Returns them in the order they appear in options.txt (bottom-most is highest priority usually, but we'll return list).
     * Actually, options.txt lists enabled packs. We merge this with file scan.
     */
    list: (instanceId: string) => Promise<ResourcePack[]>;

    /**
     * Enable a resource pack (add to options.txt)
     */
    enable: (instanceId: string, fileName: string) => Promise<{ ok: boolean }>;

    /**
     * Disable a resource pack (remove from options.txt)
     */
    disable: (instanceId: string, fileName: string) => Promise<{ ok: boolean }>;

    /**
     * Reorder resource packs.
     * The array should contain filenames of ENABLED packs in the desired order.
     * Minecraft applies packets from the list: top is applied first, bottom is applied last (overrides previous).
     * So the "Selected Resource Packs" list in UI usually shows highest priority at TOP.
     * We need to map UI list (Top=High Priority) to options.txt list (Bottom=High Priority).
     */
    reorder: (instanceId: string, fileNames: string[]) => Promise<{ ok: boolean }>;

    /**
     * Delete a resource pack file
     */
    delete: (instanceId: string, fileName: string) => Promise<{ ok: boolean }>;

    /**
     * Open the resource packs folder in the OS file explorer
     */
    openFolder: (instanceId: string) => Promise<{ ok: boolean }>;
    add: (instanceId: string) => Promise<ResourcePackAcquisitionResult>;
}
