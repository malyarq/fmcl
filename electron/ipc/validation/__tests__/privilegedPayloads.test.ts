import { describe, expect, it } from 'vitest'
import { validateShareCode } from '../privilegedPayloads'

describe('privileged share code validation', () => {
  it('accepts Burrow codes and normalizes legacy FriendLauncher codes', () => {
    expect(validateShareCode('burrow://share/v1/H4s=')).toBe('burrow://share/v1/H4s=')
    expect(validateShareCode('fmcl://share/v1/H4s=')).toBe('burrow://share/v1/H4s=')
  })

  it.each([
    'burrow://share/v2/H4s=',
    'fmcl://share/v2/H4s=',
  ])('rejects unsupported share code versions: %s', (shareCode) => {
    expect(() => validateShareCode(shareCode)).toThrow(/version is not supported/i)
  })
})
