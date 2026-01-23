import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
// import { net } from 'electron';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

interface ManifestFile {
    path: string;
    hash: string;
    size: number;
    url: string;
}

interface Manifest {
    name: string;
    files: ManifestFile[];
}

export class Updater {
    private instancePath: string;

    constructor(instancePath: string) {
        this.instancePath = instancePath;
    }

    // Calculate local file hash (sha1).
    private async getFileHash(filePath: string): Promise<string | null> {
        if (!fs.existsSync(filePath)) return null;
        const fileBuffer = await fs.promises.readFile(filePath);
        const hashSum = crypto.createHash('sha1');
        hashSum.update(fileBuffer);
        return hashSum.digest('hex');
    }

    // Download a file to disk using streaming.
    private async downloadFile(url: string, destPath: string) {
        await fs.promises.mkdir(path.dirname(destPath), { recursive: true });

        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to download ${url}: ${response.statusText}`);

        const fileStream = fs.createWriteStream(destPath);
        // @ts-expect-error - response.body is a ReadableStream which is compatible with Readable.fromWeb
        if (!response.body) throw new Error('No body');
        // @ts-expect-error - response.body is a ReadableStream which is compatible with Readable.fromWeb
        await pipeline(Readable.fromWeb(response.body), fileStream);
    }

    public async sync(manifestUrl: string, onProgress: (status: string, progress: number) => void) {
        onProgress('Fetching manifest...', 0);

        let manifest: Manifest;
        try {
            const response = await fetch(manifestUrl);
            manifest = await response.json() as Manifest;
        } catch (e) {
            throw new Error(`Failed to load manifest: ${e}`);
        }

        const totalFiles = manifest.files.length;
        let processed = 0;

        for (const file of manifest.files) {
            const destPath = path.join(this.instancePath, file.path);
            const localHash = await this.getFileHash(destPath);

            if (localHash !== file.hash) {
                onProgress(`Downloading ${path.basename(file.path)}...`, (processed / totalFiles) * 100);

                try {
                    await this.downloadFile(file.url, destPath);
                } catch (e) {
                    console.error(`Error downloading ${file.path}:`, e);
                    throw e;
                }
            }

            processed++;
            onProgress('Syncing...', (processed / totalFiles) * 100);
        }

        onProgress('Sync Complete!', 100);
    }
}
