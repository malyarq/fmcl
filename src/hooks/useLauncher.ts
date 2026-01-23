import { useState, useEffect, useRef } from 'react';
import { useSettings } from '../contexts/SettingsContext';

interface LaunchOptions {
    nickname: string;
    version: string;
    ram: number;
    hideLauncher: boolean;
    javaPath?: string;
    useOptiFine?: boolean;
}

export const useLauncher = () => {
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState('');
    const [logs, setLogs] = useState<string[]>([]);
    const [isLaunching, setIsLaunching] = useState(false);
    const logEndRef = useRef<HTMLDivElement>(null);

    const { t, javaPath, minecraftPath, downloadProvider, autoDownloadThreads, downloadThreads, maxSockets } = useSettings();

    // Subscribe to launcher events once for the active language.
    useEffect(() => {
        if (!window.launcher) {
            setStatusText(t('status.ready'));
            setLogs((prev) => [...prev, '[SYSTEM] Launcher API not available. Is preload loaded?']);
            return;
        }
        const unsubLog = window.launcher.onLog((log) => {
            setLogs((prev) => [...prev, log]);
        });

        const unsubProgress = window.launcher.onProgress((data) => {
            if (
                data.type === 'assets' ||
                data.type === 'natives' ||
                data.type === 'classes' ||
                data.type === 'Forge' ||
                data.type === 'OptiFine' ||
                data.type.startsWith('Java')
            ) {
                const percent = (data.task / data.total) * 100;
                setProgress(percent);
                setStatusText(`${t('status.download_progress')} ${data.type}: ${Math.round(percent)}%`);
            }
        });

        const unsubClose = window.launcher.onClose((code) => {
            setLogs((prev) => [...prev, `[SYSTEM] Game session ended (Code: ${code})`]);
            setStatusText(t('status.ready'));
            setIsLaunching(false);
        });

        return () => {
            unsubLog();
            unsubProgress();
            unsubClose();
        };
    }, [t]);

    // Auto-scroll logs view to the newest entry.
    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const handleLaunch = async (options: LaunchOptions) => {
        if (isLaunching) return;
        if (!window.launcher) {
            setStatusText('Launcher not available');
            setLogs((prev) => [...prev, '[SYSTEM] Launcher API not available. Is preload loaded?']);
            return;
        }

        setIsLaunching(true);
        setProgress(0);
        setStatusText(t('status.initializing'));
        setLogs((prev) => [...prev, 'Starting launch sequence...']);

        try {
            await window.launcher.launch({
                nickname: options.nickname,
                version: options.version,
                ram: options.ram,
                hideLauncher: options.hideLauncher,
                javaPath: options.javaPath ?? javaPath,
                gamePath: minecraftPath || undefined,
                downloadProvider,
                autoDownloadThreads,
                downloadThreads,
                maxSockets,
                useOptiFine: options.useOptiFine ?? false
            });
            setStatusText(t('status.game_running'));
        } catch (e) {
            setLogs((prev) => [...prev, `Error: ${e}`]);
            setStatusText('Launch Failed');
            setIsLaunching(false);
        }
    };

    const copyLogs = () => {
        navigator.clipboard.writeText(logs.join('\n'));
    };

    return {
        isLaunching,
        progress,
        statusText,
        logs,
        logEndRef,
        handleLaunch,
        copyLogs
    };
};
