import type React from 'react';

// Accent color can be a preset name or a custom hex string.
export type AccentColor = string;
export type Language = 'en' | 'ru';
export type Theme = 'dark' | 'light';
export type ThemePresetId = 'default' | 'midnight' | 'forest' | 'light-plus' | 'navy';
export type DownloadProvider = 'mojang' | 'bmcl' | 'auto';

// Global UI mode for Phase 0 split between simple play and modpacks.
export type UIMode = 'simple' | 'modpacks';

export type AccentStyleType =
  | 'bg'
  | 'text'
  | 'border'
  | 'ring'
  | 'hover'
  | 'accent'
  | 'title'
  | 'soft-bg'
  | 'soft-border';

export type BrandThemeConfig = {
  mediaBorder?: string;
  mediaFrame?: string;
  markBorder?: string;
  markFrame?: string;
  markGlow?: string;
  shellGlow?: string;
  surfaceCardShadow?: string;
  surfacePanelShadow?: string;
  surfaceSoftShadow?: string;
  wordmarkSpacing?: string;
  wordmarkWeight?: string;
};

export type CustomThemeConfig = {
  colors?: {
    background?: string;
    card?: string;
    textMain?: string;
    textSecondary?: string;
    border?: string;
    error?: string;
  };
  background?: {
    image?: string; // URL or base64
    blur?: number;
    opacity?: number;
    type?: 'image' | 'video' | 'particles';
    position?: 'center' | 'cover' | 'contain' | 'repeat';
    video?: {
      url?: string;
      volume?: number;
      loop?: boolean;
      autoPause?: boolean;
    };
    particles?: {
      type?: 'snow' | 'rain' | 'stars';
      intensity?: number;
      speed?: number;
    };
  };
  brand?: BrandThemeConfig;
};

export type AccentStyleResult = { className?: string; style?: React.CSSProperties };

export type AppearanceSettingsState = {
  accentColor: AccentColor;
  accentColorSource?: 'preset' | 'user';
  customTheme: CustomThemeConfig;
  theme: Theme;
  themePresetId: ThemePresetId | null;
};
