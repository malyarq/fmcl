// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SettingsProvider } from '../../../contexts/SettingsContext'
import { AppearanceTab } from '../tabs/AppearanceTab'

describe('AppearanceTab brand contract', () => {
  it('keeps appearance guidance focused on presets and accent behavior without a dedicated brand card', () => {
    render(
      <SettingsProvider>
        <AppearanceTab />
      </SettingsProvider>,
    )

    expect(screen.queryByTestId('appearance-brand-system-card')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Theme Presets' })).toBeTruthy()
    expect(
      screen.getByText(/Choose the base shell mood of the launcher, then fine-tune accent and background behavior below/i),
    ).toBeTruthy()
    expect(
      screen.getByText(/Accent colors tune highlights and active controls while the rest of the shell stays calm and consistent/i),
    ).toBeTruthy()
    expect(
      screen.getByText(/Background controls only change the active backdrop layer/i),
    ).toBeTruthy()
  })
})
