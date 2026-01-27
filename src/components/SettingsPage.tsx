import React, { useEffect, useState, lazy, Suspense } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useModpack } from '../contexts/ModpackContext';
import { useAppUpdater } from '../features/updater/hooks/useAppUpdater';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { LoadingSpinner } from './ui/LoadingSpinner';
import { cn } from '../utils/cn';
import { SettingsTabsHeader, type SettingsTabId } from './settings/SettingsTabsHeader';

// Lazy load tabs and UpdateModal for code splitting
const AppearanceTab = lazy(() => import('./settings/tabs/AppearanceTab').then(m => ({ default: m.AppearanceTab })));
const GameTab = lazy(() => import('./settings/tabs/GameTab').then(m => ({ default: m.GameTab })));
const DownloadsTab = lazy(() => import('./settings/tabs/DownloadsTab').then(m => ({ default: m.DownloadsTab })));
const LauncherTab = lazy(() => import('./settings/tabs/LauncherTab').then(m => ({ default: m.LauncherTab })));
const UpdateModal = lazy(() => import('./UpdateModal').then(m => ({ default: m.UpdateModal })));

interface SettingsPageProps {
    onClose: () => void;
}

// Settings modal for appearance and launcher preferences.
const SettingsPage: React.FC<SettingsPageProps> = ({ onClose }) => {
    const [activeTab, setActiveTab] = useState<SettingsTabId>('appearance');
    const [showUpdateModal, setShowUpdateModal] = useState(false);
    const {
        hideLauncher, setHideLauncher,
        accentColor, setAccentColor,
        showConsole, setShowConsole,
        language, setLanguage, t,
        theme, setTheme,
        minecraftPath, setMinecraftPath,
        downloadProvider, setDownloadProvider,
        autoDownloadThreads, setAutoDownloadThreads,
        downloadThreads, setDownloadThreads,
        maxSockets, setMaxSockets,
        getAccentStyles
    } = useSettings();

    const {
        config: modpackConfig,
        setMemoryGb,
        setJavaPath,
        setVmOptions,
        setGameExtraArgs,
        setGameResolution,
        setAutoConnectServer,
        refresh: refreshInstances
    } = useModpack();

    useEffect(() => {
        void refreshInstances();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [minecraftPath]);

    // App updater hook (without auto-check)
    const { status, updateInfo, progress, checkForUpdates, installUpdate } = useAppUpdater(false);

    // Show update modal when update becomes available
    React.useEffect(() => {
        if (status === 'available' || status === 'downloading' || status === 'downloaded') {
            // Avoid synchronous setState in effect body (lint rule).
            const timer = setTimeout(() => setShowUpdateModal(true), 0);
            return () => clearTimeout(timer);
        }
    }, [status]);

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title={t('settings.title')}
            className="max-w-2xl"
        >
            <div className="space-y-4">
                <SettingsTabsHeader
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    t={t}
                    getAccentStyles={(type) => getAccentStyles(type)}
                />

                <div>
                    <Suspense fallback={
                        <div className="flex items-center justify-center py-12">
                            <LoadingSpinner size="lg" />
                        </div>
                    }>
                        {activeTab === 'appearance' && (
                            <AppearanceTab
                                accentColor={accentColor}
                                setAccentColor={setAccentColor}
                                theme={theme}
                                setTheme={setTheme}
                                language={language}
                                setLanguage={setLanguage}
                                t={t}
                                getAccentStyles={getAccentStyles}
                            />
                        )}

                        {activeTab === 'game' && (
                            <GameTab
                                modpackConfig={modpackConfig}
                                setMemoryGb={setMemoryGb}
                                setJavaPath={setJavaPath}
                                setVmOptions={setVmOptions}
                                setGameExtraArgs={setGameExtraArgs}
                                setGameResolution={setGameResolution}
                                setAutoConnectServer={setAutoConnectServer}
                                refreshInstances={refreshInstances}
                                minecraftPath={minecraftPath}
                                setMinecraftPath={setMinecraftPath}
                                t={t}
                                getAccentStyles={getAccentStyles}
                            />
                        )}

                        {activeTab === 'downloads' && (
                            <DownloadsTab
                                downloadProvider={downloadProvider}
                                setDownloadProvider={setDownloadProvider}
                                autoDownloadThreads={autoDownloadThreads}
                                setAutoDownloadThreads={setAutoDownloadThreads}
                                downloadThreads={downloadThreads}
                                setDownloadThreads={setDownloadThreads}
                                maxSockets={maxSockets}
                                setMaxSockets={setMaxSockets}
                                t={t}
                            />
                        )}

                        {activeTab === 'launcher' && (
                            <LauncherTab
                                hideLauncher={hideLauncher}
                                setHideLauncher={setHideLauncher}
                                showConsole={showConsole}
                                setShowConsole={setShowConsole}
                                t={t}
                                status={status}
                                updateInfo={updateInfo}
                                onCheckForUpdates={checkForUpdates}
                                onBeforeCheckForUpdates={() => setShowUpdateModal(false)}
                            />
                        )}
                    </Suspense>
                </div>

                <div className="flex justify-end pt-4 border-t border-zinc-100 dark:border-zinc-800">
                    <Button
                        onClick={onClose}
                        className={cn("text-white", getAccentStyles('bg').className)}
                        style={getAccentStyles('bg').style}
                    >
                        {t('settings.done')}
                    </Button>
                </div>
            </div>

            {showUpdateModal && (
                <Suspense fallback={
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md">
                        <LoadingSpinner size="lg" />
                    </div>
                }>
                    <UpdateModal
                        isOpen={showUpdateModal}
                        onClose={() => setShowUpdateModal(false)}
                        updateInfo={updateInfo}
                        progress={progress}
                        status={status as 'available' | 'downloading' | 'downloaded'}
                        onInstall={installUpdate}
                    />
                </Suspense>
            )}
        </Modal>
    );
};

export default SettingsPage;
