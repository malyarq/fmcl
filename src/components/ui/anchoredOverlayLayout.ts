export type AnchoredPlacement = 'top' | 'bottom' | 'left' | 'right';
export type AnchoredAlign = 'start' | 'center' | 'end';

export type AnchoredRect = {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

type OverlaySize = {
  width: number;
  height: number;
};

type ViewportSize = {
  width: number;
  height: number;
};

export type AnchoredOverlayLayout = {
  top: number;
  left: number;
  placement: AnchoredPlacement;
  align: AnchoredAlign;
  transformOrigin: string;
};

function clamp(value: number, min: number, max: number): number {
  if (max < min) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

function getOppositePlacement(placement: AnchoredPlacement): AnchoredPlacement {
  switch (placement) {
    case 'top':
      return 'bottom';
    case 'bottom':
      return 'top';
    case 'left':
      return 'right';
    case 'right':
      return 'left';
  }
}

function getOrthogonalPlacements(placement: AnchoredPlacement): AnchoredPlacement[] {
  if (placement === 'top' || placement === 'bottom') {
    return ['right', 'left'];
  }

  return ['bottom', 'top'];
}

function getTransformOrigin(placement: AnchoredPlacement, align: AnchoredAlign): string {
  const crossAxisOrigin =
    align === 'start' ? '0%' : align === 'end' ? '100%' : '50%';

  switch (placement) {
    case 'top':
      return `${crossAxisOrigin} 100%`;
    case 'bottom':
      return `${crossAxisOrigin} 0%`;
    case 'left':
      return `100% ${crossAxisOrigin}`;
    case 'right':
      return `0% ${crossAxisOrigin}`;
  }
}

function getCandidatePosition(
  anchorRect: AnchoredRect,
  overlaySize: OverlaySize,
  placement: AnchoredPlacement,
  align: AnchoredAlign,
  offset: number,
): { top: number; left: number } {
  const horizontalPosition = () => {
    switch (align) {
      case 'start':
        return anchorRect.left;
      case 'end':
        return anchorRect.right - overlaySize.width;
      default:
        return anchorRect.left + anchorRect.width / 2 - overlaySize.width / 2;
    }
  };

  const verticalPosition = () => {
    switch (align) {
      case 'start':
        return anchorRect.top;
      case 'end':
        return anchorRect.bottom - overlaySize.height;
      default:
        return anchorRect.top + anchorRect.height / 2 - overlaySize.height / 2;
    }
  };

  switch (placement) {
    case 'top':
      return {
        top: anchorRect.top - overlaySize.height - offset,
        left: horizontalPosition(),
      };
    case 'bottom':
      return {
        top: anchorRect.bottom + offset,
        left: horizontalPosition(),
      };
    case 'left':
      return {
        top: verticalPosition(),
        left: anchorRect.left - overlaySize.width - offset,
      };
    case 'right':
      return {
        top: verticalPosition(),
        left: anchorRect.right + offset,
      };
  }
}

function getOverflowScore(
  position: { top: number; left: number },
  overlaySize: OverlaySize,
  viewportSize: ViewportSize,
  padding: number,
): number {
  const overflowTop = Math.max(0, padding - position.top);
  const overflowLeft = Math.max(0, padding - position.left);
  const overflowBottom = Math.max(0, position.top + overlaySize.height - (viewportSize.height - padding));
  const overflowRight = Math.max(0, position.left + overlaySize.width - (viewportSize.width - padding));

  return overflowTop + overflowLeft + overflowBottom + overflowRight;
}

export function rectFromElement(element: Pick<HTMLElement, 'getBoundingClientRect'>): AnchoredRect {
  const rect = element.getBoundingClientRect();

  return {
    top: rect.top,
    left: rect.left,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

export function resolveAnchoredOverlayLayout(input: {
  anchorRect: AnchoredRect;
  overlaySize: OverlaySize;
  viewportSize: ViewportSize;
  placement?: AnchoredPlacement;
  align?: AnchoredAlign;
  offset?: number;
  padding?: number;
}): AnchoredOverlayLayout {
  const {
    anchorRect,
    overlaySize,
    viewportSize,
    placement = 'bottom',
    align = 'center',
    offset = 8,
    padding = 12,
  } = input;

  const candidates: AnchoredPlacement[] = [
    placement,
    getOppositePlacement(placement),
    ...getOrthogonalPlacements(placement),
  ];

  let bestPlacement = placement;
  let bestPosition = getCandidatePosition(anchorRect, overlaySize, placement, align, offset);
  let bestScore = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const candidatePosition = getCandidatePosition(anchorRect, overlaySize, candidate, align, offset);
    const candidateScore = getOverflowScore(candidatePosition, overlaySize, viewportSize, padding);

    if (candidateScore < bestScore) {
      bestPlacement = candidate;
      bestPosition = candidatePosition;
      bestScore = candidateScore;
    }

    if (candidateScore === 0) {
      break;
    }
  }

  return {
    top: clamp(bestPosition.top, padding, viewportSize.height - overlaySize.height - padding),
    left: clamp(bestPosition.left, padding, viewportSize.width - overlaySize.width - padding),
    placement: bestPlacement,
    align,
    transformOrigin: getTransformOrigin(bestPlacement, align),
  };
}
