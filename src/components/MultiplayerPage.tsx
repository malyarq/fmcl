import React, { useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';

const MultiplayerPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { getAccentStyles, getAccentClass, t } = useSettings();
    const [mode, setMode] = useState<'host' | 'join'>(() => (localStorage.getItem('mp_mode') as 'host' | 'join') || 'host');
    const [port, setPort] = useState(() => localStorage.getItem('mp_host_port') || '25565');
    const [roomCode, setRoomCode] = useState(() => localStorage.getItem('mp_room_code') || '');
    const [joinCode, setJoinCode] = useState(() => localStorage.getItem('mp_join_code') || '');
    const [mappedPort, setMappedPort] = useState<number | null>(() => {
        const stored = localStorage.getItem('mp_mapped_port');
        return stored ? parseInt(stored) : null;
    });
    const [status, setStatus] = useState('');

    React.useEffect(() => { localStorage.setItem('mp_mode', mode); }, [mode]);
    React.useEffect(() => { localStorage.setItem('mp_host_port', port); }, [port]);
    React.useEffect(() => { localStorage.setItem('mp_join_code', joinCode); }, [joinCode]);

    // Persist active state
    React.useEffect(() => { localStorage.setItem('mp_room_code', roomCode); }, [roomCode]);
    React.useEffect(() => {
        if (mappedPort) localStorage.setItem('mp_mapped_port', mappedPort.toString());
        else localStorage.removeItem('mp_mapped_port');
    }, [mappedPort]);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setStatus('Copied to clipboard!');
        setTimeout(() => setStatus(''), 2000);
    };

    const handleHost = async () => {
        if (!window.networkAPI) {
            setStatus('Error: Network API not loaded. Restart Launcher.');
            return;
        }
        setStatus(t('multiplayer.publishing'));
        try {
            const code = await window.networkAPI.host(parseInt(port) || 25565);
            setRoomCode(code);
            setStatus(t('multiplayer.room_active'));
        } catch (e: any) {
            setStatus(`Error: ${e.message}`);
        }
    };

    const handleJoin = async () => {
        if (!window.networkAPI) {
            setStatus('Error: Network API not loaded. Restart Launcher.');
            return;
        }
        setStatus('Joining room...');
        try {
            const localPort = await window.networkAPI.join(joinCode);
            setMappedPort(localPort);
            setStatus(`${t('multiplayer.tunnel_established')} localhost:${localPort}`);
        } catch (e: any) {
            setStatus(`Error: ${e.message}`);
        }
    };

    const handleStop = async () => {
        await window.networkAPI.stop();
        setRoomCode('');
        setMappedPort(null);
        setStatus('Session stopped.');
    };

    const buttonStyle = `w-full py-2 rounded-lg font-bold transition-transform active:scale-95 ${getAccentClass('bg-XXX-600 hover:bg-XXX-500')} text-white`;

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-zinc-300 dark:hover:bg-white/10 rounded-lg transition-colors"
                >
                    ←
                </button>
                <h2 className="text-2xl font-bold">{t('multiplayer.title')}</h2>
            </div>

            {/* Tabs */}
            <div className="flex bg-zinc-200/50 dark:bg-black/40 p-1 rounded-xl mb-6">
                <button
                    onClick={() => setMode('host')}
                    className={`flex-1 py-2 rounded-lg font-medium transition-all ${mode === 'host' ? 'bg-white dark:bg-white/20 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 dark:text-white/50 hover:text-zinc-800 dark:hover:text-white'
                        }`}
                >
                    {t('multiplayer.host')}
                </button>
                <button
                    onClick={() => setMode('join')}
                    className={`flex-1 py-2 rounded-lg font-medium transition-all ${mode === 'join' ? 'bg-white dark:bg-white/20 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 dark:text-white/50 hover:text-zinc-800 dark:hover:text-white'
                        }`}
                >
                    {t('multiplayer.join')}
                </button>
            </div>

            {/* Content */}
            {/* Content */}
            <div className="bg-zinc-100/40 dark:bg-black/40 backdrop-blur-md rounded-2xl border border-zinc-300/30 dark:border-white/10 p-6 flex-1 flex flex-col items-center justify-center text-zinc-900 dark:text-white">

                {mode === 'host' ? (
                    <div className="w-full max-w-sm space-y-4">
                        <p className="text-sm text-zinc-600 dark:text-white/60 text-center mb-4 whitespace-pre-line">
                            {t('multiplayer.host_desc')}
                        </p>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-white/50 mb-1">{t('multiplayer.lan_port')}</label>
                            <input
                                type="text"
                                value={port}
                                onChange={(e) => setPort(e.target.value)}
                                className="w-full bg-white/50 dark:bg-black/50 border border-zinc-300/50 dark:border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-zinc-400 dark:focus:border-white/30 text-center text-xl font-mono text-zinc-900 dark:text-white"
                                placeholder="e.g. 25565"
                            />
                        </div>

                        {!roomCode && (
                            <button onClick={handleHost} className={buttonStyle} style={getAccentStyles('bg')?.style}>
                                {t('multiplayer.create_room')}
                            </button>
                        )}

                        {roomCode && (
                            <div className="bg-green-500/20 border border-green-500/30 rounded-xl p-4 text-center">
                                <p className="text-green-600 dark:text-green-300 font-bold mb-2">{t('multiplayer.room_active')}</p>
                                <div
                                    onClick={() => copyToClipboard(roomCode)}
                                    className="bg-white/50 dark:bg-black/50 p-2 rounded cursor-pointer hover:bg-white/70 dark:hover:bg-black/60 transition-colors font-mono text-xs break-all text-zinc-800 dark:text-zinc-200"
                                >
                                    {roomCode}
                                </div>
                                <p className="text-xs text-green-600 dark:text-green-400 mt-2">{t('multiplayer.click_copy')}</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="w-full max-w-sm space-y-4">
                        <p className="text-sm text-zinc-600 dark:text-white/60 text-center mb-4">
                            {t('multiplayer.join_desc')}
                        </p>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-white/50 mb-1">{t('multiplayer.room_code')}</label>
                            <input
                                type="text"
                                value={joinCode}
                                onChange={(e) => setJoinCode(e.target.value)}
                                className="w-full bg-white/50 dark:bg-black/50 border border-zinc-300/50 dark:border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-zinc-400 dark:focus:border-white/30 font-mono text-xs text-zinc-900 dark:text-white"
                                placeholder="Paste long code here..."
                            />
                        </div>

                        {!mappedPort && (
                            <button onClick={handleJoin} className={buttonStyle} style={getAccentStyles('bg')?.style}>
                                {t('multiplayer.join_room')}
                            </button>
                        )}

                        {mappedPort && (
                            <div className="bg-blue-500/20 border border-blue-500/30 rounded-xl p-4 text-center">
                                <p className="text-blue-600 dark:text-blue-300 font-bold mb-2">{t('multiplayer.tunnel_established')}</p>
                                <p className="text-sm text-zinc-600 dark:text-white/80">
                                    {t('multiplayer.direct_connect')}
                                </p>
                                <p className="text-xl font-mono font-bold text-zinc-800 dark:text-white mt-2 select-all">
                                    localhost:{mappedPort}
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Status / Stop */}
                <div className="mt-6 w-full text-center space-y-4">
                    {status && <p className="text-amber-400 text-sm animate-pulse">{status}</p>}

                    {(roomCode || mappedPort) && (
                        <button
                            onClick={handleStop}
                            className="text-red-400 hover:text-red-300 text-sm underline"
                        >
                            {t('multiplayer.stop')}
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
};

export default MultiplayerPage;
