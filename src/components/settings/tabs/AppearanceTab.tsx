import React from 'react';
import { useSettings } from '../../../contexts/SettingsContext';
import type { CustomThemeConfig } from '../../../contexts/settings/types';
import { AppearanceBackgroundControls } from '../appearance/AppearanceBackgroundControls';
import {
  AppearanceBranding,
  AppearanceSurfaceColors,
} from '../appearance/AppearanceBranding';
import { AppearancePresets } from '../appearance/AppearancePresets';

interface AppearanceTabProps {
  embedded?: boolean;
}

export const AppearanceTab: React.FC<AppearanceTabProps> = ({ embedded = false }) => {
  const {
    accentColor,
    activeThemeConfig,
    applyAppearanceState,
    applyThemePreset,
    customTheme,
    getAccentStyles,
    language,
    setAccentColor,
    setCustomTheme,
    setLanguage,
    setTheme,
    t,
    theme,
    themePresetId,
    themeRuntimeState,
  } = useSettings();

  const updateColor = (
    key: keyof NonNullable<CustomThemeConfig['colors']>,
    value: string,
  ) => {
    setCustomTheme({
      ...customTheme,
      colors: {
        ...customTheme.colors,
        [key]: value,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div
        className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.12fr)_minmax(18rem,0.88fr)]"
        data-testid="appearance-primary-grid"
      >
        <AppearancePresets
          accentColor={accentColor}
          activeThemeConfig={activeThemeConfig}
          customTheme={customTheme}
          embedded={embedded}
          onAppearanceStateChange={applyAppearanceState}
          onPresetChange={applyThemePreset}
          onThemeChange={setTheme}
          t={t}
          theme={theme}
          themePresetId={themePresetId}
          themeRuntimeState={themeRuntimeState}
        />
        <AppearanceBranding
          accentColor={accentColor}
          embedded={embedded}
          language={language}
          onAccentColorChange={setAccentColor}
          onLanguageChange={setLanguage}
          t={t}
        />
      </div>

      <AppearanceSurfaceColors
        colors={customTheme.colors}
        onColorChange={updateColor}
        t={t}
      />
      <AppearanceBackgroundControls
        accentRangeStyles={getAccentStyles('accent')}
        background={customTheme.background}
        onChange={(background) => setCustomTheme({ ...customTheme, background })}
        t={t}
      />

      <span className="hidden" style={getAccentStyles('text').style} />
    </div>
  );
};
