import { useState, useEffect, useRef } from 'react';
import { useSettings } from '../contexts/SettingsContext';

interface LaunchOptions {
    nickname: string;
    version: string;
    ram: number;
    hideLauncher: boolean;
}

export const useLauncher = () => {
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState('');
    const [logs, setLogs] = useState<string[]>([]);
    const [isLaunching, setIsLaunching] = useState(false);
    const logEndRef = useRef<HTMLDivElement>(null);

    const { t } = useSettings();

    useEffect(() => {
        const unsubLog = window.launcher.onLog((log) => {
            setLogs((prev) => [...prev, log]);
        });

        const unsubProgress = window.launcher.onProgress((data) => {
            if (
                data.type === 'assets' ||
                data.type === 'natives' ||
                data.type === 'classes' ||
                data.type === 'Forge' ||
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

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const handleLaunch = async (options: LaunchOptions) => {
        if (isLaunching) return;

        setIsLaunching(true);
        setProgress(0);
        setStatusText(t('status.initializing'));
        setLogs((prev) => [...prev, 'Starting launch sequence...']);

        try {
            await window.launcher.launch({
                nickname: options.nickname,
                version: options.version,
                ram: options.ram,
                hideLauncher: options.hideLauncher
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
        const btn = document.getElementById('copy-logs-btn');
        if (btn) {
            const originalText = btn.innerText;
            btn.innerText = 'Copied!';
            setTimeout(() => btn.innerText = originalText, 2000);
        }
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
