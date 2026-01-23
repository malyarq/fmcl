import { useState, useEffect } from 'react';
import TitleBar from './components/TitleBar';
import SettingsPage from './components/SettingsPage';
import MultiplayerPage from './components/MultiplayerPage';
import Sidebar from './components/Sidebar';
import { UpdateNotification } from './components/UpdateNotification';
import { useSettings, SettingsProvider } from './contexts/SettingsContext';
import { useLauncher } from './hooks/useLauncher';
import { useAppUpdater } from './hooks/useAppUpdater';
import { useVersions, useModSupportedVersions } from './hooks/useVersions';
import { getVersionHint } from './utils/minecraftVersions';

function App() {
  const [nickname, setNickname] = useState(() => localStorage.getItem('nickname') || 'Player');

  // Persist nickname across sessions.
  useEffect(() => { localStorage.setItem('nickname', nickname); }, [nickname]);

  const [version, setVersion] = useState('1.12.2');
  const [showSettings, setShowSettings] = useState(false);
  const [showMultiplayer, setShowMultiplayer] = useState(false);
  // In dev mode, Vite dev server serves files from public, so use direct path
  // In production, we'll update this via IPC
  const [iconPath, setIconPath] = useState(() => 
    import.meta.env.DEV ? '/icon.png' : '/icon.png'
  );

  const {
    ram, hideLauncher, showConsole,
    getAccentStyles, t, theme,
    getAccentHex
  } = useSettings();

  const {
    isLaunching,
    progress,
    statusText,
    logs,
    logEndRef,
    handleLaunch: launchGame,
    copyLogs
  } = useLauncher();

  const { versions } = useVersions();
  const { forgeVersions, fabricVersions, optiFineVersions, neoForgeVersions } = useModSupportedVersions();

  // App updater with auto-check on mount
  const { status: updateStatus, updateInfo, installUpdate } = useAppUpdater(true);

  const [useForge, setUseForge] = useState(false);
  const [useFabric, setUseFabric] = useState(false);
  const [useOptiFine, setUseOptiFine] = useState(false);
  const [useNeoForge, setUseNeoForge] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Auto-disable mods when version changes and mod is not supported
  useEffect(() => {
    let shouldUpdate = false;
    const updates: Array<() => void> = [];
    
    if (useForge && !forgeVersions.includes(version)) {
      updates.push(() => setUseForge(false));
      shouldUpdate = true;
    }
    if (useFabric && !fabricVersions.includes(version)) {
      updates.push(() => setUseFabric(false));
      shouldUpdate = true;
    }
    if (useOptiFine && !optiFineVersions.includes(version)) {
      updates.push(() => setUseOptiFine(false));
      shouldUpdate = true;
    }
    if (useNeoForge && !neoForgeVersions.includes(version)) {
      updates.push(() => setUseNeoForge(false));
      shouldUpdate = true;
    }
    
    if (shouldUpdate) {
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => {
        updates.forEach(update => update());
      }, 0);
    }
  }, [version, forgeVersions, fabricVersions, optiFineVersions, neoForgeVersions, useForge, useFabric, useOptiFine, useNeoForge]);

  // Auto-disable OptiFine when Forge is disabled (OptiFine only works with Forge)
  useEffect(() => {
    if (!useForge && useOptiFine) {
      setTimeout(() => {
        setUseOptiFine(false);
      }, 0);
    }
  }, [useForge, useOptiFine]);

  useEffect(() => {
    // Network status listeners for offline indicator.
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Get icon path from Electron (only in production, dev uses direct path)
  useEffect(() => {
    // In production, use IPC to get correct path
    if (!import.meta.env.DEV && window.assets?.getIconPath) {
      window.assets.getIconPath().then(path => {
        setIconPath(path);
      }).catch(() => {
        // Fallback to default path if IPC fails
        setIconPath('/icon.png');
      });
    }
  }, []);


  const handleLaunch = async () => {
    // Construct version string expected by backend.
    // Priority: NeoForge > Forge > Fabric (only one modloader can be active)
    let launchVersion = version;
    if (useNeoForge) {
      launchVersion = `${version}-NeoForge`;
    } else if (useForge) {
      launchVersion = `${version}-Forge`;
    } else if (useFabric) {
      launchVersion = `${version}-Fabric`;
    }

    await launchGame({
      nickname,
      version: launchVersion,
      ram,
      hideLauncher,
      useOptiFine
    });
  };

  const currentHint = getVersionHint(version, t, getAccentStyles('text'));

  return (
    <div className={theme === 'dark' ? 'dark h-full w-full' : 'h-full w-full'}>
      <div className="flex flex-col h-screen w-full bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-hidden font-sans border border-zinc-200 dark:border-zinc-800 shadow-2xl">
        <UpdateNotification
          status={updateStatus}
          updateInfo={updateInfo}
          onInstall={installUpdate}
        />
        <TitleBar />

        {showSettings && <SettingsPage onClose={() => setShowSettings(false)} />}

        {showMultiplayer && <MultiplayerPage onBack={() => setShowMultiplayer(false)} />}

        <div className="flex flex-1 overflow-hidden relative">
          <Sidebar
            nickname={nickname} setNickname={setNickname}
            version={version} setVersion={setVersion}
            versions={versions}
            useForge={useForge} setUseForge={setUseForge}
            useFabric={useFabric} setUseFabric={setUseFabric}
            useOptiFine={useOptiFine} setUseOptiFine={setUseOptiFine}
            useNeoForge={useNeoForge} setUseNeoForge={setUseNeoForge}
            isOffline={isOffline}
            isLaunching={isLaunching} progress={progress} statusText={statusText}
            onLaunch={handleLaunch}
            onShowMultiplayer={() => setShowMultiplayer(true)}
            onShowSettings={() => setShowSettings(true)}
            currentHint={currentHint}
            forgeSupportedVersions={forgeVersions}
            fabricSupportedVersions={fabricVersions}
            optiFineSupportedVersions={optiFineVersions}
            neoForgeSupportedVersions={neoForgeVersions}
          />

          <div className="flex-1 flex flex-col bg-gradient-to-br from-zinc-50/50 to-white dark:from-zinc-950 dark:to-zinc-900 min-w-0 transition-all duration-300">
            {showConsole ? (
              <div className="flex flex-col h-full p-6">
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                  <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-600 animate-pulse"></span>
                    {t('console.output')}
                  </h2>
                  <button onClick={copyLogs} className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">Copy</button>
                </div>
                <div className="flex-1 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 p-4 font-mono text-xs text-zinc-600 dark:text-zinc-400 overflow-y-auto custom-scrollbar shadow-2xl shadow-black/10 dark:shadow-black/30 select-text">
                  {logs.length === 0 && <div className="h-full flex items-center justify-center text-zinc-400 dark:text-zinc-700 opacity-50">Waiting for game...</div>}
                  {logs.map((log, i) => (
                    <div key={i} className="mb-0.5 break-words leading-relaxed select-text">{log}</div>
                  ))}
                  <div ref={logEndRef} />
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-500 p-10 select-none">
                <div className="relative mb-6">
                  <img
                    src={iconPath}
                    className="w-32 h-32 opacity-90 mb-4 transition-all duration-500 hover:scale-105"
                    style={{ 
                      filter: `drop-shadow(0 0 30px ${getAccentHex()}) drop-shadow(0 0 60px ${getAccentHex()}40)`,
                    }}
                    onError={(e) => {
                      // Fallback to default path if image fails to load
                      if (e.currentTarget.src !== '/icon.png' && !e.currentTarget.src.includes('icon.png')) {
                        e.currentTarget.src = '/icon.png';
                      }
                    }}
                  />
                  <div 
                    className="absolute inset-0 w-32 h-32 opacity-30 blur-2xl -z-10 transition-all duration-500"
                    style={{ 
                      backgroundColor: getAccentHex(),
                      transform: 'translateY(8px)',
                    }}
                  />
                </div>
                <p className="text-4xl font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-700 drop-shadow-lg">
                  <span 
                    className={getAccentStyles('text').className} 
                    style={{
                      ...getAccentStyles('text').style,
                      textShadow: `0 0 20px ${getAccentHex()}40, 0 2px 4px rgba(0,0,0,0.3)`,
                    }}
                  >
                    Friend
                  </span>
                  <span className="opacity-60">Launcher</span>
                </p>
              </div>
            )}
          </div>
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
