import { Client, ILauncherOptions } from 'minecraft-launcher-core';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { JavaManager } from './java';
import crypto from 'crypto';
import { NetworkManager } from './network';
// Explicit extension to prevent module resolution errors in some environments
import { DownloadManager } from './downloadManager';
import { getActiveProvider } from './mirrors';

/**
 * Configuration for official Minecraft download sources.
 * We strictly adhere to official Mojang and Forge Maven repositories to ensure file integrity.
 */
const OFFICIAL_CONF = {
    // Mojang
    meta: 'https://launchermeta.mojang.com',
    resource: 'https://resources.download.minecraft.net',
    libraries: 'https://libraries.minecraft.net',
    // Forge
    forgeMaven: 'https://maven.minecraftforge.net/',
    forgePromotions: 'https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json'
};

/**
 * Manager responsible for orchestration of the Minecraft client.
 * Handles tasks:
 * 1. Java Runtime Management (Auto-downloading Java 8/17)
 * 2. Version Resolution & Manifest Fetching
 * 3. Forge ModLoader Installation (Legacy & Modern)
 * 4. P2P Network Integration usage access
 * 5. Game Launch with Authlib Injection for Offline Mode
 */
export class LauncherManager {
    /** The core launcher library client */
    private launcher: Client;
    /** Manager for handling Java runtimes */
    private javaManager: JavaManager;
    /** Manager for P2P networking (Hyperswarm) */
    public networkManager: NetworkManager;

    constructor() {
        this.launcher = new Client();
        this.javaManager = new JavaManager();
        this.networkManager = new NetworkManager();
    }

    /**
     * Generates a consistent offline UUID (Version 3-like) based on the nickname.
     * This ensures the same player always gets the same UUID in offline mode.
     * @param nickname The player's username.
     * @returns A valid UUID string.
     */
    private getOfflineUUID(nickname: string): string {
        const md5 = crypto.createHash('md5');
        md5.update(`OfflinePlayer:${nickname}`);
        const buffer = md5.digest();
        // Set variant to RFC 4122
        buffer[6] = (buffer[6] & 0x0f) | 0x30; // Version 3
        buffer[8] = (buffer[8] & 0x3f) | 0x80; // Variant 1

        const hex = buffer.toString('hex');
        return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}`;
    }

    /**
     * Resolves the correct Forge version url and identifier for a given Minecraft version.
     * Fetches from the official Forge promotions JSON.
     * @param version Minecraft version (e.g., "1.12.2")
     * @param onLog Callback for logging status
     */
    private async getForgeUrl(version: string, onLog: (msg: string) => void): Promise<{ url: string; version: string }> {
        onLog('Resolving Forge version...');

        try {
            const response = await fetch(OFFICIAL_CONF.forgePromotions);
            if (!response.ok) throw new Error('Failed to fetch Forge promotions');
            const data = await response.json();

            // Try to find "recommended" build first
            const promoKey = `${version}-recommended`;
            const forgeVersion = data.promos[promoKey];

            if (!forgeVersion) {
                // Fallback to "latest" if recommended not found
                const latestKey = `${version}-latest`;
                const latestVersion = data.promos[latestKey];
                if (latestVersion) {
                    onLog(`Recommended Forge not found, using latest: ${latestVersion}`);
                    const url = this.constructForgeUrl(version, latestVersion);
                    return { url, version: `${version}-${latestVersion}` };
                }
                throw new Error(`No Forge found for version ${version}`);
            }

            onLog(`Found recommended Forge: ${forgeVersion}`);
            const url = this.constructForgeUrl(version, forgeVersion);
            return { url, version: `${version}-${forgeVersion}` };
        } catch (e) {
            throw new Error(`Failed to resolve Forge version: ${e}`);
        }
    }

    /**
     * Constructs the download URL for the Forge installer/universal JAR.
     * Handles legacy URL format differences (1.7.10 vs newer).
     */
    private constructForgeUrl(mcVersion: string, forgeVersion: string): string {
        // 1.7.10 uses "universal" jar and slightly different path structure
        if (mcVersion === '1.7.10') {
            const fullVersion = `${mcVersion}-${forgeVersion}-${mcVersion}`;
            return `${OFFICIAL_CONF.forgeMaven}net/minecraftforge/forge/${fullVersion}/forge-${fullVersion}-universal.jar`;
        }

        // Standard installer format (1.5.2 - 1.12.2+)
        const fullVersion = `${mcVersion}-${forgeVersion}`;
        return `${OFFICIAL_CONF.forgeMaven}net/minecraftforge/forge/${fullVersion}/forge-${fullVersion}-installer.jar`;
    }

    /**
     * Downloads a file while reporting dummy progress to satisfy UI requirements.
     */
    private async downloadFileSimple(url: string, dest: string, onLog: (msg: string) => void, onProgress: (data: any) => void): Promise<void> {
        onLog(`Downloading ${path.basename(dest)}...`);
        onProgress({ type: 'download', task: 'init', total: 0, current: 0 });
        try {
            await DownloadManager.downloadSingle(url, dest);
            onLog('Download complete.');
        } catch (e) {
            onLog(`[Error] Download failed: ${e}`);
            throw e;
        }
    }

    /**
     * Orchestrates the entire game launching process.
     * @param options Launch configuration options
     * @param onLog Callback to stream logs to the UI
     * @param onProgress Callback to stream progress to the UI
     * @param onClose Callback when game process exits
     * @param onGameStart Optional callback when game successfully starts
     */
    public async launchGame(options: {
        nickname: string;
        version: string; // Identifier like "1.12.2" or "1.12.2-Forge"
        ram: number;
        gamePath?: string;
        hideLauncher?: boolean;
    }, onLog: (data: string) => void, onProgress: (data: any) => void, onClose: (code: number) => void, onGameStart?: () => void) {

        const rootPath = options.gamePath || path.join(app.getPath('userData'), 'minecraft_data');
        let versionNumber = options.version;

        // --- 1. Parse Version & Requirements ---
        const isForge = options.version.includes('Forge');
        if (isForge) {
            versionNumber = options.version.replace(/-?Forge/i, '').trim();
        }

        // Detect correct Java version (Java 8 for <1.17, Java 17 for >=1.17)
        let requiredJava: 8 | 17 = 8;
        const major = parseInt(versionNumber.split('.')[1] || '0');
        if (major >= 17) {
            requiredJava = 17;
            onLog(`Version ${versionNumber} requires Java 17+. Switching to Java 17 runtime.`);
        } else {
            onLog(`Version ${versionNumber} uses Legacy Java 8.`);
        }

        // --- 2. Java Runtime Check ---
        onLog(`Checking Java ${requiredJava}...`);
        const javaPath = await this.javaManager.getJavaPath(requiredJava, (msg, current, total) => {
            if (current !== undefined && total !== undefined) {
                onProgress({ type: `Java ${requiredJava}`, task: current, total: total });
            } else {
                onLog(`[Java] ${msg}`);
            }
        });
        onLog(`Java ${requiredJava} ready at: ${javaPath}`);

        // --- 3. Forge Installation (If needed) ---
        let forgePathOrVersion: string | undefined = undefined;
        if (isForge) {
            try {
                onLog('Resolving Forge version from Mojang/Forge...');
                const forgeInfo = await this.getForgeUrl(versionNumber, onLog);
                const forgeDir = path.join(rootPath, 'libraries', 'net', 'minecraftforge', 'forge', forgeInfo.version);
                const jarType = versionNumber === '1.7.10' ? 'universal' : 'installer';
                const forgeFile = path.join(forgeDir, `forge-${forgeInfo.version}-${jarType}.jar`);

                if (!fs.existsSync(forgeFile)) {
                    onLog(`Downloading Forge ${jarType} JAR...`);
                    onLog(`URL: ${forgeInfo.url}`);
                    await this.downloadFileSimple(forgeInfo.url, forgeFile, onLog, onProgress);
                    onLog(`Forge downloaded successfully.`);
                } else {
                    onLog(`Forge ${jarType} JAR found locally, skipping download.`);
                }
                forgePathOrVersion = forgeFile;
                onLog(`Forge configured (path): ${forgePathOrVersion}`);
            } catch (e: any) {
                if (e.message && e.message.includes('No Forge found')) {
                    onLog(`[ERROR] Forge is not available for Minecraft ${versionNumber}.`);
                    onLog(`[TIP] Try version ${versionNumber}.1 or check if Forge exists for this specific release.`);
                    throw new Error(`Forge not found for ${versionNumber}`);
                }
                throw e;
            }
        }

        // --- 4. Offline Auth (Authlib Injector) ---
        // We use authlib-injector to force offline mode by redirecting auth requests to a local proxy (or just dummy properties).
        // Since we removed the local proxy server, we primarily rely on `authlib-injector`'s ability to handle offline profiles if configured correctly,
        // or we expect the user to play on Offline Mode servers (cracked).
        const injectorBase = app.isPackaged ? process.resourcesPath : app.getAppPath();
        const sourceInjectorPath = path.join(injectorBase, 'authlib-injector.jar');
        const destInjectorPath = path.join(rootPath, 'authlib-injector.jar');
        const modsPath = path.join(rootPath, 'mods');
        try { fs.mkdirSync(modsPath, { recursive: true }); } catch (e) { }

        // Copy or Download Injector
        try {
            if (fs.existsSync(sourceInjectorPath)) {
                onLog(`[Auth] Copying injector to safe path: ${destInjectorPath}`);
                if (fs.existsSync(destInjectorPath)) {
                    try { fs.unlinkSync(destInjectorPath); } catch (e) { }
                }
                fs.copyFileSync(sourceInjectorPath, destInjectorPath);
            } else {
                onLog(`[Auth Warning] Injector not found in resources. Downloading fallback...`);
                // Use a known stable release
                const url = 'https://github.com/yushijinhun/authlib-injector/releases/download/v1.2.5/authlib-injector-1.2.5.jar';
                const response = await fetch(url);
                if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
                const buffer = Buffer.from(await response.arrayBuffer());
                try {
                    fs.writeFileSync(destInjectorPath, buffer);
                    onLog(`[Auth] Downloaded injector to: ${destInjectorPath}`);
                } catch (e: any) {
                    // If file is busy (game running), we can skip if it exists
                    if ((e.code === 'EBUSY' || e.code === 'EPERM') && fs.existsSync(destInjectorPath)) {
                        onLog(`[Auth Info] Injector file locked (already running?), reusing existing.`);
                    } else {
                        throw e;
                    }
                }
            }
        } catch (e: any) {
            onLog(`[Auth Error] Failed to prepare injector: ${e}`);
        }

        // JVM Arguments
        const authlibArg = `-javaagent:${destInjectorPath}=http://127.0.0.1:25530`;
        const additionalJvmArgs = [
            '-XX:-UseAdaptiveSizePolicy',
            '-XX:-OmitStackTraceInFastThrow',
            '-Dfml.ignorePatchDiscrepancies=true',
            '-Dfml.ignoreInvalidMinecraftCertificates=true'
        ];

        // --- 5. Launch ---
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
            version: {
                number: versionNumber,
                type: 'release'
            },
            memory: {
                max: options.ram * 1024 + 'M',
                min: '1024M'
            },
            javaPath: javaPath,
            customArgs: [...additionalJvmArgs, authlibArg],
            overrides: {
                detached: false,
                url: {
                    meta: getActiveProvider().injectURL(OFFICIAL_CONF.meta),
                    resource: getActiveProvider().injectURL(OFFICIAL_CONF.resource),
                    mavenForge: getActiveProvider().injectURL(OFFICIAL_CONF.forgeMaven),
                    defaultRepoForge: getActiveProvider().injectURL(OFFICIAL_CONF.libraries),
                    fallbackMaven: 'https://search.maven.org/remotecontent?filepath='
                }
            }
        };

        if (forgePathOrVersion) {
            opts.forge = forgePathOrVersion;
        }

        onLog(`[Launcher] Launching with options: ${JSON.stringify(opts, null, 2)}`);
        console.log('Starting launch process within:', rootPath);
        onLog(`Preparing to launch version ${options.version}...`);

        // Clean up previous listeners
        this.launcher.removeAllListeners('debug');
        this.launcher.removeAllListeners('data');
        this.launcher.removeAllListeners('progress');
        this.launcher.removeAllListeners('close');

        let gameStarted = false;

        // Bind new listeners
        this.launcher.on('debug', (e) => onLog(`[DEBUG] ${e} `));
        this.launcher.on('data', (e) => {
            onLog(`[GAME] ${e} `);
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
