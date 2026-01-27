import { useCallback, useState } from 'react';

export function useAppOverlays() {
  const [showSettings, setShowSettings] = useState(false);
  const [showMultiplayer, setShowMultiplayer] = useState(false);

  const openSettings = useCallback(() => setShowSettings(true), []);
  const closeSettings = useCallback(() => setShowSettings(false), []);
  const openMultiplayer = useCallback(() => setShowMultiplayer(true), []);
  const closeMultiplayer = useCallback(() => setShowMultiplayer(false), []);

  return {
    showSettings,
    showMultiplayer,
    openSettings,
    closeSettings,
    openMultiplayer,
    closeMultiplayer,
  };
}

