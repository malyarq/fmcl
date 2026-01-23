import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
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

/**
 * Manages synchronization of files from a remote manifest.
 * Downloads files that are missing or have changed hashes.
 */
export class Updater {
    private instancePath: string;

    constructor(instancePath: string) {
        this.instancePath = instancePath;
    }

    /**
     * Calculates SHA1 hash of a local file.
     * @param filePath Path to file
     * @returns SHA1 hash as hex string, or null if file doesn't exist
     */
    private async getFileHash(filePath: string): Promise<string | null> {
        if (!fs.existsSync(filePath)) return null;
        const fileBuffer = await fs.promises.readFile(filePath);
        const hashSum = crypto.createHash('sha1');
        hashSum.update(fileBuffer);
        return hashSum.digest('hex');
    }

    /**
     * Downloads a file from URL to disk using streaming.
     * @param url Source URL
     * @param destPath Destination file path
     * @throws Error if download fails
     */
    private async downloadFile(url: string, destPath: string) {
        await fs.promises.mkdir(path.dirname(destPath), { recursive: true });

        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to download ${url}: ${response.statusText}`);

        const fileStream = fs.createWriteStream(destPath);
        if (!response.body) throw new Error('No body');
        // @ts-expect-error - response.body is a ReadableStream which is compatible with Readable.fromWeb
        await pipeline(Readable.fromWeb(response.body), fileStream);
    }

    /**
     * Synchronizes files from a remote manifest.
     * @param manifestUrl URL to the manifest JSON file
     * @param onProgress Progress callback with status message and percentage
     * @throws Error if manifest cannot be loaded or sync fails
     */
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
