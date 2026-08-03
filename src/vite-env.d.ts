/// <reference types="vite/client" />

import type { FriendLauncherApi } from '@shared/contracts';

declare global {
  interface Window {
    api: FriendLauncherApi;
  }
}

export { };
