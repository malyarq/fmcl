// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createTranslator } from '../../../contexts/settings/i18n'
import { DegradedStateView } from '../DegradedStateView'

describe('DegradedStateView', () => {
  it('keeps empty, zero-result, unavailable, and inline-error variants distinct', () => {
    const t = createTranslator('en')

    render(
      <>
        <DegradedStateView
          testId="empty-state"
          variant="empty"
          label={t('degraded.empty_label')}
          title="No modpacks yet"
          description="Create one to get started."
        />
        <DegradedStateView
          testId="zero-results-state"
          variant="zero-results"
          label={t('degraded.zero_results_label')}
          title="No filters matched"
          description="Clear a filter to keep browsing."
        />
        <DegradedStateView
          testId="unavailable-state"
          variant="unavailable"
          label={t('degraded.unavailable_label')}
          title="CurseForge browse unavailable"
          description="Use import or a shared code instead."
        />
        <DegradedStateView
          testId="inline-error-state"
          variant="error"
          layout="inline"
          label={t('degraded.error_label')}
          title="We couldn't load versions"
          description="Try again in a moment."
        />
      </>,
    )

    const emptyState = screen.getByTestId('empty-state')
    const zeroResultsState = screen.getByTestId('zero-results-state')
    const unavailableState = screen.getByTestId('unavailable-state')
    const inlineErrorState = screen.getByTestId('inline-error-state')

    expect(emptyState.getAttribute('data-variant')).toBe('empty')
    expect(emptyState.getAttribute('role')).toBe('status')
    expect(emptyState.querySelector('.surface-card')).toBeTruthy()

    expect(zeroResultsState.getAttribute('data-variant')).toBe('zero-results')
    expect(screen.getByText('No matches')).toBeTruthy()

    expect(unavailableState.getAttribute('data-variant')).toBe('unavailable')
    expect(screen.getByText('Unavailable')).toBeTruthy()

    expect(inlineErrorState.getAttribute('data-variant')).toBe('error')
    expect(inlineErrorState.getAttribute('data-layout')).toBe('inline')
    expect(inlineErrorState.getAttribute('role')).toBe('alert')
    expect(inlineErrorState.querySelector('.surface-card')).toBeNull()
    expect(screen.getByText('Needs attention')).toBeTruthy()
  })
})
