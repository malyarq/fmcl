import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../../utils/cn';

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
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Extract size classes early to check if it's a small image
  const sizeClasses = className?.match(/\b(w-|h-|w\[|h\[)\S+/g)?.join(' ') || '';
  const isSmallImage = sizeClasses.includes('w-16') || sizeClasses.includes('h-16') || 
                      sizeClasses.includes('w-12') || sizeClasses.includes('h-12') ||
                      sizeClasses.includes('w-20') || sizeClasses.includes('h-20');

  useEffect(() => {
    // If no src but fallback exists, load immediately
    if (!src && fallback) {
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
  }, [rootMargin, useNativeLazy, src, fallback, isSmallImage]);

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (!hasError && fallback && e.currentTarget.src !== fallback) {
      // Try fallback if not already using it
      setHasError(true);
    } else if (onError) {
      onError(e);
    }
  };

  const handleLoad = () => {
    setIsLoaded(true);
  };

  // Determine image source: use fallback if error occurred, otherwise use src if in view
  const imageSrc = hasError && fallback 
    ? fallback 
    : (src && isInView ? src : (fallback && !src ? fallback : undefined));

  // Extract size classes from className to apply to wrapper
  const otherClasses = className?.replace(/\b(w-|h-|w\[|h\[)\S+/g, '').trim() || '';

  // If no src and no fallback, show placeholder or nothing
  if (!src && !fallback) {
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
      {!isLoaded && placeholder && (
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
            isLoaded ? 'opacity-100' : 'opacity-0',
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
