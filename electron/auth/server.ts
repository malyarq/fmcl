import http from 'http';
import crypto from 'crypto';

/**
 * Authentication Mock Server
 * 
 * Emulates a "Permissive Yggdrasil" server to support offline/cracked mode with skins.
 * Used in conjunction with `authlib-injector`.
 */
export class AuthServer {
    private server: http.Server;
    private port: number;
    private publicKey: string;

    constructor(port: number = 25530) {
        this.port = port;
        const keys = this.generateKeys();
        this.publicKey = keys.publicKey;

        this.server = http.createServer((req, res) => this.handleRequest(req, res));

        this.server.on('error', (e: any) => {
            if (e.code === 'EADDRINUSE') {
                console.log(`[AuthMock] Port ${this.port} busy. Assuming another instance is providing Auth.`);
            } else {
                console.error('[AuthMock] Server Error:', e);
            }
        });
    }

    /**
     * Start the mock server.
     */
    public start() {
        this.server.listen(this.port, '127.0.0.1', () => {
            console.log(`[AuthMock] Permissive Yggdrasil running on 127.0.0.1:${this.port}`);
        });
    }

    /**
     * Stop the mock server.
     */
    public stop() {
        this.server.close();
    }

    private generateKeys() {
        return crypto.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
        });
    }

    private handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
        const url = new URL(req.url || '', `http://127.0.0.1:${this.port}`);

        // Echo back the specialized header if present
        if (req.headers['x-authlib-injector-yggdrasil-server']) {
            res.setHeader('X-Authlib-Injector-Yggdrasil-Server', req.headers['x-authlib-injector-yggdrasil-server']);
        }

        // 1. Root / Metadata check
        if (url.pathname === '/' || url.pathname === '/authserver/' || url.pathname === '/api/yggdrasil') {
            return this.respondJSON(res, 200, {
                meta: {
                    serverName: "OfflineMock",
                    implementationName: "OfflineMock",
                    implementationVersion: "1.0.0"
                },
                skinDomains: ["localhost"],
                signaturePublickey: this.publicKey
            });
        }

        // 2. Session Join (Client -> Mojang)
        if (req.method === 'POST' && url.pathname.includes('/join')) {
            res.writeHead(204);
            res.end();
            return;
        }

        // 3. Session HasJoined (Server -> Mojang)
        if (req.method === 'GET' && url.pathname.includes('/hasJoined')) {
            const username = url.searchParams.get('username') || 'Unknown';
            const uuid = this.getOfflineUUID(username);

            return this.respondJSON(res, 200, {
                id: uuid,
                name: username,
                properties: []
            });
        }

        // 4. Batch Profile Lookup (Name -> UUID)
        if (req.method === 'POST' && url.pathname.includes('/profiles/minecraft')) {
            return this.respondJSON(res, 200, []);
        }

        // Default
        this.respondJSON(res, 200, {});
    }

    private respondJSON(res: http.ServerResponse, code: number, data: any) {
        res.writeHead(code, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    }

    private getOfflineUUID(username: string): string {
        const md5 = crypto.createHash('md5');
        md5.update(`OfflinePlayer:${username}`);
        const buffer = md5.digest();
        buffer[6] = (buffer[6] & 0x0f) | 0x30;
        buffer[8] = (buffer[8] & 0x3f) | 0x80;
        return buffer.toString('hex');
    }
}
