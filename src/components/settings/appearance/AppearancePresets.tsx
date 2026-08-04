import React, { useRef } from 'react';
import { Download, Sparkles, Upload } from 'lucide-react';
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
import type { ThemeRuntimeState } from '../../../contexts/settings/theme';
import type {
  AccentColor,
  AppearanceSettingsState,
  CustomThemeConfig,
  Theme,
  ThemePresetId,
} from '../../../contexts/settings/types';

type Translate = (key: string, params?: Record<string, string | number>) => string;

function translateWithFallback(
  t: Translate,
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

  return Object.entries(params).reduce(
    (text, [paramKey, value]) => text.replace(new RegExp(`{{${paramKey}}}`, 'g'), String(value)),
    fallback,
  );
}

interface AppearancePresetsProps {
  accentColor: AccentColor;
  activeThemeConfig: CustomThemeConfig;
  customTheme: CustomThemeConfig;
  embedded: boolean;
  onAppearanceStateChange: (state: AppearanceSettingsState) => void;
  onPresetChange: (presetId: ThemePresetId) => void;
  onThemeChange: (theme: Theme) => void;
  t: Translate;
  theme: Theme;
  themePresetId: ThemePresetId | null;
  themeRuntimeState: ThemeRuntimeState;
}

export function AppearancePresets({
  accentColor,
  activeThemeConfig,
  customTheme,
  embedded,
  onAppearanceStateChange,
  onPresetChange,
  onThemeChange,
  t,
  theme,
  themePresetId,
  themeRuntimeState,
}: AppearancePresetsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  const customThemeExportName = translateWithFallback(
    t,
    'settings.theme_custom_export_name',
    'Custom Theme',
  );
  const selectedPresetLabel = getThemePresetLabel(t, selectedPreset);
  const selectedPresetSummary = getThemePresetSummary(t, selectedPreset, theme);
  const selectedModeLabel = getThemeModeLabel(t, theme);
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
    : translateWithFallback(t, 'settings.reset_custom_theme', 'Reset Custom Theme');
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
    : translateWithFallback(t, 'settings.reset_to_preset', 'Reset to Preset');
  const appearanceHeading = selectedPresetSummary
    || translateWithFallback(t, 'settings.theme_runtime_state_manual', 'Manual appearance');
  const appearanceStateChips = selectedPreset
    ? [runtimeModeState, runtimeStateLabel]
    : [selectedModeLabel];

  const handleExportTheme = () => {
    const themeData = {
      name: selectedPresetSummary || customThemeExportName,
      accentColor,
      customTheme,
      presetId: themePresetId || undefined,
      theme,
      config: activeThemeConfig,
    };
    const blob = new Blob([JSON.stringify(themeData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'friend-launcher-theme.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportTheme = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        if (typeof loadEvent.target?.result !== 'string') {
          return;
        }

        const parsed = JSON.parse(loadEvent.target.result) as Partial<{
          accentColor: string;
          config: CustomThemeConfig;
          customTheme: CustomThemeConfig;
          presetId: ThemePresetId;
          theme: Theme;
        }>;
        const importedTheme: Theme = parsed.theme === 'light' ? 'light' : 'dark';
        const importedPresetId = parsed.presetId && getThemePreset(parsed.presetId)
          ? parsed.presetId
          : null;
        const importedCustomTheme = parsed.customTheme
          ? parsed.customTheme
          : parsed.config
            ? importedPresetId
              ? extractThemeOverrides(importedTheme, importedPresetId, parsed.config)
              : parsed.config
            : {};

        onAppearanceStateChange({
          accentColor: typeof parsed.accentColor === 'string' && parsed.accentColor
            ? parsed.accentColor
            : accentColor,
          customTheme: importedCustomTheme,
          theme: importedTheme,
          themePresetId: importedPresetId,
        });
      } catch (error) {
        console.error('Failed to parse theme file', error);
      }
    };
    reader.readAsText(file);
  };

  const resetAppearanceCustomizations = () => {
    onAppearanceStateChange({
      accentColor,
      accentColorSource: 'preset',
      customTheme: {},
      theme,
      themePresetId,
    });
  };

  return (
    <section
      className="settings-section-shell min-w-0 p-5"
      data-appearance-owner="presets"
      data-testid="appearance-presets"
    >
      <div className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3">
            {!embedded && <div className="kicker-label">{t('settings.tab_appearance')}</div>}
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-foreground">{appearanceHeading}</h3>
              {selectedPreset && hasCustomizations && (
                <span className="settings-status-chip">
                  {translateWithFallback(t, 'settings.theme_customized_state', 'Customized')}
                </span>
              )}
            </div>
            {!embedded && <p className="text-sm text-secondary">{runtimeDescription}</p>}
            <div className="flex flex-wrap gap-2">
              {appearanceStateChips.map((chip) => (
                <span key={chip} className="settings-status-chip">{chip}</span>
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
              {resetPresetLabel}
            </Button>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles aria-hidden="true" className="h-4 w-4 text-secondary" />
            <span className="text-sm font-medium text-foreground">{t('settings.theme')}</span>
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
            {(['light', 'dark'] as const).map((mode) => (
              <button
                type="button"
                key={mode}
                onClick={() => onThemeChange(mode)}
                aria-pressed={theme === mode}
                data-state={theme === mode ? 'active' : 'inactive'}
                className="settings-segmented-option"
              >
                {mode === 'light' ? t('settings.theme_light') : t('settings.theme_dark')}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">{themePresetsLabel}</label>
          {!embedded && <p className="text-sm text-secondary">{themePresetsDescription}</p>}
          <Select
            value={themePresetId || ''}
            onChange={(event) => {
              if (event.target.value) {
                onPresetChange(event.target.value as ThemePresetId);
              }
            }}
            className="w-full"
            aria-label={themePresetsLabel}
          >
            <option value="" disabled>
              {translateWithFallback(t, 'settings.theme_presets_placeholder', 'Select a preset...')}
            </option>
            {THEME_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>{getThemePresetLabel(t, preset)}</option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            className="gap-2 sm:flex-1"
          >
            <Upload aria-hidden="true" className="h-4 w-4" />
            {translateWithFallback(t, 'settings.import_theme', 'Import')}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImportTheme}
          />
          <Button variant="secondary" onClick={handleExportTheme} className="gap-2 sm:flex-1">
            <Download aria-hidden="true" className="h-4 w-4" />
            {translateWithFallback(t, 'settings.export_theme', 'Export')}
          </Button>
        </div>
      </div>
    </section>
  );
}
