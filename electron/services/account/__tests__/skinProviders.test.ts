import { describe, expect, it } from 'vitest'
import type { Account } from '@shared/types'
import { buildAccountSkinState, detectSkinProvider, deriveProviderSiteRoot } from '../skinProviders'

describe('skinProviders', () => {
  it('detects LittleSkin hosts from the auth server URL', () => {
    expect(detectSkinProvider('https://littleskin.cn/api/yggdrasil')).toBe('littleskin')
  })

  it('derives the provider site root for self-hosted Blessing Skin servers', () => {
    expect(deriveProviderSiteRoot('https://skin.example.com/launcher/api/yggdrasil')).toBe(
      'https://skin.example.com/launcher',
    )
  })

  it('builds a supported skin state for provider-backed third-party accounts', () => {
    const account: Account = {
      id: 'account-1',
      type: 'third-party',
      name: 'PlayerOne',
      authServerUrl: 'https://littleskin.cn/api/yggdrasil',
    }

    expect(buildAccountSkinState(account)).toEqual({
      supported: true,
      provider: 'littleskin',
      providerLabel: 'LittleSkin',
      avatarUrl: 'https://littleskin.cn/avatar/player/64/PlayerOne.png',
      manageUrl: 'https://littleskin.cn/user',
    })
  })

  it('marks unsupported accounts clearly', () => {
    const account: Account = {
      id: 'account-2',
      type: 'offline',
      name: 'Steve',
    }

    expect(buildAccountSkinState(account)).toEqual({
      supported: false,
      reason: 'offline',
    })
  })
})
