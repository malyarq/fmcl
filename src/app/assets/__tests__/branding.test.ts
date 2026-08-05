import { describe, expect, it } from 'vitest'
import { getBundledAssetPath, isBundledAssetSource } from '../branding'

describe('bundled brand asset paths', () => {
  it('uses renderer-relative paths in packaged file builds', () => {
    expect(getBundledAssetPath('launcher-mark.svg', './')).toBe('./launcher-mark.svg')
    expect(getBundledAssetPath('/icon.ico', './')).toBe('./icon.ico')
  })

  it('recognizes resolved file URLs for renderer-relative assets', () => {
    expect(
      isBundledAssetSource(
        'file:///Applications/FriendLauncher.app/Contents/Resources/app.asar/dist/launcher-mark.svg',
        './launcher-mark.svg',
      ),
    ).toBe(true)
  })
})
