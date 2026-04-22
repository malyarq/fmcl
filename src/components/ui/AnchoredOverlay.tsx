import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../utils/cn';
import {
  rectFromElement,
  resolveAnchoredOverlayLayout,
  type AnchoredAlign,
  type AnchoredOverlayLayout,
  type AnchoredPlacement,
  type AnchoredRect,
} from './anchoredOverlayLayout';

function layoutsMatch(a: AnchoredOverlayLayout | null, b: AnchoredOverlayLayout): boolean {
  return Boolean(
    a &&
    a.top === b.top &&
    a.left === b.left &&
    a.placement === b.placement &&
    a.align === b.align &&
    a.transformOrigin === b.transformOrigin,
  );
}

export interface AnchoredOverlayProps extends React.HTMLAttributes<HTMLDivElement> {
  open: boolean;
  anchorRef?: React.RefObject<HTMLElement | null>;
  anchorRect?: AnchoredRect | null;
  placement?: AnchoredPlacement;
  align?: AnchoredAlign;
  offset?: number;
  padding?: number;
  portalRoot?: HTMLElement | null;
  onPlacementChange?: (placement: AnchoredPlacement) => void;
}

export const AnchoredOverlay: React.FC<AnchoredOverlayProps> = ({
  open,
  anchorRef,
  anchorRect,
  placement = 'bottom',
  align = 'center',
  offset = 8,
  padding = 12,
  portalRoot,
  className,
  style,
  onPlacementChange,
  children,
  ...props
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<AnchoredOverlayLayout | null>(null);

  useEffect(() => {
    if (!open || typeof window === 'undefined') {
      return;
    }

    const resolveAnchorRect = () => {
      if (anchorRect) {
        return anchorRect;
      }

      if (anchorRef?.current) {
        return rectFromElement(anchorRef.current);
      }

      return null;
    };

    const updateLayout = () => {
      const nextAnchorRect = resolveAnchorRect();
      const overlayBounds = overlayRef.current?.getBoundingClientRect();

      if (!nextAnchorRect || !overlayBounds) {
        return;
      }

      const nextLayout = resolveAnchoredOverlayLayout({
        anchorRect: nextAnchorRect,
        overlaySize: {
          width: overlayBounds.width,
          height: overlayBounds.height,
        },
        viewportSize: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        placement,
        align,
        offset,
        padding,
      });

      setLayout((previous) => (layoutsMatch(previous, nextLayout) ? previous : nextLayout));

      onPlacementChange?.(nextLayout.placement);
    };

    const frameId = window.requestAnimationFrame(updateLayout);
    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => updateLayout())
        : null;

    if (resizeObserver && anchorRef?.current) {
      resizeObserver.observe(anchorRef.current);
    }

    if (resizeObserver && overlayRef.current) {
      resizeObserver.observe(overlayRef.current);
    }

    window.addEventListener('resize', updateLayout);
    window.addEventListener('scroll', updateLayout, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateLayout);
      window.removeEventListener('scroll', updateLayout, true);
    };
  }, [align, anchorRect, anchorRef, offset, onPlacementChange, open, padding, placement]);

  if (!open || typeof document === 'undefined') {
    return null;
  }

  const overlayNode = (
    <div
      ref={overlayRef}
      data-placement={layout?.placement ?? placement}
      className={cn('fixed z-[120]', className)}
      style={
        layout
          ? {
              ...style,
              top: `${layout.top}px`,
              left: `${layout.left}px`,
              transformOrigin: layout.transformOrigin,
            }
          : {
              ...style,
              top: '0px',
              left: '0px',
              opacity: 0,
              pointerEvents: 'none',
            }
      }
      {...props}
    >
      {children}
    </div>
  );

  return createPortal(overlayNode, portalRoot ?? document.body);
};
