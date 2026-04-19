// @vitest-environment jsdom

import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SettingsProvider } from '../../../contexts/SettingsContext'
import { AppearanceTab } from '../tabs/AppearanceTab'

describe('AppearanceTab brand contract', () => {
  it('explains the shared brand boundary with the canonical mark and wordmark pair', () => {
    render(
      <SettingsProvider>
        <AppearanceTab />
      </SettingsProvider>,
    )

    const brandCard = screen.getByTestId('appearance-brand-system-card')
    expect(within(brandCard).getByText('Shared launcher brand')).toBeTruthy()
    expect(within(brandCard).getByText(/FMCL keeps the same mark, wordmark, and shell surfaces/i)).toBeTruthy()
    expect(within(brandCard).getByText('FriendLauncher').closest('[data-brand-wordmark]')).toBeTruthy()

    const brandMarks = brandCard.querySelectorAll('[data-brand-role="product-mark"]')
    const brandWordmarks = brandCard.querySelectorAll('[data-brand-wordmark]')
    expect(brandMarks).toHaveLength(1)
    expect(brandWordmarks).toHaveLength(1)

    expect(
      screen.getByText(/Accent colors personalize launch highlights and active controls/i),
    ).toBeTruthy()
  })
})
