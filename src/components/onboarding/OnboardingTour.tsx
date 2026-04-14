import React, { useState, useEffect, useRef } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';
import { AnchoredOverlay } from '../ui/AnchoredOverlay';
import { rectFromElement, type AnchoredRect } from '../ui/anchoredOverlayLayout';

export type TourStep = {
  id: string;
  target: string;
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
};

interface OnboardingTourProps {
  steps: TourStep[];
  isOpen: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

function TourCard(props: {
  currentStep: number;
  stepsLength: number;
  isLastStep: boolean;
  title: string;
  content: string;
  onSkip: () => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const { t, getAccentStyles } = useSettings();
  const { currentStep, stepsLength, isLastStep, title, content, onSkip, onPrevious, onNext } = props;

  return (
    <div className="surface-panel pointer-events-auto rounded-2xl p-6">
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
            {title}
          </h3>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {currentStep + 1} / {stepsLength}
          </span>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {content}
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2">
          {currentStep > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onPrevious();
              }}
            >
              {t('onboarding.tour.previous') || 'Назад'}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onSkip}>
            {t('onboarding.tour.skip') || 'Пропустить'}
          </Button>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={onNext}
          className={cn(getAccentStyles('bg').className)}
          style={getAccentStyles('bg').style}
        >
          {isLastStep
            ? t('onboarding.tour.finish') || 'Завершить'
            : t('onboarding.tour.next') || 'Далее'}
        </Button>
      </div>
    </div>
  );
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({
  steps,
  isOpen,
  onComplete,
  onSkip,
}) => {
  const { getAccentHex } = useSettings();
  const [currentStep, setCurrentStep] = useState(0);
  const [overlayPosition, setOverlayPosition] = useState<AnchoredRect | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);
  const isGoingBackRef = useRef(false);

  useEffect(() => {
    if (!isOpen || currentStep >= steps.length) {
      return;
    }

    const resolveCurrentStep = (allowAdvance: boolean, shouldScroll: boolean) => {
      const step = steps[currentStep];
      const element = document.querySelector<HTMLElement>(step.target);

      if (element) {
        isGoingBackRef.current = false;
        setOverlayPosition(rectFromElement(element));

        if (shouldScroll) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }

      if (isGoingBackRef.current) {
        isGoingBackRef.current = false;
        setOverlayPosition(null);
        return;
      }

      if (allowAdvance && currentStep < steps.length - 1) {
        setCurrentStep((prev) => prev + 1);
        setOverlayPosition(null);
        return;
      }

      if (allowAdvance) {
        onComplete();
      }
    };

    const frameId = window.requestAnimationFrame(() => {
      resolveCurrentStep(true, true);
    });

    const handleViewportChange = () => {
      resolveCurrentStep(false, false);
    };

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [currentStep, isOpen, onComplete, steps]);

  if (!isOpen || currentStep >= steps.length) {
    return null;
  }

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
      return;
    }

    setCurrentStep(currentStep + 1);
  };

  const handlePrevious = () => {
    if (currentStep <= 0) {
      return;
    }

    isGoingBackRef.current = true;
    setCurrentStep(currentStep - 1);
  };

  const card = (
    <TourCard
      currentStep={currentStep}
      stepsLength={steps.length}
      isLastStep={isLastStep}
      title={step.title}
      content={step.content}
      onSkip={onSkip}
      onPrevious={handlePrevious}
      onNext={handleNext}
    />
  );

  return (
    <>
      {overlayPosition ? (
        <>
          {overlayPosition.top > 32 && (
            <div
              className="fixed left-0 right-0 top-[32px] z-[90] bg-black/70 backdrop-blur-sm transition-opacity duration-300 pointer-events-auto"
              onClick={handleNext}
              style={{ height: `${overlayPosition.top - 32}px` }}
            />
          )}
          <div
            className="fixed z-[90] bg-black/70 backdrop-blur-sm transition-opacity duration-300 pointer-events-auto"
            onClick={handleNext}
            style={{
              top: `${Math.max(32, overlayPosition.top)}px`,
              left: '0',
              width: `${overlayPosition.left}px`,
              height: `${overlayPosition.height}px`,
            }}
          />
          <div
            className="fixed z-[90] bg-black/70 backdrop-blur-sm transition-opacity duration-300 pointer-events-auto"
            onClick={handleNext}
            style={{
              top: `${Math.max(32, overlayPosition.top)}px`,
              left: `${overlayPosition.left + overlayPosition.width}px`,
              right: '0',
              height: `${overlayPosition.height}px`,
            }}
          />
          <div
            className="fixed z-[90] bg-black/70 backdrop-blur-sm transition-opacity duration-300 pointer-events-auto"
            onClick={handleNext}
            style={{
              top: `${overlayPosition.top + overlayPosition.height}px`,
              left: '0',
              right: '0',
              bottom: '0',
            }}
          />
        </>
      ) : (
        <div
          ref={overlayRef}
          className="fixed bottom-0 left-0 right-0 top-[32px] z-[90] bg-black/70 backdrop-blur-sm transition-opacity duration-300 pointer-events-auto"
          onClick={handleNext}
        />
      )}

      {overlayPosition && (
        <div
          ref={spotlightRef}
          className="fixed z-[91] pointer-events-none transition-all duration-300"
          style={{
            top: `${overlayPosition.top - 4}px`,
            left: `${overlayPosition.left - 4}px`,
            width: `${overlayPosition.width + 8}px`,
            height: `${overlayPosition.height + 8}px`,
            borderRadius: '12px',
            border: `3px solid ${getAccentHex()}`,
            boxShadow: `0 0 0 4px rgba(0, 0, 0, 0.3), 0 0 30px ${getAccentHex()}60, inset 0 0 20px ${getAccentHex()}20`,
            backgroundColor: 'transparent',
          }}
        />
      )}

      {overlayPosition ? (
        <AnchoredOverlay
          open={true}
          anchorRect={overlayPosition}
          placement={step.position || 'bottom'}
          align="center"
          offset={20}
          padding={16}
          className="z-[110] w-full max-w-sm"
          style={{ maxWidth: 'min(90vw, 400px)' }}
        >
          {card}
        </AnchoredOverlay>
      ) : (
        <div
          className="fixed left-1/2 top-1/2 z-[110] w-full max-w-sm -translate-x-1/2 -translate-y-1/2"
          style={{ maxWidth: 'min(90vw, 400px)' }}
        >
          {card}
        </div>
      )}
    </>
  );
};
