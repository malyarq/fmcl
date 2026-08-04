import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Boxes, Settings2, Sparkles } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import { cn } from '../../utils/cn';
import { BrandMark } from '../branding/BrandMark';
import { Button } from '../ui/Button';

interface Particle {
  id: string;
  angle: number;
  distance: number;
  duration: number;
  delay: number;
  size: number;
}

export interface ClassicHeroProps {
  name: string;
  subtitle: string;
  description: string;
  busy: boolean;
  onShowSettings: () => void;
  onShowModpacks: () => void;
}

const WELCOME_DISMISSED_KEY = 'simple_play_welcome_dismissed';

function generateParticles(baseId: number): Particle[] {
  const count = 15;
  return Array.from({ length: count }, (_, index) => ({
    id: `particle-${baseId}-${index}`,
    angle: (360 / count) * index + Math.random() * 20 - 10,
    distance: 150 + Math.random() * 100,
    duration: 1.2 + Math.random() * 0.3,
    delay: Math.random() * 0.2,
    size: 16 + Math.random() * 10,
  }));
}

function readWelcomeVisibility(): boolean {
  try {
    return localStorage.getItem(WELCOME_DISMISSED_KEY) !== 'true';
  } catch {
    return true;
  }
}

export function ClassicHero({
  name,
  subtitle,
  description,
  busy,
  onShowSettings,
  onShowModpacks,
}: ClassicHeroProps) {
  const { t, getAccentHex, disableAnimations } = useSettings();
  const [showWelcome, setShowWelcome] = useState(readWelcomeVisibility);
  const [showEasterEgg, setShowEasterEgg] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const clickTimestampsRef = useRef<number[]>([]);
  const easterEggTimeoutRef = useRef<number | null>(null);
  const particleTimeoutsRef = useRef(new Set<number>());
  const particleIdCounterRef = useRef(0);
  const lastClickTimeRef = useRef(0);
  const lastFireworksTimeRef = useRef(0);

  const accentHex = getAccentHex();
  const reducedMotion = disableAnimations || prefersReducedMotion;

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);
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
    if (reducedMotion) return;

    const waveId = particleIdCounterRef.current++;
    setParticles((current) => [...current, ...generateParticles(waveId)].slice(-60));
    const timeoutId = window.setTimeout(() => {
      particleTimeoutsRef.current.delete(timeoutId);
      setParticles((current) => current.filter((particle) => !particle.id.startsWith(`particle-${waveId}-`)));
    }, 2000);
    particleTimeoutsRef.current.add(timeoutId);
  }, [reducedMotion]);

  const handleLogoClick = useCallback(() => {
    if (reducedMotion) return;

    const now = Date.now();
    lastClickTimeRef.current = now;
    clickTimestampsRef.current = [...clickTimestampsRef.current, now].filter((timestamp) => now - timestamp < 2000);
    if (clickTimestampsRef.current.length < 7) return;

    if (!showEasterEgg) {
      setShowEasterEgg(true);
      const timeoutId = window.setTimeout(() => {
        particleTimeoutsRef.current.delete(timeoutId);
        launchFireworks();
      }, 800);
      particleTimeoutsRef.current.add(timeoutId);
    } else if (now - lastFireworksTimeRef.current > 200) {
      lastFireworksTimeRef.current = now;
      launchFireworks();
    }

    if (easterEggTimeoutRef.current !== null) window.clearTimeout(easterEggTimeoutRef.current);
    easterEggTimeoutRef.current = window.setTimeout(() => {
      if (Date.now() - lastClickTimeRef.current >= 2000) {
        setShowEasterEgg(false);
        setParticles([]);
        clickTimestampsRef.current = [];
      }
    }, 2000);
  }, [launchFireworks, reducedMotion, showEasterEgg]);

  const handleDismissWelcome = useCallback(() => {
    setShowWelcome(false);
    try {
      localStorage.setItem(WELCOME_DISMISSED_KEY, 'true');
    } catch {
      // The dismissal still applies to this session when storage is unavailable.
    }
  }, []);

  useEffect(() => () => {
    if (easterEggTimeoutRef.current !== null) window.clearTimeout(easterEggTimeoutRef.current);
    particleTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    particleTimeoutsRef.current.clear();
  }, []);

  useEffect(() => {
    if (!reducedMotion) return;

    const timeoutId = window.setTimeout(() => {
      setShowEasterEgg(false);
      setParticles([]);
      clickTimestampsRef.current = [];
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [reducedMotion]);

  return (
    <>
      {showWelcome ? (
        <section
          className={cn(
            'surface-panel mb-6 w-full max-w-3xl overflow-hidden',
            !reducedMotion && 'animate-in fade-in slide-in-from-top-4',
          )}
          aria-label={t('dashboard.welcome') || 'Welcome'}
        >
          <div className="flex flex-col gap-5 p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/72 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary">
                  <Sparkles className="h-3.5 w-3.5" />
                  {t('ui_mode.simple') || 'Classic'}
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">
                    {t('dashboard.welcome_title') || 'Welcome to FriendLauncher!'}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">
                    {t('dashboard.welcome_desc') || 'Simple Play mode is the fastest way to launch Minecraft.'}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleDismissWelcome} className="self-start">
                {t('dashboard.dismiss') || 'Dismiss'}
              </Button>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="surface-muted p-4">
                <p className="kicker-label mb-2">{t('dashboard.quick_actions') || 'Quick actions'}</p>
                <p className="text-sm leading-6 text-secondary">
                  {t('dashboard.welcome_cta') || 'Choose version and nickname in the sidebar, then press Play to start.'}
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <Button variant="secondary" onClick={onShowSettings} disabled={busy} className="justify-center">
                  <Settings2 className="h-4 w-4" />
                  {t('general.settings') || 'Settings'}
                </Button>
                <Button variant="ghost" onClick={onShowModpacks} disabled={busy} className="justify-center">
                  <Boxes className="h-4 w-4" />
                  {t('dashboard.go_to_modpacks') || 'Go to Modpacks'}
                </Button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <div className="relative mb-6 w-full max-w-2xl overflow-visible">
        <section className="surface-panel relative overflow-visible border border-border/70 bg-card/82 p-5">
          <div className="flex flex-col gap-4 text-left sm:flex-row sm:items-start">
            <div className="relative shrink-0 overflow-visible">
              <button
                type="button"
                onClick={handleLogoClick}
                aria-label="FriendLauncher app icon"
                className={cn(
                  'logo-container motion-safe-transform relative rounded-2xl border border-border/60 bg-background/80 p-3',
                  reducedMotion ? 'transition-none' : 'transition-all duration-300 ease-out hover:scale-105 active:scale-[0.98]',
                )}
                style={{
                  filter: showEasterEgg
                    ? `drop-shadow(0 0 18px ${accentHex}45) drop-shadow(0 0 32px ${accentHex}30)`
                    : 'drop-shadow(0 0 18px rgb(var(--brand-mark-glow) / 0.16)) drop-shadow(0 0 32px rgb(var(--brand-mark-glow) / 0.1))',
                }}
              >
                <div
                  className="pointer-events-none absolute -inset-3 rounded-2xl animate-pulse-slow"
                  style={{
                    background: !reducedMotion && showEasterEgg
                      ? `radial-gradient(circle, ${accentHex}20 0%, transparent 70%)`
                      : 'radial-gradient(circle, rgb(var(--brand-shell-glow) / 0.14) 0%, transparent 70%)',
                    animation: !reducedMotion && showEasterEgg ? 'easter-egg-glow 0.5s ease-in-out infinite' : undefined,
                  }}
                />
                <BrandMark
                  role="app-icon"
                  alt="FriendLauncher app icon"
                  data-testid="dashboard-launcher-mark"
                  className="h-10 w-10 transition-transform duration-300 md:h-11 md:w-11"
                  style={{
                    transform: !reducedMotion && showEasterEgg ? 'rotate(360deg) scale(1.12)' : 'none',
                    filter: !reducedMotion && showEasterEgg ? `drop-shadow(0 0 10px ${accentHex})` : undefined,
                  }}
                />
              </button>
              {!reducedMotion && particles.map((particle) => {
                const angle = (particle.angle * Math.PI) / 180;
                const x = Math.cos(angle) * particle.distance;
                const y = Math.sin(angle) * particle.distance;
                return (
                  <div
                    key={particle.id}
                    className="firework-particle pointer-events-none absolute"
                    style={{
                      left: '50%',
                      top: '50%',
                      width: `${particle.size}px`,
                      height: `${particle.size}px`,
                      '--particle-x': `${x}px`,
                      '--particle-y': `${y}px`,
                      '--particle-rotation': `${particle.angle + 360}deg`,
                      '--particle-duration': `${particle.duration}s`,
                      '--particle-delay': `${particle.delay}s`,
                      '--accent-color': accentHex,
                    } as React.CSSProperties}
                  >
                    <BrandMark
                      role="app-icon"
                      decorative
                      className="h-full w-full"
                      style={{ filter: `drop-shadow(0 0 6px ${accentHex}) drop-shadow(0 0 12px ${accentHex}60)` }}
                    />
                  </div>
                );
              })}
            </div>

            <div className="min-w-0 flex-1 space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/72 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary">
                <Sparkles className="h-3.5 w-3.5" />
                {t('ui_mode.simple') || 'Classic'}
              </div>
              <div className="min-w-0 space-y-1">
                <h1 className="break-words text-2xl font-semibold text-foreground sm:text-[1.75rem]">{name}</h1>
                <p className="break-words text-sm text-secondary">{subtitle}</p>
              </div>
              <p className="max-w-xl text-sm leading-6 text-secondary">{description}</p>
            </div>
          </div>
        </section>

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
            0% { opacity: 1; transform: translate(-50%, -50%) translate(0, 0) rotate(0deg) scale(1); }
            50% { opacity: 0.8; transform: translate(-50%, -50%) translate(calc(var(--particle-x) * 0.5), calc(var(--particle-y) * 0.5)) rotate(calc(var(--particle-rotation) * 0.5)) scale(1.05); }
            100% { opacity: 0; transform: translate(-50%, -50%) translate(var(--particle-x), var(--particle-y)) rotate(var(--particle-rotation)) scale(0.2); }
          }
          .firework-particle { animation: firework-particle var(--particle-duration) ease-out var(--particle-delay) forwards; will-change: transform, opacity; }
          .animate-pulse-slow { animation: pulse-slow 3s ease-in-out infinite; }
          .logo-container:hover { filter: ${showEasterEgg
            ? (reducedMotion
              ? `drop-shadow(0 0 18px ${accentHex}45) drop-shadow(0 0 32px ${accentHex}28)`
              : `drop-shadow(0 0 20px ${accentHex}60) drop-shadow(0 0 36px ${accentHex}40)`)
            : 'drop-shadow(0 0 20px rgb(var(--brand-mark-glow) / 0.18)) drop-shadow(0 0 36px rgb(var(--brand-mark-glow) / 0.12))'} !important; }
        `}</style>
      </div>
    </>
  );
}
