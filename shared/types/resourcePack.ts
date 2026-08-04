
export interface ResourcePack {
    /** File name (e.g. "my-pack.zip") - used as ID */
    fileName: string;
    /** Display name (from pack.mcmeta or filename) */
    name: string;
    /** Description (from pack.mcmeta) */
    description?: string;
    /** Pack format version */
    packFormat: number;
    /** Icon in base64 or file:// url */
    iconUrl?: string;
    /** Whether the pack is enabled in options.txt */
    isEnabled: boolean;
    /** File size in bytes */
    size: number;
}
