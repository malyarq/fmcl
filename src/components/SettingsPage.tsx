import React, { useEffect, useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useAppUpdater } from '../features/updater/hooks/useAppUpdater';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { cn } from '../utils/cn';
import { SettingsTabsHeader, type SettingsTabId } from './settings/SettingsTabsHeader';

// Import all tabs directly to avoid loading delay when switching tabs
import { AppearanceTab } from './settings/tabs/AppearanceTab';
import { DownloadsTab } from './settings/tabs/DownloadsTab';
import { LauncherTab } from './settings/tabs/LauncherTab';
import { UpdateModal } from './UpdateModal';

interface SettingsPageProps {
    onClose: () => void;
}

// Settings modal for appearance and launcher preferences.
const SettingsPage: React.FC<SettingsPageProps> = ({ onClose }) => {
    const [activeTab, setActiveTab] = useState<SettingsTabId>('appearance' as SettingsTabId);
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
                            minecraftPath={minecraftPath}
                            setMinecraftPath={setMinecraftPath}
                            t={t}
                            status={status}
                            updateInfo={updateInfo}
                            onCheckForUpdates={checkForUpdates}
                            onBeforeCheckForUpdates={() => setShowUpdateModal(false)}
                        />
                    )}
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
                <UpdateModal
                    isOpen={showUpdateModal}
                    onClose={() => setShowUpdateModal(false)}
                    updateInfo={updateInfo}
                    progress={progress}
                    status={status as 'available' | 'downloading' | 'downloaded'}
                    onInstall={installUpdate}
                />
            )}
        </Modal>
    );
};

export default SettingsPage;
