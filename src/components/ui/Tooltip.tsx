import React, { useId, useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '../../utils/cn';
import { AnchoredOverlay } from './AnchoredOverlay';
import type { AnchoredPlacement } from './anchoredOverlayLayout';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  position?: AnchoredPlacement;
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
  const [resolvedPlacement, setResolvedPlacement] = useState<AnchoredPlacement>(position);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const tooltipId = useId();

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

  const childProps = (children as React.ReactElement).props as Record<string, unknown> & {
    onMouseEnter?: (e: React.MouseEvent) => void;
    onMouseLeave?: (e: React.MouseEvent) => void;
    onFocus?: (e: React.FocusEvent) => void;
    onBlur?: (e: React.FocusEvent) => void;
    'aria-describedby'?: string;
  };

  const originalRef = useRef<React.Ref<HTMLElement> | null>(null);
  useEffect(() => {
    const child = children as React.ReactElement & { ref?: React.Ref<HTMLElement> };
    originalRef.current = child.ref || null;
  }, [children]);

  useEffect(() => {
    if (!isVisible) {
      setResolvedPlacement(position);
    }
  }, [isVisible, position]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleWrapperRef = useCallback((node: HTMLSpanElement | null) => {
    if (!node || !node.firstElementChild) {
      return;
    }

    const element = node.firstElementChild as HTMLElement;
    triggerRef.current = element;

    const ref = originalRef.current;
    if (!ref) {
      return;
    }

    if (typeof ref === 'function') {
      ref(element);
      return;
    }

    if ('current' in ref) {
      const refObject = ref as React.MutableRefObject<HTMLElement | null>;
      refObject.current = element;
    }
  }, []);

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
    'aria-describedby': isVisible ? tooltipId : childProps['aria-describedby'],
  } as React.HTMLAttributes<HTMLElement>);

  return (
    <>
      <span ref={handleWrapperRef} style={{ display: 'contents' }}>
        {trigger}
      </span>
      <AnchoredOverlay
        open={isVisible}
        anchorRef={triggerRef}
        placement={position}
        align="center"
        offset={8}
        padding={8}
        id={tooltipId}
        role="tooltip"
        aria-hidden={!isVisible}
        onPlacementChange={setResolvedPlacement}
        className="pointer-events-none z-[100] px-3 py-2 text-sm font-medium shadow-[0_18px_40px_rgba(0,0,0,0.18)] transition-opacity duration-200 ease-out"
      >
        <div
          className={cn(
            'surface-inline relative text-foreground',
            'before:absolute before:h-2 before:w-2 before:rotate-45 before:border-b before:border-r before:border-border/60 before:bg-card/90 before:content-[""]',
            resolvedPlacement === 'top' && 'before:bottom-[-4px] before:left-1/2 before:-translate-x-1/2',
            resolvedPlacement === 'bottom' && 'before:top-[-4px] before:left-1/2 before:-translate-x-1/2',
            resolvedPlacement === 'left' && 'before:right-[-4px] before:top-1/2 before:-translate-y-1/2',
            resolvedPlacement === 'right' && 'before:left-[-4px] before:top-1/2 before:-translate-y-1/2',
            className,
          )}
        >
          {content}
        </div>
      </AnchoredOverlay>
    </>
  );
};
