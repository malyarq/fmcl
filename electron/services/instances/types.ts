export type ModLoaderType = 'vanilla' | 'forge' | 'fabric' | 'quilt' | 'neoforge';
export type NetworkMode = 'hyperswarm' | 'xmcl_lan' | 'xmcl_upnp_host';

export interface ModpackRuntime {
  minecraft: string; // "1.20.1" (base MC version)
  modLoader?: {
    type: ModLoaderType;
    /**
     * Loader version string when relevant (forge/neoforge/fabric/quilt).
     * In current UI we resolve these dynamically; we keep this for future step 7+.
     */
    version?: string;
  };
}

export interface ModpackConfig {
  id: string;
  name: string;
  runtime: ModpackRuntime;
  java?: {
    path?: string;
  };
  memory?: {
    /**
     * Max memory in MB (matches LauncherManager.launchGame current API).
     */
    maxMb: number;
  };
  vmOptions?: string[];
  game?: {
    /**
     * Window / display settings passed to @xmcl/core LaunchOption.resolution.
     */
    resolution?: { width?: number; height?: number; fullscreen?: boolean };
    /**
     * Extra game (program) args passed to @xmcl/core LaunchOption.extraMCArgs.
     */
    extraArgs?: string[];
  };
  server?: {
    host: string;
    port: number;
  };
  networkMode?: NetworkMode;
  updatedAt?: string;
  createdAt?: string;
}

export interface ModpacksIndex {
  /**
   * Selected modpack id.
   */
  selectedModpack: string;
  /**
   * All modpacks (id -> name).
   */
  modpacks: Record<string, { name: string }>;
}

