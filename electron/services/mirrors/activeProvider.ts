import type { DownloadProvider } from './providers';
import { OfficialProvider } from './providers';

let activeProvider: DownloadProvider = new OfficialProvider();

export function getActiveProvider(): DownloadProvider {
  return activeProvider;
}

export function setActiveProvider(provider: DownloadProvider) {
  activeProvider = provider;
}

