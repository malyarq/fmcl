import React from 'react';

export interface VersionHint {
    text: string;
    className?: string; // Tailwind class
    style?: React.CSSProperties; // Dynamic style from settings
}

/**
 * Get community notes/hints for specific Minecraft versions.
 * Useful for warning users about Forge compatibility or stability.
 * 
 * @param _v Version string (e.g., "1.12.2")
 * @param _t Translation function
 * @param _accentStyle Accent style for positive hints
 * @returns Hint object or null
 */
export const getVersionHint = (_v: string, _t: (key: string) => string, _accentStyle: Record<string, unknown>): VersionHint | null => {
    return null;
};
