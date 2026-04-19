import { describe, expect, it } from 'vitest'
import { createTranslator } from '../../contexts/settings/i18n'
import {
  formatTechnicalErrorDetails,
  toDisplayErrorMessage,
  toRecoveryErrorMessage,
  unwrapTechnicalErrorMessage,
} from '../displayError'

describe('displayError helpers', () => {
  const t = createTranslator('en')
  const fallback = t('error.inline_fallback')
  const recoveryFallback = t('error.recovery_summary')

  it('removes IPC wrapper prefixes before showing a user-facing message', () => {
    expect(unwrapTechnicalErrorMessage('[share] importShare failed: Share backend unavailable')).toBe('Share backend unavailable')
    expect(toDisplayErrorMessage(new Error('[share] importShare failed: Share backend unavailable'), fallback)).toBe(
      'Share backend unavailable',
    )
  })

  it('falls back when the message still contains unresolved placeholders', () => {
    expect(toDisplayErrorMessage(new Error('[modpacks] loadVersions failed: ${file.jarVersion}'), fallback)).toBe(fallback)
  })

  it('falls back for mixed-language placeholder copy', () => {
    expect(toDisplayErrorMessage(new Error('Changelog будет загружен...'), fallback)).toBe(fallback)
  })

  it('falls back to the recovery summary for fatal-screen technical messages', () => {
    expect(
      toRecoveryErrorMessage(
        new Error('Cannot read properties of undefined (reading "map")'),
        recoveryFallback,
      ),
    ).toBe(recoveryFallback)
    expect(
      toRecoveryErrorMessage(
        new Error('http://localhost:5173/src/components/ErrorBoundary.tsx?t=123'),
        recoveryFallback,
      ),
    ).toBe(recoveryFallback)
  })

  it('keeps concise user-safe recovery messages after wrapper sanitization', () => {
    expect(
      toRecoveryErrorMessage(
        new Error('[share] importShare failed: Session expired'),
        recoveryFallback,
      ),
    ).toBe('Session expired')
  })

  it('prefers the stack for copied technical details', () => {
    const error = new Error('Disk is full')

    expect(formatTechnicalErrorDetails(error)).toContain('Disk is full')
  })
})
