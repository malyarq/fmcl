export type ModLoaderType = 'fabric' | 'quilt' | 'forge' | 'neoforge' | 'unknown';

export type ModDependencyKind = 'depends' | 'recommends' | 'suggests' | 'breaks' | 'conflicts';

export interface ModDependency {
    id: string;
    versionRange?: string | string[];
    optional?: boolean;
    kind: ModDependencyKind;
}

/**
 * Normalized mod entry for UI/logging and future instance format.
 */
export interface ModEntry {
    id: string;
    name: string;
    version: string;
    loaders: ModLoaderType[];
    deps: ModDependency[];
    file: {
        path: string;
        name: string;
        size: number;
        mtimeMs: number;
    };
    hash: {
        sha1: string;
    };
    enabled?: boolean; // added for UI state
}
