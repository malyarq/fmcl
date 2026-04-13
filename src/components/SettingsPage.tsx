import React, { useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useAppUpdater } from '../features/updater/hooks/useAppUpdater';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { cn } from '../utils/cn';
import { SettingsTabsHeader } from './settings/SettingsTabsHeader';
import { getSettingsPanelId, getSettingsTabId, type SettingsTabId } from './settings/settingsTabs';

// Import all tabs directly to avoid loading delay when switching tabs
import { AppearanceTab } from './settings/tabs/AppearanceTab';
import { DownloadsTab } from './settings/tabs/DownloadsTab';
import { LauncherTab } from './settings/tabs/LauncherTab';
import { UpdateModal } from './UpdateModal';
import { StorageSettings } from './settings/tabs/StorageTab';
import { modpacksIPC } from '../services/ipc/modpacksIPC';
import { AccountsPage } from '../features/accounts/AccountsPage';
import { StatisticsTab } from '../features/settings/statistics/StatisticsTab';

interface SettingsPageProps {
    onClose: () => void;
    initialTab?: SettingsTabId;
}

// Settings modal for appearance and launcher preferences.
const SettingsPage: React.FC<SettingsPageProps> = ({ onClose, initialTab = 'appearance' }) => {
    const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab);
    const [showUpdateModal, setShowUpdateModal] = useState(false);
    const {
        hideLauncher, setHideLauncher,
        showConsole, setShowConsole,
        t,
        minecraftPath, setMinecraftPath,
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

    const getPanelHint = () => {
        if (activeTab === 'accounts') {
            return t('accounts.description');
        }

        if (activeTab === 'downloads') {
            return t('settings.downloadsHint');
        }

        if (activeTab === 'launcher') {
            return t('settings.launcherHint');
        }

        if (activeTab === 'storage') {
            return t('settings.storage.description');
        }

        if (activeTab === 'statistics') {
            return t('stats.description');
        }

        return t('settings.doneHint');
    };

    const renderActiveTab = () => {
        if (activeTab === 'appearance') {
            return <AppearanceTab />;
        }

        if (activeTab === 'downloads') {
            return (
                <DownloadsTab
                    autoDownloadThreads={autoDownloadThreads}
                    setAutoDownloadThreads={setAutoDownloadThreads}
                    downloadThreads={downloadThreads}
                    setDownloadThreads={setDownloadThreads}
                    maxSockets={maxSockets}
                    setMaxSockets={setMaxSockets}
                    t={t}
                />
            );
        }

        if (activeTab === 'launcher') {
            return (
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
            );
        }

        if (activeTab === 'storage') {
            return (
                <StorageSettings
                    t={t}
                    getAccentStyles={getAccentStyles}
                    modpacksIPC={modpacksIPC}
                />
            );
        }

        if (activeTab === 'accounts') {
            return <AccountsPage />;
        }

        return <StatisticsTab />;
    };

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title={t('settings.title')}
            className="max-w-4xl"
        >
            <div className="space-y-4">
                <SettingsTabsHeader
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    t={t}
                    getAccentStyles={(type) => getAccentStyles(type)}
                />

                <div
                    id={getSettingsPanelId(activeTab)}
                    role="tabpanel"
                    aria-labelledby={getSettingsTabId(activeTab)}
                    tabIndex={0}
                    className="surface-panel min-h-[26rem] outline-none p-4 sm:p-5"
                >
                    {renderActiveTab()}
                </div>

                <div className="surface-inline flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-secondary">
                        {getPanelHint()}
                    </p>
                    <Button
                        onClick={onClose}
                        className={cn("text-white sm:min-w-[9rem]", getAccentStyles('bg').className)}
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
