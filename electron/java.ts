import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { spawn } from 'child_process';
import { fetchJavaRuntimeManifest, installJavaRuntimeTask, JavaRuntimeTargetType } from '@xmcl/installer';
import type { Task } from '@xmcl/task';

/**
 * Manages the Java Runtime Environment (JRE) required for Minecraft.
 * Handles detection, downloading, and verification of Java installations.
 */
export class JavaManager {
    private readonly runtimeRoot = path.join(app.getPath('userData'), 'runtime');

    /**
     * Ensures validity of a Java executable at a specific path.
     * @param javaPath Path to java.exe
     * @returns Promise that resolves if valid, rejects if invalid.
     */
    private verifyJava(javaPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const child = spawn(javaPath, ['-version']);
            child.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`Java verification failed with code ${code}`));
            });
            child.on('error', (err) => reject(err));
        });
    }

    /**
     * Gets the Java version number from a Java executable.
     * @param javaPath Path to java.exe
     * @returns Promise that resolves to the major version number (e.g., 8, 17, 21)
     */
    public async getJavaVersion(javaPath: string): Promise<number> {
        return new Promise((resolve, reject) => {
            const child = spawn(javaPath, ['-version']);
            let output = '';
            child.stderr?.on('data', (data) => {
                output += data.toString();
            });
            child.stdout?.on('data', (data) => {
                output += data.toString();
            });
            child.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Failed to get Java version: exit code ${code}`));
                    return;
                }
                // Parse version from output like "openjdk version "21.0.1""
                const versionMatch = output.match(/version ["']?(\d+)/);
                if (versionMatch) {
                    const majorVersion = parseInt(versionMatch[1], 10);
                    resolve(majorVersion);
                } else {
                    reject(new Error(`Could not parse Java version from output: ${output}`));
                }
            });
            child.on('error', (err) => reject(err));
        });
    }

    /**
     * Finds system-installed Java of a specific version.
     * @param requiredVersion The required Java version (8, 17, or 21)
     * @returns Path to java.exe if found, null otherwise
     */
    private async findSystemJava(requiredVersion: number): Promise<string | null> {
        // First, try to find Java in PATH
        try {
            const javaPath = 'java';
            await this.verifyJava(javaPath);
            const version = await this.getJavaVersion(javaPath);
            if (version === requiredVersion) {
                return javaPath;
            }
        } catch {
            // Continue searching
        }

        // Try JAVA_HOME
        if (process.env.JAVA_HOME) {
            const javaHomePaths = [
                path.join(process.env.JAVA_HOME, 'bin', 'java.exe'),
                path.join(process.env.JAVA_HOME, 'bin', 'java'),
            ];
            for (const javaPath of javaHomePaths) {
                try {
                    await this.verifyJava(javaPath);
                    const version = await this.getJavaVersion(javaPath);
                    if (version === requiredVersion) {
                        return javaPath;
                    }
                } catch {
                    // Continue searching
                }
            }
        }

        // Try common Windows installation paths
        const commonPaths = [
            `C:\\Program Files\\Java\\jdk-${requiredVersion}\\bin\\java.exe`,
            `C:\\Program Files\\Java\\jre-${requiredVersion}\\bin\\java.exe`,
            `C:\\Program Files\\Java\\jdk-${requiredVersion}\\bin\\java`,
            `C:\\Program Files\\Java\\jre-${requiredVersion}\\bin\\java`,
            `C:\\Program Files (x86)\\Java\\jdk-${requiredVersion}\\bin\\java.exe`,
            `C:\\Program Files (x86)\\Java\\jre-${requiredVersion}\\bin\\java.exe`,
            // Also try without version number (latest JDK/JRE)
            'C:\\Program Files\\Java\\jdk\\bin\\java.exe',
            'C:\\Program Files\\Java\\jre\\bin\\java.exe',
            'C:\\Program Files\\Java\\jdk\\bin\\java',
            'C:\\Program Files\\Java\\jre\\bin\\java',
        ];

        for (const javaPath of commonPaths) {
            try {
                if (fs.existsSync(javaPath)) {
                    await this.verifyJava(javaPath);
                    const version = await this.getJavaVersion(javaPath);
                    if (version === requiredVersion) {
                        return javaPath;
                    }
                }
            } catch {
                // Continue searching
            }
        }

        // Try to find all Java installations in Program Files
        const programFilesPaths = [
            'C:\\Program Files\\Java',
            'C:\\Program Files (x86)\\Java',
        ];

        for (const basePath of programFilesPaths) {
            if (!fs.existsSync(basePath)) continue;
            try {
                const entries = fs.readdirSync(basePath, { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.isDirectory()) {
                        const javaPath = path.join(basePath, entry.name, 'bin', 'java.exe');
                        if (fs.existsSync(javaPath)) {
                            try {
                                await this.verifyJava(javaPath);
                                const version = await this.getJavaVersion(javaPath);
                                if (version === requiredVersion) {
                                    return javaPath;
                                }
                            } catch {
                                // Continue searching
                            }
                        }
                    }
                }
            } catch {
                // Continue searching
            }
        }

        return null;
    }

    /**
     * Validates a custom Java path provided by the user.
     */
    public async validateJavaPath(javaPath: string): Promise<boolean> {
        try {
            await this.verifyJava(javaPath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Retrieves a valid path to the requested Java version.
     * Downloads and installs it if missing or corrupted.
     * 
     * @param version 8 (Legacy), 17 (Modern), or 21 (Latest)
     * @param onProgress Callback for status updates
     * @returns Absolute path to java.exe
     */
    public async getJavaPath(version: 8 | 17 | 21, onProgress: (status: string, current?: number, total?: number) => void): Promise<string> {
        let runtimeDir: string;
        let target: JavaRuntimeTargetType | string;
        
        if (version === 8) {
            runtimeDir = path.join(this.runtimeRoot, 'jre-legacy');
            target = JavaRuntimeTargetType.Legacy;
        } else if (version === 17) {
            runtimeDir = path.join(this.runtimeRoot, 'java17');
            target = JavaRuntimeTargetType.Gamma;
        } else {
            // Java 21 - Minecraft 1.20.5+ uses Java 21
            // Try different possible runtime target types for Java 21
            // The runtime manifest system may have Java 21 under a different name
            runtimeDir = path.join(this.runtimeRoot, 'java21');
            // Try common possible names for Java 21 runtime
            // If none work, we'll try to fetch and see what's available
            target = 'java-runtime-gamma' as JavaRuntimeTargetType; // Start with gamma, will try others if needed
        }

        // Check existing installation first.
        const existingJava = findJavaExecutable(runtimeDir);
        if (existingJava) {
            try {
                await this.verifyJava(existingJava);
                // For Java 21, verify it's actually version 21
                if (version === 21) {
                    const actualVersion = await this.getJavaVersion(existingJava);
                    if (actualVersion === 21) {
                        return existingJava;
                    } else {
                        console.warn(`Existing Java installation is version ${actualVersion}, not 21. Re-downloading...`);
                        try {
                            fs.rmSync(runtimeDir, { recursive: true, force: true });
                        } catch (delErr) {
                            console.error('Failed to clear runtime dir:', delErr);
                        }
                    }
                } else {
                    return existingJava;
                }
            } catch (e) {
                console.error(`Existing Java ${version} is corrupted, re-downloading...`, e);
                try {
                    fs.rmSync(runtimeDir, { recursive: true, force: true });
                } catch (delErr) {
                    console.error('Failed to clear runtime dir:', delErr);
                }
            }
        }

        // For Java 21, try to find system Java first before downloading
        if (version === 21) {
            onProgress('Checking for system Java 21...');
            const systemJava = await this.findSystemJava(21);
            if (systemJava) {
                onProgress(`Using system Java 21: ${systemJava}`);
                return systemJava;
            }
        }
        
        onProgress(`Fetching Java ${version} runtime manifest...`);
        
        // For Java 21, try multiple possible target types since it might not be explicitly defined
        let manifest;
        if (version === 21) {
            // Try different possible runtime types for Java 21
            const possibleTargets = [
                'java-runtime-gamma', // Might be updated to Java 21
                'java-runtime-delta', // Possible newer runtime
                JavaRuntimeTargetType.Gamma, // Fallback to Java 17 runtime
            ];
            
            let lastError: Error | null = null;
            for (const tryTarget of possibleTargets) {
                try {
                    manifest = await fetchJavaRuntimeManifest({ target: tryTarget });
                    onProgress(`Found Java runtime using target: ${tryTarget}`);
                    break;
                } catch (e) {
                    lastError = e;
                    continue;
                }
            }
            
            if (!manifest) {
                // If all targets failed, try to use system Java 21 if available (one more time)
                onProgress('Runtime manifest failed, checking system Java 21 again...');
                const systemJava = await this.findSystemJava(21);
                if (systemJava) {
                    onProgress(`Using system Java 21: ${systemJava}`);
                    return systemJava;
                }
                
                throw new Error(
                    `Failed to fetch Java 21 runtime manifest and no system Java 21 found. ` +
                    `Please install Java 21 system-wide or update @xmcl/installer. ` +
                    `Last error: ${lastError?.message || 'Unknown error'}`
                );
            }
        } else {
            manifest = await fetchJavaRuntimeManifest({ target });
        }

        onProgress(`Downloading Java ${version}...`, 0, 0);
        const task = installJavaRuntimeTask({
            destination: runtimeDir,
            manifest
        });

        await task.startAndWait({
            onStart: (t: Task) => {
                const total = typeof t.total === 'number' ? t.total : 0;
                if (total > 0) onProgress(`Downloading Java ${version}...`, 0, total);
            },
            onUpdate: (t: Task) => {
                const total = typeof t.total === 'number' ? t.total : 0;
                const progress = typeof t.progress === 'number' ? t.progress : 0;
                if (total > 0) onProgress(`Downloading Java ${version}...`, progress, total);
            }
        });

        const newJava = findJavaExecutable(runtimeDir);
        if (!newJava) throw new Error(`Java ${version} installed but java.exe not found in runtime directory`);

        await this.verifyJava(newJava);
        
        // For Java 21, verify it's actually version 21
        if (version === 21) {
            const actualVersion = await this.getJavaVersion(newJava);
            if (actualVersion !== 21) {
                // The downloaded Java is not version 21, try system Java
                onProgress(`Downloaded Java is version ${actualVersion}, not 21. Trying system Java...`);
                const systemJava = await this.findSystemJava(21);
                if (systemJava) {
                    onProgress(`Using system Java 21: ${systemJava}`);
                    return systemJava;
                }
                throw new Error(
                    `Downloaded Java runtime is version ${actualVersion}, not 21. ` +
                    `Please install Java 21 system-wide or check your Minecraft version requirements.`
                );
            }
        }
        
        return newJava;
    }
}

/**
 * Recursively search for java.exe in a directory.
 */
export function findJavaExecutable(startDir: string): string | null {
    if (!fs.existsSync(startDir)) return null;
    let files: fs.Dirent[];
    try {
        files = fs.readdirSync(startDir, { withFileTypes: true });
    } catch {
        return null;
    }

    for (const file of files) {
        const fullPath = path.join(startDir, file.name);
        if (file.isDirectory()) {
            const found = findJavaExecutable(fullPath);
            if (found) return found;
        } else if (file.name === 'java.exe') {
            return fullPath;
        }
    }
    return null;
}
