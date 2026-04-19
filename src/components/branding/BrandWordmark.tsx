import type { HTMLAttributes } from 'react'
import { getBrandWordmark } from '../../app/assets/branding'
import { cn } from '../../utils/cn'

export type BrandWordmarkTone = 'default' | 'hero' | 'shell'

const TONE_CLASS_MAP: Record<BrandWordmarkTone, string> = {
  default: 'brand-wordmark text-base text-foreground',
  hero: 'brand-wordmark brand-wordmark-hero text-foreground',
  shell: 'brand-wordmark brand-wordmark-shell text-secondary',
}

type BrandWordmarkProps = HTMLAttributes<HTMLElement> & {
  as?: 'div' | 'h1' | 'h2' | 'p' | 'span'
  tone?: BrandWordmarkTone
}

export function BrandWordmark({
  as = 'span',
  className,
  tone = 'default',
  ...props
}: BrandWordmarkProps) {
  const Component = as

  return (
    <Component {...props} data-brand-wordmark="" className={cn(TONE_CLASS_MAP[tone], className)}>
      {getBrandWordmark()}
    </Component>
  )
}
