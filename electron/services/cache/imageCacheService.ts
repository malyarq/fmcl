import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { assertPublicHttpsUrl } from '../../security/remoteUrls'

export interface ImageCacheState {
  entryCount: number
  totalSizeBytes: number
  maxSizeBytes: number
  usageRatio: number
}

export interface ImageCacheResolveResult {
  localUrl: string
  sourceUrl: string
  cacheHit: boolean
  stale: boolean
}

export interface ImageCacheCleanupResult extends ImageCacheState {
  deletedEntries: number
  freedBytes: number
}

interface ImageCacheCleanupOptions {
  protectedKeys?: string[]
}

interface ImageCacheEntry {
  key: string
  url: string
  fileName: string
  sizeBytes: number
  contentType: string
  cachedAt: number
  lastAccessedAt: number
}

interface ImageCacheIndex {
  version: 1
  maxSizeBytes: number
  lastCleanupAt: number | null
  entries: Record<string, ImageCacheEntry>
}

interface ImageCacheServiceOptions {
  fetchImpl?: typeof fetch
}

const DEFAULT_MAX_SIZE_BYTES = 256 * 1024 * 1024
const MIN_MAX_SIZE_BYTES = 32 * 1024 * 1024
const MAX_MAX_SIZE_BYTES = 2 * 1024 * 1024 * 1024
const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000
const MAX_IMAGE_BYTES = 32 * 1024 * 1024

export class ImageCacheService {
  private readonly cacheRoot: string
  private readonly entriesRoot: string
  private readonly indexPath: string
  private readonly fetchImpl: typeof fetch
  private index: ImageCacheIndex

  constructor(userDataPath: string, options: ImageCacheServiceOptions = {}) {
    this.cacheRoot = path.join(userDataPath, 'image-cache')
    this.entriesRoot = path.join(this.cacheRoot, 'entries')
    this.indexPath = path.join(this.cacheRoot, 'index.json')
    this.fetchImpl = options.fetchImpl ?? fetch

    this.ensureRoots()
    this.index = this.loadIndex()
  }

  async resolveImage(sourceUrl: string): Promise<ImageCacheResolveResult> {
    const normalizedUrl = this.normalizeSourceUrl(sourceUrl)
    await this.removeMissingEntries()

    const key = this.createKey(normalizedUrl)
    const existingEntry = this.index.entries[key]

    if (existingEntry) {
      const existingPath = this.getEntryPath(existingEntry)
      if (fs.existsSync(existingPath)) {
        const isStale = Date.now() - existingEntry.cachedAt >= STALE_AFTER_MS
        if (!isStale) {
          existingEntry.lastAccessedAt = Date.now()
          await this.saveIndex()

          return {
            localUrl: this.buildRenderableLocalUrl(existingPath, existingEntry.contentType),
            sourceUrl: normalizedUrl,
            cacheHit: true,
            stale: false,
          }
        }

        try {
          return await this.downloadAndPersist(normalizedUrl, existingEntry)
        } catch {
          existingEntry.lastAccessedAt = Date.now()
          await this.saveIndex()

          return {
            localUrl: this.buildRenderableLocalUrl(existingPath, existingEntry.contentType),
            sourceUrl: normalizedUrl,
            cacheHit: true,
            stale: true,
          }
        }
      }

      delete this.index.entries[key]
      await this.saveIndex()
    }

    return this.downloadAndPersist(normalizedUrl)
  }

  async getState(): Promise<ImageCacheState> {
    await this.removeMissingEntries()
    return this.buildState()
  }

  async setMaxSizeBytes(nextMaxSizeBytes: number): Promise<ImageCacheState> {
    if (!Number.isFinite(nextMaxSizeBytes)) {
      throw new Error('Image cache limit must be a finite number')
    }

    this.index.maxSizeBytes = this.clampMaxSizeBytes(nextMaxSizeBytes)
    await this.saveIndex()
    await this.cleanupToLimit()

    return this.buildState()
  }

  async cleanupToLimit(options: ImageCacheCleanupOptions = {}): Promise<ImageCacheCleanupResult> {
    await this.removeMissingEntries()

    const stateBeforeCleanup = this.buildState()
    if (stateBeforeCleanup.totalSizeBytes <= this.index.maxSizeBytes) {
      return {
        ...stateBeforeCleanup,
        deletedEntries: 0,
        freedBytes: 0,
      }
    }

    const entries = Object.values(this.index.entries).sort((left, right) => {
      if (left.lastAccessedAt !== right.lastAccessedAt) {
        return left.lastAccessedAt - right.lastAccessedAt
      }

      return left.cachedAt - right.cachedAt
    })

    let totalSizeBytes = stateBeforeCleanup.totalSizeBytes
    let deletedEntries = 0
    let freedBytes = 0
    const protectedKeys = new Set(options.protectedKeys ?? [])

    for (const entry of entries) {
      if (totalSizeBytes <= this.index.maxSizeBytes) {
        break
      }

      if (protectedKeys.has(entry.key)) {
        continue
      }

      const entryPath = this.getEntryPath(entry)
      if (fs.existsSync(entryPath)) {
        fs.rmSync(entryPath, { force: true })
      }

      delete this.index.entries[entry.key]
      totalSizeBytes -= entry.sizeBytes
      freedBytes += entry.sizeBytes
      deletedEntries += 1
    }

    this.index.lastCleanupAt = Date.now()
    await this.saveIndex()

    return {
      ...this.buildState(),
      deletedEntries,
      freedBytes,
    }
  }

  async clear(): Promise<ImageCacheCleanupResult> {
    await this.removeMissingEntries()

    const stateBeforeClear = this.buildState()

    for (const entry of Object.values(this.index.entries)) {
      const entryPath = this.getEntryPath(entry)
      if (fs.existsSync(entryPath)) {
        fs.rmSync(entryPath, { force: true })
      }
    }

    this.index.entries = {}
    this.index.lastCleanupAt = Date.now()
    fs.rmSync(this.entriesRoot, { recursive: true, force: true })
    fs.mkdirSync(this.entriesRoot, { recursive: true })
    await this.saveIndex()

    return {
      ...this.buildState(),
      deletedEntries: stateBeforeClear.entryCount,
      freedBytes: stateBeforeClear.totalSizeBytes,
    }
  }

  private async downloadAndPersist(
    sourceUrl: string,
    existingEntry?: ImageCacheEntry,
  ): Promise<ImageCacheResolveResult> {
    const response = await this.fetchImpl(sourceUrl, { redirect: 'error' })
    if (!response.ok) {
      throw new Error(`Image download failed with status ${response.status}`)
    }

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.startsWith('image/')) {
      throw new Error(`Expected image response, received ${contentType || 'unknown content type'}`)
    }

    if (!response.body) throw new Error('Image download returned an empty body')
    const contentLength = response.headers.get('content-length')
    if (contentLength !== null && Number(contentLength) > MAX_IMAGE_BYTES) {
      throw new Error('Image download exceeds the per-image size limit')
    }

    const key = this.createKey(sourceUrl)
    const extension = this.resolveExtension(sourceUrl, contentType)
    const fileName = `${key}.${extension}`
    const finalPath = path.join(this.entriesRoot, fileName)
    const tempPath = path.join(this.entriesRoot, `${fileName}.tmp-${Date.now()}`)

    fs.mkdirSync(this.entriesRoot, { recursive: true })
    let received = 0
    const limiter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        received += chunk.length
        if (received > MAX_IMAGE_BYTES) {
          callback(new Error('Image download exceeds the per-image size limit'))
          return
        }
        callback(null, chunk)
      },
    })
    try {
      await pipeline(
        Readable.fromWeb(response.body as never),
        limiter,
        fs.createWriteStream(tempPath, { flags: 'wx' }),
      )
      if (received === 0) throw new Error('Image download returned an empty body')
      fs.renameSync(tempPath, finalPath)
    } catch (error) {
      fs.rmSync(tempPath, { force: true })
      throw error
    }

    if (existingEntry && existingEntry.fileName !== fileName) {
      const previousPath = this.getEntryPath(existingEntry)
      if (fs.existsSync(previousPath)) {
        fs.rmSync(previousPath, { force: true })
      }
    }

    const now = Date.now()
    this.index.entries[key] = {
      key,
      url: sourceUrl,
      fileName,
      sizeBytes: received,
      contentType,
      cachedAt: now,
      lastAccessedAt: now,
    }

    await this.saveIndex()
    await this.cleanupToLimit({ protectedKeys: [key] })

    return {
      localUrl: this.buildRenderableLocalUrl(finalPath, contentType),
      sourceUrl,
      cacheHit: false,
      stale: false,
    }
  }

  private buildRenderableLocalUrl(entryPath: string, contentType: string): string {
    const buffer = fs.readFileSync(entryPath)
    const renderableContentType = this.resolveRenderableContentType(buffer, entryPath, contentType)

    // Electron renderer runs under http:// in dev, so file:// cache paths can fail to render.
    return `data:${renderableContentType};base64,${buffer.toString('base64')}`
  }

  private ensureRoots(): void {
    fs.mkdirSync(this.entriesRoot, { recursive: true })
  }

  private loadIndex(): ImageCacheIndex {
    if (!fs.existsSync(this.indexPath)) {
      return this.createEmptyIndex()
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(this.indexPath, 'utf-8')) as Partial<ImageCacheIndex>
      const entries = typeof parsed.entries === 'object' && parsed.entries ? parsed.entries : {}

      return {
        version: 1,
        maxSizeBytes: this.clampMaxSizeBytes(parsed.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES),
        lastCleanupAt: typeof parsed.lastCleanupAt === 'number' ? parsed.lastCleanupAt : null,
        entries: Object.fromEntries(
          Object.entries(entries).filter(([, entry]) => this.isImageCacheEntry(entry)),
        ),
      }
    } catch {
      return this.createEmptyIndex()
    }
  }

  private createEmptyIndex(): ImageCacheIndex {
    return {
      version: 1,
      maxSizeBytes: DEFAULT_MAX_SIZE_BYTES,
      lastCleanupAt: null,
      entries: {},
    }
  }

  private async saveIndex(): Promise<void> {
    const tempPath = `${this.indexPath}.tmp-${Date.now()}`
    fs.writeFileSync(tempPath, JSON.stringify(this.index, null, 2), 'utf-8')
    fs.renameSync(tempPath, this.indexPath)
  }

  private async removeMissingEntries(): Promise<void> {
    let changed = false

    for (const [key, entry] of Object.entries(this.index.entries)) {
      if (!fs.existsSync(this.getEntryPath(entry))) {
        delete this.index.entries[key]
        changed = true
      }
    }

    if (changed) {
      await this.saveIndex()
    }
  }

  private buildState(): ImageCacheState {
    const entryCount = Object.keys(this.index.entries).length
    const totalSizeBytes = Object.values(this.index.entries).reduce((sum, entry) => sum + entry.sizeBytes, 0)

    return {
      entryCount,
      totalSizeBytes,
      maxSizeBytes: this.index.maxSizeBytes,
      usageRatio: this.index.maxSizeBytes > 0 ? totalSizeBytes / this.index.maxSizeBytes : 0,
    }
  }

  private getEntryPath(entry: ImageCacheEntry): string {
    return path.join(this.entriesRoot, entry.fileName)
  }

  private createKey(sourceUrl: string): string {
    return crypto.createHash('sha256').update(sourceUrl).digest('hex')
  }

  private normalizeSourceUrl(sourceUrl: string): string {
    return assertPublicHttpsUrl(sourceUrl, 'Image URL')
  }

  private resolveExtension(sourceUrl: string, contentType: string): string {
    const normalizedType = contentType.split(';', 1)[0]?.trim().toLowerCase()
    if (normalizedType) {
      const explicit = this.getExtensionForContentType(normalizedType)
      if (explicit) {
        return explicit
      }
    }

    const pathname = new URL(sourceUrl).pathname
    const extension = path.extname(pathname).replace('.', '').toLowerCase()
    if (/^[a-z0-9]{2,5}$/.test(extension)) {
      return extension
    }

    return 'img'
  }

  private getExtensionForContentType(contentType: string): string | null {
    switch (contentType) {
      case 'image/png':
        return 'png'
      case 'image/jpeg':
        return 'jpg'
      case 'image/webp':
        return 'webp'
      case 'image/gif':
        return 'gif'
      case 'image/svg+xml':
        return 'svg'
      case 'image/avif':
        return 'avif'
      default:
        return null
    }
  }

  private getContentTypeForExtension(extension: string): string | null {
    switch (extension) {
      case 'png':
        return 'image/png'
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg'
      case 'webp':
        return 'image/webp'
      case 'gif':
        return 'image/gif'
      case 'svg':
        return 'image/svg+xml'
      case 'avif':
        return 'image/avif'
      default:
        return null
    }
  }

  private resolveRenderableContentType(buffer: Buffer, entryPath: string, contentType: string): string {
    const normalizedContentType = contentType.split(';', 1)[0]?.trim().toLowerCase()
    if (normalizedContentType?.startsWith('image/')) {
      return normalizedContentType
    }

    const detectedContentType = this.detectContentTypeFromBuffer(buffer)
    if (detectedContentType) {
      return detectedContentType
    }

    const extension = path.extname(entryPath).replace('.', '').toLowerCase()
    return this.getContentTypeForExtension(extension) ?? 'image/png'
  }

  private detectContentTypeFromBuffer(buffer: Buffer): string | null {
    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      return 'image/png'
    }

    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return 'image/jpeg'
    }

    if (buffer.length >= 6) {
      const gifHeader = buffer.subarray(0, 6).toString('ascii')
      if (gifHeader === 'GIF87a' || gifHeader === 'GIF89a') {
        return 'image/gif'
      }
    }

    if (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
      return 'image/webp'
    }

    if (
      buffer.length >= 12 &&
      buffer.subarray(4, 8).toString('ascii') === 'ftyp' &&
      ['avif', 'avis'].includes(buffer.subarray(8, 12).toString('ascii'))
    ) {
      return 'image/avif'
    }

    const utf8Preview = buffer.subarray(0, 512).toString('utf-8').trimStart()
    if (utf8Preview.startsWith('<svg') || utf8Preview.includes('<svg')) {
      return 'image/svg+xml'
    }

    return null
  }

  private clampMaxSizeBytes(value: number): number {
    return Math.min(MAX_MAX_SIZE_BYTES, Math.max(MIN_MAX_SIZE_BYTES, Math.round(value)))
  }

  private isImageCacheEntry(value: unknown): value is ImageCacheEntry {
    if (!value || typeof value !== 'object') {
      return false
    }

    const entry = value as Partial<ImageCacheEntry>
    return (
      typeof entry.key === 'string' &&
      typeof entry.url === 'string' &&
      typeof entry.fileName === 'string' &&
      typeof entry.sizeBytes === 'number' &&
      typeof entry.contentType === 'string' &&
      typeof entry.cachedAt === 'number' &&
      typeof entry.lastAccessedAt === 'number'
    )
  }
}
