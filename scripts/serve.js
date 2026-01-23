import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const ROOT = path.join(__dirname, '../');

// Minimal static server to preview modpack manifests locally.
const mimeTypes = {
    '.json': 'application/json',
    '.jar': 'application/java-archive',
    '.txt': 'text/plain',
};

http.createServer((req, res) => {
    console.log(`${req.method} ${req.url}`);

    const filePath = path.join(ROOT, req.url || '');

    if (!filePath.startsWith(ROOT)) {
        res.statusCode = 403;
        res.end('Forbidden');
        return;
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.statusCode = 404;
            res.end('Not found');
            return;
        }

        const ext = path.extname(filePath);
        const contentType = mimeTypes[ext] || 'application/octet-stream';

        res.setHeader('Content-Type', contentType);
        fs.createReadStream(filePath).pipe(res);
    });
}).listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
    console.log(`Test manifest at: http://localhost:${PORT}/modpacks/example-pack/manifest.json`);
});
