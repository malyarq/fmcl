import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export class ContentManager {
    private storePath: string;

    constructor(userDataPath: string) {
        this.storePath = path.join(userDataPath, 'content-store');
        this.ensureStore();
    }

    private ensureStore() {
        if (!fs.existsSync(this.storePath)) {
            fs.mkdirSync(this.storePath, { recursive: true });
        }
    }

    public getStorePath(hash: string): string {
        // Sharding by first 2 chars to avoid too many files in one directory
        const prefix = hash.substring(0, 2);
        const dir = path.join(this.storePath, prefix);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        return path.join(dir, hash);
    }

    public async calculateHash(filePath: string, algo: 'sha1' | 'sha256' = 'sha1'): Promise<string> {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash(algo);
            const stream = fs.createReadStream(filePath);

            stream.on('error', reject);
            stream.on('data', (chunk) => hash.update(chunk));
            stream.on('end', () => resolve(hash.digest('hex')));
        });
    }

    /**
     * Import a file into the centralized store.
     * If hash is provided, it is used. Otherwise, it is calculated.
     * Returns the hash of the file.
     */
    public async importFile(sourcePath: string, providedHash?: string, algo: 'sha1' | 'sha256' = 'sha1'): Promise<string> {
        if (!fs.existsSync(sourcePath)) {
            throw new Error(`File not found: ${sourcePath}`);
        }

        const hash = providedHash || await this.calculateHash(sourcePath, algo);
        const storeDest = this.getStorePath(hash);

        // If file does not exist in store, copy it
        if (!fs.existsSync(storeDest)) {
            // Copy to a temp file first to ensure atomicity
            const tempDest = `${storeDest}.tmp-${Date.now()}`;
            fs.copyFileSync(sourcePath, tempDest);
            fs.renameSync(tempDest, storeDest);
        }

        return hash;
    }

    /**
     * Create a hard link from the store to the destination.
     * If the destination exists, it is removed first (unless it is already the correct hard link).
     */
    public async linkFile(destinationPath: string, hash: string): Promise<void> {
        const storePath = this.getStorePath(hash);

        if (!fs.existsSync(storePath)) {
            throw new Error(`Content not found in store: ${hash}`);
        }

        const destDir = path.dirname(destinationPath);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }

        // Check if destination already exists
        if (fs.existsSync(destinationPath)) {
            const destStats = fs.statSync(destinationPath);
            const storeStats = fs.statSync(storePath);

            // Check if it's already the same inode (hard linked)
            if (destStats.ino === storeStats.ino && destStats.dev === storeStats.dev) {
                return; // Already linked
            }

            // If not linked, remove it
            fs.unlinkSync(destinationPath);
        }

        // Create hard link
        try {
            fs.linkSync(storePath, destinationPath);
        } catch (error) {
            // Fallback to copy if hard link fails (e.g. cross-device link)
            console.warn(`Failed to create hard link for ${hash}, falling back to copy:`, error);
            fs.copyFileSync(storePath, destinationPath);
        }
    }

    /**
     * Scan a directory and deduplicate files that match content in the store.
     * Returns number of deduplicated files.
     */
    public async deduplicateDirectory(dirPath: string, algo: 'sha1' | 'sha256' = 'sha1'): Promise<number> {
        if (!fs.existsSync(dirPath)) return 0;

        let count = 0;
        const files = fs.readdirSync(dirPath);

        for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stats = fs.statSync(filePath);

            if (stats.isDirectory()) {
                count += await this.deduplicateDirectory(filePath, algo);
            } else if (stats.isFile()) {
                const hash = await this.calculateHash(filePath, algo);
                const storePath = this.getStorePath(hash);

                if (fs.existsSync(storePath)) {
                    const storeStats = fs.statSync(storePath);
                    if (stats.ino !== storeStats.ino || stats.dev !== storeStats.dev) {
                        // Not linked, but content exists. Deduplicate.
                        await this.linkFile(filePath, hash);
                        count++;
                    }
                } else {
                    // Content not in store, import it then link it
                    await this.importFile(filePath, hash, algo);
                    await this.linkFile(filePath, hash);
                    // Technically not "deduplication" yet as we just added it, but future usages will benefit
                }
            }
        }
        return count;
    }
    /**
     * Get statistics about the content store.
     */
    public async getStats(): Promise<{ totalSize: number; dedupedSize: number; totalFiles: number; storedFiles: number }> {
        let totalFiles = 0;
        let storedFiles = 0;
        let totalSize = 0;
        let dedupedSize = 0;

        const processDir = async (dir: string) => {
            if (!fs.existsSync(dir)) return;
            const entries = fs.readdirSync(dir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    await processDir(fullPath);
                } else if (entry.isFile()) {
                    const stats = fs.statSync(fullPath);
                    storedFiles++;
                    totalSize += stats.size;

                    // If nlink > 1, it means it's used elsewhere (hard linked)
                    // logical size = size * nlink
                    // physical size = size
                    // saved = size * (nlink - 1)
                    if (stats.nlink > 1) {
                        dedupedSize += stats.size * (stats.nlink - 1);
                        totalFiles += stats.nlink; // 1 in store + (nlink-1) external
                    } else {
                        totalFiles += 1;
                    }
                }
            }
        };

        await processDir(this.storePath);

        return {
            totalSize,
            dedupedSize,
            totalFiles,
            storedFiles
        };
    }

    /**
     * Remove unused files (nlink === 1) that are older than minAgeMs.
     */
    public async cleanup(minAgeMs: number = 60000): Promise<{ freedSize: number; deletedFiles: number }> {
        let freedSize = 0;
        let deletedFiles = 0;
        const now = Date.now();

        const processDir = async (dir: string) => {
            if (!fs.existsSync(dir)) return;
            const entries = fs.readdirSync(dir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    await processDir(fullPath);
                    // Try to remove empty directories
                    try {
                        if (fs.readdirSync(fullPath).length === 0) {
                            fs.rmdirSync(fullPath);
                        }
                    } catch {
                        // Ignore
                    }
                } else if (entry.isFile()) {
                    const stats = fs.statSync(fullPath);
                    // nlink === 1 means it's only in the store (unused)
                    if (stats.nlink === 1) {
                        // Check age to avoid race conditions with ongoing downloads
                        if (now - stats.birthtimeMs > minAgeMs && now - stats.mtimeMs > minAgeMs) {
                            try {
                                fs.unlinkSync(fullPath);
                                freedSize += stats.size;
                                deletedFiles++;
                            } catch (e) {
                                console.error(`Failed to delete unused file ${fullPath}:`, e);
                            }
                        }
                    }
                }
            }
        };

        await processDir(this.storePath);

        return { freedSize, deletedFiles };
    }
}
