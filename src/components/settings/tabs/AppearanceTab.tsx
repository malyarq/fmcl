import React, { useRef } from 'react';
import { Download, Paintbrush2, Sparkles, Upload } from 'lucide-react';
import { cn } from '../../../utils/cn';
import { useSettings } from '../../../contexts/SettingsContext';
import { CollapsibleSection } from '../../ui/CollapsibleSection';
import { Input } from '../../ui/Input';
import { Button } from '../../ui/Button';
import { Select } from '../../ui/Select';
import { THEME_PRESETS } from '../../../contexts/settings/theme-presets';
import type { CustomThemeConfig } from '../../../contexts/settings/types';

const COLORS = [
  { id: 'emerald', class: 'bg-emerald-500', ring: 'ring-emerald-500' },
  { id: 'blue', class: 'bg-blue-500', ring: 'ring-blue-500' },
  { id: 'purple', class: 'bg-purple-500', ring: 'ring-purple-500' },
  { id: 'orange', class: 'bg-orange-500', ring: 'ring-orange-500' },
  { id: 'rose', class: 'bg-rose-500', ring: 'ring-rose-500' },
] as const;

type BackgroundConfig = NonNullable<CustomThemeConfig['background']>;
type BackgroundParticlesConfig = NonNullable<BackgroundConfig['particles']>;
type BackgroundParticleType = NonNullable<BackgroundParticlesConfig['type']>;
type BackgroundType = NonNullable<BackgroundConfig['type']>;
type BackgroundPosition = NonNullable<BackgroundConfig['position']>;

const BACKGROUND_TYPES: readonly BackgroundType[] = ['image', 'video', 'particles'];
const BACKGROUND_POSITIONS: readonly BackgroundPosition[] = ['cover', 'contain', 'center', 'repeat'];
const BACKGROUND_PARTICLE_TYPES: readonly BackgroundParticleType[] = ['stars', 'snow', 'rain'];

function ToggleRow(props: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  const { label, checked, onToggle } = props;

  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onToggle}
        className={cn(
          'relative h-6 w-11 rounded-full border border-border/60 transition-colors',
          checked ? 'bg-[rgb(var(--accent-main))]' : 'bg-background/90'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0.5'
          )}
        />
      </button>
    </div>
  );
}

export const AppearanceTab: React.FC = () => {
  const {
    accentColor, setAccentColor,
    theme, setTheme,
    language, setLanguage,
    t,
    getAccentStyles,
    customTheme, setCustomTheme,
    uiScale, setUiScale,
    disableAnimations, setDisableAnimations,
    sidebarPosition, setSidebarPosition,
    compactMode, setCompactMode,
  } = useSettings();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preset palette is used to keep Tailwind classes static (prevents purging).
  const isPreset = (c: string) => COLORS.some((col) => col.id === c);
  const isCustom = !isPreset(accentColor);

  const updateCustomColor = (key: keyof NonNullable<typeof customTheme.colors>, value: string) => {
    setCustomTheme({
      ...customTheme,
      colors: {
        ...customTheme.colors,
        [key]: value,
      },
    });
  };

  const updateBackground = <K extends keyof BackgroundConfig>(key: K, value: BackgroundConfig[K]) => {
    setCustomTheme({
      ...customTheme,
      background: {
        ...customTheme.background,
        [key]: value,
      },
    });
  };

  const applyPreset = (presetId: string) => {
    const preset = THEME_PRESETS.find(p => p.id === presetId);
    if (preset) {
      setTheme(preset.theme);
      setCustomTheme(preset.config);
    }
  };

  const handleExportTheme = () => {
    const themeData = {
      name: "Custom Export",
      theme,
      config: customTheme
    };
    const blob = new Blob([JSON.stringify(themeData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "friend-launcher-theme.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportTheme = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        if (typeof event.target?.result !== 'string') {
          return;
        }

        const parsed = JSON.parse(event.target.result) as Partial<{
          config: CustomThemeConfig;
          theme: 'light' | 'dark';
        }>;

        if (parsed.config) {
          setCustomTheme(parsed.config);
        }
        if (parsed.theme === 'light' || parsed.theme === 'dark') {
          setTheme(parsed.theme);
        }
      } catch (error) {
        console.error("Failed to parse theme file", error);
      }
    };
    reader.readAsText(file);
  };

  const resetCustomTheme = () => {
    setCustomTheme({});
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="surface-card space-y-3 p-5">
          <div className="flex items-center gap-2">
            <Paintbrush2 className="h-4 w-4 text-secondary" />
            <label className="text-sm font-medium text-foreground">
              {t('settings.appearance_branding') || t('settings.accent')}
            </label>
          </div>
          <p className="text-sm text-secondary">
            {t('settings.appearance_branding_desc') || 'Set the accent tone used across launch buttons, highlights, and active controls.'}
          </p>
          <label className="text-sm font-medium text-foreground mb-2 block">
            {t('settings.accent')}
          </label>
          <div className="flex gap-3 flex-wrap items-center">
            {COLORS.map((c) => (
              <button
                key={c.id}
                onClick={() => setAccentColor(c.id)}
                className={cn(
                  'w-8 h-8 rounded-full transition-all ring-offset-2 ring-offset-background focus:outline-none',
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
                  'w-full h-full rounded-full flex items-center justify-center transition-all ring-offset-2 ring-offset-background cursor-pointer overflow-hidden',
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
                title={t('settings.custom_color') || 'Custom Color'}
              />
            </div>
          </div>
        </div>

        <div className="surface-card space-y-3 p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-secondary" />
            <label className="text-sm font-medium text-foreground">
              {t('settings.theme')}
            </label>
          </div>
          <p className="text-sm text-secondary">
            {t('settings.theme_desc') || 'Choose the base mood of the launcher, then fine-tune the rest below.'}
          </p>
          <label className="text-sm font-medium text-foreground mb-2 block">
            {t('settings.theme')}
          </label>
          <div className="flex rounded-[20px] border border-border/60 bg-background/84 p-1 shadow-inner">
            {(['light', 'dark'] as const).map((m) => (
              <button
                type="button"
                key={m}
                onClick={() => setTheme(m)}
                className={cn(
                  'flex-1 rounded-2xl py-2 text-xs font-bold uppercase transition-all',
                  theme === m
                    ? 'bg-card text-foreground shadow-md'
                    : 'text-muted hover:text-foreground',
                )}
              >
                {m === 'light' ? t('settings.theme_light') : t('settings.theme_dark')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Presets & Management */}
      <div className="surface-card space-y-3 p-5">
        <label className="text-sm font-medium text-foreground mb-2 block">
          {t('settings.theme_presets') || 'Theme Presets'}
        </label>
        <p className="text-sm text-secondary">
          {t('settings.theme_presets_desc') || 'Apply a ready-made visual profile, or import/export your own configuration.'}
        </p>
        <div className="flex gap-2">
          <Select
            onChange={(e) => applyPreset(e.target.value)}
            className="flex-1"
            defaultValue=""
          >
            <option value="" disabled>{t('settings.theme_presets_placeholder') || 'Select a preset...'}</option>
            {THEME_PRESETS.map(preset => (
              <option key={preset.id} value={preset.id}>{preset.name}</option>
            ))}
          </Select>

          <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4" />
            {t('settings.import_theme') || 'Import'}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImportTheme}
          />

          <Button variant="secondary" onClick={handleExportTheme}>
            <Download className="h-4 w-4" />
            {t('settings.export_theme') || 'Export'}
          </Button>
        </div>
      </div>

      <div className="surface-card space-y-3 p-5">
        <label className="text-sm font-medium text-foreground mb-2 block">
          {t('settings.language')}
        </label>
        <div className="flex rounded-[20px] border border-border/60 bg-background/84 p-1 shadow-inner">
          {(['en', 'ru'] as const).map((lang) => (
            <button
              type="button"
              key={lang}
              onClick={() => setLanguage(lang)}
              className={cn(
                'flex-1 rounded-2xl py-2 text-xs font-bold uppercase transition-all',
                language === lang
                  ? 'bg-card text-foreground shadow-md'
                  : 'text-muted hover:text-foreground',
              )}
            >
              {lang === 'en' ? 'English' : 'Русский'}
            </button>
          ))}
        </div>
      </div>

      <CollapsibleSection title={t('settings.advanced_appearance') || 'Advanced Appearance'} defaultExpanded={false}>
        <div className="surface-muted space-y-4 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-secondary uppercase">{t('settings.background_color') || 'Background Color'}</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={customTheme.colors?.background || '#ffffff'}
                  onChange={(e) => updateCustomColor('background', e.target.value)}
                  className="h-8 w-12 cursor-pointer bg-transparent border-none p-0"
                />
                <span className="text-xs text-secondary">{customTheme.colors?.background || (t('settings.default_value') || 'Default')}</span>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-secondary uppercase">{t('settings.card_color') || 'Card Color'}</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={customTheme.colors?.card || '#ffffff'}
                  onChange={(e) => updateCustomColor('card', e.target.value)}
                  className="h-8 w-12 cursor-pointer bg-transparent border-none p-0"
                />
                <span className="text-xs text-secondary">{customTheme.colors?.card || (t('settings.default_value') || 'Default')}</span>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-secondary uppercase">{t('settings.text_main') || 'Text Main'}</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={customTheme.colors?.textMain || '#000000'}
                  onChange={(e) => updateCustomColor('textMain', e.target.value)}
                  className="h-8 w-12 cursor-pointer bg-transparent border-none p-0"
                />
                <span className="text-xs text-secondary">{customTheme.colors?.textMain || (t('settings.default_value') || 'Default')}</span>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-secondary uppercase">{t('settings.border_color') || 'Border Color'}</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={customTheme.colors?.border || '#e4e4e7'}
                  onChange={(e) => updateCustomColor('border', e.target.value)}
                  className="h-8 w-12 cursor-pointer bg-transparent border-none p-0"
                />
                <span className="text-xs text-secondary">{customTheme.colors?.border || (t('settings.default_value') || 'Default')}</span>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-secondary uppercase">{t('settings.error_color') || 'Error Color'}</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={customTheme.colors?.error || '#ef4444'}
                  onChange={(e) => updateCustomColor('error', e.target.value)}
                  className="h-8 w-12 cursor-pointer bg-transparent border-none p-0"
                />
                <span className="text-xs text-secondary">{customTheme.colors?.error || (t('settings.default_value') || 'Default')}</span>
              </div>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title={t('settings.background_effects') || 'Background Effects'} defaultExpanded={false}>
        <div className="surface-muted space-y-4 p-4">

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {t('settings.background_type') || 'Background Type'}
            </label>
            <Select
              value={customTheme.background?.type || 'image'}
              onChange={(e) => {
                const nextType = e.target.value as BackgroundType;
                if (BACKGROUND_TYPES.includes(nextType)) {
                  updateBackground('type', nextType);
                }
              }}
            >
              <option value="image">{t('settings.background_type_image') || 'Image'}</option>
              <option value="video">{t('settings.background_type_video') || 'Video'}</option>
              <option value="particles">{t('settings.background_type_particles') || 'Particles'}</option>
            </Select>
          </div>

          {(!customTheme.background?.type || customTheme.background.type === 'image') && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {t('settings.background_image_url') || 'Background Image URL'}
              </label>
              <Input
                value={customTheme.background?.image || ''}
                onChange={(e) => updateBackground('image', e.target.value)}
                placeholder={t('settings.background_image_url_placeholder') || 'https://example.com/image.jpg'}
                className="w-full"
              />
              <p className="text-xs text-secondary">{t('settings.background_image_url_hint') || 'Enter a URL to an image or leave empty to disable.'}</p>
            </div>
          )}

          {customTheme.background?.type === 'video' && (
            <div className="space-y-4 border-t border-border pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {t('settings.background_video_url') || 'Video URL (MP4/WebM)'}
                </label>
                <Input
                  value={customTheme.background?.video?.url || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustomTheme({
                      ...customTheme,
                      background: { ...customTheme.background, video: { ...customTheme.background?.video, url: val } }
                    });
                  }}
                  placeholder={t('settings.background_video_url_placeholder') || 'https://example.com/video.mp4'}
                  className="w-full"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="flex justify-between text-sm font-medium text-foreground">
                    <span>{t('settings.background_volume') || 'Volume'}</span>
                    <span>{Math.round((customTheme.background?.video?.volume ?? 0) * 100)}%</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={customTheme.background?.video?.volume ?? 0}
                    onChange={(e) => {
                      setCustomTheme({
                        ...customTheme,
                        background: { ...customTheme.background, video: { ...customTheme.background?.video, volume: parseFloat(e.target.value) } }
                      });
                    }}
                    className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-700"
                  />
                </div>

                <div className="pt-6">
                  <ToggleRow
                    label={t('settings.background_autopause') || 'Auto-Pause (Inactive)'}
                    checked={Boolean(customTheme.background?.video?.autoPause)}
                    onToggle={() => {
                      setCustomTheme({
                        ...customTheme,
                        background: { ...customTheme.background, video: { ...customTheme.background?.video, autoPause: !customTheme.background?.video?.autoPause } }
                      });
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {customTheme.background?.type === 'particles' && (
            <div className="space-y-4 border-t border-border pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {t('settings.background_particle_type') || 'Particle Type'}
                </label>
                <Select
                  value={customTheme.background?.particles?.type || 'stars'}
                  onChange={(e) => {
                    setCustomTheme({
                      ...customTheme,
                      background: {
                        ...customTheme.background,
                        particles: {
                          ...customTheme.background?.particles,
                          type: BACKGROUND_PARTICLE_TYPES.includes(e.target.value as BackgroundParticleType)
                            ? (e.target.value as BackgroundParticleType)
                            : 'stars',
                        },
                      }
                    });
                  }}
                >
                  <option value="stars">{t('settings.background_particle_type_stars') || 'Stars'}</option>
                  <option value="snow">{t('settings.background_particle_type_snow') || 'Snow'}</option>
                  <option value="rain">{t('settings.background_particle_type_rain') || 'Rain'}</option>
                </Select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="flex justify-between text-sm font-medium text-foreground">
                    <span>{t('settings.background_intensity') || 'Intensity'}</span>
                    <span>{customTheme.background?.particles?.intensity || 50}</span>
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={customTheme.background?.particles?.intensity || 50}
                    onChange={(e) => {
                      setCustomTheme({
                        ...customTheme,
                        background: { ...customTheme.background, particles: { ...customTheme.background?.particles, intensity: parseInt(e.target.value) } }
                      });
                    }}
                    className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-700"
                  />
                </div>
                <div className="space-y-2">
                  <label className="flex justify-between text-sm font-medium text-foreground">
                    <span>{t('settings.background_speed') || 'Speed'}</span>
                    <span>{customTheme.background?.particles?.speed || 2}</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    step="0.5"
                    value={customTheme.background?.particles?.speed || 2}
                    onChange={(e) => {
                      setCustomTheme({
                        ...customTheme,
                        background: { ...customTheme.background, particles: { ...customTheme.background?.particles, speed: parseFloat(e.target.value) } }
                      });
                    }}
                    className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-700"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border">
            <div className="space-y-2">
              <label className="flex justify-between text-sm font-medium text-foreground">
                <span>{t('settings.background_blur') || 'Blur'}</span>
                <span>{customTheme.background?.blur || 0}px</span>
              </label>
              <input
                type="range"
                min="0"
                max="20"
                value={customTheme.background?.blur || 0}
                onChange={(e) => updateBackground('blur', parseInt(e.target.value))}
                className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-700"
              />
            </div>
            <div className="space-y-2">
              <label className="flex justify-between text-sm font-medium text-foreground">
                <span>{t('settings.background_opacity') || 'Opacity'}</span>
                <span>{Math.round((customTheme.background?.opacity ?? 1) * 100)}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={customTheme.background?.opacity ?? 1}
                onChange={(e) => updateBackground('opacity', parseFloat(e.target.value))}
                className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-700"
              />
            </div>
            {(!customTheme.background?.type || customTheme.background?.type === 'image') && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {t('settings.background_position') || 'Background Position'}
                </label>
                <Select
                  value={customTheme.background?.position || 'cover'}
                  onChange={(e) => {
                    const nextPosition = e.target.value as BackgroundPosition;
                    if (BACKGROUND_POSITIONS.includes(nextPosition)) {
                      updateBackground('position', nextPosition);
                    }
                  }}
                >
                  <option value="cover">{t('settings.background_position_cover') || 'Cover (Stretch)'}</option>
                  <option value="contain">{t('settings.background_position_contain') || 'Contain (Fit)'}</option>
                  <option value="center">{t('settings.background_position_center') || 'Center'}</option>
                  <option value="repeat">{t('settings.background_position_repeat') || 'Tile (Repeat)'}</option>
                </Select>
              </div>
            )}
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title={t('settings.ui_scalability') || 'UI Scalability'} defaultExpanded={false}>
        <div className="surface-muted space-y-4 p-4">
          <div className="space-y-2">
            <label className="flex justify-between text-sm font-medium text-foreground">
              <span>{t('settings.ui_zoom') || 'Interface Zoom'}</span>
              <span>{uiScale}%</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="70"
                max="150"
                step="5"
                value={uiScale}
                onChange={(e) => setUiScale(parseInt(e.target.value))}
                className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-700 flex-1"
              />
              <Button size="sm" variant="secondary" onClick={() => setUiScale(100)} disabled={uiScale === 100}>
                {t('settings.reset') || 'Reset'}
              </Button>
            </div>
            <p className="text-xs text-secondary">{t('settings.ui_zoom_desc') || 'Adjust the size of the interface elements.'}</p>
          </div>
          <ToggleRow
            label={t('settings.animations') || 'Enable Animations'}
            checked={!disableAnimations}
            onToggle={() => setDisableAnimations(!disableAnimations)}
          />

          <ToggleRow
            label={t('settings.compact_mode') || 'Compact Mode'}
            checked={compactMode}
            onToggle={() => setCompactMode(!compactMode)}
          />

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {t('settings.sidebar_position') || 'Sidebar Position'}
            </label>
            <div className="flex rounded-[20px] border border-border/60 bg-background/84 p-1 shadow-inner">
              <button
                type="button"
                onClick={() => setSidebarPosition('left')}
                className={cn(
                  'flex-1 rounded-2xl py-2 text-xs font-medium transition-all',
                  sidebarPosition === 'left' ? 'bg-card text-foreground shadow' : 'text-secondary'
                )}
              >
                {t('settings.sidebar_position_left') || 'Left'}
              </button>
              <button
                type="button"
                onClick={() => setSidebarPosition('right')}
                className={cn(
                  'flex-1 rounded-2xl py-2 text-xs font-medium transition-all',
                  sidebarPosition === 'right' ? 'bg-card text-foreground shadow' : 'text-secondary'
                )}
              >
                {t('settings.sidebar_position_right') || 'Right'}
              </button>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {(customTheme.colors || customTheme.background) && (
        <div className="flex justify-end">
          <Button variant="danger" onClick={resetCustomTheme} size="sm">
            {t('settings.reset_custom_theme') || 'Reset Custom Theme'}
          </Button>
        </div>
      )}

      {/* keep a harmless reference to getAccentStyles to avoid unused prop in some builds */}
      <span className="hidden" style={getAccentStyles('text').style} />
    </div >
  );
};
