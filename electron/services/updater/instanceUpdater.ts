import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';
import { resolvePathWithinRoot } from '../../security/pathGuards';
import { assertPublicHttpsUrl, fetchPublicHttpsUrl } from '../../security/remoteUrls';

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

export type UpdaterSyncOptions = {
    checkCancelled?: () => void;
};

const MAX_MANIFEST_BYTES = 1024 * 1024;
const MAX_MANIFEST_FILES = 2_000;
const MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024 * 1024;
const SHA1_RE = /^[a-f\d]{40}$/i;

function validateManifest(value: unknown): Manifest {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Updater manifest must be an object');
    }

    const record = value as Record<string, unknown>;
    if (typeof record.name !== 'string' || !record.name.trim() || record.name.length > 256) {
        throw new Error('Updater manifest name is invalid');
    }
    if (!Array.isArray(record.files) || record.files.length > MAX_MANIFEST_FILES) {
        throw new Error(`Updater manifest must contain at most ${MAX_MANIFEST_FILES} files`);
    }

    let totalBytes = 0;
    const files = record.files.map((entry, index): ManifestFile => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
            throw new Error(`Updater manifest file ${index} must be an object`);
        }
        const file = entry as Record<string, unknown>;
        if (typeof file.path !== 'string' || !file.path.trim() || file.path.length > 4_096) {
            throw new Error(`Updater manifest file ${index} has an invalid path`);
        }
        if (typeof file.hash !== 'string' || !SHA1_RE.test(file.hash)) {
            throw new Error(`Updater manifest file ${index} must include a SHA-1 hash`);
        }
        if (!Number.isSafeInteger(file.size) || Number(file.size) < 0 || Number(file.size) > MAX_FILE_BYTES) {
            throw new Error(`Updater manifest file ${index} has an invalid size`);
        }

        totalBytes += Number(file.size);
        if (totalBytes > MAX_TOTAL_BYTES) {
            throw new Error('Updater manifest exceeds the total download limit');
        }

        return {
            path: file.path,
            hash: file.hash.toLowerCase(),
            size: Number(file.size),
            url: assertPublicHttpsUrl(file.url, `Updater manifest file ${index} URL`),
        };
    });

    return { name: record.name.trim(), files };
}

async function readJsonResponse(response: Response): Promise<unknown> {
    if (!response.ok) {
        throw new Error(`Manifest request failed with HTTP ${response.status}`);
    }

    const contentLength = response.headers.get('content-length');
    const declaredLength = contentLength === null ? undefined : Number(contentLength);
    if (declaredLength !== undefined && Number.isFinite(declaredLength) && declaredLength > MAX_MANIFEST_BYTES) {
        throw new Error('Updater manifest is too large');
    }
    if (!response.body) throw new Error('Updater manifest response has no body');

    const chunks: Buffer[] = [];
    let received = 0;
    for await (const chunk of Readable.fromWeb(response.body as never)) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
        received += buffer.length;
        if (received > MAX_MANIFEST_BYTES) throw new Error('Updater manifest is too large');
        chunks.push(buffer);
    }

    try {
        return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
    } catch {
        throw new Error('Updater manifest is not valid JSON');
    }
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
        const hashSum = crypto.createHash('sha1');
        for await (const chunk of fs.createReadStream(filePath)) {
            hashSum.update(chunk);
        }
        return hashSum.digest('hex');
    }

    /**
     * Downloads a file from URL to disk using streaming.
     * @param url Source URL
     * @param destPath Destination file path
     * @throws Error if download fails
     */
    private async downloadFile(file: ManifestFile, destPath: string, checkCancelled: () => void) {
        checkCancelled();
        await fs.promises.mkdir(path.dirname(destPath), { recursive: true });

        const response = await fetchPublicHttpsUrl(file.url, `Updater file ${file.path} URL`, {
            maxRedirections: 0,
        });
        if (!response.ok) throw new Error(`Failed to download ${file.url}: HTTP ${response.status}`);
        if (!response.body) throw new Error('Download response has no body');

        const contentLength = response.headers.get('content-length');
        const declaredLength = contentLength === null ? undefined : Number(contentLength);
        if (declaredLength !== undefined && Number.isFinite(declaredLength) && declaredLength !== file.size) {
            throw new Error(`Download size mismatch for ${file.path}`);
        }

        const tempPath = `${destPath}.fmcl-download-${process.pid}-${crypto.randomUUID()}`;
        const hash = crypto.createHash('sha1');
        let received = 0;
        const verifier = new Transform({
            transform(chunk: Buffer, _encoding, callback) {
                try {
                    checkCancelled();
                } catch (error) {
                    callback(error as Error);
                    return;
                }
                received += chunk.length;
                if (received > file.size || received > MAX_FILE_BYTES) {
                    callback(new Error(`Download exceeds declared size for ${file.path}`));
                    return;
                }
                hash.update(chunk);
                callback(null, chunk);
            },
        });

        try {
            await pipeline(
                Readable.fromWeb(response.body as never),
                verifier,
                fs.createWriteStream(tempPath, { flags: 'wx' }),
            );
            if (received !== file.size) throw new Error(`Download size mismatch for ${file.path}`);
            if (hash.digest('hex') !== file.hash) throw new Error(`Download hash mismatch for ${file.path}`);
            await fs.promises.rename(tempPath, destPath);
        } catch (error) {
            await fs.promises.rm(tempPath, { force: true }).catch(() => undefined);
            throw error;
        }
    }

    /**
     * Synchronizes files from a remote manifest.
     * @param manifestUrl URL to the manifest JSON file
     * @param onProgress Progress callback with status message and percentage
     * @throws Error if manifest cannot be loaded or sync fails
     */
    public async sync(
        manifestUrl: string,
        onProgress: (status: string, progress: number) => void,
        options: UpdaterSyncOptions = {},
    ) {
        const checkCancelled = options.checkCancelled ?? (() => undefined);
        checkCancelled();
        onProgress('Fetching manifest...', 0);

        let manifest: Manifest;
        try {
            const safeManifestUrl = assertPublicHttpsUrl(manifestUrl, 'Updater manifest URL');
            const response = await fetchPublicHttpsUrl(safeManifestUrl, 'Updater manifest URL', {
                maxRedirections: 0,
            });
            manifest = validateManifest(await readJsonResponse(response));
        } catch (e) {
            throw new Error(`Failed to load manifest: ${e}`);
        }

        const totalFiles = manifest.files.length;
        let processed = 0;

        for (const file of manifest.files) {
            checkCancelled();
            const destPath = resolvePathWithinRoot(this.instancePath, file.path, 'Updater file path');
            const localHash = await this.getFileHash(destPath);

            if (localHash !== file.hash) {
                onProgress(`Downloading ${path.basename(file.path)}...`, (processed / totalFiles) * 100);

                try {
                    await this.downloadFile(file, destPath, checkCancelled);
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
