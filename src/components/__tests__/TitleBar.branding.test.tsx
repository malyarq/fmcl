// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TitleBar from '../TitleBar'
import { APP_ICON_PATH, LAUNCHER_MARK_PATH } from '../../app/assets/branding'
import { applyThemeToDocument } from '../../contexts/settings/theme'

vi.mock('../../app/hooks/useAppIcon', () => ({
  useAppIcon: () => ({
    iconPath: APP_ICON_PATH,
  }),
}))

vi.mock('../../services/ipc/windowControlsIPC', () => ({
  windowControlsIPC: {
    minimize: vi.fn(),
    close: vi.fn(),
  },
}))

function getRootVar(name: string) {
  return document.documentElement.style.getPropertyValue(name)
}

describe('TitleBar brand contract', () => {
  beforeEach(() => {
    document.documentElement.className = ''
    document.body.className = ''
    document.documentElement.removeAttribute('style')
    document.body.removeAttribute('style')
  })

  it('renders the shared app-icon and shell wordmark primitives', () => {
    render(<TitleBar />)

    const icon = screen.getByTestId('title-bar-brand-icon')
    expect(icon.getAttribute('data-brand-role')).toBe('app-icon')
    expect(icon.getAttribute('src')).toBe(APP_ICON_PATH)
    expect(screen.getByText('FriendLauncher').closest('[data-brand-wordmark]')).toBeTruthy()
    expect(screen.getAllByText('FriendLauncher')).toHaveLength(1)
  })

  it('falls back from the bundled app icon to the product mark', () => {
    render(<TitleBar />)

    const icon = screen.getByTestId('title-bar-brand-icon') as HTMLImageElement
    fireEvent.error(icon)

    expect(icon.src.endsWith(LAUNCHER_MARK_PATH)).toBe(true)
  })

  it('keeps product brand tokens separate from the active accent token', () => {
    applyThemeToDocument('dark', 'rose', {
      brand: {
        shellGlow: '#112233',
        markFrame: '#223344',
        markBorder: '#334455',
        markGlow: '#445566',
        mediaFrame: '#556677',
        mediaBorder: '#667788',
        surfacePanelShadow: '0 1px 2px rgba(0, 0, 0, 0.30)',
        surfaceCardShadow: '0 3px 4px rgba(0, 0, 0, 0.20)',
        surfaceSoftShadow: '0 5px 6px rgba(0, 0, 0, 0.10)',
        wordmarkWeight: '760',
        wordmarkSpacing: '0.14em',
      },
    })

    expect(getRootVar('--accent-main')).toBe('244 63 94')
    expect(getRootVar('--brand-shell-glow')).toBe('17 34 51')
    expect(getRootVar('--brand-mark-frame')).toBe('34 51 68')
    expect(getRootVar('--brand-media-border')).toBe('102 119 136')
    expect(getRootVar('--surface-shadow-panel')).toBe('0 1px 2px rgba(0, 0, 0, 0.30)')
    expect(getRootVar('--brand-wordmark-weight')).toBe('760')
    expect(getRootVar('--brand-wordmark-spacing')).toBe('0.14em')
  })
})
