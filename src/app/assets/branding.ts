export const BRAND_WORDMARK = 'FriendLauncher'

export function getBundledAssetPath(fileName: string, baseUrl = import.meta.env.BASE_URL) {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  return `${normalizedBase}${fileName.replace(/^\/+/, '')}`
}

export const APP_ICON_PATH = getBundledAssetPath('icon.ico')
export const LAUNCHER_MARK_PATH = getBundledAssetPath('launcher-mark.svg')

function createSvgDataUri(svg: string) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

const MEDIA_FALLBACK_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" fill="none">
  <rect width="160" height="160" rx="32" fill="#151a17"/>
  <rect x="12" y="12" width="136" height="136" rx="24" fill="#1a211d" stroke="#2c3630" stroke-width="4"/>
  <circle cx="55" cy="54" r="10" fill="#708272"/>
  <path d="M40 109 64 84l19 18 19-29 22 36H40Z" fill="#536555"/>
  <path d="M45 114h70" stroke="#2f3932" stroke-width="8" stroke-linecap="round"/>
  <path d="M52 48h56" stroke="#415046" stroke-width="4" stroke-linecap="round" opacity=".65"/>
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
  const absoluteAssetSuffix = normalizedAsset.startsWith('./')
    ? normalizedAsset.slice(1)
    : normalizedAsset

  return normalizedSource === normalizedAsset || normalizedSource.endsWith(absoluteAssetSuffix)
}

export function isBrandAssetSource(source: string | null | undefined, role: BrandAssetRole) {
  return isBundledAssetSource(source, getBrandAssetPath(role))
}
