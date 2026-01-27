export type ModLoaderType = 'fabric' | 'quilt' | 'forge' | 'unknown';

export type ModDependencyKind = 'depends' | 'recommends' | 'suggests' | 'breaks' | 'conflicts';

export interface ModDependency {
  id: string;
  versionRange?: string | string[];
  optional?: boolean;
  kind: ModDependencyKind;
}

/**
 * Normalized mod entry for UI/logging and future instance format.
 *
 * Notes:
 * - One jar can contain multiple logical mods (Forge mods.toml, etc.), therefore `file` can repeat.
 * - `hash` is SHA1 of the jar file to be stable and comparable.
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
}

