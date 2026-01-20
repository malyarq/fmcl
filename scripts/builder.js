import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

/**
 * Configuration
 * Run with: node scripts/builder.js <modpack-folder-name> <base-url>
 * Example: node scripts/builder.js super-rpg https://raw.githubusercontent.com/USER/REPO/main/modpacks/super-rpg
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODPACKS_DIR = path.join(__dirname, '../modpacks');
const PACK_NAME = process.argv[2];
const BASE_URL = process.argv[3];

if (!PACK_NAME || !BASE_URL) {
    console.error('Usage: node scripts/builder.js <pack-name> <base-url>');
    console.error('Example: node scripts/builder.js example-pack https://raw.githubusercontent.com/username/repo/main/modpacks/example-pack');
    process.exit(1);
}

const PACK_DIR = path.join(MODPACKS_DIR, PACK_NAME);
const OUTPUT_FILE = path.join(PACK_DIR, 'manifest.json');
const IGNORE_FILES = ['manifest.json', '.DS_Store', 'thumbs.db'];

// Helper: Calculate SHA1
function getFileHash(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha1');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}

// Helper: Recursive file scan
function scanDirectory(dir, fileList = []) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        if (IGNORE_FILES.includes(file.toLowerCase())) return;

        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            scanDirectory(filePath, fileList);
        } else {
            // Calculate relative path (e.g., "mods/jei.jar")
            // We must force forward slashes for URLs even on Windows
            const relativePath = path.relative(PACK_DIR, filePath).replace(/\\/g, '/');

            fileList.push({
                path: relativePath,
                hash: getFileHash(filePath),
                size: stat.size,
                url: `${BASE_URL}/${relativePath}`
            });
        }
    });

    return fileList;
}

console.log(`🔨 Building manifest for "${PACK_NAME}"...`);
console.log(`📂 Directory: ${PACK_DIR}`);

if (!fs.existsSync(PACK_DIR)) {
    console.error(`❌ Error: Directory not found: ${PACK_DIR}`);
    process.exit(1);
}

try {
    const files = scanDirectory(PACK_DIR);

    const manifest = {
        name: PACK_NAME,
        builtAt: new Date().toISOString(),
        totalFiles: files.length,
        files: files
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(manifest, null, 2));
    console.log(`✅ Success! Manifest generated at: ${OUTPUT_FILE}`);
    console.log(`📄 Total files: ${files.length}`);
} catch (error) {
    console.error('❌ Failed to build manifest:', error);
}
