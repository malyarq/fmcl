import { Client, ILauncherOptions } from 'minecraft-launcher-core';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { JavaManager } from './java';
import crypto from 'crypto';
// ...
// (inside class)
// removed downloadFile
// ...

import { NetworkManager } from './network';

const FORGE_PROMOTIONS_URL = 'https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json';

export class LauncherManager {
    private launcher: Client;
    private javaManager: JavaManager;
    public networkManager: NetworkManager;

    constructor() {
        this.launcher = new Client();
        this.javaManager = new JavaManager();
        this.networkManager = new NetworkManager();
    }

    private getOfflineUUID(nickname: string): string {
        const md5 = crypto.createHash('md5');
        md5.update(`OfflinePlayer:${nickname}`);
        const buffer = md5.digest();
        // Set version to 3 (UUIDv3 via MD5ish)
        buffer[6] = (buffer[6] & 0x0f) | 0x30;
        buffer[8] = (buffer[8] & 0x3f) | 0x80;

        const hex = buffer.toString('hex');
        return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}`;
    }

    private async getForgeUrl(version: string, onLog: (msg: string) => void): Promise<string> {
        onLog('Resolving Forge version...');
        try {
            const response = await fetch(FORGE_PROMOTIONS_URL);
            if (!response.ok) throw new Error('Failed to fetch Forge promotions');
            const data = await response.json();

            const promoKey = `${version}-recommended`;
            const forgeVersion = data.promos[promoKey];

            if (!forgeVersion) {
                // Fallback to latest if recommended not found
                const latestKey = `${version}-latest`;
                const latestVersion = data.promos[latestKey];
                if (latestVersion) {
                    onLog(`Recommended Forge not found, using latest: ${latestVersion}`);
                    return this.constructForgeUrl(version, latestVersion);
                }
                throw new Error(`No Forge found for version ${version}`);
            }

            onLog(`Found recommended Forge: ${forgeVersion}`);
            return this.constructForgeUrl(version, forgeVersion);
        } catch (e) {
            throw new Error(`Failed to resolve Forge version: ${e}`);
        }
    }

    private constructForgeUrl(mcVersion: string, forgeVersion: string): string {
        // 1.7.10 specific formatting (mcVersion appended twice)
        if (mcVersion === '1.7.10') {
            const fullVersion = `${mcVersion}-${forgeVersion}-${mcVersion}`;
            return `https://maven.minecraftforge.net/net/minecraftforge/forge/${fullVersion}/forge-${fullVersion}-universal.jar`;
        }

        // Standard legacy formatting (1.5.2 - 1.12.2 mostly)
        const fullVersion = `${mcVersion}-${forgeVersion}`;
        return `https://maven.minecraftforge.net/net/minecraftforge/forge/${fullVersion}/forge-${fullVersion}-universal.jar`;
    }





    private async downloadForge(version: string, dest: string, onLog: (msg: string) => void, onProgress: (data: any) => void): Promise<void> {
        // Offline Mode / Cache Check
        if (fs.existsSync(dest)) {
            const stats = fs.statSync(dest);
            // Basic validity check (> 3MB for Forge Universal)
            if (stats.size > 3 * 1024 * 1024) {
                onLog(`Forge found locally (${(stats.size / 1024 / 1024).toFixed(2)} MB). Skipping download.`);
                return;
            } else {
                onLog(`Forge file corrupted or too small (${(stats.size / 1024).toFixed(2)} KB). Redownloading...`);
                try { fs.unlinkSync(dest); } catch (e) { }
            }
        }

        let url: string;
        try {
            url = await this.getForgeUrl(version, onLog);
        } catch (e) {
            // If file exists (even if small/dubious?) - no, we checked above.
            // If we are here, we don't have a valid file AND failed to resolve URL.
            // Check internet? 
            throw new Error(`Cannot download Forge (Offline?): ${e}`);
        }

        onLog(`Downloading Forge for ${version} (via PowerShell)...`);
        onLog(`URL: ${url}`);

        fs.mkdirSync(path.dirname(dest), { recursive: true });

        return new Promise((resolve, reject) => {
            // Use PowerShell's Invoke-WebRequest which is robust on Windows
            // We use -UserAgent to mimic a browser
            const psCommand = `
                $ProgressPreference = 'SilentlyContinue';
                Invoke-WebRequest -Uri "${url}" -OutFile "${dest}" -UserAgent "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
            `;

            const child = spawn('powershell.exe', ['-Command', psCommand]);

            // Artificial progress since we can't easily parse PS progress bar standard output without complex logic
            // But we can check file size periodically or just show "Downloading..."
            let progressInterval: NodeJS.Timeout;

            progressInterval = setInterval(() => {
                if (fs.existsSync(dest)) {
                    const stats = fs.statSync(dest);
                    // Approximate total size ~5-6MB for Forge
                    const total = 6 * 1024 * 1024;
                    onProgress({ type: 'Forge', task: stats.size, total: total });
                }
            }, 500);

            child.stderr.on('data', () => {
                // console.error(`PS Stderr: ${data}`);
                // PowerShell sometimes outputs progress to stderr, optionally log it or ignore
            });

            child.on('close', (code: number) => {
                clearInterval(progressInterval);
                if (code === 0) {
                    onLog('Forge download complete (OS-native).');
                    resolve();
                } else {
                    reject(new Error(`PowerShell download failed with code ${code}`));
                }
            });

            child.on('error', (err: any) => {
                clearInterval(progressInterval);
                reject(err);
            });
        });
    }

    public async launchGame(options: {
        nickname: string;
        version: string; // "1.12.2" or "1.12.2-Forge"
        ram: number;
        gamePath?: string;
        hideLauncher?: boolean;
    }, onLog: (data: string) => void, onProgress: (data: any) => void, onClose: (code: number) => void, onGameStart?: () => void) {

        const rootPath = options.gamePath || path.join(app.getPath('userData'), 'minecraft_data');
        let versionNumber = options.version;

        // 1. Parse Version & Determine Java Requirement
        const isForge = options.version.includes('Forge');
        if (isForge) {
            versionNumber = options.version.replace(/-?Forge/i, '').trim();
        }

        let requiredJava: 8 | 17 = 8;
        // 1.17 usually needs Java 16, 1.18+ needs Java 17.
        const major = parseInt(versionNumber.split('.')[1] || '0');
        if (major >= 17) {
            requiredJava = 17;
            onLog(`Version ${versionNumber} requires Java 17+. Switching to Java 17 runtime.`);
        } else {
            onLog(`Version ${versionNumber} uses Legacy Java 8.`);
        }

        // 2. Ensure Java
        onLog(`Checking Java ${requiredJava}...`);
        const javaPath = await this.javaManager.getJavaPath(requiredJava, (msg, current, total) => {
            if (current !== undefined && total !== undefined) {
                onProgress({ type: `Java ${requiredJava}`, task: current, total: total });
            } else {
                onLog(`[Java] ${msg}`);
            }
        });

        onLog(`Java ${requiredJava} ready at: ${javaPath}`);

        // 3. Prepare Forge if needed
        let forgePath: string | undefined = undefined;
        if (isForge) {
            const forgeDir = path.join(rootPath, 'forge');
            const forgeFile = path.join(forgeDir, `${versionNumber}-universal.jar`);

            // We pass onLog to downloadForge for dynamic resolution logging
            try {
                await this.downloadForge(versionNumber, forgeFile, onLog, onProgress);
            } catch (e: any) {
                if (e.message && e.message.includes('No Forge found')) {
                    onLog(`[ERROR] Forge is not available for Minecraft ${versionNumber}.`);
                    onLog(`[TIP] Try version ${versionNumber}.1 or check if Forge exists for this specific release.`);
                    throw new Error(`Forge not found for ${versionNumber}`);
                }
                throw e;
            }
            forgePath = forgeFile;
            forgePath = forgeFile;
            onLog(`Forge configured: ${forgePath}`);
        }

        // Mod downloading logic removed by request.

        // 5. Environment Injection (The "Proxy Nuke" - Hard Offline Force)
        // This is CRITICAL. Vanilla 1.12.2 LAN only falls back to offline if it gets a
        // 'Connection Refused' at the socket level. Soft proxy/Maintenance errors block entry.
        // We exclude localhost to protect P2P tunnels.
        // 3. JVM Arguments - Authlib Injector Magic
        // We use authlib-injector to redirect Authlib to our local Mock Server (http://127.0.0.1:25530)
        // This bypasses the HTTPS enforcement and allows us to approve any session.
        // In prod, jar is in resources/authlib-injector.jar. In dev, it's in root.
        const injectorBase = app.isPackaged ? process.resourcesPath : app.getAppPath();
        const sourceInjectorPath = path.join(injectorBase, 'authlib-injector.jar');

        // FIX: Copy to rootPath (Minecraft Data) to avoid encoding issues with Cyrillic paths 
        // (e.g. if Launcher is installed in E:\Игры\...)
        const destInjectorPath = path.join(rootPath, 'authlib-injector.jar');

        // Ensure mods folder exists
        const modsPath = path.join(rootPath, 'mods');
        try { fs.mkdirSync(modsPath, { recursive: true }); } catch (e) { }

        try {
            if (fs.existsSync(sourceInjectorPath)) {
                onLog(`[Auth] Copying injector to safe path: ${destInjectorPath}`);
                if (fs.existsSync(destInjectorPath)) {
                    // Try to remove it first to ensure clean state, but ignore if locked
                    try { fs.unlinkSync(destInjectorPath); } catch (e) { }
                }
                fs.copyFileSync(sourceInjectorPath, destInjectorPath);
            } else {
                onLog(`[Auth Warning] Injector not found in resources. Downloading fallback...`);
                // Inline fetch since we are inside a method
                const url = 'https://github.com/yushijinhun/authlib-injector/releases/download/v1.2.5/authlib-injector-1.2.5.jar';
                const response = await fetch(url);
                if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
                const buffer = Buffer.from(await response.arrayBuffer());
                // Try to write, ignore if locked (EBUSY) assuming it's already there and valid
                try {
                    fs.writeFileSync(destInjectorPath, buffer);
                    onLog(`[Auth] Downloaded injector to: ${destInjectorPath}`);
                } catch (e: any) {
                    if (e.code === 'EBUSY' || e.code === 'EPERM') {
                        onLog(`[Auth Info] Injector file locked (already running?), skipping write.`);
                    } else {
                        throw e;
                    }
                }
            }
        } catch (e: any) {
            if (e.code === 'EBUSY' || e.code === 'EPERM') {
                onLog(`[Auth Info] Injector file locked, skipping copy/write.`);
            } else {
                onLog(`[Auth Error] Failed to prepare injector: ${e}`);
                // Fallback: try to use dest if it exists (maybe old download)
                if (!fs.existsSync(destInjectorPath)) {
                    onLog("[Auth Critical] Injector missing. Game launch might fail.");
                }
            }
        }

        const proxyNuke = `-javaagent:${destInjectorPath}=http://127.0.0.1:25530`;

        process.env.JAVA_TOOL_OPTIONS = proxyNuke;

        // 4. Construct Launch Options
        const opts: ILauncherOptions = {
            authorization: {
                access_token: '00000000000000000000000000000000',
                client_token: '00000000000000000000000000000001',
                user_properties: '{}' as any,
                meta: {
                    type: 'legacy' as any,
                    demo: false
                },
                name: options.nickname,
                uuid: this.getOfflineUUID(options.nickname),
            },
            root: rootPath,
            // 4.1 Proxy removed - authlib-injector handles the hijack
            version: {
                number: versionNumber,
                type: 'release'
            },
            memory: {
                max: options.ram * 1024 + 'M',
                min: '1024M'
            },
            javaPath: javaPath,
            overrides: {
                detached: false,
            }
        };
        if (forgePath) {
            opts.forge = forgePath;
        }

        onLog(`[Launcher] Launching with options: ${JSON.stringify(opts, null, 2)}`);

        console.log('Starting launch process within:', rootPath);
        onLog(`Preparing to launch version ${options.version}...`);

        // Fix Memory Leak: Remove previous listeners to avoid MaxListenersExceededWarning
        this.launcher.removeAllListeners('debug');
        this.launcher.removeAllListeners('data');
        this.launcher.removeAllListeners('progress');
        this.launcher.removeAllListeners('close');

        let gameStarted = false;

        this.launcher.on('debug', (e) => onLog(`[DEBUG] ${e} `));
        this.launcher.on('data', (e) => {
            onLog(`[GAME] ${e} `);
            // Hook for Performance Mode: Hide launcher only when game actually outputs data (starts)
            if (!gameStarted) {
                gameStarted = true;
                if (onGameStart) onGameStart();
            }
        });
        this.launcher.on('progress', (e) => onProgress(e));
        this.launcher.on('close', (e) => {
            onLog(`[EXIT] Game closed with code ${e} `);
            onClose(e);
        });

        try {
            await this.launcher.launch(opts);
            onLog('Launch successful!');
        } catch (error) {
            console.error('Launch failed', error);
            onLog(`Error: ${error} `);
            throw error;
        }
    }
}
