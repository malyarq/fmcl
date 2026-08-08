// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LAUNCHER_MARK_PATH, MEDIA_FALLBACK_PATH } from '../../../app/assets/branding'
import { LazyImage } from '../LazyImage'

const resolveImageMock = vi.fn()
const hasMock = vi.fn()

vi.mock('../../../services/ipc/cacheIPC', () => ({
  cacheIPC: {
    has: (...args: unknown[]) => hasMock(...args),
    resolveImage: (...args: unknown[]) => resolveImageMock(...args),
  },
}))

describe('LazyImage image cache integration', () => {
  beforeEach(() => {
    resolveImageMock.mockReset()
    hasMock.mockReset()
    hasMock.mockReturnValue(true)
  })

  it('resolves remote sources through the cache IPC seam before rendering the image', async () => {
    resolveImageMock.mockResolvedValue({
      localUrl: 'file:///tmp/burrow-cache/modpack.png',
      sourceUrl: 'https://cdn.example.com/modpack.png',
      cacheHit: true,
      stale: false,
    })

    render(
      <LazyImage
        src="https://cdn.example.com/modpack.png"
        alt="Cached modpack"
        className="w-16 h-16 rounded"
      />,
    )

    await waitFor(() => {
      expect(resolveImageMock).toHaveBeenCalledWith('https://cdn.example.com/modpack.png')
    })

    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'Cached modpack' }).getAttribute('src')).toBe(
        'file:///tmp/burrow-cache/modpack.png',
      )
    })
  })

  it('falls back to the original source when cache resolution fails', async () => {
    resolveImageMock.mockRejectedValue(new Error('cache unavailable'))

    render(
      <LazyImage
        src="https://cdn.example.com/modpack.png"
        alt="Fallback modpack"
        className="w-16 h-16 rounded"
      />,
    )

    await waitFor(() => {
      expect(resolveImageMock).toHaveBeenCalledWith('https://cdn.example.com/modpack.png')
    })

    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'Fallback modpack' }).getAttribute('src')).toBe(
        'https://cdn.example.com/modpack.png',
      )
    })
  })

  it('retries the original remote source before using the provided fallback when a cached image fails to load', async () => {
    resolveImageMock.mockResolvedValue({
      localUrl: 'file:///tmp/burrow-cache/broken-modpack.png',
      sourceUrl: 'https://cdn.example.com/broken-modpack.png',
      cacheHit: true,
      stale: false,
    })

    render(
      <LazyImage
        src="https://cdn.example.com/broken-modpack.png"
        alt="Broken modpack"
        className="w-20 h-20 rounded"
        fallback="/icon.png"
      />,
    )

    const image = await screen.findByRole('img', { name: 'Broken modpack' })

    await waitFor(() => {
      expect(image.getAttribute('src')).toBe('file:///tmp/burrow-cache/broken-modpack.png')
    })

    fireEvent.error(image)

    await waitFor(() => {
      expect(image.getAttribute('src')).toBe('https://cdn.example.com/broken-modpack.png')
    })

    fireEvent.error(image)

    await waitFor(() => {
      expect(image.getAttribute('src')).toBe('/icon.png')
    })
  })

  it('retries the original remote source before the neutral fallback when a cached image fails without an explicit fallback', async () => {
    resolveImageMock.mockResolvedValue({
      localUrl: 'file:///tmp/burrow-cache/missing-mark.png',
      sourceUrl: 'https://cdn.example.com/missing-mark.png',
      cacheHit: true,
      stale: false,
    })

    render(
      <LazyImage
        src="https://cdn.example.com/missing-mark.png"
        alt="Fallback artwork"
        className="w-20 h-20 rounded"
      />,
    )

    const image = await screen.findByRole('img', { name: 'Fallback artwork' })

    await waitFor(() => {
      expect(image.getAttribute('src')).toBe('file:///tmp/burrow-cache/missing-mark.png')
    })

    fireEvent.error(image)

    await waitFor(() => {
      expect(image.getAttribute('src')).toBe('https://cdn.example.com/missing-mark.png')
    })

    fireEvent.error(image)

    await waitFor(() => {
      expect(image.getAttribute('src')).toBe(MEDIA_FALLBACK_PATH)
    })
  })

  it('does not invoke cache resolution for local or bundled sources', async () => {
    render(<LazyImage src="/icon.png" alt="Bundled icon" className="w-16 h-16 rounded" />)

    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'Bundled icon' }).getAttribute('src')).toBe('/icon.png')
    })

    expect(resolveImageMock).not.toHaveBeenCalled()
  })

  it('treats the launcher mark as a bundled asset instead of a remote cache candidate', async () => {
    render(<LazyImage src={LAUNCHER_MARK_PATH} alt="Bundled launcher mark" className="w-16 h-16 rounded" />)

    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'Bundled launcher mark' }).getAttribute('src')).toBe(
        LAUNCHER_MARK_PATH,
      )
    })

    expect(resolveImageMock).not.toHaveBeenCalled()
  })
})
