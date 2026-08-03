import { useCallback, useState } from 'react';

export function useAppOverlays() {
  const [activeOverlay, setActiveOverlay] = useState<'settings' | 'multiplayer' | null>(null);

  const openSettings = useCallback(() => setActiveOverlay('settings'), []);
  const closeSettings = useCallback(() => {
    setActiveOverlay((current) => current === 'settings' ? null : current);
  }, []);
  const openMultiplayer = useCallback(() => setActiveOverlay('multiplayer'), []);
  const closeMultiplayer = useCallback(() => {
    setActiveOverlay((current) => current === 'multiplayer' ? null : current);
  }, []);

  return {
    showSettings: activeOverlay === 'settings',
    showMultiplayer: activeOverlay === 'multiplayer',
    openSettings,
    closeSettings,
    openMultiplayer,
    closeMultiplayer,
  };
}
