export type ModLoaderType = 'vanilla' | 'forge' | 'fabric' | 'quilt' | 'neoforge';
export type NetworkMode = 'hyperswarm' | 'xmcl_lan' | 'xmcl_upnp_host';

export interface ModpackRuntime {
  minecraft: string;
  modLoader?: { type: ModLoaderType; version?: string };
}

export interface ModpackConfig {
  id: string;
  name: string;
  runtime: ModpackRuntime;
  java?: { path?: string };
  memory?: { maxMb: number };
  vmOptions?: string[];
  game?: {
    /**
     * Window / display settings passed to @xmcl/core LaunchOption.resolution.
     * If fullscreen is true, width/height are ignored by the launcher.
     */
    resolution?: { width?: number; height?: number; fullscreen?: boolean };
    /**
     * Extra game (program) arguments passed to @xmcl/core LaunchOption.extraMCArgs.
     */
    extraArgs?: string[];
  };
  server?: { host: string; port: number };
  networkMode?: NetworkMode;
  updatedAt?: string;
  createdAt?: string;
}

export interface ModpackListItem {
  id: string;
  name: string;
  path: string;
  selected: boolean;
}

