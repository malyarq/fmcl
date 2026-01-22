import { useState, useEffect } from 'react';
import TitleBar from './components/TitleBar';
import SettingsPage from './components/SettingsPage';
import MultiplayerPage from './components/MultiplayerPage';
import Sidebar from './components/Sidebar';
import { useSettings, SettingsProvider } from './contexts/SettingsContext';
import { useLauncher } from './hooks/useLauncher';
import { useVersions } from './hooks/useVersions';
import { getVersionHint } from './utils/minecraftVersions';

function App() {
  const [nickname, setNickname] = useState(() => localStorage.getItem('nickname') || 'Player');

  // Persist nickname
  useEffect(() => { localStorage.setItem('nickname', nickname); }, [nickname]);

  const [version, setVersion] = useState('1.12.2');
  const [showSettings, setShowSettings] = useState(false);
  const [showMultiplayer, setShowMultiplayer] = useState(false);

  // Global Settings from Context
  const {
    ram, hideLauncher, showConsole,
    getAccentStyles, t, theme,
    getAccentHex
  } = useSettings();


  // Launcher logic from custom hook
  const {
    isLaunching,
    progress,
    statusText,
    logs,
    logEndRef,
    handleLaunch: launchGame,
    copyLogs
  } = useLauncher();

  // Fetch Versions
  const { versions } = useVersions();

  const [useForge, setUseForge] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    // Network Status Listeners
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleLaunch = async () => {
    // Construct version string expected by backend
    const launchVersion = useForge ? `${version}-Forge` : version;

    await launchGame({
      nickname,
      version: launchVersion,
      ram,
      hideLauncher
    });
  };

  const currentHint = getVersionHint(version, t, getAccentStyles('text'));

  return (
    <div className={`${theme} flex flex-col h-screen w-full bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 overflow-hidden font-sans border border-zinc-300 dark:border-zinc-800`}>
      <TitleBar />

      {showSettings && <SettingsPage onClose={() => setShowSettings(false)} />}

      {showMultiplayer && <MultiplayerPage onBack={() => setShowMultiplayer(false)} />}

      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar
          nickname={nickname} setNickname={setNickname}
          version={version} setVersion={setVersion}
          versions={versions}
          useForge={useForge} setUseForge={setUseForge}
          isOffline={isOffline}
          isLaunching={isLaunching} progress={progress} statusText={statusText}
          onLaunch={handleLaunch}
          onShowMultiplayer={() => setShowMultiplayer(true)}
          onShowSettings={() => setShowSettings(true)}
          currentHint={currentHint}
        />

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
              <img
                src="/tray-icon.png"
                className="w-32 h-32 opacity-80 mb-4 transition-all duration-500"
                style={{ filter: `drop-shadow(0 0 25px ${getAccentHex()})` }}
              />
              <p className="text-3xl font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-700">
                <span className={getAccentStyles('text').className} style={getAccentStyles('text').style}>Friend</span>Launcher
              </p>
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
