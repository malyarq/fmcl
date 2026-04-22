import React, { useRef } from 'react';
import { Download, Paintbrush2, Sparkles, Upload } from 'lucide-react';
import { cn } from '../../../utils/cn';
import { useSettings } from '../../../contexts/SettingsContext';
import { CollapsibleSection } from '../../ui/CollapsibleSection';
import { Input } from '../../ui/Input';
import { Button } from '../../ui/Button';
import { Select } from '../../ui/Select';
import {
  getThemeModeLabel,
  getThemePreset,
  getThemePresetLabel,
  getThemePresetSummary,
  THEME_PRESETS,
} from '../../../contexts/settings/theme-presets';
import { extractThemeOverrides } from '../../../contexts/settings/theme';
import type { CustomThemeConfig, ThemePresetId } from '../../../contexts/settings/types';

const COLORS = [
  { id: 'emerald', class: 'bg-emerald-500' },
  { id: 'blue', class: 'bg-blue-500' },
  { id: 'purple', class: 'bg-purple-500' },
  { id: 'orange', class: 'bg-orange-500' },
  { id: 'rose', class: 'bg-rose-500' },
] as const;

type BackgroundConfig = NonNullable<CustomThemeConfig['background']>;
type BackgroundParticlesConfig = NonNullable<BackgroundConfig['particles']>;
type BackgroundParticleType = NonNullable<BackgroundParticlesConfig['type']>;
type BackgroundType = NonNullable<BackgroundConfig['type']>;
type BackgroundPosition = NonNullable<BackgroundConfig['position']>;

const BACKGROUND_TYPES: readonly BackgroundType[] = ['image', 'video', 'particles'];
const BACKGROUND_POSITIONS: readonly BackgroundPosition[] = ['cover', 'contain', 'center', 'repeat'];
const BACKGROUND_PARTICLE_TYPES: readonly BackgroundParticleType[] = ['stars', 'snow', 'rain'];

function translateWithFallback(
  t: (key: string, params?: Record<string, string | number>) => string,
  key: string,
  fallback: string,
  params?: Record<string, string | number>,
): string {
  const translated = t(key, params);
  if (translated !== key) {
    return translated;
  }

  if (!params) {
    return fallback;
  }

  return Object.entries(params).reduce((text, [paramKey, value]) => (
    text.replace(new RegExp(`{{${paramKey}}}`, 'g'), String(value))
  ), fallback);
}

function ToggleRow(props: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  const { label, checked, onToggle } = props;

  return (
    <div className="settings-toggle-row">
      <div className="settings-toggle-copy">
        <p className="settings-toggle-title">{label}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onToggle}
        data-state={checked ? 'checked' : 'unchecked'}
        className="settings-toggle-switch"
      >
        <span
          className="settings-toggle-thumb"
          data-state={checked ? 'checked' : 'unchecked'}
        />
      </button>
    </div>
  );
}

interface AppearanceTabProps {
  embedded?: boolean;
}

export const AppearanceTab: React.FC<AppearanceTabProps> = ({ embedded = false }) => {
  const {
    accentColor, setAccentColor,
    theme, setTheme,
    language, setLanguage,
    themePresetId,
    applyThemePreset,
    applyAppearanceState,
    t,
    getAccentStyles,
    customTheme, setCustomTheme,
    activeThemeConfig,
    themeRuntimeState,
  } = useSettings();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const customAccentInputRef = useRef<HTMLInputElement>(null);
  const selectedPreset = getThemePreset(themePresetId);
  const themePresetsLabel = translateWithFallback(t, 'settings.theme_presets', 'Theme Presets');
  const themePresetsDescription = translateWithFallback(
    t,
    'settings.theme_presets_desc',
    'Apply a ready-made shell and surface profile, or import/export your own configuration.',
  );
  const themeDescription = translateWithFallback(
    t,
    'settings.theme_desc',
    'Choose the base shell mood of the launcher, then fine-tune accent and background behavior below.',
  );
  const themePresetsPlaceholder = translateWithFallback(
    t,
    'settings.theme_presets_placeholder',
    'Select a preset...',
  );
  const importThemeLabel = translateWithFallback(t, 'settings.import_theme', 'Import');
  const exportThemeLabel = translateWithFallback(t, 'settings.export_theme', 'Export');
  const customThemeExportName = translateWithFallback(
    t,
    'settings.theme_custom_export_name',
    'Custom Theme',
  );
  const selectedPresetLabel = getThemePresetLabel(t, selectedPreset);
  const selectedPresetSummary = getThemePresetSummary(t, selectedPreset, theme);
  const selectedModeLabel = getThemeModeLabel(t, theme);
  const accentRangeStyles = getAccentStyles('accent');
  const accentLabel = t('settings.accent');
  const customColorLabel = t('settings.custom_color') || 'Custom Color';
  const hasCustomizations = themeRuntimeState.hasCustomizations;
  const runtimeModeState = translateWithFallback(
    t,
    themeRuntimeState.matchesPresetDefaultMode
      ? 'settings.theme_mode_default_state'
      : 'settings.theme_mode_variant_state',
    themeRuntimeState.matchesPresetDefaultMode ? 'Preset default' : 'Preset variant',
  );
  const runtimeStateLabel = selectedPreset
    ? translateWithFallback(
      t,
      hasCustomizations
        ? 'settings.theme_runtime_state_customized'
        : 'settings.theme_runtime_state_preset',
      hasCustomizations ? 'Customized preset' : 'Untouched preset',
    )
    : translateWithFallback(t, 'settings.theme_runtime_state_manual', 'Manual appearance');
  const runtimeDescription = selectedPreset
    ? hasCustomizations
      ? translateWithFallback(
        t,
        'settings.theme_runtime_customized_desc',
        '{{preset}} stays active in {{mode}} mode while bounded accent, background, and surface refinements are layered on top.',
        {
          mode: selectedModeLabel,
          preset: selectedPresetLabel ?? selectedPresetSummary ?? customThemeExportName,
        },
      )
      : translateWithFallback(
        t,
        themeRuntimeState.matchesPresetDefaultMode
          ? 'settings.theme_runtime_default_desc'
          : 'settings.theme_runtime_variant_desc',
        themeRuntimeState.matchesPresetDefaultMode
          ? '{{preset}} is active in its default {{mode}} mode. Switch modes to preview the other preset variant without leaving this preset family.'
          : '{{preset}} stays active while you preview its {{mode}} variant instead of the default.',
        {
          mode: selectedModeLabel,
          preset: selectedPresetLabel ?? selectedPresetSummary ?? customThemeExportName,
        },
      )
    : themeDescription;
  const resetPresetLabel = selectedPresetSummary
    ? translateWithFallback(
      t,
      'settings.reset_preset_customizations',
      `Return to ${selectedPresetSummary}`,
      { preset: selectedPresetSummary },
    )
    : t('settings.reset_custom_theme') || 'Reset Custom Theme';
  const resetPresetDescription = selectedPresetSummary
    ? translateWithFallback(
      t,
      'settings.reset_preset_customizations_desc',
      `Remove refinements and return to the untouched ${selectedPresetSummary} runtime contract.`,
      { preset: selectedPresetSummary },
    )
    : '';
  const resetPresetA11yLabel = themePresetId
    ? resetPresetLabel
    : translateWithFallback(
      t,
      'settings.reset_to_preset',
      'Reset to Preset',
    );
  const appearanceHeading = selectedPresetSummary
    || translateWithFallback(t, 'settings.theme_runtime_state_manual', 'Manual appearance');
  const appearanceStateChips = selectedPreset
    ? [runtimeModeState, runtimeStateLabel]
    : [selectedModeLabel];
  const advancedAppearanceScopeDescription = translateWithFallback(
    t,
    'settings.advanced_appearance_scope_desc',
    'These color overrides repaint visible shell surfaces and cards without leaving the active preset family.',
  );
  const backgroundPreviewTitle = translateWithFallback(
    t,
    'settings.background_preview_title',
    'Visible Background Scope',
  );
  const backgroundScopeDescription = translateWithFallback(
    t,
    'settings.background_scope_desc',
    'Background controls repaint the shell frame and backdrop around this modal while the settings panels stay readable on top.',
  );

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

  const handlePresetChange = (presetId: string) => {
    if (!presetId) {
      return;
    }

    applyThemePreset(presetId as ThemePresetId);
  };

  const handleExportTheme = () => {
    const themeData = {
      name: selectedPresetSummary || customThemeExportName,
      accentColor,
      customTheme,
      presetId: themePresetId || undefined,
      theme,
      config: activeThemeConfig
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
          accentColor: string;
          config: CustomThemeConfig;
          customTheme: CustomThemeConfig;
          presetId: ThemePresetId;
          theme: 'light' | 'dark';
        }>;
        const importedTheme = parsed.theme === 'light' ? 'light' : 'dark';
        const importedPresetId = parsed.presetId && getThemePreset(parsed.presetId) ? parsed.presetId : null;
        const importedCustomTheme = parsed.customTheme
          ? parsed.customTheme
          : parsed.config
            ? importedPresetId
              ? extractThemeOverrides(importedTheme, importedPresetId, parsed.config)
              : parsed.config
            : {};

        applyAppearanceState({
          accentColor: typeof parsed.accentColor === 'string' && parsed.accentColor ? parsed.accentColor : accentColor,
          customTheme: importedCustomTheme,
          theme: importedTheme,
          themePresetId: importedPresetId,
        });
      } catch (error) {
        console.error("Failed to parse theme file", error);
      }
    };
    reader.readAsText(file);
  };

  const resetAppearanceCustomizations = () => {
    applyAppearanceState({
      accentColor,
      accentColorSource: 'preset',
      customTheme: {},
      theme,
      themePresetId,
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.12fr)_minmax(18rem,0.88fr)]">
        <div className="settings-section-shell min-w-0 p-5">
          <div className="space-y-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-3">
                {!embedded && (
                  <div className="kicker-label">{t('settings.tab_appearance')}</div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-foreground">
                    {appearanceHeading}
                  </h3>
                  {selectedPreset && hasCustomizations && (
                    <span className="settings-status-chip">
                      {translateWithFallback(t, 'settings.theme_customized_state', 'Customized')}
                    </span>
                  )}
                </div>
                {!embedded && (
                  <p className="text-sm text-secondary">
                    {selectedPreset ? runtimeDescription : themeDescription}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {appearanceStateChips.map((chip) => (
                    <span key={chip} className="settings-status-chip">
                      {chip}
                    </span>
                  ))}
                </div>
                {selectedPreset && hasCustomizations && resetPresetDescription && (
                  <p className="settings-embedded-copy">{resetPresetDescription}</p>
                )}
              </div>

              {hasCustomizations && (
                <Button
                  variant="danger"
                  onClick={resetAppearanceCustomizations}
                  size="sm"
                  aria-label={resetPresetA11yLabel}
                  className="w-full shrink-0 sm:w-auto"
                >
                  {themePresetId
                    ? resetPresetLabel
                    : (t('settings.reset_custom_theme') || 'Reset Custom Theme')}
                </Button>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-secondary" />
                <label className="text-sm font-medium text-foreground">
                  {t('settings.theme')}
                </label>
              </div>
              {!embedded && (
                <p className="text-sm text-secondary">
                  {translateWithFallback(
                    t,
                    'settings.theme_mode_scope_desc',
                    'Light and dark only switch the active runtime variant of the selected preset.',
                  )}
                </p>
              )}
              <div className="settings-segmented-row">
                {(['light', 'dark'] as const).map((m) => (
                  <button
                    type="button"
                    key={m}
                    onClick={() => setTheme(m)}
                    aria-pressed={theme === m}
                    data-state={theme === m ? 'active' : 'inactive'}
                    className="settings-segmented-option"
                  >
                    {m === 'light' ? t('settings.theme_light') : t('settings.theme_dark')}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {themePresetsLabel}
              </label>
              {!embedded && (
                <p className="text-sm text-secondary">
                  {themePresetsDescription}
                </p>
              )}
              <Select
                value={themePresetId || ''}
                onChange={(e) => handlePresetChange(e.target.value)}
                className="w-full"
                aria-label={themePresetsLabel}
              >
                <option value="" disabled>{themePresetsPlaceholder}</option>
                {THEME_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>{getThemePresetLabel(t, preset)}</option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()} className="gap-2 sm:flex-1">
                <Upload className="h-4 w-4" />
                {importThemeLabel}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImportTheme}
              />

              <Button variant="secondary" onClick={handleExportTheme} className="gap-2 sm:flex-1">
                <Download className="h-4 w-4" />
                {exportThemeLabel}
              </Button>
            </div>
          </div>
        </div>

        <div className="settings-section-shell min-w-0 p-5">
          <div className="space-y-5">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Paintbrush2 className="h-4 w-4 text-secondary" />
                <label className="text-sm font-medium text-foreground">
                  {accentLabel}
                </label>
              </div>
              {!embedded && (
                <p className="settings-embedded-copy">
                  {t('settings.appearance_branding_desc') || 'Accent colors personalize launch highlights and active controls without changing the FMCL mark, wordmark, or shell surfaces.'}
                </p>
              )}
              <div className="settings-accent-grid">
                {COLORS.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => setAccentColor(c.id)}
                    aria-pressed={accentColor === c.id}
                    aria-label={`${accentLabel}: ${c.id}`}
                    data-state={accentColor === c.id ? 'active' : 'inactive'}
                    className={cn(
                      'settings-accent-chip',
                      accentColor === c.id ? 'ring-2 scale-110' : '',
                    )}
                    title={c.id}
                  >
                    <span className={cn('settings-accent-swatch', c.class)} />
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => customAccentInputRef.current?.click()}
                  aria-pressed={isCustom}
                  aria-label={`${accentLabel}: ${customColorLabel}`}
                  data-state={isCustom ? 'active' : 'inactive'}
                  className={cn(
                    'settings-accent-chip',
                    isCustom ? 'ring-2 scale-110' : '',
                  )}
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
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="sr-only"
                  tabIndex={-1}
                  aria-label={customColorLabel}
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">
                {t('settings.language')}
              </label>
              <div className="settings-segmented-row">
                {(['en', 'ru'] as const).map((lang) => (
                  <button
                    type="button"
                    key={lang}
                    onClick={() => setLanguage(lang)}
                    aria-pressed={language === lang}
                    data-state={language === lang ? 'active' : 'inactive'}
                    className="settings-segmented-option"
                  >
                    {lang === 'en' ? 'English' : 'Русский'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <CollapsibleSection title={t('settings.advanced_appearance') || 'Advanced Appearance'} defaultExpanded={false}>
        <div className="surface-muted space-y-4 p-4">
          <p className="settings-embedded-copy">
            {advancedAppearanceScopeDescription}
          </p>
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
          <div className="surface-inline space-y-1 p-3" data-testid="appearance-background-scope">
            <p className="kicker-label">{backgroundPreviewTitle}</p>
            <p className="text-sm leading-6 text-secondary">{backgroundScopeDescription}</p>
          </div>

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
                    className={cn('settings-slider', accentRangeStyles.className)}
                    style={accentRangeStyles.style}
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
                    className={cn('settings-slider', accentRangeStyles.className)}
                    style={accentRangeStyles.style}
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
                    className={cn('settings-slider', accentRangeStyles.className)}
                    style={accentRangeStyles.style}
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
                className={cn('settings-slider', accentRangeStyles.className)}
                style={accentRangeStyles.style}
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
                className={cn('settings-slider', accentRangeStyles.className)}
                style={accentRangeStyles.style}
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

      {/* keep a harmless reference to getAccentStyles to avoid unused prop in some builds */}
      <span className="hidden" style={getAccentStyles('text').style} />
    </div >
  );
};
