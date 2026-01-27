import React, { useState, useEffect, useRef } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';

export type TourStep = {
  id: string;
  target: string; // CSS selector или ref
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

export const OnboardingTour: React.FC<OnboardingTourProps> = ({
  steps,
  isOpen,
  onComplete,
  onSkip,
}) => {
  const { t, getAccentStyles, getAccentHex } = useSettings();
  const [currentStep, setCurrentStep] = useState(0);
  const [overlayPosition, setOverlayPosition] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || currentStep >= steps.length) return;

    const step = steps[currentStep];
    const element = document.querySelector(step.target);

    if (element) {
      const rect = element.getBoundingClientRect();
      const scrollX = window.scrollX || window.pageXOffset;
      const scrollY = window.scrollY || window.pageYOffset;

      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => {
        setOverlayPosition({
          top: rect.top + scrollY,
          left: rect.left + scrollX,
          width: rect.width,
          height: rect.height,
        });
      }, 0);

      // Прокрутка к элементу, если он не виден
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isOpen, currentStep, steps]);

  if (!isOpen || currentStep >= steps.length) return null;

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const getTooltipPosition = () => {
    if (!overlayPosition) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

    const position = step.position || 'bottom';
    const padding = 20;
    const tooltipWidth = 400; // Примерная ширина tooltip
    const tooltipHeight = 200; // Примерная высота tooltip
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top = 0;
    let left = 0;
    let transform = '';

    switch (position) {
      case 'top':
        top = overlayPosition.top - padding;
        left = overlayPosition.left + overlayPosition.width / 2;
        transform = 'translate(-50%, -100%)';
        // Проверка границ
        if (top - tooltipHeight < 0) {
          top = overlayPosition.top + overlayPosition.height + padding;
          transform = 'translate(-50%, 0)';
        }
        break;
      case 'bottom':
        top = overlayPosition.top + overlayPosition.height + padding;
        left = overlayPosition.left + overlayPosition.width / 2;
        transform = 'translate(-50%, 0)';
        // Проверка границ
        if (top + tooltipHeight > viewportHeight) {
          top = overlayPosition.top - padding;
          transform = 'translate(-50%, -100%)';
        }
        break;
      case 'left':
        top = overlayPosition.top + overlayPosition.height / 2;
        left = overlayPosition.left - padding;
        transform = 'translate(-100%, -50%)';
        // Проверка границ
        if (left - tooltipWidth < 0) {
          left = overlayPosition.left + overlayPosition.width + padding;
          transform = 'translate(0, -50%)';
        }
        break;
      case 'right':
        top = overlayPosition.top + overlayPosition.height / 2;
        left = overlayPosition.left + overlayPosition.width + padding;
        transform = 'translate(0, -50%)';
        // Проверка границ
        if (left + tooltipWidth > viewportWidth) {
          left = overlayPosition.left - padding;
          transform = 'translate(-100%, -50%)';
        }
        break;
      default:
        top = overlayPosition.top + overlayPosition.height + padding;
        left = overlayPosition.left + overlayPosition.width / 2;
        transform = 'translate(-50%, 0)';
    }

    // Финальная проверка границ
    if (left < 10) left = 10;
    if (left + tooltipWidth > viewportWidth - 10) left = viewportWidth - tooltipWidth - 10;
    if (top < 10) top = 10;
    if (top + tooltipHeight > viewportHeight - 10) top = viewportHeight - tooltipHeight - 10;

    return { top: `${top}px`, left: `${left}px`, transform };
  };

  const tooltipStyle = getTooltipPosition();

  return (
    <>
      {/* Overlay - не блокирует TitleBar (z-100) и выделенный элемент */}
      {overlayPosition ? (
        <>
          {/* Верхняя часть overlay (над выделенным элементом) */}
          {overlayPosition.top > 32 && (
            <div
              className="fixed top-[32px] left-0 right-0 z-[90] bg-black/70 backdrop-blur-sm transition-opacity duration-300 pointer-events-auto"
              onClick={handleNext}
              style={{ height: `${overlayPosition.top - 32}px` }}
            />
          )}
          {/* Левая часть overlay */}
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
          {/* Правая часть overlay */}
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
          {/* Нижняя часть overlay */}
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
          className="fixed top-[32px] left-0 right-0 bottom-0 z-[90] bg-black/70 backdrop-blur-sm transition-opacity duration-300 pointer-events-auto"
          onClick={handleNext}
        />
      )}

      {/* Spotlight highlight */}
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

      {/* Tooltip */}
      <div
        className="fixed z-[92] w-full max-w-sm bg-white dark:bg-zinc-800 rounded-lg shadow-2xl p-6 pointer-events-auto border border-zinc-200 dark:border-zinc-700"
        style={{
          ...tooltipStyle,
          // Ограничиваем позицию tooltip, чтобы он не выходил за границы экрана
          maxWidth: 'min(90vw, 400px)',
          margin: '0 auto',
        }}
      >
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
              {step.title}
            </h3>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {currentStep + 1} / {steps.length}
            </span>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {step.content}
          </p>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-2">
            {currentStep > 0 && (
              <Button variant="secondary" size="sm" onClick={handlePrevious}>
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
            onClick={handleNext}
            className={cn(getAccentStyles('bg').className)}
            style={getAccentStyles('bg').style}
          >
            {isLastStep
              ? t('onboarding.tour.finish') || 'Завершить'
              : t('onboarding.tour.next') || 'Далее'}
          </Button>
        </div>
      </div>
    </>
  );
};
