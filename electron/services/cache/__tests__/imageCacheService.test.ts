import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ImageCacheService } from '../imageCacheService'

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-image-cache-'))
}

function createResponse(body: string, contentType = 'image/png'): Response {
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': contentType,
    },
  })
}

function getCachedEntryPaths(rootDir: string): string[] {
  const entriesRoot = path.join(rootDir, 'image-cache', 'entries')
  if (!fs.existsSync(entriesRoot)) {
    return []
  }

  return fs.readdirSync(entriesRoot)
    .filter((name) => !name.includes('.tmp-'))
    .map((name) => path.join(entriesRoot, name))
}

function decodeDataUrlPayload(dataUrl: string): Buffer {
  const encodedPayload = dataUrl.split(',', 2)[1]
  if (!encodedPayload) {
    throw new Error(`Expected a data URL payload, received: ${dataUrl}`)
  }

  return Buffer.from(encodedPayload, 'base64')
}

describe('ImageCacheService', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('persists downloaded images and reuses the cached file across service instances', async () => {
    const rootDir = createTempRoot()
    tempDirs.push(rootDir)

    const imageUrl = 'https://cdn.example.com/icons/modpack.png'
    const firstService = new ImageCacheService(rootDir, {
      fetchImpl: async () => createResponse('fresh image'),
    })

    const firstResult = await firstService.resolveImage(imageUrl)
    const [firstPath] = getCachedEntryPaths(rootDir)

    expect(firstPath).toBeDefined()
    if (!firstPath) {
      throw new Error('Expected a cached file to be written to disk')
    }

    expect(firstResult.cacheHit).toBe(false)
    expect(firstResult.localUrl.startsWith('data:image/png;base64,')).toBe(true)
    expect(decodeDataUrlPayload(firstResult.localUrl).toString('utf-8')).toBe('fresh image')
    expect(fs.readFileSync(firstPath, 'utf-8')).toBe('fresh image')

    const secondService = new ImageCacheService(rootDir, {
      fetchImpl: async () => {
        throw new Error('network should not be used for a cache hit')
      },
    })

    const secondResult = await secondService.resolveImage(imageUrl)

    expect(secondResult.cacheHit).toBe(true)
    expect(secondResult.localUrl).toBe(firstResult.localUrl)
  })

  it('tracks cache size and evicts the least recently used entry when the limit is lowered', async () => {
    const rootDir = createTempRoot()
    tempDirs.push(rootDir)

    const payloads = new Map<string, string>([
      ['https://cdn.example.com/icons/one.png', 'a'.repeat(18 * 1024 * 1024)],
      ['https://cdn.example.com/icons/two.png', 'b'.repeat(20 * 1024 * 1024)],
    ])

    const service = new ImageCacheService(rootDir, {
      fetchImpl: async (input) => {
        const body = payloads.get(String(input))
        if (!body) {
          throw new Error(`Unexpected URL: ${String(input)}`)
        }

        return createResponse(body)
      },
    })

    const firstResult = await service.resolveImage('https://cdn.example.com/icons/one.png')
    const [firstPath] = getCachedEntryPaths(rootDir)

    expect(firstPath).toBeDefined()
    if (!firstPath) {
      throw new Error('Expected the first cached image to exist on disk')
    }

    await service.resolveImage('https://cdn.example.com/icons/two.png')

    const state = await service.setMaxSizeBytes(32 * 1024 * 1024)

    expect(state.entryCount).toBe(1)
    expect(state.totalSizeBytes).toBeLessThanOrEqual(32 * 1024 * 1024)
    expect(firstResult.localUrl.startsWith('data:image/png;base64,')).toBe(true)
    expect(fs.existsSync(firstPath)).toBe(false)
  })

  it('reports cleanup results when the image cache is cleared', async () => {
    const rootDir = createTempRoot()
    tempDirs.push(rootDir)

    const service = new ImageCacheService(rootDir, {
      fetchImpl: async () => createResponse('cache me'),
    })

    await service.resolveImage('https://cdn.example.com/icons/cache-me.png')

    const cleanup = await service.clear()
    const state = await service.getState()

    expect(cleanup.deletedEntries).toBe(1)
    expect(cleanup.freedBytes).toBe(Buffer.byteLength('cache me'))
    expect(state.entryCount).toBe(0)
    expect(state.totalSizeBytes).toBe(0)
  })

  it('rejects a single image that exceeds the safe per-image limit', async () => {
    const rootDir = createTempRoot()
    tempDirs.push(rootDir)

    const service = new ImageCacheService(rootDir, {
      fetchImpl: async () => createResponse('x'.repeat(40 * 1024 * 1024)),
    })

    await service.setMaxSizeBytes(32 * 1024 * 1024)
    await expect(service.resolveImage('https://cdn.example.com/icons/oversized.png'))
      .rejects.toThrow('per-image size limit')
    const state = await service.getState()

    expect(getCachedEntryPaths(rootDir)).toEqual([])
    expect(state.entryCount).toBe(0)
    expect(state.totalSizeBytes).toBe(0)
  })
})
