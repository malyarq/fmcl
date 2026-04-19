import React from 'react';
import { Box, Globe2, Paintbrush2, Settings2, Sparkles } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import { BrandLockup } from '../branding/BrandLockup';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';

interface WelcomePageProps {
  onComplete: () => void;
  onSkip?: () => void;
  onShowSettings?: () => void;
}

export const WelcomePage: React.FC<WelcomePageProps> = ({ onComplete, onSkip, onShowSettings }) => {
  const { t, getAccentStyles, getAccentHex } = useSettings();
  const features = [
    {
      icon: Box,
      title: t('onboarding.welcome.feature_modpacks.title') || 'Modpack Management',
      description: t('onboarding.welcome.feature_modpacks.desc') || 'Import and manage modpacks from CurseForge and Modrinth',
    },
    {
      icon: Globe2,
      title: t('onboarding.welcome.feature_multiplayer.title') || 'Multiplayer Tunnel',
      description: t('onboarding.welcome.feature_multiplayer.desc') || 'Play with friends through a secure tunnel without port forwarding',
    },
    {
      icon: Paintbrush2,
      title: t('onboarding.welcome.feature_customization.title') || 'Customization',
      description: t('onboarding.welcome.feature_customization.desc') || 'Dark/light theme, accent colors, and more',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/84 p-4 backdrop-blur-xl">
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background: `radial-gradient(circle at top, ${getAccentHex()}28 0%, transparent 38%), radial-gradient(circle at bottom left, ${getAccentHex()}18 0%, transparent 26%)`,
        }}
      />
      <div className="surface-panel relative w-full max-w-4xl overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[1.25fr_0.95fr]">
          <div className="border-b border-border/60 p-8 sm:p-10 lg:border-b-0 lg:border-r">
            <div className="mb-8 text-left">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/72 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary">
                <Sparkles className="h-3.5 w-3.5" />
                {t('onboarding.welcome.badge') || 'Launcher setup'}
              </div>
              <BrandLockup
                align="start"
                markFrame="brand"
                markRole="product-mark"
                markSize="lg"
                className="mb-5"
                wordmarkTone="hero"
                wordmarkClassName="text-3xl sm:text-4xl"
              />
              <h1
                className={cn('text-2xl font-black tracking-tight sm:text-3xl', getAccentStyles('text').className)}
                style={{
                  ...getAccentStyles('text').style,
                  textShadow: `0 2px 12px ${getAccentHex()}28`,
                }}
              >
                {t('onboarding.welcome.title') || 'Welcome!'}
              </h1>
              <p className="mt-4 max-w-xl text-base text-secondary sm:text-lg">
                {t('onboarding.welcome.intro') || 'Start with one clear launcher shell, then move into modpacks, multiplayer, and personalization when you need them.'}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {features.map(({ icon: Icon, title, description }) => (
                <div key={title} className="surface-card p-4">
                  <div
                    className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: `${getAccentHex()}14`, color: getAccentHex() }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mb-1 text-sm font-semibold text-foreground">{title}</h3>
                  <p className="text-sm leading-6 text-secondary">{description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="p-8 sm:p-10">
            <div className="surface-muted mb-6 p-6">
              <p className="kicker-label mb-3">{t('onboarding.welcome.quick_start.title') || 'Quick Start:'}</p>
              <ol className="space-y-3 text-sm leading-6 text-secondary">
                <li>1. {t('onboarding.welcome.quick_start.step1') || 'Select or create a modpack'}</li>
                <li>2. {t('onboarding.welcome.quick_start.step2') || 'Configure Minecraft version and modloader'}</li>
                <li>3. {t('onboarding.welcome.quick_start.step3') || 'Click "Play" and enjoy!'}</li>
              </ol>
            </div>

            <div className="surface-card mb-6 p-5">
              <p className="kicker-label mb-3">{t('onboarding.welcome.customize_title') || 'Make it yours'}</p>
              <p className="text-sm leading-6 text-secondary">
                {t('onboarding.welcome.customize_desc') || 'Start with a clean launcher shell, then adjust theme, accent, background effects, and account setup in Settings.'}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                variant="primary"
                onClick={onComplete}
                className="w-full justify-center py-3"
              >
                {t('onboarding.welcome.get_started') || 'Get Started'}
              </Button>
              <div className="flex flex-col gap-3 sm:flex-row">
                {onShowSettings && (
                  <Button
                    variant="secondary"
                    onClick={onShowSettings}
                    className="flex-1"
                  >
                    <Settings2 className="h-4 w-4" />
                    {t('general.settings') || 'Settings'}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  onClick={onSkip ?? onComplete}
                  className="flex-1"
                >
                  {t('onboarding.welcome.skip') || 'Skip'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
