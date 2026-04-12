import type { ResourcePack } from '../types/resourcePack';

export interface ResourcePacksAPI {
    /**
     * List all resource packs in the instance's resourcepacks folder.
     * Returns them in the order they appear in options.txt (bottom-most is highest priority usually, but we'll return list).
     * Actually, options.txt lists enabled packs. We merge this with file scan.
     */
    list: (instancePath?: string) => Promise<ResourcePack[]>;

    /**
     * Enable a resource pack (add to options.txt)
     */
    enable: (fileName: string, instancePath?: string) => Promise<{ ok: boolean }>;

    /**
     * Disable a resource pack (remove from options.txt)
     */
    disable: (fileName: string, instancePath?: string) => Promise<{ ok: boolean }>;

    /**
     * Reorder resource packs.
     * The array should contain filenames of ENABLED packs in the desired order.
     * Minecraft applies packets from the list: top is applied first, bottom is applied last (overrides previous).
     * So the "Selected Resource Packs" list in UI usually shows highest priority at TOP.
     * We need to map UI list (Top=High Priority) to options.txt list (Bottom=High Priority).
     */
    reorder: (fileNames: string[], instancePath?: string) => Promise<{ ok: boolean }>;

    /**
     * Import a resource pack file
     */
    import: (filePath: string, instancePath?: string) => Promise<{ ok: boolean }>;

    /**
     * Delete a resource pack file
     */
    delete: (fileName: string, instancePath?: string) => Promise<{ ok: boolean }>;

    /**
     * Open the resource packs folder in the OS file explorer
     */
    openFolder: (instancePath?: string) => Promise<{ ok: boolean }>;
    add: (instancePath?: string) => Promise<boolean>;
}
