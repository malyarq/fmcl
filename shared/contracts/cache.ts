export interface CacheAPI {
  clear: () => Promise<{ success: boolean; error?: string }>;
  reload: () => Promise<void>;
}

