// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LAUNCHER_MARK_PATH } from '../../app/assets/branding'
import { SimplePlayHome } from '../SimplePlayHome'

vi.mock('../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    getAccentStyles: () => ({ className: '', style: undefined }),
    getAccentHex: () => '#10b981',
  }),
}))

describe('SimplePlayHome visual truth', () => {
  it('uses the shipped launcher mark for both the classic logo and easter-egg particles', async () => {
    const { container } = render(<SimplePlayHome />)

    const logo = screen.getByTestId('classic-launcher-mark')
    expect(logo.getAttribute('src')).toBe(LAUNCHER_MARK_PATH)

    const logoButton = logo.closest('.logo-container')
    expect(logoButton).toBeTruthy()

    for (let index = 0; index < 7; index += 1) {
      fireEvent.click(logoButton as HTMLElement)
    }

    await waitFor(() => {
      expect(container.querySelectorAll('.firework-particle img').length).toBeGreaterThan(0)
    })

    const particleImages = Array.from(container.querySelectorAll<HTMLImageElement>('.firework-particle img'))
    expect(particleImages.every((image) => image.getAttribute('src') === LAUNCHER_MARK_PATH)).toBe(true)
  })
})
