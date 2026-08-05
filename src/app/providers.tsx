import type { ReactNode } from 'react';
import { SettingsProvider } from '../contexts/SettingsContext';
import { ToastProvider } from '../contexts/ToastContext';
import { ConfirmProvider } from '../contexts/ConfirmContext';
import { InstanceQueryProvider } from '../features/instances/InstanceQueryProvider';
import { OperationRecoveryProvider } from '../features/operations/recovery/OperationRecoveryProvider';
import { AnalyticsProvider } from '../features/analytics/AnalyticsProvider';

export function AppProviders(props: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <AnalyticsProvider>
        <InstanceQueryProvider>
          <ToastProvider>
            <ConfirmProvider>
              <OperationRecoveryProvider>{props.children}</OperationRecoveryProvider>
            </ConfirmProvider>
          </ToastProvider>
        </InstanceQueryProvider>
      </AnalyticsProvider>
    </SettingsProvider>
  );
}
