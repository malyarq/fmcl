import type { ReactNode } from 'react';
import { SettingsProvider } from '../contexts/SettingsContext';
import { ModpackProvider } from '../contexts/ModpackContext';
import { ToastProvider } from '../contexts/ToastContext';
import { ConfirmProvider } from '../contexts/ConfirmContext';

export function AppProviders(props: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <ModpackProvider>
        <ToastProvider>
          <ConfirmProvider>{props.children}</ConfirmProvider>
        </ToastProvider>
      </ModpackProvider>
    </SettingsProvider>
  );
}

