import { useRef } from 'react';
import { Paintbrush2 } from 'lucide-react';
import { cn } from '../../../utils/cn';
import { CollapsibleSection } from '../../ui/CollapsibleSection';
import type { AccentColor, CustomThemeConfig, Language } from '../../../contexts/settings/types';

type Translate = (key: string, params?: Record<string, string | number>) => string;
type ThemeColors = NonNullable<CustomThemeConfig['colors']>;

const COLORS = [
  { id: 'emerald', className: 'bg-emerald-500' },
  { id: 'blue', className: 'bg-blue-500' },
  { id: 'purple', className: 'bg-purple-500' },
  { id: 'orange', className: 'bg-orange-500' },
  { id: 'rose', className: 'bg-rose-500' },
] as const;

interface AppearanceBrandingProps {
  accentColor: AccentColor;
  embedded: boolean;
  language: Language;
  onAccentColorChange: (accentColor: AccentColor) => void;
  onLanguageChange: (language: Language) => void;
  t: Translate;
}

export function AppearanceBranding({
  accentColor,
  embedded,
  language,
  onAccentColorChange,
  onLanguageChange,
  t,
}: AppearanceBrandingProps) {
  const customAccentInputRef = useRef<HTMLInputElement>(null);
  const accentLabel = t('settings.accent');
  const customColorLabel = t('settings.custom_color');
  const isCustom = !COLORS.some((color) => color.id === accentColor);

  return (
    <section
      className="settings-section-shell min-w-0 p-5"
      data-appearance-owner="branding"
      data-testid="appearance-branding"
    >
      <div className="space-y-5">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Paintbrush2 aria-hidden="true" className="h-4 w-4 text-secondary" />
            <span className="text-sm font-medium text-foreground">{accentLabel}</span>
          </div>
          {!embedded && (
            <p className="settings-embedded-copy">{t('settings.appearance_branding_desc')}</p>
          )}
          <div className="settings-accent-grid">
            {COLORS.map((color) => (
              <button
                type="button"
                key={color.id}
                onClick={() => onAccentColorChange(color.id)}
                aria-pressed={accentColor === color.id}
                aria-label={`${accentLabel}: ${color.id}`}
                data-state={accentColor === color.id ? 'active' : 'inactive'}
                className={cn(
                  'settings-accent-chip',
                  accentColor === color.id ? 'ring-2 scale-110' : '',
                )}
                title={color.id}
              >
                <span className={cn('settings-accent-swatch', color.className)} />
              </button>
            ))}

            <button
              type="button"
              onClick={() => customAccentInputRef.current?.click()}
              aria-pressed={isCustom}
              aria-label={`${accentLabel}: ${customColorLabel}`}
              data-state={isCustom ? 'active' : 'inactive'}
              className={cn('settings-accent-chip', isCustom ? 'ring-2 scale-110' : '')}
              title={customColorLabel}
            >
              {isCustom ? (
                <span className="settings-accent-swatch" style={{ backgroundColor: accentColor }} />
              ) : (
                <span className="settings-accent-chip-symbol">+</span>
              )}
            </button>
            <input
              ref={customAccentInputRef}
              type="color"
              value={isCustom ? accentColor : '#10b981'}
              onChange={(event) => onAccentColorChange(event.target.value)}
              className="sr-only"
              tabIndex={-1}
              aria-label={customColorLabel}
            />
          </div>
        </div>

        <div className="space-y-3">
          <span className="text-sm font-medium text-foreground">{t('settings.language')}</span>
          <div className="settings-segmented-row">
            {(['en', 'ru'] as const).map((nextLanguage) => (
              <button
                type="button"
                key={nextLanguage}
                onClick={() => onLanguageChange(nextLanguage)}
                aria-pressed={language === nextLanguage}
                data-state={language === nextLanguage ? 'active' : 'inactive'}
                className="settings-segmented-option"
              >
                {nextLanguage === 'en' ? 'English' : 'Русский'}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

interface AppearanceSurfaceColorsProps {
  colors: ThemeColors | undefined;
  onColorChange: (key: keyof ThemeColors, value: string) => void;
  t: Translate;
}

const COLOR_CONTROLS: ReadonlyArray<{
  fallback: string;
  key: keyof ThemeColors;
  localeKey: string;
  placeholder: string;
}> = [
  { key: 'background', localeKey: 'settings.background_color', fallback: 'Background Color', placeholder: '#ffffff' },
  { key: 'card', localeKey: 'settings.card_color', fallback: 'Card Color', placeholder: '#ffffff' },
  { key: 'textMain', localeKey: 'settings.text_main', fallback: 'Text Main', placeholder: '#000000' },
  { key: 'border', localeKey: 'settings.border_color', fallback: 'Border Color', placeholder: '#e4e4e7' },
  { key: 'error', localeKey: 'settings.error_color', fallback: 'Error Color', placeholder: '#ef4444' },
];

export function AppearanceSurfaceColors({ colors, onColorChange, t }: AppearanceSurfaceColorsProps) {
  return (
    <CollapsibleSection title={t('settings.advanced_appearance') || 'Advanced Appearance'} defaultExpanded={false}>
      <div className="surface-muted space-y-4 p-4">
        <p className="settings-embedded-copy">{t('settings.advanced_appearance_scope_desc')}</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {COLOR_CONTROLS.map((control) => {
            const label = t(control.localeKey) || control.fallback;
            return (
              <div key={control.key} className="space-y-2">
                <label className="text-xs font-medium uppercase text-secondary">{label}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label={label}
                    value={colors?.[control.key] || control.placeholder}
                    onChange={(event) => onColorChange(control.key, event.target.value)}
                    className="h-8 w-12 cursor-pointer border-none bg-transparent p-0"
                  />
                  <span className="text-xs text-secondary">
                    {colors?.[control.key] || t('settings.default_value') || 'Default'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </CollapsibleSection>
  );
}
