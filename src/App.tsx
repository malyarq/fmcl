import { useState, useEffect, useRef } from 'react';
import TitleBar from './components/TitleBar';
import SettingsPage from './components/SettingsPage';
import MultiplayerPage from './components/MultiplayerPage';
import { useSettings, SettingsProvider } from './contexts/SettingsContext';
import pkg from '../package.json';

function App() {
  const [nickname, setNickname] = useState(() => localStorage.getItem('nickname') || 'Player');

  // Persist nickname
  useEffect(() => { localStorage.setItem('nickname', nickname); }, [nickname]);

  const [version, setVersion] = useState('1.12.2');
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [isLaunching, setIsLaunching] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMultiplayer, setShowMultiplayer] = useState(false);

  // Global Settings from Context
  const {
    ram, hideLauncher, showConsole,
    getAccentStyles, t, theme // Now from context
  } = useSettings();

  const [versions, setVersions] = useState<any[]>([]);
  const [useForge, setUseForge] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Network Status Listeners
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubLog = window.launcher.onLog((log) => {
      setLogs((prev) => [...prev, log]);
    });

    const unsubProgress = window.launcher.onProgress((data) => {
      // Allow known types and any custom "Java ..." types
      if (
        data.type === 'assets' ||
        data.type === 'natives' ||
        data.type === 'classes' ||
        data.type === 'Forge' ||
        data.type.startsWith('Java')
      ) {
        const percent = (data.task / data.total) * 100;
        setProgress(percent);
        setStatusText(`Downloading ${data.type}: ${Math.round(percent)}%`);
      }
    });

    const unsubClose = window.launcher.onClose((code) => {
      setLogs((prev) => [...prev, `[SYSTEM] Game session ended (Code: ${code})`]);
      setStatusText(t('status.ready'));
      setIsLaunching(false);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubLog();
      unsubProgress();
      unsubClose();
    };
  }, []);

  // Use Effect for Version Management with Caching
  useEffect(() => {
    const cachedVersions = localStorage.getItem('mc_versions');

    // Always try to fetch fresh if online
    fetch('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json')
      .then(res => res.json())
      .then(data => {
        const releases = data.versions.filter((v: any) => v.type === 'release');
        setVersions(releases);
        localStorage.setItem('mc_versions', JSON.stringify(releases));
        setLogs(prev => [...prev, 'Versions list updated from Mojang.']);
      })
      .catch(err => {
        console.warn('Network fetch failed, trying cache...', err);
        setLogs(prev => [...prev, 'Network unreachable. Trying cached versions...']);

        if (cachedVersions) {
          try {
            const parsed = JSON.parse(cachedVersions);
            setVersions(parsed);
            setLogs(prev => [...prev, 'Loaded versions from local cache.']);
          } catch (e) {
            console.error('Cache parse error', e);
          }
        }

        // Final fallback if cache is missing/broken
        if (!cachedVersions) {
          setVersions([{ id: '1.20.4' }, { id: '1.16.5' }, { id: '1.12.2' }, { id: '1.7.10' }]);
          setLogs(prev => [...prev, 'Cache missing. Using default safe list.']);
        }
      });
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleLaunch = async () => {
    if (isLaunching) return;
    setIsLaunching(true);
    setIsLaunching(true);
    setProgress(0);
    setStatusText(t('status.initializing'));
    setLogs((prev) => [...prev, 'Starting launch sequence...']);

    // Construct version string expected by backend
    const launchVersion = useForge ? `${version}-Forge` : version;

    try {
      await window.launcher.launch({
        nickname,
        version: launchVersion,
        ram,
        hideLauncher
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
    // Visual feedback could be added here, but simplest is just functionality
    const btn = document.getElementById('copy-logs-btn');
    if (btn) {
      const originalText = btn.innerText;
      btn.innerText = 'Copied!';
      setTimeout(() => btn.innerText = originalText, 2000);
    }
  };

  // Community/User Notes for specific versions
  const getVersionHint = (v: string) => {
    const accent = getAccentStyles('text');

    if (v === '1.6.4') return { text: `✅ ${t('hint.stable')}`, ...accent };
    if (v === '1.12.2') return { text: `🏆 ${t('hint.classic')}`, ...accent };
    if (v === '1.7.10') return { text: `⭐ ${t('hint.legendary')}`, ...accent };

    const major = parseInt(v.split('.')[1] || '0');
    const minor = parseInt(v.split('.')[2] || '0');

    if (v === '1.6.2' || v === '1.8.8' || v === '1.10.1') return { text: '⚠️ Known Issue: Forge Libraries (Scala)', className: 'text-amber-400' };
    if (v === '1.7.2') return { text: '⚠️ Known Issue: Forge Connection', className: 'text-amber-400' };
    if (v.startsWith('1.8') && v !== '1.8.9' && v !== '1.8.0') return { text: `❌ ${t('hint.no_forge')}`, className: 'text-red-400' };
    if (v.startsWith('1.9') && major === 9 && minor <= 3) return { text: `❌ ${t('hint.no_forge')}`, className: 'text-red-400' };
    if (v === '1.11.1') return { text: `❌ ${t('hint.no_forge')}`, className: 'text-red-400' };

    if (major >= 13) return { text: `🚧 ${t('hint.dev')}`, className: 'text-yellow-400' };

    if (v === '1.8.9' || v === '1.9.4' || v === '1.10') return { text: '⚠️ Potential Download Error', className: 'text-amber-400' };

    return null;
  };

  const currentHint = getVersionHint(version);

  return (
    <div className={`${theme} flex flex-col h-screen w-full bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 overflow-hidden font-sans border border-zinc-300 dark:border-zinc-800`}>
      <TitleBar />

      {showSettings && <SettingsPage onClose={() => setShowSettings(false)} />}

      {/* Multiplayer Overlay */}
      {showMultiplayer && (
        <div className="absolute inset-0 z-50 bg-zinc-200/95 dark:bg-zinc-900/95 flex items-center justify-center p-10 backdrop-blur-sm text-zinc-900 dark:text-white">
          <div className="w-full max-w-4xl h-full">
            <MultiplayerPage onBack={() => setShowMultiplayer(false)} />
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden relative">
        <div className="w-80 flex flex-col p-6 bg-zinc-200 dark:bg-zinc-800 border-r border-zinc-300 dark:border-zinc-700 shadow-xl z-10 relative">

          {/* Header Area */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1
                className={`text-2xl font-bold tracking-tighter ${getAccentStyles('text').className || ''}`}
                style={getAccentStyles('text').style}
              >
                FriendLauncher
              </h1>
              <p className="text-[10px] text-zinc-500 font-mono mt-1">BUILD v{pkg.version}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowMultiplayer(true)}
                className="p-2 text-zinc-400 hover:text-white dark:hover:text-white hover:bg-zinc-300 dark:hover:bg-zinc-700 rounded transition-colors"
                title="Multiplayer (Tunnel)"
              >
                🌐
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 text-zinc-400 hover:text-white dark:hover:text-white hover:bg-zinc-300 dark:hover:bg-zinc-700 rounded transition-colors"
                title="Settings"
              >
                ⚙️
              </button>
            </div>
          </div>

          <div className="space-y-5 flex-1 flex flex-col pt-2">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{t('general.nickname')}</label>
                {isOffline && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-500 border border-amber-200 dark:border-amber-800/50 uppercase tracking-wider">
                    {t('general.offline')}
                  </span>
                )}
              </div>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className={`w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded p-3 focus:outline-none transition-colors placeholder-zinc-400 dark:placeholder-zinc-600 text-zinc-900 dark:text-zinc-100 ${getAccentStyles('border').className || ''}`}
                style={getAccentStyles('border').style}
                placeholder="Steve"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">{t('general.version')}</label>
              <select
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                className={`w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded p-3 focus:outline-none transition-colors text-zinc-900 dark:text-zinc-100 ${getAccentStyles('border').className || ''}`}
                style={getAccentStyles('border').style}
              >
                {versions.map(v => (
                  <option key={v.id} value={v.id}>{v.id}</option>
                ))}
              </select>
              {currentHint && (
                <p
                  className={`text-xs mt-2 font-medium ${currentHint.className || ''}`}
                  style={currentHint.style}
                >
                  {currentHint.text}
                </p>
              )}
            </div>

            <div className="flex items-center space-x-3 bg-zinc-200 dark:bg-zinc-900 p-3 rounded border border-zinc-300 dark:border-zinc-700">
              <input
                type="checkbox"
                id="forge-toggle"
                checked={useForge}
                onChange={(e) => setUseForge(e.target.checked)}
                className="w-4 h-4 rounded cursor-pointer accent-current"
              />
              <label htmlFor="forge-toggle" className="text-sm text-zinc-600 dark:text-zinc-300 cursor-pointer select-none">
                {t('forge.enable')}
              </label>
            </div>


          </div>

          <div className="space-y-3 mt-6">
            {isLaunching && (
              <div className="w-full bg-zinc-900 dark:bg-zinc-900 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ease-out ${getAccentStyles('bg').className || ''}`}
                  style={{ width: `${progress}%`, ...getAccentStyles('bg').style }}
                />
              </div>
            )}
            <div className="text-center text-xs text-zinc-500 min-h-[1rem]">
              {statusText}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleLaunch}
                disabled={isLaunching}
                className={`flex-1 py-4 rounded font-bold text-lg tracking-wide uppercase transition-all transform active:scale-95 shadow-lg relative overflow-hidden group ${isLaunching
                  ? 'bg-zinc-300 dark:bg-zinc-600 text-zinc-500 dark:text-zinc-400 cursor-not-allowed'
                  : 'text-white shadow-black/20 ' + (getAccentStyles('bg').className || '')
                  }`}
                style={!isLaunching ? getAccentStyles('bg').style : {}}
              >
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="relative z-10">
                  {isLaunching ? t('general.running') : t('general.play')}
                </span>
              </button>

              {isLaunching && (
                <button
                  onClick={() => window.location.reload()} // Quick dirty kill switch for now
                  className="px-4 bg-red-100 dark:bg-red-900/50 hover:bg-red-200 dark:hover:bg-red-800 text-red-600 dark:text-red-200 rounded font-bold text-xs uppercase"
                  title="Force Restart Launcher"
                >
                  X
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Main Content Area (Logs or Placeholder) */}
        <div className="flex-1 flex flex-col bg-zinc-50 dark:bg-zinc-950 min-w-0 transition-all duration-300">
          {showConsole ? (
            <div className="flex flex-col h-full p-6">
              <div className="flex justify-between items-center mb-4 flex-shrink-0">
                <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-600 animate-pulse"></span>
                  {t('console.output')}
                </h2>
                <button onClick={copyLogs} className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">Copy</button>
              </div>
              <div className="flex-1 bg-white dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-800/50 p-4 font-mono text-xs text-zinc-600 dark:text-zinc-400 overflow-y-auto custom-scrollbar shadow-inner">
                {logs.length === 0 && <div className="h-full flex items-center justify-center text-zinc-400 dark:text-zinc-700 opacity-50">Waiting for game...</div>}
                {logs.map((log, i) => (
                  <div key={i} className="mb-0.5 break-words leading-relaxed">{log}</div>
                ))}
                <div ref={logEndRef} />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-500 p-10 select-none">
              <img src="/tray-icon.png" className="w-32 h-32 opacity-80 mb-4 invert dark:invert-0" />
              <p className="text-3xl font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-700">FriendLauncher</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const AppWrapped = () => (
  <SettingsProvider>
    <App />
  </SettingsProvider>
);

export default AppWrapped;
