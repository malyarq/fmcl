import { describe, expect, it } from 'vitest'
import { validateShareCode } from '../privilegedPayloads'

describe('privileged share code validation', () => {
  it('accepts Burrow codes', () => {
    expect(validateShareCode('burrow://share/v1/H4s=')).toBe('burrow://share/v1/H4s=')
  })

  it('rejects unsupported share code versions', () => {
    const shareCode = 'burrow://share/v2/H4s='
    expect(() => validateShareCode(shareCode)).toThrow(/version is not supported/i)
  })
})
