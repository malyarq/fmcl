import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useSettings, useUIMode } from '../contexts/SettingsContext';
import { useModpack } from '../contexts/ModpackContext';
import { modpacksIPC } from '../services/ipc/modpacksIPC';
import { resourcePacksIPC } from '../services/ipc/resourcePacksIPC';
import { shadersIPC } from '../services/ipc/shadersIPC';
import { ModsTab } from './modpacks/details/ModsTab';
import { Button } from './ui/Button';
import { CollapsibleSection } from './ui/CollapsibleSection';
import { GameTab } from './settings/tabs/GameTab';
import { ResourcePacksTab } from './modpacks/details/ResourcePacksTab';
import { ShadersTab } from './modpacks/details/ShadersTab';
import { WorldsTab } from './modpacks/details/WorldsTab';
import { cn } from '../utils/cn';

interface Particle {
  id: string;
  angle: number;
  distance: number;
  duration: number;
  delay: number;
  size: number;
}

const LOADER_LABELS: Record<string, string> = {
  vanilla: 'Vanilla',
  forge: 'Forge',
  fabric: 'Fabric',
  neoforge: 'NeoForge',
};

export type SimplePlayDashboardProps = {
  launch: {
    version: string;
    nickname: string;
    loaderType: 'vanilla' | 'forge' | 'fabric' | 'neoforge';
    ram: number;
    isOffline: boolean;
  };
  runtime: {
    isLaunching: boolean;
    onLaunch: () => void;
  };
  actions: {
    onShowMultiplayer: () => void;
    onShowSettings: () => void;
  };
};

function generateParticles(baseId: number): Particle[] {
  const count = 15;
  const out: Particle[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      id: `particle-${baseId}-${i}`,
      angle: (360 / count) * i + Math.random() * 20 - 10,
      distance: 150 + Math.random() * 100,
      duration: 1.2 + Math.random() * 0.3,
      delay: Math.random() * 0.2,
      size: 16 + Math.random() * 10,
    });
  }
  return out;
}

export function SimplePlayDashboard({ launch, runtime: _runtime, actions: _actions }: SimplePlayDashboardProps) {
  const { t, getAccentStyles, getAccentHex, minecraftPath, disableAnimations } = useSettings();
  const { setMode } = useUIMode();
  const {
    effectiveModpackId,
    config: modpackConfig,
    setMemoryGb,
    setMinMemoryGb,
    setJavaPath,
    setVmOptions,
    setGameExtraArgs,
    setGameResolution,
    setAutoConnectServer,
    modpacks, // Use modpacks to find the path
  } = useModpack(); // в Classic — classic config и setters
  const modpackId = effectiveModpackId;
  const currentModpack = modpacks.find((m) => m.id === modpackId);
  const targetPath = currentModpack?.path || minecraftPath || undefined;

  const [resolvedPath, setResolvedPath] = useState<string>('');

  useEffect(() => {
    if (!targetPath && modpackId) {
      modpacksIPC.resolvePath(modpackId)
        .then((path: string) => {
          console.log('[SimplePlayDashboard] Resolved path via IPC:', path);
          setResolvedPath(path);
        })
        .catch((err: Error) => console.error('Failed to resolve path:', err));
    }
  }, [targetPath, modpackId]);

  const effectivePath = targetPath || resolvedPath || undefined;

  // Debug logs removed


  const [showEasterEgg, setShowEasterEgg] = useState(false);
  const [showWelcome, setShowWelcome] = useState(() => {
    return localStorage.getItem('simple_play_welcome_dismissed') !== 'true';
  });
  const [particles, setParticles] = useState<Particle[]>([]);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const clickTimestampsRef = useRef<number[]>([]);
  const easterEggTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const particleIdCounterRef = useRef(0);
  const lastClickTimeRef = useRef(0);
  const lastFireworksTimeRef = useRef(0);

  const accent = getAccentStyles('text');
  const accentHex = getAccentHex();
  const loaderLabel = LOADER_LABELS[launch.loaderType] ?? launch.loaderType;
  const showMods = launch.loaderType !== 'vanilla';
  const reducedMotion = disableAnimations || prefersReducedMotion;

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => {
      setPrefersReducedMotion(mediaQuery.matches);
    };

    updatePreference();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updatePreference);
    } else {
      mediaQuery.addListener(updatePreference);
    }

    return () => {
      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', updatePreference);
      } else {
        mediaQuery.removeListener(updatePreference);
      }
    };
  }, []);

  const launchFireworks = useCallback(() => {
    if (reducedMotion) {
      return;
    }

    const waveId = particleIdCounterRef.current++;
    const next = generateParticles(waveId);
    setParticles((prev) => [...prev, ...next].slice(-60));
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => !p.id.startsWith(`particle-${waveId}-`)));
    }, 2000);
  }, [reducedMotion]);

  const handleLogoClick = useCallback(() => {
    if (reducedMotion) {
      return;
    }

    const now = Date.now();
    clickTimestampsRef.current.push(now);
    lastClickTimeRef.current = now;
    clickTimestampsRef.current = clickTimestampsRef.current.filter((ts) => now - ts < 2000);
    const n = clickTimestampsRef.current.length;
    if (n < 7) return;
    if (!showEasterEgg) {
      setShowEasterEgg(true);
      setTimeout(launchFireworks, 800);
    } else if (now - lastFireworksTimeRef.current > 200) {
      lastFireworksTimeRef.current = now;
      launchFireworks();
    }
    if (easterEggTimeoutRef.current) clearTimeout(easterEggTimeoutRef.current);
    easterEggTimeoutRef.current = setTimeout(() => {
      if (Date.now() - lastClickTimeRef.current >= 2000) {
        setShowEasterEgg(false);
        setParticles([]);
        clickTimestampsRef.current = [];
      }
    }, 2000);
  }, [showEasterEgg, launchFireworks, reducedMotion]);

  const handleDismissWelcome = useCallback(() => {
    setShowWelcome(false);
    localStorage.setItem('simple_play_welcome_dismissed', 'true');
  }, []);

  useEffect(() => {
    return () => {
      if (easterEggTimeoutRef.current) clearTimeout(easterEggTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!reducedMotion) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShowEasterEgg(false);
      setParticles([]);
      clickTimestampsRef.current = [];
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [reducedMotion]);

  return (
    <div className={cn(
      'h-full w-full flex flex-col items-center px-4 py-6 md:px-6 overflow-y-auto overflow-x-hidden',
      !reducedMotion && 'animate-fade-in-up'
    )}>
      {/* Welcome Banner */}
      {showWelcome && (
        <div className={cn(
          'w-full max-w-2xl mb-6 p-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 flex flex-col sm:flex-row items-center gap-4 relative',
          !reducedMotion && 'animate-in fade-in slide-in-from-top-4'
        )}>
          <div className="text-3xl">👋</div>
          <div className="flex-1 text-center sm:text-left">
            <h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-100">
              {t('dashboard.welcome_title') || 'Welcome!'}
            </h3>
            <p className="text-sm text-indigo-700 dark:text-indigo-300 mt-1">
              {t('dashboard.welcome_desc') || 'This is Simple Play mode...'}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleDismissWelcome}
            className="shrink-0"
          >
            {t('dashboard.dismiss') || 'Dismiss'}
          </Button>
        </div>
      )}

      {/* Logo + easter egg — на фоне, без жёсткого бокса */}
      <div className="relative flex flex-col items-center gap-2 mb-6 overflow-visible w-full">
        <button
          type="button"
          onClick={handleLogoClick}
          aria-label="FriendLauncher logo"
          className={cn(
            'logo-container motion-safe-transform relative w-20 h-20 md:w-24 md:h-24 rounded-2xl overflow-visible cursor-pointer',
            reducedMotion
              ? 'transition-none'
              : 'transition-all duration-300 ease-out hover:scale-110 active:scale-105'
          )}
          style={{ filter: `drop-shadow(0 0 24px ${accentHex}50) drop-shadow(0 0 48px ${accentHex}30)` }}
        >
          <div
            className="absolute -inset-6 rounded-full animate-pulse-slow pointer-events-none"
            style={{
              background: `radial-gradient(circle, ${accentHex}20 0%, transparent 60%)`,
              animation: !reducedMotion && showEasterEgg ? 'easter-egg-glow 0.5s ease-in-out infinite' : 'none',
            }}
          />
          <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-2xl shadow-black/20 border border-zinc-200/60 dark:border-zinc-700/60 bg-zinc-900/80 flex items-center justify-center backdrop-blur-sm">
            <img
              src="/icon.png"
              alt="FriendLauncher"
              className="w-16 h-16 md:w-20 md:h-20 object-contain transition-transform duration-300"
              style={{
                transform: !reducedMotion && showEasterEgg ? 'rotate(360deg) scale(1.2)' : 'none',
                filter: !reducedMotion && showEasterEgg ? `drop-shadow(0 0 15px ${accentHex})` : 'none',
              }}
            />
          </div>
        </button>
        <h1
          className={cn(
            'text-2xl md:text-3xl font-black tracking-tight drop-shadow-sm transition-all duration-300 relative z-10',
            accent.className,
            !reducedMotion && showEasterEgg && 'animate-pulse scale-110'
          )}
          style={{
            ...(accent.style ?? {}),
            textShadow: !reducedMotion && showEasterEgg
              ? `0 0 20px ${accentHex}, 0 0 40px ${accentHex}, 0 4px 14px ${accentHex}80`
              : `0 4px 14px ${accentHex}40`,
          }}
        >
          FriendLauncher
        </h1>
        {!reducedMotion && particles.map((p) => {
          const ar = (p.angle * Math.PI) / 180;
          const x = Math.cos(ar) * p.distance;
          const y = Math.sin(ar) * p.distance;
          return (
            <div
              key={p.id}
              className="absolute pointer-events-none firework-particle"
              style={
                {
                  left: '50%',
                  top: '50%',
                  width: `${p.size}px`,
                  height: `${p.size}px`,
                  '--particle-x': `${x}px`,
                  '--particle-y': `${y}px`,
                  '--particle-rotation': `${p.angle + 360}deg`,
                  '--particle-duration': `${p.duration}s`,
                  '--particle-delay': `${p.delay}s`,
                  '--accent-color': accentHex,
                } as React.CSSProperties & {
                  '--particle-x': string;
                  '--particle-y': string;
                  '--particle-rotation': string;
                  '--particle-duration': string;
                  '--particle-delay': string;
                  '--accent-color': string;
                }
              }
            >
              <img src="/icon.png" alt="" className="w-full h-full object-contain" style={{ filter: `drop-shadow(0 0 6px ${accentHex}) drop-shadow(0 0 12px ${accentHex}60)` }} />
            </div>
          );
        })}
        <style>{`
          @keyframes pulse-slow {
            0%, 100% { opacity: 0.3; transform: scale(1); }
            50% { opacity: 0.6; transform: scale(1.05); }
          }
          @keyframes easter-egg-glow {
            0%, 100% { opacity: 0.5; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.2); }
          }
          @keyframes firework-particle {
            0% { opacity: 1; transform: translate(-50%, -50%) translate(0, 0) rotate(0deg) scale(1); filter: drop-shadow(0 0 6px var(--accent-color)) drop-shadow(0 0 12px var(--accent-color)); }
            50% { opacity: 0.8; transform: translate(-50%, -50%) translate(calc(var(--particle-x) * 0.5), calc(var(--particle-y) * 0.5)) rotate(calc(var(--particle-rotation) * 0.5)) scale(1.05); filter: drop-shadow(0 0 8px var(--accent-color)) drop-shadow(0 0 16px var(--accent-color)); }
            100% { opacity: 0; transform: translate(-50%, -50%) translate(var(--particle-x), var(--particle-y)) rotate(var(--particle-rotation)) scale(0.2); filter: drop-shadow(0 0 2px var(--accent-color)) drop-shadow(0 0 4px var(--accent-color)); }
          }
          .firework-particle { animation: firework-particle var(--particle-duration) ease-out var(--particle-delay) forwards; will-change: transform, opacity; }
          .animate-pulse-slow { animation: pulse-slow 3s ease-in-out infinite; }
          .logo-container:hover { filter: ${reducedMotion ? `drop-shadow(0 0 24px ${accentHex}50) drop-shadow(0 0 48px ${accentHex}30)` : `drop-shadow(0 0 30px ${accentHex}80) drop-shadow(0 0 60px ${accentHex}60)`} !important; }
        `}</style>
      </div>

      {/* Info panel */}
      <section className="w-full max-w-2xl mb-6" aria-label={t('dashboard.info_panel') || 'Current settings'}>
        <h2 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
          {t('dashboard.current_settings') || 'Current settings'}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <InfoCard
            label={t('modpacks.minecraft_version') || 'Minecraft version'}
            value={launch.version}
          />
          <InfoCard
            label={t('general.modloader') || 'Modloader'}
            value={loaderLabel}
          />
          <InfoCard
            label={t('dashboard.ram') || 'RAM'}
            value={`${launch.ram} GB`}
          />
          <InfoCard
            label={t('dashboard.connection') || 'Connection'}
            value={launch.isOffline ? (t('general.offline') || 'Offline') : (t('dashboard.online') || 'Online')}
            highlight={launch.isOffline}
          />
        </div>
      </section>

      {/* Настройки игры для Classic — свой конфиг, отдельно от модпаков */}
      <CollapsibleSection
        title={t('dashboard.advanced_settings') || 'Расширенные настройки'}
        defaultExpanded={false}
        storageKey="classic_game_settings_expanded"
        className="w-full max-w-2xl mt-6"
      >
        <GameTab
          modpackConfig={modpackConfig}
          setMemoryGb={setMemoryGb}
          setMinMemoryGb={setMinMemoryGb}
          setJavaPath={setJavaPath}
          setVmOptions={setVmOptions}
          setGameExtraArgs={setGameExtraArgs}
          setGameResolution={setGameResolution}
          setAutoConnectServer={setAutoConnectServer}
          t={t}
          getAccentStyles={getAccentStyles}
        />
      </CollapsibleSection>

      {/* Контент: Моды, Ресурспаки, Шейдеры, Миры */}
      <CollapsibleSection
        title={t('dashboard.content') || 'Контент'}
        defaultExpanded={false}
        storageKey="classic_content_expanded"
        className="w-full max-w-2xl mt-4"
      >
        <ContentManagerSection
          minecraftPath={effectivePath}
          t={t}
          showMods={showMods}
          modpackId={modpackId}
          defaultMCVersion={launch.version}
          defaultLoader={launch.loaderType}
        />
      </CollapsibleSection>

      {/* Go to Modpacks */}
      <button
        type="button"
        onClick={() => setMode('modpacks')}
        className="mt-8 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 underline underline-offset-2 transition-colors"
      >
        {t('dashboard.go_to_modpacks') || 'Go to Modpacks'}
      </button>
    </div>
  );
}



function InfoCard({
  label,
  value,
  highlight,
}: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={cn(
        'p-3 rounded-xl border bg-white/60 dark:bg-zinc-800/60 backdrop-blur-sm',
        highlight
          ? 'border-amber-300 dark:border-amber-600/60'
          : 'border-zinc-200/80 dark:border-zinc-700/80'
      )}
    >
      <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider truncate">
        {label}
      </p>
      <p className={cn(
        'mt-0.5 text-sm font-semibold truncate',
        highlight && 'text-amber-600 dark:text-amber-400'
      )}>
        {value}
      </p>
    </div>
  );
}

type ContentTab = 'mods' | 'resourcepacks' | 'shaders' | 'worlds';

function ContentManagerSection({
  minecraftPath,
  t,
  showMods = false,
  modpackId,
  defaultMCVersion,
  defaultLoader,
}: {
  minecraftPath?: string;
  t: (k: string) => string;
  showMods?: boolean;
  modpackId?: string;
  defaultMCVersion?: string;
  defaultLoader?: string;
}) {
  const { getAccentHex } = useSettings();
  const accentHex = getAccentHex();
  const [activeTab, setActiveTab] = useState<ContentTab>(showMods ? 'mods' : 'resourcepacks');
  const instancePath = minecraftPath || '';

  const [rpUpdateKey, setRpUpdateKey] = useState(0);
  const [shUpdateKey, setShUpdateKey] = useState(0);

  const onAddRP = useCallback(async () => {
    if (!instancePath) return;
    await resourcePacksIPC.add(instancePath);
    setRpUpdateKey(k => k + 1);
  }, [instancePath]);

  const onAddSH = useCallback(async () => {
    if (!instancePath) return;
    await shadersIPC.add(instancePath);
    setShUpdateKey(k => k + 1);
  }, [instancePath]);

  if (!instancePath) {
    return (
      <div className="text-center py-4 text-zinc-500 text-sm">
        {t('dashboard.no_minecraft_path') || 'Minecraft path not set'}
      </div>
    );
  }

  const tabs: { key: ContentTab; label: string }[] = [
    ...(showMods ? [{ key: 'mods' as ContentTab, label: t('modpacks.tab_mods') || 'Моды' }] : []),
    { key: 'resourcepacks', label: t('modpacks.tab_resourcepacks') || 'Ресурспаки' },
    { key: 'shaders', label: t('modpacks.tab_shaders') || 'Шейдеры' },
    { key: 'worlds', label: t('modpacks.tab_worlds') || 'Миры' },
  ];

  return (
    <div className="space-y-4">
      {/* Tab buttons */}
      <div
        className="flex gap-2 border-b border-zinc-200 dark:border-zinc-700 overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none' }}
        onWheel={(e) => {
          if (e.deltaY !== 0) {
            e.currentTarget.scrollLeft += e.deltaY;
            e.preventDefault();
          }
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap',
              activeTab !== tab.key && 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            )}
            style={activeTab === tab.key ? {
              borderColor: accentHex,
              color: accentHex
            } : undefined}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {/* Tab content */}
      <div className="w-full">
        {activeTab === 'mods' && modpackId && (
          <ModsTab
            modpackId={modpackId}
            instancePath={instancePath}
            showAddButton={true}
            defaultMCVersion={defaultMCVersion}
            defaultLoader={defaultLoader}
          />
        )}
        {activeTab === 'resourcepacks' && (
          <ResourcePacksTab
            key={rpUpdateKey}
            instancePath={instancePath}
            onAddResourcePack={onAddRP}
          />
        )}
        {activeTab === 'shaders' && (
          <ShadersTab
            key={shUpdateKey}
            instancePath={instancePath}
            onAddShader={onAddSH}
          />
        )}
        {activeTab === 'worlds' && <WorldsTab instancePath={instancePath} mcVersion={defaultMCVersion} />}
      </div>
    </div>
  );
}
