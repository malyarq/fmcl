import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import {
  analyticsClient,
  hasAnalyticsConsent,
  persistAnalyticsConsent,
  type AnalyticsCaptureResult,
  type AnalyticsEventMap,
  type AnalyticsEventName,
} from './analyticsClient';

type AnalyticsContextValue = {
  capture<K extends AnalyticsEventName>(event: K, properties: AnalyticsEventMap[K]): Promise<AnalyticsCaptureResult>;
  enabled: boolean;
  configured: boolean;
  setEnabled(enabled: boolean): void;
};

const AnalyticsContext = createContext<AnalyticsContextValue | null>(null);

export function AnalyticsProvider(props: { children: ReactNode }) {
  const { language, uiMode } = useSettings();
  const [enabled, setEnabledState] = useState(() => hasAnalyticsConsent());
  const startupCaptured = useRef(false);

  const capture = useCallback(<K extends AnalyticsEventName>(event: K, properties: AnalyticsEventMap[K]) => (
    analyticsClient.capture(event, properties)
  ), []);

  const setEnabled = useCallback((nextEnabled: boolean) => {
    persistAnalyticsConsent(nextEnabled);
    setEnabledState(nextEnabled);
    if (!nextEnabled) analyticsClient.clearInstallId();
  }, []);

  useEffect(() => {
    if (!enabled || startupCaptured.current || window.location.hash === '#console') return;
    startupCaptured.current = true;
    void capture('app_opened', { language, ui_mode: uiMode });
  }, [capture, enabled, language, uiMode]);

  const value = useMemo<AnalyticsContextValue>(() => ({
    capture,
    configured: analyticsClient.configured,
    enabled,
    setEnabled,
  }), [capture, enabled, setEnabled]);

  return <AnalyticsContext.Provider value={value}>{props.children}</AnalyticsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAnalytics(): AnalyticsContextValue {
  const context = useContext(AnalyticsContext);
  if (!context) throw new Error('useAnalytics must be used within an AnalyticsProvider');
  return context;
}
