export const BRAND_WORDMARK = 'FriendLauncher'
export const APP_ICON_PATH = '/icon.ico'
export const LAUNCHER_MARK_PATH = '/launcher-mark.svg'

function createSvgDataUri(svg: string) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

const MEDIA_FALLBACK_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" fill="none">
  <rect width="160" height="160" rx="32" fill="#151a17"/>
  <rect x="10" y="10" width="140" height="140" rx="26" fill="#1b231d" stroke="#2e3a31" stroke-width="4"/>
  <path d="M80 30 116 50 80 69 44 50 80 30Z" fill="#c4d0c2"/>
  <path d="M44 50 80 69v43L44 93V50Z" fill="#7f9383"/>
  <path d="M116 50 80 69v43l36-19V50Z" fill="#9aab98"/>
  <rect x="54" y="93" width="14" height="14" rx="2" fill="#516655"/>
  <rect x="72" y="85" width="16" height="16" rx="2" fill="#d7e2d4"/>
  <rect x="91" y="93" width="14" height="14" rx="2" fill="#516655"/>
  <rect x="36" y="118" width="88" height="8" rx="4" fill="#2c3a30"/>
</svg>
`.trim()

export const MEDIA_FALLBACK_PATH = createSvgDataUri(MEDIA_FALLBACK_SVG)

export type BrandAssetRole = 'app-icon' | 'product-mark' | 'media-fallback'

export type BrandAssetDefinition = {
  alt: string
  label: string
  path: string
  role: BrandAssetRole
}

export const BRAND_ASSETS: Record<BrandAssetRole, BrandAssetDefinition> = {
  'app-icon': {
    role: 'app-icon',
    path: APP_ICON_PATH,
    label: 'FriendLauncher app icon',
    alt: 'FriendLauncher app icon',
  },
  'product-mark': {
    role: 'product-mark',
    path: LAUNCHER_MARK_PATH,
    label: 'FriendLauncher mark',
    alt: 'FriendLauncher mark',
  },
  'media-fallback': {
    role: 'media-fallback',
    path: MEDIA_FALLBACK_PATH,
    label: 'FriendLauncher media fallback art',
    alt: 'FriendLauncher media fallback art',
  },
}

export function getBrandAsset(role: BrandAssetRole) {
  return BRAND_ASSETS[role]
}

export function getBrandAssetPath(role: BrandAssetRole) {
  return getBrandAsset(role).path
}

export function getBrandWordmark() {
  return BRAND_WORDMARK
}

export function isBundledAssetSource(source: string | null | undefined, assetPath: string): boolean {
  if (!source) {
    return false
  }

  const normalizedSource = source.split('#')[0]?.split('?')[0] ?? ''
  const normalizedAsset = assetPath.split('#')[0]?.split('?')[0] ?? assetPath

  return normalizedSource === normalizedAsset || normalizedSource.endsWith(normalizedAsset)
}

export function isBrandAssetSource(source: string | null | undefined, role: BrandAssetRole) {
  return isBundledAssetSource(source, getBrandAssetPath(role))
}
