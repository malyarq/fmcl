export interface IMirrorProvider {
    injectURL(url: string): string;
}

export class OfficialProvider implements IMirrorProvider {
    injectURL(url: string): string {
        return url;
    }
}

// In the future, we can add BMCLAPI or MCBBS providers here.

let activeProvider: IMirrorProvider = new OfficialProvider();

export function getActiveProvider(): IMirrorProvider {
    return activeProvider;
}

export function setActiveProvider(provider: IMirrorProvider) {
    activeProvider = provider;
}
