export interface CacheActionResult {
  success: boolean
  error?: string
}

export interface ImageCacheState {
  entryCount: number
  totalSizeBytes: number
  maxSizeBytes: number
  usageRatio: number
}

export interface ImageCacheCleanupResult extends ImageCacheState {
  deletedEntries: number
  freedBytes: number
}

export interface ImageCacheResolveResult {
  localUrl: string
  sourceUrl: string
  cacheHit: boolean
  stale: boolean
}

export interface CacheAPI {
  clear: () => Promise<CacheActionResult>
  reload: () => Promise<void>
  getImageCacheState: () => Promise<ImageCacheState>
  setImageCacheLimit: (maxSizeBytes: number) => Promise<ImageCacheState>
  cleanupImageCache: () => Promise<ImageCacheCleanupResult>
  resolveImage: (sourceUrl: string) => Promise<ImageCacheResolveResult>
}
