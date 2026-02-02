import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSettings, useUIMode } from '../contexts/SettingsContext';
import { useModpack } from '../contexts/ModpackContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { useToast } from '../contexts/ToastContext';
import { modpacksIPC } from '../services/ipc/modpacksIPC';
import { AddModModal } from './modpacks/AddModModal';
import { Button } from './ui/Button';
import { CollapsibleSection } from './ui/CollapsibleSection';
import { GameTab } from './settings/tabs/GameTab';
import { cn } from '../utils/cn';
import { modNameToSlug } from '../utils/modSlug';

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

export function SimplePlayDashboard({ launch, runtime, actions }: SimplePlayDashboardProps) {
  const { t, getAccentStyles, getAccentHex, minecraftPath } = useSettings();
  const { setMode } = useUIMode();
  const {
    effectiveModpackId,
    config: modpackConfig,
    setMemoryGb,
    setJavaPath,
    setVmOptions,
    setGameExtraArgs,
    setGameResolution,
    setAutoConnectServer,
  } = useModpack(); // в Classic — classic config и setters
  const modpackId = effectiveModpackId;

  const [showEasterEgg, setShowEasterEgg] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const clickTimestampsRef = useRef<number[]>([]);
  const easterEggTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const particleIdCounterRef = useRef(0);
  const lastClickTimeRef = useRef(0);
  const lastFireworksTimeRef = useRef(0);

  const accent = getAccentStyles('text');
  const accentHex = getAccentHex();
  const loaderLabel = LOADER_LABELS[launch.loaderType] ?? launch.loaderType;
  const showMods = launch.loaderType !== 'vanilla';

  const launchFireworks = useCallback(() => {
    const waveId = particleIdCounterRef.current++;
    const next = generateParticles(waveId);
    setParticles((prev) => [...prev, ...next].slice(-60));
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => !p.id.startsWith(`particle-${waveId}-`)));
    }, 2000);
  }, []);

  const handleLogoClick = useCallback(() => {
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
  }, [showEasterEgg, launchFireworks]);

  useEffect(() => {
    return () => {
      if (easterEggTimeoutRef.current) clearTimeout(easterEggTimeoutRef.current);
    };
  }, []);

  return (
    <div className="h-full w-full flex flex-col items-center px-4 py-6 md:px-6 overflow-y-auto overflow-x-hidden animate-fade-in-up">
      {/* Logo + easter egg — на фоне, без жёсткого бокса */}
      <div className="relative flex flex-col items-center gap-2 mb-6 overflow-visible w-full">
        <div
          role="button"
          tabIndex={0}
          onClick={handleLogoClick}
          onKeyDown={(e) => e.key === 'Enter' && handleLogoClick()}
          className="logo-container relative w-20 h-20 md:w-24 md:h-24 rounded-2xl overflow-visible cursor-pointer transition-all duration-300 ease-out hover:scale-110 active:scale-105"
          style={{ filter: `drop-shadow(0 0 24px ${accentHex}50) drop-shadow(0 0 48px ${accentHex}30)` }}
        >
          <div
            className="absolute -inset-6 rounded-full animate-pulse-slow pointer-events-none"
            style={{
              background: `radial-gradient(circle, ${accentHex}20 0%, transparent 60%)`,
              animation: showEasterEgg ? 'easter-egg-glow 0.5s ease-in-out infinite' : 'none',
            }}
          />
          <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-2xl shadow-black/20 border border-zinc-200/60 dark:border-zinc-700/60 bg-zinc-900/80 flex items-center justify-center backdrop-blur-sm">
            <img
              src="/icon.png"
              alt="FriendLauncher"
              className="w-16 h-16 md:w-20 md:h-20 object-contain transition-transform duration-300"
              style={{
                transform: showEasterEgg ? 'rotate(360deg) scale(1.2)' : 'none',
                filter: showEasterEgg ? `drop-shadow(0 0 15px ${accentHex})` : 'none',
              }}
            />
          </div>
        </div>
        <h1
          className={cn(
            'text-2xl md:text-3xl font-black tracking-tight drop-shadow-sm transition-all duration-300 relative z-10',
            accent.className,
            showEasterEgg && 'animate-pulse scale-110'
          )}
          style={{
            ...(accent.style ?? {}),
            textShadow: showEasterEgg
              ? `0 0 20px ${accentHex}, 0 0 40px ${accentHex}, 0 4px 14px ${accentHex}80`
              : `0 4px 14px ${accentHex}40`,
          }}
        >
          FriendLauncher
        </h1>
        {particles.map((p) => {
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
          .logo-container:hover { filter: drop-shadow(0 0 30px ${accentHex}80) drop-shadow(0 0 60px ${accentHex}60) !important; }
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

      {/* Mods (when modloader selected) - с кнопкой добавить для Classic */}
      {showMods && (
        <ModsSection
          modpackId={modpackId}
          minecraftPath={minecraftPath || undefined}
          t={t}
          getAccentStyles={getAccentStyles}
          showAddButton
          defaultMCVersion={launch.version}
          defaultLoader={launch.loaderType}
        />
      )}

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
          setJavaPath={setJavaPath}
          setVmOptions={setVmOptions}
          setGameExtraArgs={setGameExtraArgs}
          setGameResolution={setGameResolution}
          setAutoConnectServer={setAutoConnectServer}
          t={t}
          getAccentStyles={getAccentStyles}
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

type ModEntry = {
  id: string;
  name: string;
  version: string;
  loaders: string[];
  file: { path: string; name: string; size: number; mtimeMs: number };
  enabled?: boolean;
};

function ModsSection({
  modpackId,
  minecraftPath,
  t,
  getAccentStyles,
  showAddButton = false,
  defaultMCVersion,
  defaultLoader,
}: {
  modpackId: string;
  minecraftPath?: string;
  t: (k: string) => string;
  getAccentStyles?: (type: 'bg' | 'text') => { className?: string; style?: React.CSSProperties };
  showAddButton?: boolean;
  defaultMCVersion?: string;
  defaultLoader?: string;
}) {
  const [mods, setMods] = useState<ModEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModModal, setShowAddModModal] = useState(false);
  const confirm = useConfirm();
  const toast = useToast();

  const loadMods = useCallback(() => {
    setLoading(true);
    modpacksIPC
      .getMods(modpackId, minecraftPath)
      .then((list) => {
        const withEnabled = (list ?? []).map((m: ModEntry) => ({
          ...m,
          enabled: !m.file.name.endsWith('.disabled'),
        }));
        setMods(withEnabled);
      })
      .catch(() => setMods([]))
      .finally(() => setLoading(false));
  }, [modpackId, minecraftPath]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    modpacksIPC
      .getMods(modpackId, minecraftPath)
      .then((list) => {
        const withEnabled = (list ?? []).map((m: ModEntry) => ({
          ...m,
          enabled: !m.file.name.endsWith('.disabled'),
        }));
        if (!cancelled) setMods(withEnabled);
      })
      .catch(() => {
        if (!cancelled) setMods([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [modpackId, minecraftPath]);

  const handleRemoveMod = useCallback(
    async (mod: ModEntry) => {
      const confirmed = await confirm.confirm({
        title: t('modpacks.remove') || 'Remove mod',
        message:
          t('modpacks.remove_mod_confirm')?.replace('{{name}}', mod.name) || `Remove mod "${mod.name}"?`,
        variant: 'danger',
        confirmText: t('modpacks.remove') || 'Remove',
        cancelText: t('general.cancel') || 'Cancel',
      });
      if (confirmed) {
        try {
          await modpacksIPC.removeMod(modpackId, mod.file.name, minecraftPath);
          loadMods();
        } catch (error) {
          console.error('Error removing mod:', error);
          toast.error(t('modpacks.remove_mod_error') || 'Failed to remove mod');
        }
      }
    },
    [modpackId, minecraftPath, confirm, t, loadMods, toast]
  );

  const handleModToggle = useCallback(
    async (mod: ModEntry) => {
      const enabled = !(mod.enabled ?? true);
      setMods((prev) =>
        prev.map((m) => (m.id === mod.id ? { ...m, enabled } : m))
      );
      try {
        await modpacksIPC.setModEnabled(modpackId, mod.file.name, enabled, minecraftPath);
      } catch (error) {
        setMods((prev) =>
          prev.map((m) => (m.id === mod.id ? { ...m, enabled: !enabled } : m))
        );
        console.error('Error toggling mod:', error);
        toast.error(t('modpacks.mod_toggle_error') || 'Failed to toggle mod');
      }
    },
    [modpackId, minecraftPath, t, toast]
  );

  const accentStyle = getAccentStyles?.('bg').style ?? {};

  return (
    <section className="w-full max-w-2xl mt-6" aria-label={t('modpacks.tab_mods') || 'Mods'}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
          {t('modpacks.tab_mods') || 'Mods'} {!loading && `(${mods.length})`}
        </h2>
        {showAddButton && !loading && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowAddModModal(true)}
            style={accentStyle}
          >
            {t('modpacks.add') || 'Add'}
          </Button>
        )}
      </div>
      {loading ? (
        <div className="py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          {t('modpacks.loading') || 'Loading...'}
        </div>
      ) : mods.length === 0 ? (
        <div className="py-6 text-center text-sm text-zinc-500 dark:text-zinc-400 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/30">
          {t('modpacks.no_mods') || 'No mods in modpack'}
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 bg-white/60 dark:bg-zinc-800/60 p-3">
          {mods.map((mod) => (
            <div
              key={mod.id}
              className={cn(
                'flex items-start gap-3 py-2 px-3 rounded-lg border transition-all',
                mod.enabled ?? true
                  ? 'bg-zinc-100/80 dark:bg-zinc-900/40 border-zinc-200/60 dark:border-zinc-700/60'
                  : 'bg-zinc-100/50 dark:bg-zinc-800/40 border-zinc-300 dark:border-zinc-600 opacity-60'
              )}
            >
              <input
                type="checkbox"
                checked={mod.enabled ?? true}
                onChange={() => handleModToggle(mod)}
                className="mt-1 w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 focus:ring-2 focus:ring-zinc-500 dark:focus:ring-zinc-400"
              />
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    'font-medium truncate',
                    mod.enabled ?? true ? 'text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400'
                  )}
                >
                  {mod.name}
                </p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {t('modpacks.version')}: {mod.version}
                  </span>
                  {mod.loaders.length > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300">
                      {mod.loaders.join(', ')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">{mod.file.name}</p>
                <div className="flex gap-2 mt-1.5">
                  <a
                    href={`https://modrinth.com/mod/${modNameToSlug(mod.name)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Modrinth
                  </a>
                  <a
                    href={`https://www.curseforge.com/minecraft/mc-mods/${modNameToSlug(mod.name)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-orange-600 dark:text-orange-400 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    CurseForge
                  </a>
                </div>
              </div>
              <Button variant="danger" size="sm" onClick={() => handleRemoveMod(mod)}>
                {t('modpacks.remove') || 'Remove'}
              </Button>
            </div>
          ))}
        </div>
      )}
      {showAddButton && (
        <AddModModal
          modpackId={modpackId}
          isOpen={showAddModModal}
          onClose={() => setShowAddModModal(false)}
          onAdded={() => {
            loadMods();
            setShowAddModModal(false);
          }}
          defaultMCVersion={defaultMCVersion}
          defaultLoader={defaultLoader}
        />
      )}
    </section>
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

