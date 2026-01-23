/// <reference types="vite/client" />

interface Window {
    launcher: {
        launch: (options: {
            nickname: string;
            version: string;
            ram: number;
            hideLauncher?: boolean;
            gamePath?: string;
            javaPath?: string;
            installOptifine?: boolean;
            downloadProvider?: 'mojang' | 'bmcl' | 'auto';
            autoDownloadThreads?: boolean;
            downloadThreads?: number;
            maxSockets?: number;
            useOptiFine?: boolean;
        }) => Promise<void>;
        getVersionList: (providerId?: 'mojang' | 'bmcl' | 'auto') => Promise<{ versions: Array<{ id: string; type: string; url: string; time: string; releaseTime: string }> }>;
        getForgeSupportedVersions: (providerId?: 'mojang' | 'bmcl' | 'auto') => Promise<string[]>;
        getFabricSupportedVersions: () => Promise<string[]>;
        getOptiFineSupportedVersions: () => Promise<string[]>;
        getNeoForgeSupportedVersions: (providerId?: 'mojang' | 'bmcl' | 'auto') => Promise<string[]>;
        onLog: (callback: (log: string) => void) => () => void;
        onProgress: (callback: (progress: { type: string; task: number; total: number }) => void) => () => void;
        onClose: (callback: (code: number) => void) => () => void;
    }
    updater: {
        sync: (manifestUrl: string) => Promise<void>;
        onProgress: (callback: (data: { status: string, progress: number }) => void) => () => void;
    }
    windowControls: {
        minimize: () => Promise<void>;
        close: () => Promise<void>;
    }
    networkAPI: {
        host: (port: number) => Promise<string>;
        join: (code: string) => Promise<number>;
        stop: () => Promise<void>;
    }
    cache: {
        clear: () => Promise<{ success: boolean; error?: string }>;
        reload: () => Promise<void>;
    }
    settings: {
        selectMinecraftPath: () => Promise<{ success: boolean; path: string | null; error?: string }>;
        openMinecraftPath: (path?: string) => Promise<{ success: boolean; error?: string }>;
        getDefaultMinecraftPath: () => Promise<string>;
    }
    appUpdater: {
        check: () => Promise<{ cancelled?: boolean } | null>;
        quitAndInstall: () => void;
        onStatus: (callback: (status: string) => void) => () => void;
        onAvailable: (callback: (info: { version?: string; tag?: string; releaseDate?: string; releaseName?: string; releaseNotes?: string }) => void) => () => void;
        onNotAvailable: (callback: (info: unknown) => void) => () => void;
        onError: (callback: (error: string) => void) => () => void;
        onProgress: (callback: (progress: { percent?: number; transferred?: number; total?: number }) => void) => () => void;
        onDownloaded: (callback: (info: { version?: string }) => void) => () => void;
    }
}
