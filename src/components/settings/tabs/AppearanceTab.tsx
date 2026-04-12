import React, { useRef } from 'react';
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
      {/* Main Appearance Settings */}
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
                title="Custom Color"
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-sm font-medium text-zinc-600 dark:text-zinc-300 mb-2 block">
            {t('settings.theme')}
          </label>
          <div className="flex bg-zinc-100/80 dark:bg-zinc-900/50 backdrop-blur-sm p-1 rounded-xl border border-border shadow-inner">
            {(['light', 'dark'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setTheme(m)}
                className={cn(
                  'flex-1 py-1.5 text-xs font-bold uppercase rounded-lg transition-all',
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
      <div className="space-y-3">
        <label className="text-sm font-medium text-zinc-600 dark:text-zinc-300 mb-2 block">
          Theme Presets
        </label>
        <div className="flex gap-2">
          <Select
            onChange={(e) => applyPreset(e.target.value)}
            className="flex-1"
            defaultValue=""
          >
            <option value="" disabled>Select a Preset...</option>
            {THEME_PRESETS.map(preset => (
              <option key={preset.id} value={preset.id}>{preset.name}</option>
            ))}
          </Select>

          <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
            Import
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImportTheme}
          />

          <Button variant="secondary" onClick={handleExportTheme}>
            Export
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium text-zinc-600 dark:text-zinc-300 mb-2 block">
          {t('settings.language')}
        </label>
        <div className="flex bg-zinc-100 dark:bg-zinc-900/50 p-1 rounded-lg border border-border">
          {(['en', 'ru'] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              className={cn(
                'flex-1 py-1.5 text-xs font-bold uppercase rounded-lg transition-all',
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
        <div className="space-y-4 p-4 bg-zinc-50 dark:bg-zinc-900/30 rounded-lg border border-border">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-500 uppercase">Background Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={customTheme.colors?.background || '#ffffff'}
                  onChange={(e) => updateCustomColor('background', e.target.value)}
                  className="h-8 w-12 cursor-pointer bg-transparent border-none p-0"
                />
                <span className="text-xs text-zinc-500">{customTheme.colors?.background || 'Default'}</span>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-500 uppercase">Card Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={customTheme.colors?.card || '#ffffff'}
                  onChange={(e) => updateCustomColor('card', e.target.value)}
                  className="h-8 w-12 cursor-pointer bg-transparent border-none p-0"
                />
                <span className="text-xs text-zinc-500">{customTheme.colors?.card || 'Default'}</span>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-500 uppercase">Text Main</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={customTheme.colors?.textMain || '#000000'}
                  onChange={(e) => updateCustomColor('textMain', e.target.value)}
                  className="h-8 w-12 cursor-pointer bg-transparent border-none p-0"
                />
                <span className="text-xs text-zinc-500">{customTheme.colors?.textMain || 'Default'}</span>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-500 uppercase">Border Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={customTheme.colors?.border || '#e4e4e7'}
                  onChange={(e) => updateCustomColor('border', e.target.value)}
                  className="h-8 w-12 cursor-pointer bg-transparent border-none p-0"
                />
                <span className="text-xs text-zinc-500">{customTheme.colors?.border || 'Default'}</span>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-500 uppercase">Error Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={customTheme.colors?.error || '#ef4444'}
                  onChange={(e) => updateCustomColor('error', e.target.value)}
                  className="h-8 w-12 cursor-pointer bg-transparent border-none p-0"
                />
                <span className="text-xs text-zinc-500">{customTheme.colors?.error || 'Default'}</span>
              </div>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title={t('settings.background_effects') || 'Background Effects'} defaultExpanded={false}>
        <div className="space-y-4 p-4 bg-zinc-50 dark:bg-zinc-900/30 rounded-lg border border-border">

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
              Background Type
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
              <option value="image">Image</option>
              <option value="video">Video</option>
              <option value="particles">Particles</option>
            </Select>
          </div>

          {(!customTheme.background?.type || customTheme.background.type === 'image') && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                Background Image URL
              </label>
              <Input
                value={customTheme.background?.image || ''}
                onChange={(e) => updateBackground('image', e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="w-full"
              />
              <p className="text-xs text-zinc-500">Enter a URL to an image or leave empty to disable.</p>
            </div>
          )}

          {customTheme.background?.type === 'video' && (
            <div className="space-y-4 border-t border-border pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  Video URL (MP4/WebM)
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
                  placeholder="https://example.com/video.mp4"
                  className="w-full"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200 flex justify-between">
                    <span>Volume</span>
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

                <div className="flex items-center justify-between pt-6">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                    Auto-Pause (Inactive)
                  </label>
                  <div
                    className={cn(
                      "w-11 h-6 bg-zinc-200 rounded-full relative cursor-pointer transition-colors dark:bg-zinc-700",
                      customTheme.background?.video?.autoPause ? "bg-emerald-500" : ""
                    )}
                    onClick={() => {
                      setCustomTheme({
                        ...customTheme,
                        background: { ...customTheme.background, video: { ...customTheme.background?.video, autoPause: !customTheme.background?.video?.autoPause } }
                      });
                    }}
                  >
                    <div className={cn(
                      "w-4 h-4 bg-white rounded-full absolute top-1 transition-transform",
                      customTheme.background?.video?.autoPause ? "left-6" : "left-1"
                    )} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {customTheme.background?.type === 'particles' && (
            <div className="space-y-4 border-t border-border pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  Particle Type
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
                  <option value="stars">Stars</option>
                  <option value="snow">Snow</option>
                  <option value="rain">Rain</option>
                </Select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200 flex justify-between">
                    <span>Intensity</span>
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
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200 flex justify-between">
                    <span>Speed</span>
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
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200 flex justify-between">
                <span>Blur</span>
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
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200 flex justify-between">
                <span>Opacity</span>
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
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  Background Position
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
                  <option value="cover">Cover (Stretch)</option>
                  <option value="contain">Contain (Fit)</option>
                  <option value="center">Center</option>
                  <option value="repeat">Tile (Repeat)</option>
                </Select>
              </div>
            )}
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title={t('settings.ui_scalability') || 'UI Scalability'} defaultExpanded={false}>
        <div className="space-y-4 p-4 bg-zinc-50 dark:bg-zinc-900/30 rounded-lg border border-border">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200 flex justify-between">
              <span>Interface Zoom</span>
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
                Reset
              </Button>
            </div>
            <p className="text-xs text-zinc-500">Adjust the size of the interface elements.</p>
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
              Enable Animations
            </label>
            <div
              className={cn(
                "w-11 h-6 bg-zinc-200 rounded-full relative cursor-pointer transition-colors dark:bg-zinc-700",
                !disableAnimations ? "bg-emerald-500" : ""
              )}
              onClick={() => setDisableAnimations(!disableAnimations)}
            >
              <div className={cn(
                "w-4 h-4 bg-white rounded-full absolute top-1 transition-transform",
                !disableAnimations ? "left-6" : "left-1"
              )} />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
              Compact Mode
            </label>
            <div
              className={cn(
                "w-11 h-6 bg-zinc-200 rounded-full relative cursor-pointer transition-colors dark:bg-zinc-700",
                compactMode ? "bg-emerald-500" : ""
              )}
              onClick={() => setCompactMode(!compactMode)}
            >
              <div className={cn(
                "w-4 h-4 bg-white rounded-full absolute top-1 transition-transform",
                compactMode ? "left-6" : "left-1"
              )} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
              Sidebar Position
            </label>
            <div className="flex bg-zinc-200 dark:bg-zinc-700 p-1 rounded-lg">
              <button
                onClick={() => setSidebarPosition('left')}
                className={cn(
                  "flex-1 py-1 text-xs font-medium rounded-md transition-all",
                  sidebarPosition === 'left' ? "bg-white dark:bg-zinc-600 shadow" : "text-zinc-500"
                )}
              >
                Left
              </button>
              <button
                onClick={() => setSidebarPosition('right')}
                className={cn(
                  "flex-1 py-1 text-xs font-medium rounded-md transition-all",
                  sidebarPosition === 'right' ? "bg-white dark:bg-zinc-600 shadow" : "text-zinc-500"
                )}
              >
                Right
              </button>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {(customTheme.colors || customTheme.background) && (
        <div className="flex justify-end">
          <Button variant="danger" onClick={resetCustomTheme} size="sm">
            Reset Custom Theme
          </Button>
        </div>
      )}

      {/* keep a harmless reference to getAccentStyles to avoid unused prop in some builds */}
      <span className="hidden" style={getAccentStyles('text').style} />
    </div >
  );
};
