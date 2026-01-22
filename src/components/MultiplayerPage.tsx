import React, { useState, useEffect } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { cn } from '../utils/cn';

interface MultiplayerPageProps {
    onBack: () => void;
}

const MultiplayerPage: React.FC<MultiplayerPageProps> = ({ onBack }) => {
    const { t, getAccentStyles } = useSettings();
    const [mode, setMode] = useState<'host' | 'join'>(() => (localStorage.getItem('mp_mode') as 'host' | 'join') || 'host');
    const [port, setPort] = useState(() => localStorage.getItem('mp_host_port') || '25565');
    const [roomCode, setRoomCode] = useState(() => localStorage.getItem('mp_room_code') || '');
    const [joinCode, setJoinCode] = useState(() => localStorage.getItem('mp_join_code') || '');
    const [mappedPort, setMappedPort] = useState<number | null>(() => {
        const stored = localStorage.getItem('mp_mapped_port');
        return stored ? parseInt(stored) : null;
    });
    const [status, setStatus] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => { localStorage.setItem('mp_mode', mode); }, [mode]);
    useEffect(() => { localStorage.setItem('mp_host_port', port); }, [port]);
    useEffect(() => { localStorage.setItem('mp_join_code', joinCode); }, [joinCode]);
    useEffect(() => { localStorage.setItem('mp_room_code', roomCode); }, [roomCode]);
    useEffect(() => {
        if (mappedPort) localStorage.setItem('mp_mapped_port', mappedPort.toString());
        else localStorage.removeItem('mp_mapped_port');
    }, [mappedPort]);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setStatus(t('general.copied'));
        setTimeout(() => setStatus(''), 2000);
    };

    const handleHost = async () => {
        if (!(window as any).networkAPI) {
            setStatus('Error: Network API not loaded.');
            return;
        }
        setIsLoading(true);
        setStatus(t('multiplayer.publishing'));
        try {
            const code = await (window as any).networkAPI.host(parseInt(port) || 25565);
            setRoomCode(code);
            setStatus(t('multiplayer.room_active'));
        } catch (e: any) {
            setStatus(`Error: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleJoin = async () => {
        if (!(window as any).networkAPI) {
            setStatus('Error: Network API not loaded.');
            return;
        }
        setIsLoading(true);
        setStatus(t('multiplayer.joining'));
        try {
            const localPort = await (window as any).networkAPI.join(joinCode);
            setMappedPort(localPort);
            setStatus(`${t('multiplayer.tunnel_established')} localhost:${localPort}`);
        } catch (e: any) {
            setStatus(`Error: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleStop = async () => {
        await (window as any).networkAPI.stop();
        setRoomCode('');
        setMappedPort(null);
        setStatus(t('multiplayer.session_stopped'));
    };

    return (
        <Modal
            isOpen={true}
            onClose={onBack}
            title={t('multiplayer.title')}
            className="max-w-md"
        >
            <div className="flex flex-col gap-6">
                {/* Mode Switcher */}
                <div className="flex bg-zinc-100 dark:bg-zinc-900/50 p-1 rounded-lg border border-zinc-200 dark:border-zinc-700">
                    {['host', 'join'].map((m) => (
                        <button
                            key={m}
                            onClick={() => setMode(m as any)}
                            className={cn(
                                "flex-1 py-2 text-sm font-bold uppercase rounded-md transition-all",
                                mode === m
                                    ? cn("shadow-md text-white", getAccentStyles('bg').className)
                                    : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                            )}
                            style={mode === m ? getAccentStyles('bg').style : undefined}
                        >
                            {t(`multiplayer.${m}`)}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="min-h-[250px] flex flex-col justify-center">
                    {mode === 'host' ? (
                        <div className="space-y-4">
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 text-center px-4 whitespace-pre-line">
                                {t('multiplayer.host_desc')}
                            </p>

                            {!roomCode ? (
                                <>
                                    <Input
                                        label={t('multiplayer.lan_port')}
                                        value={port}
                                        onChange={(e) => setPort(e.target.value)}
                                        placeholder="25565"
                                        className="text-center font-mono"
                                    />
                                    <Button onClick={handleHost} isLoading={isLoading} className="w-full">
                                        {t('multiplayer.create_room')}
                                    </Button>
                                </>
                            ) : (
                                <div className="space-y-4">
                                    <div
                                        onClick={() => copyToClipboard(roomCode)}
                                        className={cn(
                                            "border rounded-xl p-4 text-center cursor-pointer hover:brightness-95 dark:hover:brightness-110 transition-all group",
                                            getAccentStyles('soft-bg').className,
                                            getAccentStyles('soft-border').className
                                        )}
                                        style={{
                                            ...getAccentStyles('soft-bg').style,
                                            ...getAccentStyles('soft-border').style
                                        }}
                                    >
                                        <p className={cn("font-bold mb-2 uppercase text-xs tracking-wider", getAccentStyles('text').className)} style={getAccentStyles('text').style}>{t('multiplayer.room_active')}</p>
                                        <p className="font-mono text-sm break-all text-zinc-900 dark:text-zinc-100 group-hover:scale-105 transition-transform">{roomCode}</p>
                                        <p className={cn("text-[10px] mt-2 opacity-70", getAccentStyles('text').className)} style={getAccentStyles('text').style}>{t('multiplayer.click_copy')}</p>
                                    </div>
                                    <Button variant="danger" onClick={handleStop} className="w-full">
                                        {t('multiplayer.stop')}
                                    </Button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 text-center px-4">
                                {t('multiplayer.join_desc')}
                            </p>

                            {!mappedPort ? (
                                <>
                                    <Input
                                        label={t('multiplayer.room_code')}
                                        value={joinCode}
                                        onChange={(e) => setJoinCode(e.target.value)}
                                        placeholder={t('multiplayer.code_placeholder')}
                                        className="font-mono text-center text-xs"
                                    />
                                    <Button onClick={handleJoin} isLoading={isLoading} className="w-full">
                                        {t('multiplayer.join_room')}
                                    </Button>
                                </>
                            ) : (
                                <div className="space-y-4">
                                    <div className={cn(
                                        "border rounded-xl p-4 text-center",
                                        getAccentStyles('soft-bg').className,
                                        getAccentStyles('soft-border').className
                                    )}
                                        style={{
                                            ...getAccentStyles('soft-bg').style,
                                            ...getAccentStyles('soft-border').style
                                        }}
                                    >
                                        <p className={cn("font-bold mb-2 uppercase text-xs tracking-wider", getAccentStyles('text').className)} style={getAccentStyles('text').style}>{t('multiplayer.tunnel_established')}</p>
                                        <p className="text-xl font-mono font-bold text-zinc-900 dark:text-white select-all">
                                            localhost:{mappedPort}
                                        </p>
                                        <p className={cn("text-xs mt-2 opacity-70", getAccentStyles('text').className)} style={getAccentStyles('text').style}>{t('multiplayer.direct_connect')}</p>
                                    </div>
                                    <Button variant="danger" onClick={handleStop} className="w-full">
                                        {t('multiplayer.stop')}
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Status Message */}
                {status && (
                    <div className="text-center">
                        <p className="text-amber-500 text-xs font-medium animate-pulse">{status}</p>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default MultiplayerPage;
