import React from 'react';
import { useSettings } from '../contexts/SettingsContext';

const COLORS = [
    { id: 'emerald', class: 'bg-emerald-500', hover: 'hover:bg-emerald-400', ring: 'ring-emerald-500' },
    { id: 'blue', class: 'bg-blue-500', hover: 'hover:bg-blue-400', ring: 'ring-blue-500' },
    { id: 'purple', class: 'bg-purple-500', hover: 'hover:bg-purple-400', ring: 'ring-purple-500' },
    { id: 'orange', class: 'bg-orange-500', hover: 'hover:bg-orange-400', ring: 'ring-orange-500' },
    { id: 'rose', class: 'bg-rose-500', hover: 'hover:bg-rose-400', ring: 'ring-rose-500' },
];

interface SettingsPageProps {
    onClose: () => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ onClose }) => {
    const {
        ram, setRam,
        hideLauncher, setHideLauncher,
        accentColor, setAccentColor,
        showConsole, setShowConsole,
        javaPath, setJavaPath,
        installOptifine, setInstallOptifine
    } = useSettings();

    // Helper to get dynamic classes based on accent
    const isPreset = (c: string) => COLORS.some(col => col.id === c);

    // For local usage in SettingsPage, we can replicate similar logic or just use inline styles
    // Since this page is simpler, let's just use inline styles for the "done" button to match custom color
    // and for the header icon.

    // Actually, let's keep it consistent.
    const getAccentStyle = () => {
        if (isPreset(accentColor)) {
            // Basic map for just text color here
            const map: any = {
                emerald: 'text-emerald-400',
                blue: 'text-blue-400',
                purple: 'text-purple-400',
                orange: 'text-orange-400',
                rose: 'text-rose-400'
            };
            return { className: map[accentColor] || map.emerald };
        }
        return { style: { color: accentColor } };
    };

    return (
        <div className="absolute inset-0 z-40 bg-zinc-900/95 backdrop-blur-sm flex items-center justify-center p-8">
            <div className="bg-zinc-800 border border-zinc-700 w-full max-w-2xl rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-full">

                {/* Header */}
                <div className="p-6 border-b border-zinc-700 flex justify-between items-center bg-zinc-800/50">
                    <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                        <span className={getAccentStyle().className || ''} style={getAccentStyle().style}>⚙️</span> Launcher Settings
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-zinc-500 hover:text-white transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto custom-scrollbar space-y-8">

                    {/* Appearance Section */}
                    <section>
                        <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-4">Appearance</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-zinc-400 text-xs mb-3">Accent Color</label>
                                <div className="flex gap-4 items-center">
                                    {COLORS.map((c) => (
                                        <button
                                            key={c.id}
                                            onClick={() => setAccentColor(c.id as any)}
                                            className={`w-8 h-8 rounded-full transition-all duration-300 ${c.class} ${c.hover} ${accentColor === c.id ? `ring-2 ring-offset-2 ring-offset-zinc-800 ${c.ring} scale-110` : 'opacity-70 hover:opacity-100'}`}
                                            title={c.id.charAt(0).toUpperCase() + c.id.slice(1)}
                                        />
                                    ))}

                                    {/* Custom Color Picker */}
                                    <div className="relative group ml-2 flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full overflow-hidden relative ring-2 ring-zinc-700 group-hover:ring-zinc-500 transition-all">
                                            <input
                                                type="color"
                                                value={!isPreset(accentColor) ? accentColor : '#10b981'}
                                                onChange={(e) => setAccentColor(e.target.value)}
                                                className="absolute inset-0 w-[150%] h-[150%] -top-1/4 -left-1/4 cursor-pointer p-0 border-0"
                                            />
                                        </div>
                                        {!isPreset(accentColor) && (
                                            <span className="text-[10px] font-mono text-zinc-500 uppercase">{accentColor}</span>
                                        )}
                                        <span className="text-[10px] text-zinc-600 absolute -bottom-5 left-0 w-max opacity-0 group-hover:opacity-100 transition-opacity">Custom</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-3 bg-zinc-900/50 rounded border border-zinc-700/50">
                                <span className="text-zinc-300 text-sm">Show Developer Console</span>
                                <input
                                    type="checkbox"
                                    checked={showConsole}
                                    onChange={(e) => setShowConsole(e.target.checked)}
                                    className="w-4 h-4 rounded accent-current"
                                    style={!isPreset(accentColor) ? { accentColor: accentColor } : {}}
                                />
                            </div>
                        </div>
                    </section>

                    {/* Java & Performance Section */}
                    <section>
                        <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-4">Java & Performance</h3>
                        <div className="space-y-6">
                            {/* RAM Slider */}
                            <div>
                                <div className="flex justify-between mb-2">
                                    <label className="text-zinc-400 text-xs">Allocated Memory (RAM)</label>
                                    <span className={`text-xs font-bold ${getAccentStyle().className || ''}`} style={getAccentStyle().style}>{ram} GB</span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="16"
                                    step="0.5"
                                    value={ram}
                                    onChange={(e) => setRam(parseFloat(e.target.value))}
                                    className={`w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer ${isPreset(accentColor) ? `accent-${accentColor}-500` : ''}`}
                                    style={!isPreset(accentColor) ? { accentColor: accentColor } : {}}
                                />
                                <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
                                    <span>1 GB (Low)</span>
                                    <span>8 GB (Recommended)</span>
                                    <span>16 GB (Extreme)</span>
                                </div>
                            </div>

                            {/* Performance Mode */}
                            <div className="flex items-center justify-between p-3 bg-zinc-900/50 rounded border border-zinc-700/50">
                                <div>
                                    <p className="text-zinc-300 text-sm font-medium">Performance Mode</p>
                                    <p className="text-zinc-500 text-xs">Hide launcher window while playing to save resources.</p>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={hideLauncher}
                                    onChange={(e) => setHideLauncher(e.target.checked)}
                                    className="w-5 h-5 rounded cursor-pointer accent-current"
                                    style={!isPreset(accentColor) ? { accentColor: accentColor } : {}}
                                />
                            </div>

                            {/* OptiFine Toggle */}
                            <div className="flex items-center justify-between p-3 bg-zinc-900/50 rounded border border-zinc-700/50">
                                <div>
                                    <p className="text-zinc-300 text-sm font-medium flex items-center gap-2">
                                        Auto-Install OptiFine
                                        <span className={`text-[10px] px-1 py-0.5 rounded border ${isPreset(accentColor) ? 'bg-zinc-800 text-zinc-400 border-zinc-700' : 'bg-transparent border-current'}`} style={!isPreset(accentColor) ? { color: accentColor, borderColor: accentColor } : {}}>BETA</span>
                                    </p>
                                    <p className="text-zinc-500 text-xs">Automatically download and install OptiFine for supported versions.</p>
                                    <p className="text-[10px] text-zinc-600 mt-0.5 italic">Requires Forge enabled.</p>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={installOptifine}
                                    onChange={(e) => setInstallOptifine(e.target.checked)}
                                    className="w-5 h-5 rounded cursor-pointer accent-current"
                                    style={!isPreset(accentColor) ? { accentColor: accentColor } : {}}
                                />
                            </div>

                            {/* Java Path Override */}
                            <div>
                                <label className="block text-zinc-400 text-xs mb-2">Custom Java Path (Optional)</label>
                                <input
                                    type="text"
                                    value={javaPath}
                                    onChange={(e) => setJavaPath(e.target.value)}
                                    placeholder="Auto-detected (Default)"
                                    className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-sm text-zinc-300 focus:outline-none focus:border-zinc-500 transition-colors"
                                />
                                <p className="text-[10px] text-zinc-600 mt-1">Leave empty to let the launcher manage Java versions automatically.</p>
                            </div>
                        </div>
                    </section>
                </div>

                <div className="p-6 border-t border-zinc-700 bg-zinc-800/50 flex justify-end">
                    <button
                        onClick={onClose}
                        className={`px-6 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-sm font-medium transition-colors`}
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
