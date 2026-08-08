/// <reference types="vite/client" />

import type { BurrowApi } from '@shared/contracts';

declare global {
  interface ImportMetaEnv {
    readonly VITE_POSTHOG_HOST?: string;
    readonly VITE_POSTHOG_PROJECT_TOKEN?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }

  interface Window {
    api: BurrowApi;
  }
}

export { };
