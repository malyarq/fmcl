import { describe, expect, it } from 'vitest'
import { getBundledAssetPath, isBundledAssetSource } from '../branding'

describe('bundled brand asset paths', () => {
  it('uses renderer-relative paths in packaged file builds', () => {
    expect(getBundledAssetPath('launcher-mark.png', './')).toBe('./launcher-mark.png')
    expect(getBundledAssetPath('/icon.ico', './')).toBe('./icon.ico')
  })

  it('recognizes resolved file URLs for renderer-relative assets', () => {
    expect(
      isBundledAssetSource(
        'file:///Applications/Burrow.app/Contents/Resources/app.asar/dist/launcher-mark.png',
        './launcher-mark.png',
      ),
    ).toBe(true)
  })
})
