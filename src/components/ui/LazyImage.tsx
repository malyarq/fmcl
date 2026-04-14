import React, { useState, useRef, useEffect } from 'react';
import { LAUNCHER_MARK_PATH, isBundledAssetSource } from '../../app/assets/branding';
import { cn } from '../../utils/cn';
import { cacheIPC } from '../../services/ipc/cacheIPC';

export interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** Placeholder to show while loading */
  placeholder?: React.ReactNode;
  /** Fallback image source if main image fails to load */
  fallback?: string;
  /** Root margin for Intersection Observer (default: "50px") */
  rootMargin?: string;
  /** Whether to use native lazy loading as fallback */
  useNativeLazy?: boolean;
}

/**
 * Lazy-loaded image component using Intersection Observer
 * Falls back to native lazy loading if Intersection Observer is not supported
 */
export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  className,
  placeholder,
  fallback,
  rootMargin = '50px',
  useNativeLazy = true,
  onError,
  ...props
}) => {
  const [isInView, setIsInView] = useState(false);
  const safeFallback = fallback ?? LAUNCHER_MARK_PATH;
  const sourceKey = `${src ?? ''}::${safeFallback}`;
  const [imageState, setImageState] = useState(() => ({
    key: sourceKey,
    isLoaded: false,
    hasError: false,
    resolvedSrc: undefined as string | undefined,
  }));
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Extract size classes early to check if it's a small image
  const sizeClasses = className?.match(/\b(w-|h-|w\[|h\[)\S+/g)?.join(' ') || '';
  const isSmallImage = sizeClasses.includes('w-16') || sizeClasses.includes('h-16') || 
                      sizeClasses.includes('w-12') || sizeClasses.includes('h-12') ||
                      sizeClasses.includes('w-20') || sizeClasses.includes('h-20');
  const isRemoteImage = typeof src === 'string' && /^https?:\/\//i.test(src);
  const currentImageState = imageState.key === sourceKey
    ? imageState
    : { key: sourceKey, isLoaded: false, hasError: false, resolvedSrc: undefined as string | undefined };

  useEffect(() => {
    // If no src but fallback exists, load immediately
    if (!src && safeFallback) {
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => {
        setIsInView(true);
      }, 0);
      return;
    }

    // If no src and no fallback, don't load anything
    if (!src) {
      return;
    }

    // For small images like icons, load immediately
    if (isSmallImage) {
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => {
        setIsInView(true);
      }, 0);
      return;
    }

    const img = imgRef.current;
    if (!img) {
      // If img not ready yet, try again after a short delay
      const timer = setTimeout(() => {
        setIsInView(true);
      }, 100);
      return () => clearTimeout(timer);
    }

    // Check if Intersection Observer is supported
    if (!('IntersectionObserver' in window)) {
      // Fallback: load immediately if Intersection Observer is not supported
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => {
        setIsInView(true);
      }, 0);
      return;
    }

    // Use native lazy loading if supported and useNativeLazy is true
    if (useNativeLazy && 'loading' in HTMLImageElement.prototype) {
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => {
        setIsInView(true);
      }, 0);
      return;
    }

    // Create Intersection Observer
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observerRef.current?.disconnect();
          }
        });
      },
      {
        rootMargin,
        threshold: 0.01,
      }
    );

    observerRef.current.observe(img);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [rootMargin, useNativeLazy, src, safeFallback, isSmallImage]);

  useEffect(() => {
    let isActive = true;

    if (!src || !isInView) {
      return () => {
        isActive = false;
      };
    }

    if (!isRemoteImage || !cacheIPC.has('resolveImage') || currentImageState.resolvedSrc) {
      return () => {
        isActive = false;
      };
    }

    void cacheIPC.resolveImage(src)
      .then((result) => {
        if (!isActive) {
          return;
        }

        setImageState((previous) => {
          const nextState = previous.key === sourceKey
            ? previous
            : { key: sourceKey, isLoaded: false, hasError: false, resolvedSrc: undefined as string | undefined };

          return {
            ...nextState,
            resolvedSrc: result.localUrl || src,
          };
        });
      })
      .catch((error) => {
        console.warn('[LazyImage] Failed to resolve cached image, using source URL instead.', error);
        if (!isActive) {
          return;
        }

        setImageState((previous) => {
          const nextState = previous.key === sourceKey
            ? previous
            : { key: sourceKey, isLoaded: false, hasError: false, resolvedSrc: undefined as string | undefined };

          return {
            ...nextState,
            resolvedSrc: src,
          };
        });
      });

    return () => {
      isActive = false;
    };
  }, [currentImageState.resolvedSrc, isInView, isRemoteImage, sourceKey, src]);

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (!currentImageState.hasError && safeFallback && !isBundledAssetSource(e.currentTarget.currentSrc || e.currentTarget.src, safeFallback)) {
      // Try fallback if not already using it
      setImageState((previous) => ({
        ...(previous.key === sourceKey
          ? previous
          : { key: sourceKey, isLoaded: false, hasError: false, resolvedSrc: undefined as string | undefined }),
        hasError: true,
        isLoaded: false,
      }));
    } else if (onError) {
      onError(e);
    }
  };

  const handleLoad = () => {
    setImageState((previous) => ({
      ...(previous.key === sourceKey
        ? previous
        : { key: sourceKey, isLoaded: false, hasError: false, resolvedSrc: undefined as string | undefined }),
      isLoaded: true,
    }));
  };

  // Determine image source: use fallback if error occurred, otherwise use src if in view
  const primarySrc = src && isInView
    ? (isRemoteImage ? currentImageState.resolvedSrc : src)
    : undefined;
  const imageSrc = currentImageState.hasError && safeFallback
    ? safeFallback
    : primarySrc ?? (safeFallback && !src ? safeFallback : undefined);

  // Extract size classes from className to apply to wrapper
  const otherClasses = className?.replace(/\b(w-|h-|w\[|h\[)\S+/g, '').trim() || '';

  // If no src and no fallback, show placeholder or nothing
  if (!src && !safeFallback) {
    return (
      <div className={cn('relative overflow-hidden', sizeClasses, otherClasses)}>
        {placeholder && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-200 dark:bg-zinc-800">
            {placeholder}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn('relative overflow-hidden', sizeClasses)}>
      {!currentImageState.isLoaded && placeholder && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-200 dark:bg-zinc-800 z-10">
          {placeholder}
        </div>
      )}
      {imageSrc && (
        <img
          ref={imgRef}
          src={imageSrc}
          alt={alt}
          className={cn(
            'w-full h-full object-cover transition-opacity duration-300',
            currentImageState.isLoaded ? 'opacity-100' : 'opacity-0',
            otherClasses
          )}
          onLoad={handleLoad}
          onError={handleError}
          loading={isSmallImage ? undefined : (useNativeLazy ? 'lazy' : undefined)}
          {...props}
        />
      )}
    </div>
  );
};
