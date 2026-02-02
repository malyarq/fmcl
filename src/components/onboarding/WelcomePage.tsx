import React from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';

interface WelcomePageProps {
  onComplete: () => void;
  onSkip?: () => void;
  onShowSettings?: () => void;
}

export const WelcomePage: React.FC<WelcomePageProps> = ({ onComplete, onSkip, onShowSettings }) => {
  const { t, getAccentStyles, getAccentHex } = useSettings();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-950 p-4">
      <div className="w-full max-w-2xl bg-white/95 dark:bg-zinc-800/95 backdrop-blur-xl border border-zinc-200/50 dark:border-zinc-700/50 rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-8 sm:p-12">
          {/* Header */}
          <div className="text-center mb-8">
            <h1
              className={cn('text-4xl sm:text-5xl font-black mb-4', getAccentStyles('text').className)}
              style={{
                ...getAccentStyles('text').style,
                textShadow: `0 2px 8px ${getAccentHex()}30`,
              }}
            >
              FriendLauncher
            </h1>
            <p className="text-lg sm:text-xl text-zinc-600 dark:text-zinc-400">
              {t('onboarding.welcome.title') || 'Добро пожаловать!'}
            </p>
          </div>

          {/* Features */}
          <div className="space-y-6 mb-8">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center text-2xl">
                📦
              </div>
              <div>
                <h3 className="font-bold text-zinc-900 dark:text-white mb-1">
                  {t('onboarding.welcome.feature_modpacks.title') || 'Управление модпаками'}
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {t('onboarding.welcome.feature_modpacks.desc') || 'Импортируйте и управляйте модпаками из CurseForge и Modrinth'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center text-2xl">
                🌐
              </div>
              <div>
                <h3 className="font-bold text-zinc-900 dark:text-white mb-1">
                  {t('onboarding.welcome.feature_multiplayer.title') || 'Мультиплеер туннель'}
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {t('onboarding.welcome.feature_multiplayer.desc') || 'Играйте с друзьями через безопасный туннель без настройки портов'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center text-2xl">
                ⚙️
              </div>
              <div>
                <h3 className="font-bold text-zinc-900 dark:text-white mb-1">
                  {t('onboarding.welcome.feature_customization.title') || 'Настройка под себя'}
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {t('onboarding.welcome.feature_customization.desc') || 'Темная/светлая тема, акцентные цвета и многое другое'}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Start */}
          <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-lg p-6 mb-8">
            <h3 className="font-bold text-zinc-900 dark:text-white mb-3">
              {t('onboarding.welcome.quick_start.title') || 'Быстрый старт:'}
            </h3>
            <ol className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400 list-decimal list-inside">
              <li>{t('onboarding.welcome.quick_start.step1') || 'Выберите или создайте модпак'}</li>
              <li>{t('onboarding.welcome.quick_start.step2') || 'Настройте версию Minecraft и модлоадер'}</li>
              <li>{t('onboarding.welcome.quick_start.step3') || 'Нажмите "Играть" и наслаждайтесь!'}</li>
            </ol>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="primary"
              onClick={onComplete}
              className={cn('flex-1', getAccentStyles('bg').className)}
              style={getAccentStyles('bg').style}
            >
              {t('onboarding.welcome.get_started') || 'Начать'}
            </Button>
            {onShowSettings && (
              <Button
                variant="secondary"
                onClick={onShowSettings}
                className="flex-1 sm:flex-initial"
              >
                <span className="mr-2">⚙️</span>
                {t('general.settings') || 'Настройки'}
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={onSkip ?? onComplete}
              className="flex-1 sm:flex-initial"
            >
              {t('onboarding.welcome.skip') || 'Пропустить'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
