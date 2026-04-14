import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useLauncherIPC } from '../launcher/hooks/useLauncherIPC';
import { useSettings } from '../../contexts/SettingsContext';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { cn } from '../../utils/cn';
import { dialogIPC } from '../../services/ipc/dialogIPC';
import type { LaunchStage } from '../launcher/services/launcherService';
// import { ArrowLeft, ArrowUp, ArrowDown, Send, Filter, Search, RotateCcw, Copy, Trash2 } from 'lucide-react';

interface LogEntry {
    id: string;
    timestamp: string;
    level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
    content: string;
    raw: string;
}

// Basic Minecraft commands list
const COMMANDS = [
    'help', 'gamemode', 'gamerule', 'give', 'time', 'weather', 'tp', 'kill', 'op', 'deop',
    'stop', 'say', 'list', 'save-all', 'save-off', 'save-on', 'ban', 'pardon', 'kick',
    'whitelist', 'difficulty', 'effect', 'enchant', 'experience', 'fill', 'locate', 'me',
    'particle', 'playsound', 'reload', 'seed', 'setblock', 'setworldspawn', 'spawnpoint',
    'spreadplayers', 'stopsound', 'summon', 'tag', 'team', 'teleport', 'tell', 'tellraw',
    'testfor', 'title', 'trigger', 'videostream', 'worldborder', 'xp'
];

export function ConsolePage() {
  const { t } = useSettings();
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [input, setInput] = useState('');
    const [history, setHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [autoScroll, setAutoScroll] = useState(true);
    const [filterLevel, setFilterLevel] = useState<('INFO' | 'WARN' | 'ERROR' | 'DEBUG')[]>(['INFO', 'WARN', 'ERROR', 'DEBUG']);
    const [searchQuery, setSearchQuery] = useState('');
    const logEndRef = useRef<HTMLDivElement>(null);
    const launchStageRef = useRef<LaunchStage>('idle');

    const [isSuggestionsDismissed, setIsSuggestionsDismissed] = useState(false);

    const suggestions = useMemo(() => {
        if (isSuggestionsDismissed) return [];
        if (!input.trim()) return [];
        const cleanInput = input.startsWith('/') ? input.slice(1) : input;
        if (cleanInput.includes(' ')) return [];
        return COMMANDS.filter(c => c.startsWith(cleanInput.toLowerCase())).slice(0, 5);
    }, [input, isSuggestionsDismissed]);

    const [selectedSuggestion, setSelectedSuggestion] = useState(0);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInput(e.target.value);
        setSelectedSuggestion(0);
        setIsSuggestionsDismissed(false);
    };

    const applySuggestion = (suggestion: string) => {
        const prefix = input.startsWith('/') ? '/' : '';
        setInput(prefix + suggestion + ' ');
        // Suggestions will clear automatically because input has space
    };

    const { sendStdin } = useLauncherIPC({
        t,
        onAppendLog: (rawLog) => {
            const entry = parseLog(rawLog);
            setLogs((prev) => [...prev, entry]);
        },
        onSetProgress: () => { },
        onSetStatusText: () => { },
        onSetStatusDetail: () => { },
        onSetLaunchStage: (stage) => {
            launchStageRef.current = stage;
        },
        onSetLaunching: () => { },
        getLaunchStage: () => launchStageRef.current,
    });

    const parseLog = (raw: string): LogEntry => {
        const timestampMatch = raw.match(/^\[(\d{2}:\d{2}:\d{2})\]/);
        const timestamp = timestampMatch ? timestampMatch[1] : new Date().toLocaleTimeString();

        let level: LogEntry['level'] = 'INFO';
        if (raw.includes('ERROR') || raw.includes('Exception') || raw.includes('Fatal')) level = 'ERROR';
        else if (raw.includes('WARN')) level = 'WARN';
        else if (raw.includes('DEBUG')) level = 'DEBUG';

        // Very basic content extraction, can be improved
        const content = raw;

        return {
            id: Math.random().toString(36).substr(2, 9),
            timestamp,
            level,
            content,
            raw
        };
    };

    useEffect(() => {
        if (autoScroll) {
            logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, autoScroll]);

    const handleSend = async (cmd?: string) => {
        const textToSend = cmd || input;
        if (!textToSend.trim()) return;

        await sendStdin(textToSend + '\n');
        setHistory(prev => [textToSend, ...prev]);
        setHistoryIndex(-1);
        setInput('');

        // Optimistically add command to log
        setLogs(prev => [...prev, {
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toLocaleTimeString(),
            level: 'INFO',
            content: `> ${textToSend}`,
            raw: `> ${textToSend}`
        }]);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (suggestions.length > 0) {
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedSuggestion(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
                return;
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedSuggestion(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
                return;
            } else if (e.key === 'Tab' || e.key === 'Enter') {
                e.preventDefault();
                applySuggestion(suggestions[selectedSuggestion]);
                return;
            } else if (e.key === 'Escape') {
                setIsSuggestionsDismissed(true);
                return;
            }
        }

        if (e.key === 'Enter') {
            handleSend();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (historyIndex < history.length - 1) {
                const newIndex = historyIndex + 1;
                setHistoryIndex(newIndex);
                setInput(history[newIndex]);
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex > 0) {
                const newIndex = historyIndex - 1;
                setHistoryIndex(newIndex);
                setInput(history[newIndex]);
            } else if (historyIndex === 0) {
                setHistoryIndex(-1);
                setInput('');
            }
        }
    };

    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            if (!filterLevel.includes(log.level)) return false;
            if (searchQuery && !log.content.toLowerCase().includes(searchQuery.toLowerCase())) return false;
            return true;
        });
    }, [logs, filterLevel, searchQuery]);

    const toggleFilter = (level: LogEntry['level']) => {
        setFilterLevel(prev =>
            prev.includes(level)
                ? prev.filter(l => l !== level)
                : [...prev, level]
        );
    };

    const getLevelColor = (level: LogEntry['level']) => {
        switch (level) {
            case 'ERROR': return 'text-red-500 font-bold';
            case 'WARN': return 'text-yellow-500';
            case 'DEBUG': return 'text-zinc-500';
            default: return 'text-zinc-300';
        }
    };

    const copyLogs = () => {
        navigator.clipboard.writeText(logs.map(l => l.raw).join('\n'));
    };

    const clearLogs = () => {
        setLogs([]);
    };

    return (
        <div className="h-screen w-screen flex flex-col bg-zinc-950 text-zinc-100 font-mono text-sm overflow-hidden">
            {/* Header / Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-zinc-100">Console</span>
                    <div className="h-4 w-[1px] bg-zinc-700 mx-2" />
                    <div className="flex items-center gap-1 bg-zinc-800 rounded-md p-1">
                        <span className="text-zinc-400 ml-1 text-xs">🔍</span>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search logs..."
                            className="bg-transparent border-none outline-none text-xs w-32 md:w-48 placeholder-zinc-500"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex bg-zinc-800 rounded-md overflow-hidden">
                        {(['INFO', 'WARN', 'ERROR', 'DEBUG'] as const).map(level => (
                            <button
                                key={level}
                                onClick={() => toggleFilter(level)}
                                className={cn(
                                    "px-2 py-1 text-xs transition-colors hover:bg-zinc-700",
                                    filterLevel.includes(level) ? "bg-zinc-700 text-zinc-100" : "text-zinc-500",
                                    level === 'ERROR' && filterLevel.includes(level) && "text-red-400",
                                    level === 'WARN' && filterLevel.includes(level) && "text-yellow-400"
                                )}
                            >
                                {level}
                            </button>
                        ))}
                    </div>
                    <div className="h-4 w-[1px] bg-zinc-700 mx-1" />
                    <button onClick={() => setAutoScroll(!autoScroll)} className={cn("p-1.5 rounded hover:bg-zinc-800 transition-colors", autoScroll && "bg-zinc-800 text-green-400")}>
                        <span className="text-xs">Scroll</span>
                    </button>
                    <button onClick={copyLogs} className="p-1.5 rounded hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-100">
                        <span className="text-xs">Copy</span>
                    </button>
                    <button onClick={clearLogs} className="p-1.5 rounded hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-red-400">
                        <span className="text-xs">Clear</span>
                    </button>
                    <div className="h-4 w-[1px] bg-zinc-700 mx-1" />
                    <button onClick={async () => {
                        try {
                            const content = logs.map(l => l.raw).join('\n');
                            const { canceled, filePath } = await dialogIPC.showSaveDialog({
                                title: 'Export Logs',
                                defaultPath: 'latest.log',
                                filters: [{ name: 'Log Files', extensions: ['log', 'txt'] }]
                            });

                            if (!canceled && filePath) {
                                await window.api.ipcRenderer.invoke('app:saveFile', filePath, content);
                            }
                        } catch (err) {
                            console.error('Failed to export logs:', err);
                        }
                    }} className="p-1.5 rounded hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-blue-400">
                        <span className="text-xs">Export</span>
                    </button>
                </div>
            </div>

            {/* Logs Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-0.5 custom-scrollbar bg-zinc-950">
                {filteredLogs.map((log) => (
                    <div key={log.id} className="flex gap-2 hover:bg-zinc-900/50 px-1 rounded">
                        <span className="text-zinc-600 shrink-0 select-none">[{log.timestamp}]</span>
                        <span className={cn("shrink-0 w-12 font-bold", getLevelColor(log.level))}>[{log.level}]</span>
                        <span className={cn("break-all whitespace-pre-wrap", getLevelColor(log.level), log.level === 'INFO' && 'text-zinc-300')}>{log.content}</span>
                    </div>
                ))}
                <div ref={logEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-zinc-900 border-t border-zinc-800 relative">
                {/* Suggestions Popover */}
                {suggestions.length > 0 && (
                    <div className="absolute bottom-full left-4 mb-2 bg-zinc-800 border border-zinc-700 rounded-md shadow-xl overflow-hidden min-w-[200px]">
                        {suggestions.map((suggestion, index) => (
                            <button
                                key={suggestion}
                                onClick={() => applySuggestion(suggestion)}
                                className={cn(
                                    "w-full text-left px-3 py-1.5 text-xs font-mono transition-colors",
                                    index === selectedSuggestion
                                        ? "bg-indigo-600 text-white"
                                        : "text-zinc-300 hover:bg-zinc-700"
                                )}
                            >
                                {input.startsWith('/') ? '/' : ''}{suggestion}
                            </button>
                        ))}
                    </div>
                )}
                <div className="flex gap-2">
                    <Input
                        value={input}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a command..."
                        className="flex-1 bg-zinc-950 border-zinc-800 text-zinc-100 focus:ring-zinc-700 font-mono"
                        autoFocus
                    />
                    <Button onClick={() => handleSend()} variant="secondary" className="px-3" disabled={!input.trim()}>
                        <span className="text-xs">Send</span>
                    </Button>
                </div>
            </div>
        </div>
    );
}
