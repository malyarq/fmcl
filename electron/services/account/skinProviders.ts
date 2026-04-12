import type { Account } from '@shared/types'
import type { AccountSkinState } from '@shared/contracts/account'

const YGGDRASIL_PATH_MARKERS = ['/api/yggdrasil', '/api/authlib-injector']

function normalizeBaseUrl(url: string): string {
  return url.endsWith('/') ? url : `${url}/`
}

export function deriveProviderSiteRoot(authServerUrl: string): string {
  const parsed = new URL(authServerUrl)
  const marker = YGGDRASIL_PATH_MARKERS.find((candidate) => parsed.pathname.includes(candidate))
  const markerIndex = marker ? parsed.pathname.indexOf(marker) : -1
  const prefix = markerIndex >= 0 ? parsed.pathname.slice(0, markerIndex) : parsed.pathname.replace(/\/+$/, '')

  return `${parsed.origin}${prefix}`.replace(/\/+$/, '')
}

export function detectSkinProvider(authServerUrl?: string): Account['skinProvider'] | undefined {
  if (!authServerUrl) {
    return undefined
  }

  const parsed = new URL(authServerUrl)
  const hostname = parsed.hostname.toLowerCase()

  if (hostname.includes('littleskin')) {
    return 'littleskin'
  }

  if (parsed.pathname.includes('/api/yggdrasil') || parsed.pathname.includes('/api/authlib-injector')) {
    return 'blessing-skin'
  }

  return undefined
}

function getProviderLabel(provider: Account['skinProvider']): string {
  switch (provider) {
    case 'littleskin':
      return 'LittleSkin'
    case 'blessing-skin':
      return 'Blessing Skin'
    default:
      return 'Unsupported'
  }
}

function buildAvatarUrl(siteRoot: string, accountName: string): string {
  return new URL(`./avatar/player/64/${encodeURIComponent(accountName)}.png`, normalizeBaseUrl(siteRoot)).toString()
}

function buildManageUrl(siteRoot: string): string {
  return new URL('./user', normalizeBaseUrl(siteRoot)).toString()
}

export function buildAccountSkinState(account: Account): AccountSkinState {
  if (account.type !== 'third-party') {
    return {
      supported: false,
      reason: 'offline',
    }
  }

  const provider = detectSkinProvider(account.authServerUrl)
  if (!provider || !account.authServerUrl) {
    return {
      supported: false,
      reason: 'unsupported-provider',
    }
  }

  const siteRoot = deriveProviderSiteRoot(account.authServerUrl)

  return {
    supported: true,
    provider,
    providerLabel: getProviderLabel(provider),
    avatarUrl: buildAvatarUrl(siteRoot, account.name),
    manageUrl: buildManageUrl(siteRoot),
  }
}
