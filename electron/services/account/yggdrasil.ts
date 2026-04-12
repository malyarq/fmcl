import { net } from 'electron';

export interface YggdrasilAuthResponse {
    accessToken: string;
    clientToken: string;
    availableProfiles: Array<{ id: string; name: string }>;
    selectedProfile: { id: string; name: string };
    user?: { id: string; properties?: Array<{ name: string; value: string }> };
}

export class YggdrasilClient {
    constructor(private authServerUrl: string) { }

    async authenticate(username: string, password?: string, clientToken?: string): Promise<YggdrasilAuthResponse> {
        const response = await net.fetch(`${this.authServerUrl}/authserver/authenticate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agent: { name: 'Minecraft', version: 1 },
                username,
                password,
                clientToken,
                requestUser: true,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Authentication failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        return (await response.json()) as YggdrasilAuthResponse;
    }

    async refresh(accessToken: string, clientToken: string): Promise<YggdrasilAuthResponse> {
        const response = await net.fetch(`${this.authServerUrl}/authserver/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                accessToken,
                clientToken,
                requestUser: true,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Refresh failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        return (await response.json()) as YggdrasilAuthResponse;
    }

    async validate(accessToken: string, clientToken: string): Promise<boolean> {
        const response = await net.fetch(`${this.authServerUrl}/authserver/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                accessToken,
                clientToken,
            }),
        });

        return response.status === 204;
    }
}
