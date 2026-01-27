import React from 'react';
import { cn } from '../../../utils/cn';

const COLORS = [
  { id: 'emerald', class: 'bg-emerald-500', ring: 'ring-emerald-500' },
  { id: 'blue', class: 'bg-blue-500', ring: 'ring-blue-500' },
  { id: 'purple', class: 'bg-purple-500', ring: 'ring-purple-500' },
  { id: 'orange', class: 'bg-orange-500', ring: 'ring-orange-500' },
  { id: 'rose', class: 'bg-rose-500', ring: 'ring-rose-500' },
] as const;

export interface AppearanceTabProps {
  accentColor: string;
  setAccentColor: (val: string) => void;
  theme: 'dark' | 'light';
  setTheme: (val: 'dark' | 'light') => void;
  language: 'en' | 'ru';
  setLanguage: (val: 'en' | 'ru') => void;
  t: (key: string) => string;
  getAccentStyles: (type: 'bg' | 'text' | 'border' | 'ring' | 'hover' | 'accent' | 'title' | 'soft-bg' | 'soft-border') => {
    className?: string;
    style?: React.CSSProperties;
  };
}

export const AppearanceTab: React.FC<AppearanceTabProps> = ({
  accentColor,
  setAccentColor,
  theme,
  setTheme,
  language,
  setLanguage,
  t,
  getAccentStyles,
}) => {
  // Preset palette is used to keep Tailwind classes static (prevents purging).
  const isPreset = (c: string) => COLORS.some((col) => col.id === c);
  const isCustom = !isPreset(accentColor);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <label className="text-sm font-medium text-zinc-600 dark:text-zinc-300 mb-2 block">
            {t('settings.accent')}
          </label>
          <div className="flex gap-3 flex-wrap items-center">
            {COLORS.map((c) => (
              <button
                key={c.id}
                onClick={() => setAccentColor(c.id)}
                className={cn(
                  'w-8 h-8 rounded-full transition-all ring-offset-2 ring-offset-white dark:ring-offset-zinc-800 focus:outline-none',
                  c.class,
                  accentColor === c.id ? `ring-2 ${c.ring} scale-110` : 'opacity-60 hover:opacity-100',
                )}
                title={c.id}
              />
            ))}

            {/* Custom Color Picker */}
            <div className="relative group w-8 h-8">
              <div
                className={cn(
                  'w-full h-full rounded-full flex items-center justify-center transition-all ring-offset-2 ring-offset-white dark:ring-offset-zinc-800 cursor-pointer overflow-hidden',
                  isCustom ? 'ring-2 ring-zinc-500 scale-110' : 'bg-zinc-200 dark:bg-zinc-800 opacity-60 group-hover:opacity-100',
                )}
              >
                {isCustom ? (
                  <div className="w-full h-full" style={{ backgroundColor: accentColor }} />
                ) : (
                  <span className="text-base text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200">+</span>
                )}
              </div>
              <input
                type="color"
                value={isCustom ? accentColor : '#10b981'}
                onChange={(e) => setAccentColor(e.target.value)}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                title="Custom Color"
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-sm font-medium text-zinc-600 dark:text-zinc-300 mb-2 block">
            {t('settings.theme')}
          </label>
          <div className="flex bg-zinc-100/80 dark:bg-zinc-900/50 backdrop-blur-sm p-1 rounded-xl border border-zinc-200/50 dark:border-zinc-700/50 shadow-inner">
            {(['light', 'dark'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setTheme(m)}
                className={cn(
                  'flex-1 py-1.5 text-xs font-bold uppercase rounded-lg transition-all',
                  theme === m
                    ? 'bg-white/90 dark:bg-zinc-700/90 backdrop-blur-sm shadow-md text-zinc-900 dark:text-white'
                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300',
                )}
              >
                {m === 'light' ? t('settings.theme_light') : t('settings.theme_dark')}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium text-zinc-600 dark:text-zinc-300 mb-2 block">
          {t('settings.language')}
        </label>
        <div className="flex bg-zinc-100 dark:bg-zinc-900/50 p-1 rounded-lg border border-zinc-200 dark:border-zinc-700">
          {(['en', 'ru'] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              className={cn(
                'flex-1 py-1.5 text-xs font-bold uppercase rounded-lg transition-all',
                language === lang
                  ? 'bg-white/90 dark:bg-zinc-700/90 backdrop-blur-sm shadow-md text-zinc-900 dark:text-white'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300',
              )}
            >
              {lang === 'en' ? 'English' : 'Русский'}
            </button>
          ))}
        </div>
      </div>

      {/* keep a harmless reference to getAccentStyles to avoid unused prop in some builds */}
      <span className="hidden" style={getAccentStyles('text').style} />
    </div>
  );
};

