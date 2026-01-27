import { useState, useEffect } from 'react';

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
    }
  }, []);

  const handleWelcomeComplete = () => {
    setShowWelcome(false);
    // После Welcome показываем Tour
    setShowTour(true);
  };

  const handleTourComplete = () => {
    setShowTour(false);
    localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
  };

  const handleSkip = () => {
    setShowWelcome(false);
    setShowTour(false);
    localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
    localStorage.setItem(FIRST_LAUNCH_KEY, 'false');
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
    handleTourComplete,
    handleSkip,
    resetOnboarding,
  };
}
