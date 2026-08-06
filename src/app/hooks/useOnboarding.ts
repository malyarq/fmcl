import { useState, useEffect } from 'react';
import { analyticsClient } from '../../features/analytics/analyticsClient';

const ONBOARDING_COMPLETED_KEY = 'onboarding_completed';
const FIRST_LAUNCH_KEY = 'first_launch';

export function useOnboarding() {
  const [showWelcome, setShowWelcome] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [isFirstLaunch, setIsFirstLaunch] = useState(false);

  useEffect(() => {
    // Проверяем, был ли уже показан onboarding
    const onboardingCompleted = localStorage.getItem(ONBOARDING_COMPLETED_KEY) === 'true';
    const firstLaunch = localStorage.getItem(FIRST_LAUNCH_KEY) !== 'false';

    if (firstLaunch && !onboardingCompleted) {
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => {
        setIsFirstLaunch(true);
        setShowWelcome(true);
      }, 0);
      // Помечаем, что первый запуск был
      localStorage.setItem(FIRST_LAUNCH_KEY, 'false');
      void analyticsClient.capture('onboarding_shown', {});
    }
  }, []);

  const handleWelcomeComplete = () => {
    setShowWelcome(false);
    setShowTour(false);
    localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
  };

  const handleTourStart = () => {
    setShowWelcome(false);
    setShowTour(true);
    void analyticsClient.capture('onboarding_action', { action: 'tour_started' });
  };

  const handleTourComplete = () => {
    setShowTour(false);
    localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
    void analyticsClient.capture('onboarding_action', { action: 'tour_completed' });
  };

  const handleSkip = () => {
    setShowWelcome(false);
    setShowTour(false);
    localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
    localStorage.setItem(FIRST_LAUNCH_KEY, 'false');
    void analyticsClient.capture('onboarding_action', { action: 'tour_skipped' });
  };

  const resetOnboarding = () => {
    localStorage.removeItem(ONBOARDING_COMPLETED_KEY);
    localStorage.removeItem(FIRST_LAUNCH_KEY);
    setIsFirstLaunch(true);
    setShowWelcome(true);
  };

  return {
    showWelcome,
    showTour,
    isFirstLaunch,
    handleWelcomeComplete,
    handleTourStart,
    handleTourComplete,
    handleSkip,
    resetOnboarding,
  };
}
