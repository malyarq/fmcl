import type { ImgHTMLAttributes } from 'react'
import { getBrandAsset, type BrandAssetRole } from '../../app/assets/branding'
import { cn } from '../../utils/cn'

export type BrandMarkSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
export type BrandMarkFrame = 'none' | 'brand' | 'media'

const SIZE_CLASS_MAP: Record<BrandMarkSize, string> = {
  xs: 'h-4 w-4',
  sm: 'h-6 w-6',
  md: 'h-10 w-10',
  lg: 'h-14 w-14',
  xl: 'h-20 w-20',
  '2xl': 'h-32 w-32',
}

type BrandMarkProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'alt'> & {
  alt?: string
  decorative?: boolean
  frame?: BrandMarkFrame
  role?: BrandAssetRole
  size?: BrandMarkSize
  wrapperClassName?: string
}

export function BrandMark({
  alt,
  className,
  decorative = false,
  frame = 'none',
  role = 'product-mark',
  size = 'md',
  src,
  wrapperClassName,
  ...props
}: BrandMarkProps) {
  const asset = getBrandAsset(role)
  const image = (
    <img
      {...props}
      data-brand-role={role}
      src={src ?? asset.path}
      alt={decorative ? '' : alt ?? asset.alt}
      aria-hidden={decorative || undefined}
      className={cn(SIZE_CLASS_MAP[size], 'object-contain', className)}
    />
  )

  if (frame === 'none') {
    return image
  }

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-2xl border',
        frame === 'brand' ? 'brand-mark-frame' : 'brand-media-frame',
        wrapperClassName,
      )}
    >
      {image}
    </span>
  )
}
