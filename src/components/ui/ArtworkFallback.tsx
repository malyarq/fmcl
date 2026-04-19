import type { FC, ImgHTMLAttributes } from 'react';
import { getBrandAssetPath, isBrandAssetSource, type BrandAssetRole } from '../../app/assets/branding';
import { BrandMark, type BrandMarkFrame } from '../branding/BrandMark';
import { cn } from '../../utils/cn';

export type ArtworkFallbackKind = 'content-artwork' | 'product-mark' | 'app-icon';

const FALLBACK_ROLE_BY_KIND: Record<ArtworkFallbackKind, BrandAssetRole> = {
  'content-artwork': 'media-fallback',
  'product-mark': 'product-mark',
  'app-icon': 'app-icon',
};

const FALLBACK_FRAME_BY_KIND: Record<ArtworkFallbackKind, BrandMarkFrame> = {
  'content-artwork': 'media',
  'product-mark': 'brand',
  'app-icon': 'none',
};

const DEFAULT_ARTWORK_FALLBACK_KIND: ArtworkFallbackKind = 'content-artwork';

function getArtworkFallbackRole(kind: ArtworkFallbackKind = DEFAULT_ARTWORK_FALLBACK_KIND): BrandAssetRole {
  return FALLBACK_ROLE_BY_KIND[kind];
}

function getArtworkFallbackSrc(kind: ArtworkFallbackKind = DEFAULT_ARTWORK_FALLBACK_KIND): string {
  return getBrandAssetPath(getArtworkFallbackRole(kind));
}

function isArtworkFallbackSource(
  source: string | null | undefined,
  kind: ArtworkFallbackKind = DEFAULT_ARTWORK_FALLBACK_KIND,
): boolean {
  return isBrandAssetSource(source, getArtworkFallbackRole(kind));
}

type ArtworkFallbackProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  decorative?: boolean;
  kind?: ArtworkFallbackKind;
  wrapperClassName?: string;
};

type ArtworkFallbackComponent = FC<ArtworkFallbackProps> & {
  defaultKind: ArtworkFallbackKind;
  getRole: (kind?: ArtworkFallbackKind) => BrandAssetRole;
  getSrc: (kind?: ArtworkFallbackKind) => string;
  isSource: (source: string | null | undefined, kind?: ArtworkFallbackKind) => boolean;
};

export const ArtworkFallback: ArtworkFallbackComponent = Object.assign(function ArtworkFallback({
  alt,
  className,
  decorative = true,
  kind = DEFAULT_ARTWORK_FALLBACK_KIND,
  wrapperClassName,
  ...props
}: ArtworkFallbackProps) {
  return (
    <BrandMark
      {...props}
      alt={alt}
      className={cn('h-full w-full object-contain', className)}
      decorative={decorative}
      frame={FALLBACK_FRAME_BY_KIND[kind]}
      role={getArtworkFallbackRole(kind)}
      size="xl"
      wrapperClassName={cn('h-full w-full', wrapperClassName)}
    />
  );
}, {
  defaultKind: DEFAULT_ARTWORK_FALLBACK_KIND,
  getRole: getArtworkFallbackRole,
  getSrc: getArtworkFallbackSrc,
  isSource: isArtworkFallbackSource,
});
