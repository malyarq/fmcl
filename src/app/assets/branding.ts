export const APP_ICON_PATH = '/icon.png'
export const LAUNCHER_MARK_PATH = '/launcher-mark.svg'

export function isBundledAssetSource(source: string | null | undefined, assetPath: string): boolean {
  if (!source) {
    return false
  }

  const normalizedSource = source.split('#')[0]?.split('?')[0] ?? ''
  const normalizedAsset = assetPath.split('#')[0]?.split('?')[0] ?? assetPath

  return normalizedSource === normalizedAsset || normalizedSource.endsWith(normalizedAsset)
}
