// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { APP_ICON_PATH } from '../../app/assets/branding'
import { SimplePlayHome } from '../SimplePlayHome'

vi.mock('../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    getAccentStyles: () => ({ className: '', style: undefined }),
    getAccentHex: () => '#10b981',
    t: (key: string) =>
      ({
        'ui_mode.simple': 'Classic',
        'dashboard.classic_surface_title': 'Launch Minecraft from one focused surface.',
        'dashboard.classic_surface_desc': 'Use the sidebar to choose your version, nickname, and launch settings before you play.',
      }[key] ?? key),
  }),
}))

describe('SimplePlayHome visual truth', () => {
  it('uses the shipped app icon and wordmark as one classic-surface lockup', async () => {
    const { container } = render(<SimplePlayHome />)

    const logo = screen.getByTestId('classic-launcher-mark')
    expect(logo.getAttribute('data-brand-role')).toBe('app-icon')
    expect(logo.getAttribute('src')).toBe(APP_ICON_PATH)
    expect(screen.getByText('Launch Minecraft from one focused surface.')).toBeTruthy()
    expect(
      screen.getByText('Use the sidebar to choose your version, nickname, and launch settings before you play.'),
    ).toBeTruthy()
    expect(container.querySelector('[data-brand-wordmark]')?.textContent).toBe('Burrow')

    const logoButton = logo.closest('.logo-container')
    expect(logoButton).toBeTruthy()

    for (let index = 0; index < 7; index += 1) {
      fireEvent.click(logoButton as HTMLElement)
    }

    await waitFor(() => {
      expect(container.querySelectorAll('.firework-particle img').length).toBeGreaterThan(0)
    })

    const particleImages = Array.from(container.querySelectorAll<HTMLImageElement>('.firework-particle img'))
    expect(particleImages.every((image) => image.getAttribute('src') === APP_ICON_PATH)).toBe(true)
  })
})
