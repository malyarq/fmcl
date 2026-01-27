import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '../../utils/cn';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delay = 300,
  className,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const showTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  // Get props from children with proper typing
  const childProps = (children as React.ReactElement).props as Record<string, unknown> & {
    onMouseEnter?: (e: React.MouseEvent) => void;
    onMouseLeave?: (e: React.MouseEvent) => void;
    onFocus?: (e: React.FocusEvent) => void;
    onBlur?: (e: React.FocusEvent) => void;
  };

  // Store the original ref from children to avoid mutating props
  const originalRef = useRef<React.Ref<HTMLElement> | null>(null);
  useEffect(() => {
    // Access children.ref in effect to avoid accessing during render
    const child = children as React.ReactElement & { ref?: React.Ref<HTMLElement> };
    originalRef.current = child.ref || null;
  }, [children]);

  // Use a wrapper div with display: contents to capture ref without affecting layout
  const handleWrapperRef = useCallback((node: HTMLSpanElement | null) => {
    // Find the actual child element inside the wrapper
    if (node && node.firstElementChild) {
      const element = node.firstElementChild as HTMLElement;
      triggerRef.current = element;
      
      // Forward ref to original children if it exists (in callback, not during render)
      const ref = originalRef.current;
      if (ref) {
        if (typeof ref === 'function') {
          ref(element);
        } else if (ref && 'current' in ref) {
          // Extract to local variable to avoid mutating prop
          const refObject = ref as React.MutableRefObject<HTMLElement | null>;
          refObject.current = element;
        }
      }
    }
  }, []);

  // Wrap children and attach event handlers
  // eslint-disable-next-line react-hooks/refs
  const trigger = React.cloneElement(children as React.ReactElement, {
    onMouseEnter: (e: React.MouseEvent) => {
      showTooltip();
      childProps.onMouseEnter?.(e);
    },
    onMouseLeave: (e: React.MouseEvent) => {
      hideTooltip();
      childProps.onMouseLeave?.(e);
    },
    onFocus: (e: React.FocusEvent) => {
      showTooltip();
      childProps.onFocus?.(e);
    },
    onBlur: (e: React.FocusEvent) => {
      hideTooltip();
      childProps.onBlur?.(e);
    },
  } as React.HTMLAttributes<HTMLElement>);

  // Wrap trigger in a span with display: contents to capture ref without affecting layout
  const triggerWithRef = (
    <span ref={handleWrapperRef} style={{ display: 'contents' }}>
      {trigger}
    </span>
  );

  useEffect(() => {
    if (isVisible && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const scrollX = window.scrollX || window.pageXOffset;
      const scrollY = window.scrollY || window.pageYOffset;

      let top = 0;
      let left = 0;

      switch (position) {
        case 'top':
          top = triggerRect.top + scrollY - tooltipRect.height - 8;
          left = triggerRect.left + scrollX + triggerRect.width / 2 - tooltipRect.width / 2;
          break;
        case 'bottom':
          top = triggerRect.bottom + scrollY + 8;
          left = triggerRect.left + scrollX + triggerRect.width / 2 - tooltipRect.width / 2;
          break;
        case 'left':
          top = triggerRect.top + scrollY + triggerRect.height / 2 - tooltipRect.height / 2;
          left = triggerRect.left + scrollX - tooltipRect.width - 8;
          break;
        case 'right':
          top = triggerRect.top + scrollY + triggerRect.height / 2 - tooltipRect.height / 2;
          left = triggerRect.right + scrollX + 8;
          break;
      }

      // Проверка границ экрана
      const padding = 8;
      if (left < padding) left = padding;
      if (left + tooltipRect.width > window.innerWidth - padding) {
        left = window.innerWidth - tooltipRect.width - padding;
      }
      if (top < padding) top = padding;
      if (top + tooltipRect.height > window.innerHeight - padding) {
        top = window.innerHeight - tooltipRect.height - padding;
      }

      setTooltipPosition({ top, left });
    }
  }, [isVisible, position]);

  return (
    <>
      {triggerWithRef}
      {isVisible && (
        <div
          ref={tooltipRef}
          className={cn(
            'fixed z-[100] px-3 py-2 text-sm font-medium text-white bg-zinc-900 dark:bg-zinc-700 rounded-lg shadow-lg pointer-events-none',
            'transition-opacity duration-200 ease-out',
            'before:content-[""] before:absolute before:w-2 before:h-2 before:bg-zinc-900 dark:before:bg-zinc-700 before:rotate-45',
            position === 'top' && 'before:bottom-[-4px] before:left-1/2 before:-translate-x-1/2',
            position === 'bottom' && 'before:top-[-4px] before:left-1/2 before:-translate-x-1/2',
            position === 'left' && 'before:right-[-4px] before:top-1/2 before:-translate-y-1/2',
            position === 'right' && 'before:left-[-4px] before:top-1/2 before:-translate-y-1/2',
            className
          )}
          style={
            tooltipPosition
              ? {
                  top: `${tooltipPosition.top}px`,
                  left: `${tooltipPosition.left}px`,
                }
              : { visibility: 'hidden' }
          }
        >
          {content}
        </div>
      )}
    </>
  );
};
