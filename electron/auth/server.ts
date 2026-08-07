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
    private owned = false;
    private startPromise?: Promise<{ url: string; owned: boolean }>;
    private stopPromise?: Promise<void>;

    constructor(port: number = 25530) {
        this.port = port;
        const keys = this.generateKeys();
        this.publicKey = keys.publicKey;

        this.server = http.createServer((req, res) => this.handleRequest(req, res));

        this.server.on('error', (error) => {
            if (this.owned) console.error('[AuthMock] Server error:', error);
        });
    }

    public start(): Promise<{ url: string; owned: boolean }> {
        if (this.startPromise) return this.startPromise;
        this.startPromise = new Promise((resolve, reject) => {
            const onError = async (error: Error & { code?: string }) => {
                this.server.off('listening', onListening);
                if (error.code === 'EADDRINUSE' && await this.verifyExistingServer()) {
                    console.log(`[AuthMock] Verified compatible server on 127.0.0.1:${this.port}.`);
                    resolve({ url: this.url, owned: false });
                    return;
                }
                reject(error);
            };
            const onListening = () => {
                this.server.off('error', onError);
                const address = this.server.address();
                if (address && typeof address !== 'string') this.port = address.port;
                this.owned = true;
                console.log(`[AuthMock] Permissive Yggdrasil running on 127.0.0.1:${this.port}`);
                resolve({ url: this.url, owned: true });
            };
            this.server.once('error', onError);
            this.server.once('listening', onListening);
            this.server.listen(this.port, '127.0.0.1');
        });
        return this.startPromise;
    }

    public stop(): Promise<void> {
        if (this.stopPromise) return this.stopPromise;
        this.stopPromise = (async () => {
            if (!this.owned || !this.server.listening) return;
            this.owned = false;
            this.server.closeAllConnections?.();
            await new Promise<void>((resolve, reject) => this.server.close((error) => error ? reject(error) : resolve()));
        })();
        return this.stopPromise;
    }

    public get url(): string { return `http://127.0.0.1:${this.port}`; }

    private async verifyExistingServer(): Promise<boolean> {
        try {
            const response = await fetch(this.url, { signal: AbortSignal.timeout(1_500) });
            if (!response.ok) return false;
            const value = await response.json() as { meta?: { implementationName?: unknown } };
            return value.meta?.implementationName === 'OfflineMock';
        } catch {
            return false;
        }
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

        // 4. Profile properties. Offline profiles do not have signed textures;
        // Yggdrasil represents a missing profile with an empty response, not `{}`.
        if (req.method === 'GET' && url.pathname.includes('/session/minecraft/profile/')) {
            res.writeHead(204);
            res.end();
            return;
        }

        // 5. Batch Profile Lookup (Name -> UUID)
        if (req.method === 'POST' && url.pathname.includes('/profiles/minecraft')) {
            return this.respondJSON(res, 200, []);
        }

        // Default
        this.respondJSON(res, 200, {});
    }

    private respondJSON(res: http.ServerResponse, code: number, data: unknown) {
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
