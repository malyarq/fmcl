import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { spawn } from 'child_process';

/**
 * Manages the Java Runtime Environment (JRE) required for Minecraft.
 * Handles detection, downloading, and verification of Java installations.
 */
export class JavaManager {
    // Adoptium API URLs for Windows x64 JRE/JDK
    private static readonly JAVA_URLS: Record<number, string> = {
        8: 'https://api.adoptium.net/v3/binary/latest/8/ga/windows/x64/jre/hotspot/normal/eclipse',
        17: 'https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse'
    };

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
     * Retrieves a valid path to the requested Java version.
     * Downloads and installs it if missing or corrupted.
     * 
     * @param version 8 (Legacy) or 17 (Modern)
     * @param onProgress Callback for status updates
     * @returns Absolute path to java.exe
     */
    public async getJavaPath(version: 8 | 17, onProgress: (status: string, current?: number, total?: number) => void): Promise<string> {
        const runtimeDir = path.join(app.getPath('userData'), 'runtime', `java${version}`);

        // 1. Check existing installation
        const existingJava = findJavaExecutable(runtimeDir);
        if (existingJava) {
            try {
                await this.verifyJava(existingJava);
                return existingJava;
            } catch (e) {
                console.error(`Existing Java ${version} is corrupted, re-downloading...`, e);
                try {
                    fs.rmSync(runtimeDir, { recursive: true, force: true });
                } catch (delErr) {
                    console.error('Failed to clear runtime dir:', delErr);
                }
            }
        }

        // 2. Download if missing
        onProgress(`Downloading Java ${version}...`, 0, 100);
        const url = JavaManager.JAVA_URLS[version];
        if (!url) throw new Error(`Unsupported Java version: ${version}`);

        await this.downloadJava(url, runtimeDir, `Java ${version}`, onProgress);

        // 3. Verify new installation
        const newJava = findJavaExecutable(runtimeDir);
        if (!newJava) throw new Error(`Java ${version} downloaded but java.exe not found in extracted files`);

        await this.verifyJava(newJava);
        return newJava;
    }

    /**
     * Downloads and extracts a Java Runtime from a URL using stream processing.
     * Use streams to minimize memory usage for large files.
     */
    private async downloadJava(url: string, destDir: string, label: string, onProgress: (status: string, current?: number, total?: number) => void) {
        fs.mkdirSync(destDir, { recursive: true });
        const zipPath = path.join(destDir, 'java.zip');

        // Cleanup existing zip from failed attempts
        if (fs.existsSync(zipPath)) {
            try { fs.unlinkSync(zipPath); } catch (e) { }
        }

        onProgress(`Connecting to Adoptium for ${label}...`, 0, 0);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to download ${label}: ${response.status} ${response.statusText}`);

        const totalBytes = Number(response.headers.get('content-length') || 0);
        const reader = response.body?.getReader();
        if (!reader) throw new Error('Failed to get response body reader');

        // Stream to file
        const fileStream = fs.createWriteStream(zipPath);

        try {
            let receivedLength = 0;
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                // Write chunk directly to file stream
                if (value) {
                    // fileStream.write usually accepts Uint8Array from fetch body
                    const canWrite = fileStream.write(value);
                    receivedLength += value.length;

                    // Throttle progress updates to avoid IPC flooding? 
                    // For now, update every chunk is okay for local socket, or maybe every 1MB
                    onProgress(`Downloading ${label}...`, receivedLength, totalBytes);

                    if (!canWrite) {
                        // Handle backpressure if needed (rare for file writes vs network reads)
                        await new Promise<void>(resolve => fileStream.once('drain', resolve));
                    }
                }
            }

            // Close stream safely
            await new Promise<void>((resolve, reject) => {
                fileStream.end(() => resolve());
                fileStream.on('error', reject);
            });

            console.log(`Downloaded ${receivedLength} bytes to ${zipPath}`);
        } catch (e) {
            fileStream.destroy(); // Close handle
            if (fs.existsSync(zipPath)) try { fs.unlinkSync(zipPath); } catch (_) { }
            throw e;
        }

        // Extract
        onProgress(`Extracting ${label}...`, 100, 100);
        try {
            await this.extractZip(zipPath, destDir);
        } catch (e) {
            throw e;
        } finally {
            // Clean up zip
            if (fs.existsSync(zipPath)) try { fs.unlinkSync(zipPath); } catch (_) { }
        }
    }

    /**
     * Extracts a ZIP file using Native PowerShell commands (Windows).
     */
    private extractZip(zipPath: string, dest: string): Promise<void> {
        return new Promise((resolve, reject) => {
            // Use PowerShell to unzip
            const command = `Expand-Archive -Path "${zipPath}" -DestinationPath "${dest}" -Force`;
            const child = spawn('powershell.exe', ['-Command', command]);

            child.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`Extraction failed with code ${code}`));
            });
            child.on('error', (err) => {
                reject(new Error(`Failed to spawn PowerShell for extraction: ${err.message}`));
            });
            // Optional: listen to stderr for debug
        });
    }
}

/**
 * recursively searches for java.exe in a directory.
 */
export function findJavaExecutable(startDir: string): string | null {
    if (!fs.existsSync(startDir)) return null;
    let files: fs.Dirent[];
    try {
        files = fs.readdirSync(startDir, { withFileTypes: true });
    } catch (e) {
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
