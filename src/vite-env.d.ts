/// <reference types="vite/client" />

interface Window {
    launcher: {
        launch: (options: { nickname: string; version: string; ram: number; hideLauncher?: boolean; installOptifine?: boolean }) => Promise<void>;
        onLog: (callback: (log: string) => void) => () => void;
        onProgress: (callback: (progress: any) => void) => () => void;
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
}
