export interface VersionHint {
    text: string;
    className?: string; // Tailwind class
    style?: React.CSSProperties; // Dynamic style from settings
}

/**
 * Get community notes/hints for specific Minecraft versions.
 * Useful for warning users about Forge compatibility or stability.
 * 
 * @param v Version string (e.g., "1.12.2")
 * @param t Translation function
 * @param accentStyle Accent style for positive hints
 * @returns Hint object or null
 */
export const getVersionHint = (v: string, t: (key: string) => string, accentStyle: any): VersionHint | null => {

    // Legends
    if (v === '1.6.4') return { text: `✅ ${t('hint.stable')}`, ...accentStyle };
    if (v === '1.12.2') return { text: `🏆 ${t('hint.classic')}`, ...accentStyle };
    if (v === '1.7.10') return { text: `⭐ ${t('hint.legendary')}`, ...accentStyle };

    const parts = v.split('.');
    const major = parseInt(parts[1] || '0');
    const minor = parseInt(parts[2] || '0');

    // Known Issues
    if (v === '1.6.2' || v === '1.8.8' || v === '1.10.1') return { text: '⚠️ Known Issue: Forge Libraries (Scala)', className: 'text-amber-400' };
    if (v === '1.7.2') return { text: '⚠️ Known Issue: Forge Connection', className: 'text-amber-400' };

    // No Forge Support (roughly)
    if (v.startsWith('1.8') && v !== '1.8.9' && v !== '1.8.0') return { text: `❌ ${t('hint.no_forge')}`, className: 'text-red-400' };
    if (v.startsWith('1.9') && major === 9 && minor <= 3) return { text: `❌ ${t('hint.no_forge')}`, className: 'text-red-400' };
    if (v === '1.11.1') return { text: `❌ ${t('hint.no_forge')}`, className: 'text-red-400' };

    // Dev / Unstable
    if (major >= 13) return { text: `🚧 ${t('hint.dev')}`, className: 'text-yellow-400' };

    // Download Errors
    if (v === '1.8.9' || v === '1.9.4' || v === '1.10') return { text: '⚠️ Potential Download Error', className: 'text-amber-400' };

    return null;
};
