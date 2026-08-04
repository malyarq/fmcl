import React from 'react';
import { useSettings } from '../contexts/SettingsContext';
import ErrorBoundary from './ErrorBoundary';

export const ErrorBoundaryWrapper: React.FC<{
    children: React.ReactNode;
    onRecover: () => Promise<void> | void;
}> = ({ children, onRecover }) => {
    const { t } = useSettings();
    return <ErrorBoundary mode="recover" onRecover={onRecover} t={t}>{children}</ErrorBoundary>;
};
