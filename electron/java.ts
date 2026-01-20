import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { spawn } from 'child_process';

export class JavaManager {
    // Adoptium API URLs for Windows x64 JRE
    private static readonly JAVA_URLS: Record<number, string> = {
        8: 'https://api.adoptium.net/v3/binary/latest/8/ga/windows/x64/jre/hotspot/normal/eclipse',
        17: 'https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse' // JDK for 17 usually safer, or JRE if available
    };

    public async getJavaPath(version: 8 | 17, onProgress: (status: string, current?: number, total?: number) => void): Promise<string> {
        const runtimeDir = path.join(app.getPath('userData'), 'runtime', `java${version}`);

        // Try to find existing java
        const existingJava = findJavaExecutable(runtimeDir);

        if (existingJava) {
            // Verify it works
            try {
                await this.verifyJava(existingJava);
                return existingJava;
            } catch (e) {
                console.error(`Existing Java ${version} is corrupted, re-downloading...`, e);
                // Wipe directory to force fresh install
                try {
                    fs.rmSync(runtimeDir, { recursive: true, force: true });
                } catch (delErr) {
                    console.error('Failed to clear runtime dir:', delErr);
                }
            }
        }

        onProgress(`Downloading Java ${version}...`, 0, 100);
        const url = JavaManager.JAVA_URLS[version];
        if (!url) throw new Error(`Unsupported Java version: ${version}`);

        await this.downloadJava(url, runtimeDir, `Java ${version}`, onProgress);

        // Check again after download
        const newJava = findJavaExecutable(runtimeDir);
        if (!newJava) throw new Error(`Java ${version} downloaded but java.exe not found in extracted files`);

        // Verify the new download immediately
        await this.verifyJava(newJava);

        return newJava;
    }

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

    private async downloadJava(url: string, destDir: string, label: string, onProgress: (status: string, current?: number, total?: number) => void) {
        fs.mkdirSync(destDir, { recursive: true });
        const zipPath = path.join(destDir, 'java.zip');

        // Clean up previous corrupt attempts
        if (fs.existsSync(zipPath)) {
            try {
                fs.unlinkSync(zipPath);
            } catch (e) {
                console.error('Failed to delete existing java.zip:', e);
            }
        }

        onProgress(`Connecting to Adoptium for ${label}...`, 0, 0);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to download ${label}: ${response.status} ${response.statusText}`);

        const totalBytes = Number(response.headers.get('content-length') || 0);

        // Download as ArrayBuffer (loads in memory, safe for ~50MB file)
        const reader = response.body?.getReader();
        if (!reader) throw new Error('Failed to get response body reader');

        const chunks: Uint8Array[] = [];
        let receivedLength = 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            chunks.push(value);
            receivedLength += value.length;

            onProgress(`Downloading ${label}...`, receivedLength, totalBytes);
        }

        // Combine chunks
        const completeBuffer = new Uint8Array(receivedLength);
        let position = 0;
        for (const chunk of chunks) {
            completeBuffer.set(chunk, position);
            position += chunk.length;
        }

        console.log(`Writing java.zip (${receivedLength} bytes) to ${zipPath}`);
        fs.writeFileSync(zipPath, completeBuffer);

        onProgress(`Extracting ${label}...`, 100, 100);
        try {
            await this.extractZip(zipPath, destDir);
        } catch (e) {
            if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
            throw e;
        }

        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    }

    private extractZip(zipPath: string, dest: string): Promise<void> {
        return new Promise((resolve, reject) => {
            // Use PowerShell to unzip (Native on Windows 10+)
            const command = `Expand-Archive -Path "${zipPath}" -DestinationPath "${dest}" -Force`;
            const child = spawn('powershell.exe', ['-Command', command]);

            child.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`Extraction failed with code ${code}`));
            });
            child.on('error', reject);
        });
    }
}

// Helper to find java executable recursively if extraction created a subfolder
export function findJavaExecutable(startDir: string): string | null {
    if (!fs.existsSync(startDir)) return null;
    const files = fs.readdirSync(startDir, { withFileTypes: true });

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
