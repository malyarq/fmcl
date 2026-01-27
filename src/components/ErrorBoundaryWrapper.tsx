import React from 'react';
import { useSettings } from '../contexts/SettingsContext';
import ErrorBoundary from './ErrorBoundary';

export const ErrorBoundaryWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { t } = useSettings();
    return <ErrorBoundary t={t}>{children}</ErrorBoundary>;
};
