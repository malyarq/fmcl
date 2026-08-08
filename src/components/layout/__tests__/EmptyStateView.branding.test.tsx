// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { APP_ICON_PATH } from '../../../app/assets/branding'
import { createTranslator } from '../../../contexts/settings/i18n'
import { DegradedStateView } from '../DegradedStateView'
import { EmptyStateView } from '../EmptyStateView'

vi.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    getAccentHex: () => '#10b981',
    getAccentStyles: () => ({ className: '', style: undefined }),
  }),
}))

describe('EmptyStateView brand contract', () => {
  it('keeps the canonical app icon restrained inside a neutral placeholder instead of a branded hero', () => {
    render(<EmptyStateView iconPath={APP_ICON_PATH} />)

    const mark = screen.getByTestId('empty-state-brand-mark')
    expect(mark.getAttribute('data-brand-role')).toBe('app-icon')
    expect(mark.closest('.brand-mark-frame')).toBeNull()
    expect(screen.getByTestId('empty-state-placeholder')).toBeTruthy()
    expect(screen.queryByText('Burrow')).toBeNull()
  })

  it('falls back to the app icon when a custom empty-state icon fails', () => {
    render(<EmptyStateView iconPath="/broken-empty-state.svg" />)

    const mark = screen.getByTestId('empty-state-brand-mark') as HTMLImageElement
    fireEvent.error(mark)

    expect(mark.src.endsWith(APP_ICON_PATH)).toBe(true)
  })

  it('keeps the new degraded-state contract separate from the branded hero surface', () => {
    const t = createTranslator('en')

    render(
      <DegradedStateView
        testId="degraded-state"
        variant="empty"
        label={t('degraded.empty_label')}
        title="No modpacks yet"
        description="Create one to get started."
      />,
    )

    const degradedState = screen.getByTestId('degraded-state')
    expect(degradedState.getAttribute('data-variant')).toBe('empty')
    expect(screen.queryByTestId('empty-state-brand-mark')).toBeNull()
    expect(screen.queryByText('Burrow')).toBeNull()
  })
})
