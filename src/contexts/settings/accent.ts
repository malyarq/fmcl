import type { AccentStyleResult, AccentStyleType } from './types';

// Preset styles are static to prevent Tailwind purging.
const PRESET_STYLES: Record<string, Record<string, string>> = {
  emerald: {
    bg: 'bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white',
    text: 'text-emerald-500 dark:text-emerald-400',
    border: 'focus:border-emerald-500 dark:focus:border-emerald-400',
    hover: 'hover:text-emerald-600 dark:hover:text-emerald-300',
    ring: 'focus:ring-emerald-500/20',
    accent: 'accent-emerald-500 dark:accent-emerald-400',
    title: 'text-emerald-600 dark:text-emerald-400',
  },
  blue: {
    bg: 'bg-blue-600 hover:bg-blue-500 dark:bg-blue-600 dark:hover:bg-blue-500 text-white',
    text: 'text-blue-500 dark:text-blue-400',
    border: 'focus:border-blue-500 dark:focus:border-blue-400',
    hover: 'hover:text-blue-600 dark:hover:text-blue-300',
    ring: 'focus:ring-blue-500/20',
    accent: 'accent-blue-500 dark:accent-blue-400',
    title: 'text-blue-600 dark:text-blue-400',
  },
  purple: {
    bg: 'bg-purple-600 hover:bg-purple-500 dark:bg-purple-600 dark:hover:bg-purple-500 text-white',
    text: 'text-purple-500 dark:text-purple-400',
    border: 'focus:border-purple-500 dark:focus:border-purple-400',
    hover: 'hover:text-purple-600 dark:hover:text-purple-300',
    ring: 'focus:ring-purple-500/20',
    accent: 'accent-purple-500 dark:accent-purple-400',
    title: 'text-purple-600 dark:text-purple-400',
  },
  orange: {
    bg: 'bg-orange-600 hover:bg-orange-500 dark:bg-orange-600 dark:hover:bg-orange-500 text-white',
    text: 'text-orange-500 dark:text-orange-400',
    border: 'focus:border-orange-500 dark:focus:border-orange-400',
    hover: 'hover:text-orange-600 dark:hover:text-orange-300',
    ring: 'focus:ring-orange-500/20',
    accent: 'accent-orange-500 dark:accent-orange-400',
    title: 'text-orange-600 dark:text-orange-400',
  },
  rose: {
    bg: 'bg-rose-600 hover:bg-rose-500 dark:bg-rose-600 dark:hover:bg-rose-500 text-white',
    text: 'text-rose-500 dark:text-rose-400',
    border: 'focus:border-rose-500 dark:focus:border-rose-400',
    hover: 'hover:text-rose-600 dark:hover:text-rose-300',
    ring: 'focus:ring-rose-500/20',
    accent: 'accent-rose-500 dark:accent-rose-400',
    title: 'text-rose-600 dark:text-rose-400',
  },
};

const PRESET_KEYS = Object.keys(PRESET_STYLES);

const PRESET_HEX_MAP: Record<string, string> = {
  emerald: '#10b981',
  blue: '#3b82f6',
  purple: '#a855f7',
  orange: '#f97316',
  rose: '#f43f5e',
};

function isPreset(color: string) {
  return PRESET_KEYS.includes(color);
}

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getAccentHexForColor(accentColor: string) {
  const color = accentColor || 'emerald';
  return isPreset(color) ? PRESET_HEX_MAP[color] : color;
}

export function getAccentStylesForColor(accentColor: string, type: AccentStyleType): AccentStyleResult {
  const color = accentColor || 'emerald';

  if (isPreset(color)) {
    if (type === 'soft-bg') return { className: `bg-${color}-500/10` };
    if (type === 'soft-border') return { className: `border-${color}-500/20` };
    return { className: PRESET_STYLES[color][type] || '' };
  }

  if (type === 'bg') return { style: { backgroundColor: color, color: '#fff' } };
  if (type === 'text') return { style: { color } };
  if (type === 'title') return { style: { color } };
  if (type === 'border') return { style: { borderColor: color } };
  if (type === 'accent') return { style: { accentColor: color } };
  if (type === 'soft-bg') return { style: { backgroundColor: hexToRgba(color, 0.1) } };
  if (type === 'soft-border') return { style: { borderColor: hexToRgba(color, 0.2) } };

  return {};
}

// Replace placeholder 'XXX' with preset colors when possible.
export function getAccentClassForColor(accentColor: string, tailwindClasses: string) {
  if (isPreset(accentColor)) {
    return tailwindClasses.replace(/XXX/g, accentColor);
  }
  return tailwindClasses.replace(/XXX/g, 'emerald');
}

/**
 * Hidden div class list to prevent Tailwind from purging preset color classes.
 */
export function getPresetAccentSafelistClassName() {
  return Object.values(PRESET_STYLES).flatMap((s) => Object.values(s)).join(' ');
}

