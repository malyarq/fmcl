import type { HTMLAttributes } from 'react'
import type { BrandAssetRole } from '../../app/assets/branding'
import { cn } from '../../utils/cn'
import { BrandMark, type BrandMarkFrame, type BrandMarkSize } from './BrandMark'
import { BrandWordmark, type BrandWordmarkTone } from './BrandWordmark'

type BrandLockupProps = HTMLAttributes<HTMLDivElement> & {
  align?: 'center' | 'start'
  direction?: 'horizontal' | 'vertical'
  markFrame?: BrandMarkFrame
  markRole?: BrandAssetRole
  markSize?: BrandMarkSize
  wordmarkTone?: BrandWordmarkTone
  wordmarkClassName?: string
}

export function BrandLockup({
  align = 'center',
  className,
  direction = 'horizontal',
  markFrame = 'brand',
  markRole = 'product-mark',
  markSize = 'md',
  wordmarkClassName,
  wordmarkTone = 'default',
  ...props
}: BrandLockupProps) {
  const isVertical = direction === 'vertical'

  return (
    <div
      {...props}
      className={cn(
        'inline-flex',
        isVertical ? 'flex-col gap-3' : 'items-center gap-3',
        align === 'start' ? 'items-start' : 'items-center',
        className,
      )}
    >
      <BrandMark role={markRole} size={markSize} frame={markFrame} />
      <BrandWordmark tone={wordmarkTone} className={wordmarkClassName} />
    </div>
  )
}
