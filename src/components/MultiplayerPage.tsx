import React, { useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';

const MultiplayerPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { getAccentStyles, getAccentClass } = useSettings();
    const [mode, setMode] = useState<'host' | 'join'>('host');
    const [port, setPort] = useState('25565'); // Default Minecraft LAN port
    const [roomCode, setRoomCode] = useState('');
    const [joinCode, setJoinCode] = useState('');
    const [mappedPort, setMappedPort] = useState<number | null>(null);
    const [status, setStatus] = useState('');

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
        setStatus('Publishing room...');
        try {
            const code = await window.networkAPI.host(parseInt(port) || 25565);
            setRoomCode(code);
            setStatus('Room created! Share code with friend.');
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
            setStatus(`Connected! Join connection at localhost:${localPort}`);
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
        <div className="flex flex-col h-full text-white/90">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                    ←
                </button>
                <h2 className="text-2xl font-bold">Multiplayer (Built-in Tunnel)</h2>
            </div>

            {/* Tabs */}
            <div className="flex bg-black/40 p-1 rounded-xl mb-6">
                <button
                    onClick={() => setMode('host')}
                    className={`flex-1 py-2 rounded-lg font-medium transition-all ${mode === 'host' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white'
                        }`}
                >
                    Host Game
                </button>
                <button
                    onClick={() => setMode('join')}
                    className={`flex-1 py-2 rounded-lg font-medium transition-all ${mode === 'join' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white'
                        }`}
                >
                    Join Game
                </button>
            </div>

            {/* Content */}
            <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 p-6 flex-1 flex flex-col items-center justify-center">

                {mode === 'host' ? (
                    <div className="w-full max-w-sm space-y-4">
                        <p className="text-sm text-white/60 text-center mb-4">
                            1. Open your world to LAN in Minecraft.<br />
                            2. Enter the port below (usually printed in chat).
                        </p>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-1">LAN Port</label>
                            <input
                                type="text"
                                value={port}
                                onChange={(e) => setPort(e.target.value)}
                                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-white/30 text-center text-xl font-mono"
                                placeholder="e.g. 25565"
                            />
                        </div>

                        {!roomCode && (
                            <button onClick={handleHost} className={buttonStyle} style={getAccentStyles('bg')?.style}>
                                Create Room
                            </button>
                        )}

                        {roomCode && (
                            <div className="bg-green-500/20 border border-green-500/30 rounded-xl p-4 text-center">
                                <p className="text-green-300 font-bold mb-2">Room Active!</p>
                                <div
                                    onClick={() => copyToClipboard(roomCode)}
                                    className="bg-black/50 p-2 rounded cursor-pointer hover:bg-black/60 transition-colors font-mono text-xs break-all"
                                >
                                    {roomCode}
                                </div>
                                <p className="text-xs text-green-400 mt-2">Click code to copy</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="w-full max-w-sm space-y-4">
                        <p className="text-sm text-white/60 text-center mb-4">
                            Paste the Room Code from your friend to connect.
                        </p>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-1">Room Code</label>
                            <input
                                type="text"
                                value={joinCode}
                                onChange={(e) => setJoinCode(e.target.value)}
                                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-white/30 font-mono text-xs"
                                placeholder="Paste long code here..."
                            />
                        </div>

                        {!mappedPort && (
                            <button onClick={handleJoin} className={buttonStyle} style={getAccentStyles('bg')?.style}>
                                Join Room
                            </button>
                        )}

                        {mappedPort && (
                            <div className="bg-blue-500/20 border border-blue-500/30 rounded-xl p-4 text-center">
                                <p className="text-blue-300 font-bold mb-2">Tunnel Established!</p>
                                <p className="text-sm text-white/80">
                                    Direct Connect in Minecraft to:
                                </p>
                                <p className="text-xl font-mono font-bold text-white mt-2 select-all">
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
                            Stop Session
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
};

export default MultiplayerPage;
