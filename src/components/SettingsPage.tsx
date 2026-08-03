import React, { useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useAppUpdater } from '../features/updater/hooks/useAppUpdater';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { cn } from '../utils/cn';
import { SettingsTabsHeader } from './settings/SettingsTabsHeader';
import {
    getSettingsPanelId,
    getSettingsTabLabelId,
    type SettingsTabId,
} from './settings/settingsTabs';

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
        uiScale, setUiScale,
        disableAnimations, setDisableAnimations,
        sidebarPosition, setSidebarPosition,
        compactMode, setCompactMode,
        getAccentStyles
    } = useSettings();

    // App updater hook (without auto-check)
    const { status, updateInfo, progress, checkForUpdates, downloadUpdate, installUpdate } = useAppUpdater(false);

    // Show update modal when update becomes available
    React.useEffect(() => {
        if (status === 'available' || status === 'downloading' || status === 'downloaded') {
            // Avoid synchronous setState in effect body (lint rule).
            const timer = setTimeout(() => setShowUpdateModal(true), 0);
            return () => clearTimeout(timer);
        }
    }, [status]);

    const renderActiveTab = () => {
        if (activeTab === 'appearance') {
            return <AppearanceTab embedded />;
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
                    embedded
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
                    uiScale={uiScale}
                    setUiScale={setUiScale}
                    disableAnimations={disableAnimations}
                    setDisableAnimations={setDisableAnimations}
                    sidebarPosition={sidebarPosition}
                    setSidebarPosition={setSidebarPosition}
                    compactMode={compactMode}
                    setCompactMode={setCompactMode}
                    onCheckForUpdates={checkForUpdates}
                    onBeforeCheckForUpdates={() => setShowUpdateModal(false)}
                    embedded
                />
            );
        }

        if (activeTab === 'storage') {
            return (
                <StorageSettings
                    t={t}
                    getAccentStyles={getAccentStyles}
                    modpacksIPC={modpacksIPC}
                    embedded
                />
            );
        }

        if (activeTab === 'accounts') {
            return <AccountsPage embedded />;
        }

        return <StatisticsTab embedded />;
    };

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title={t('settings.title')}
            className="max-w-[min(72rem,calc(100vw-1rem))]"
        >
            <div className="min-h-0 space-y-3">
                <div
                    data-testid="settings-shell-header"
                    className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
                >
                    <div className="min-w-0 flex-1">
                        <SettingsTabsHeader
                            activeTab={activeTab}
                            onTabChange={setActiveTab}
                            t={t}
                            getAccentStyles={(type) => getAccentStyles(type)}
                        />
                    </div>
                    <Button
                        onClick={onClose}
                        className={cn(
                            'w-full shrink-0 text-white sm:w-auto sm:min-w-[9rem]',
                            getAccentStyles('bg').className,
                        )}
                        style={getAccentStyles('bg').style}
                    >
                        {t('settings.done')}
                    </Button>
                </div>

                <div
                    id={getSettingsPanelId(activeTab)}
                    role="tabpanel"
                    aria-labelledby={getSettingsTabLabelId(activeTab)}
                    tabIndex={0}
                    className="settings-route-panel min-h-[22rem] outline-none p-4 sm:p-5"
                >
                    {renderActiveTab()}
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
                    onDownload={downloadUpdate}
                />
            )}
        </Modal>
    );
};

export default SettingsPage;
