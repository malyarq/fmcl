import type { CustomThemeConfig } from './types';

export interface ThemePreset {
    id: string;
    name: string;
    theme: 'light' | 'dark';
    config: CustomThemeConfig;
}

export const THEME_PRESETS: ThemePreset[] = [
    {
        id: 'default-dark',
        name: 'Default Dark',
        theme: 'dark',
        config: {}
    },
    {
        id: 'midnight',
        name: 'Midnight',
        theme: 'dark',
        config: {
            colors: {
                background: '#09090b', // zinc-950
                card: '#18181b', // zinc-900
                textMain: '#fafafa', // zinc-50
                textSecondary: '#a1a1aa', // zinc-400
                border: '#27272a', // zinc-800
                error: '#ef4444' // red-500
            }
        }
    },
    {
        id: 'forest',
        name: 'Forest',
        theme: 'dark',
        config: {
            colors: {
                background: '#052e16', // emerald-950
                card: '#064e3b', // emerald-900
                textMain: '#ecfdf5', // emerald-50
                textSecondary: '#6ee7b7', // emerald-300
                border: '#065f46', // emerald-800
                error: '#f87171' // red-400
            }
        }
    },
    {
        id: 'light-plus',
        name: 'Light+',
        theme: 'light',
        config: {
            colors: {
                background: '#ffffff',
                card: '#f4f4f5', // zinc-100
                textMain: '#18181b', // zinc-900
                textSecondary: '#52525b', // zinc-600
                border: '#e4e4e7', // zinc-200
                error: '#dc2626' // red-600
            }
        }
    },
    {
        id: 'navy',
        name: 'Navy',
        theme: 'dark',
        config: {
            colors: {
                background: '#0f172a', // slate-900
                card: '#1e293b', // slate-800
                textMain: '#f8fafc', // slate-50
                textSecondary: '#94a3b8', // slate-400
                border: '#334155', // slate-700
                error: '#ef4444' // red-500
            }
        }
    }
];
