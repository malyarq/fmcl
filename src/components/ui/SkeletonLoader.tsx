import React from 'react';
import { cn } from '../../utils/cn';

export interface SkeletonLoaderProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  lines?: number;
  animated?: boolean;
}

/**
 * SkeletonLoader - компонент для отображения placeholder'ов во время загрузки
 * 
 * @example
 * // Простой прямоугольник
 * <SkeletonLoader variant="rectangular" width={200} height={100} />
 * 
 * // Текст с несколькими строками
 * <SkeletonLoader variant="text" lines={3} />
 * 
 * // Круглый (для аватаров)
 * <SkeletonLoader variant="circular" width={64} height={64} />
 */
export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  className,
  variant = 'rectangular',
  width,
  height,
  lines = 1,
  animated = true,
}) => {
  const baseStyles = cn(
    'bg-zinc-200 dark:bg-zinc-800',
    animated && 'animate-pulse',
    className
  );

  if (variant === 'text' && lines > 1) {
    return (
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={cn(
              baseStyles,
              'h-4 rounded',
              index === lines - 1 && 'w-3/4' // Последняя строка короче
            )}
            style={index === lines - 1 ? undefined : { width }}
          />
        ))}
      </div>
    );
  }

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  const variantStyles = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: '',
    rounded: 'rounded-lg',
  };

  return (
    <div
      className={cn(baseStyles, variantStyles[variant])}
      style={style}
      aria-label="Loading..."
      role="status"
    />
  );
};
