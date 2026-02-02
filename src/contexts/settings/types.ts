import type React from 'react';

// Accent color can be a preset name or a custom hex string.
export type AccentColor = string;
export type Language = 'en' | 'ru';
export type Theme = 'dark' | 'light';
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

export type AccentStyleResult = { className?: string; style?: React.CSSProperties };

