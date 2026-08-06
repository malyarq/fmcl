import React from 'react';
import { Box, Gamepad2, Globe2, Languages, Settings2, Waypoints } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import { BrandLockup } from '../branding/BrandLockup';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { cn } from '../../utils/cn';
import { analyticsClient } from '../../features/analytics/analyticsClient';

interface WelcomePageProps {
  onComplete: () => void;
  onStartTour: () => void;
  onShowMultiplayer: () => void;
  onShowSettings: () => void;
}

export const WelcomePage: React.FC<WelcomePageProps> = ({
  onComplete,
  onStartTour,
  onShowMultiplayer,
  onShowSettings,
}) => {
  const { language, setLanguage, setUIMode, t, getAccentStyles, getAccentHex } = useSettings();

  const openModpacks = () => {
    void analyticsClient.capture('onboarding_action', { action: 'modpacks' });
    setUIMode('modpacks');
    onComplete();
  };

  const openLauncher = () => {
    void analyticsClient.capture('onboarding_action', { action: 'play_now' });
    onComplete();
  };

  const openMultiplayer = () => {
    void analyticsClient.capture('onboarding_action', { action: 'friend_tunnel' });
    onShowMultiplayer();
  };

  const openSettings = () => {
    void analyticsClient.capture('onboarding_action', { action: 'settings' });
    onShowSettings();
  };

  const choices = [
    {
      icon: Gamepad2,
      title: t('onboarding.welcome.play_now'),
      description: t('onboarding.welcome.play_now_desc'),
      action: openLauncher,
      button: t('onboarding.welcome.play_now_action'),
    },
    {
      icon: Globe2,
      title: t('onboarding.welcome.play_together'),
      description: t('onboarding.welcome.play_together_desc'),
      action: openMultiplayer,
      button: t('onboarding.welcome.play_together_action'),
    },
    {
      icon: Box,
      title: t('onboarding.welcome.modpacks'),
      description: t('onboarding.welcome.modpacks_desc'),
      action: openModpacks,
      button: t('onboarding.welcome.modpacks_action'),
    },
  ];

  return (
    <Modal
      isOpen
      onClose={() => undefined}
      closeDisabled
      closeLabel={t('general.close_dialog')}
      hideHeader
      ariaLabelledBy="welcome-title"
      overlayClassName="bg-background/84 backdrop-blur-xl"
      className="max-w-5xl"
      bodyClassName="!p-0"
    >
      <div className="relative">
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{ background: `radial-gradient(circle at top, ${getAccentHex()}28 0%, transparent 38%), radial-gradient(circle at bottom left, ${getAccentHex()}18 0%, transparent 26%)` }}
      />
      <div className="relative overflow-hidden">
        <div className="border-b border-border/60 p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
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
                id="welcome-title"
                className={cn('text-2xl font-black tracking-tight sm:text-3xl', getAccentStyles('text').className)}
                style={getAccentStyles('text').style}
              >
                {t('onboarding.welcome.title')}
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-secondary">
                {t('onboarding.welcome.intro')}
              </p>
            </div>

            <div
              className="surface-soft flex shrink-0 items-center gap-1 rounded-xl p-1"
              role="group"
              aria-label={t('onboarding.welcome.language')}
            >
              <Languages className="mx-2 h-4 w-4 text-secondary" aria-hidden="true" />
              {(['en', 'ru'] as const).map((nextLanguage) => (
                <button
                  key={nextLanguage}
                  type="button"
                  aria-pressed={language === nextLanguage}
                  onClick={() => setLanguage(nextLanguage)}
                  className={cn(
                    'rounded-lg px-3 py-2 text-sm font-semibold uppercase transition-colors',
                    language === nextLanguage ? 'bg-card text-foreground shadow-sm' : 'text-secondary hover:text-foreground',
                  )}
                >
                  {nextLanguage}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-6 sm:p-8 lg:grid-cols-3">
          {choices.map(({ icon: Icon, title, description, action, button }, index) => (
            <article key={title} className="surface-card flex min-w-0 flex-col p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ backgroundColor: `${getAccentHex()}14`, color: getAccentHex() }}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h2 className="text-base font-bold text-foreground">{title}</h2>
              </div>
              <p className="mb-5 flex-1 text-sm leading-6 text-secondary">{description}</p>
              <Button
                variant={index === 0 ? 'primary' : 'secondary'}
                onClick={action}
                className="w-full"
                data-autofocus={index === 0 ? 'true' : undefined}
              >
                {button}
              </Button>
            </article>
          ))}
        </div>

        <div className="flex flex-col gap-3 border-t border-border/60 bg-background/28 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="max-w-2xl text-sm leading-6 text-secondary">
            {t('onboarding.welcome.account_note')}
          </p>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={onStartTour}>
              <Waypoints className="h-4 w-4" aria-hidden="true" />
              {t('onboarding.welcome.tour')}
            </Button>
            <Button variant="ghost" size="sm" onClick={openSettings}>
              <Settings2 className="h-4 w-4" aria-hidden="true" />
              {t('general.settings')}
            </Button>
          </div>
        </div>
      </div>
      </div>
    </Modal>
  );
};
