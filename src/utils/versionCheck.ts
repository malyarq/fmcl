
/**
 * Simple version comparator.
 * Returns -1 if a < b, 1 if a > b, 0 if a == b.
 */
function compareVersions(a: string, b: string): number {
    const pa = a.split(/[-.]/);
    const pb = b.split(/[-.]/);
    const len = Math.max(pa.length, pb.length);

    for (let i = 0; i < len; i++) {
        const na = parseInt(pa[i] || '0', 10);
        const nb = parseInt(pb[i] || '0', 10);

        // If not a number, compare as strings
        if (isNaN(na) || isNaN(nb)) {
            const sa = pa[i] || '';
            const sb = pb[i] || '';
            if (sa < sb) return -1;
            if (sa > sb) return 1;
            continue;
        }

        if (na > nb) return 1;
        if (na < nb) return -1;
    }
    return 0;
}

/**
 * Checks if a version satisfies a Maven-style version range.
 * Examples:
 * - "[1.0]" : Exact version 1.0
 * - "[1.0,)" : 1.0 or greater (inclusive 1.0, inclusive infinity)
 * - "(1.0,)" : Greater than 1.0 (exclusive 1.0)
 * - "[1.0, 2.0]" : Between 1.0 and 2.0 (inclusive)
 * - "(,2.0)" : Less than 2.0
 */
export function isVersionCompatible(installedVersion: string, rangeSpec: string | string[] | undefined): boolean {
    if (!rangeSpec) return true;
    if (!installedVersion) return false;

    const ranges = Array.isArray(rangeSpec) ? rangeSpec : [rangeSpec];
    const version = installedVersion.startsWith('v') ? installedVersion.slice(1) : installedVersion;

    // Start optimistic: if any range in the list is satisfied, return true.
    return ranges.some(range => {
        range = range.trim();
        if (!range || range === '*') return true;

        // Strict exact match if no brackets/parens (or simple string)
        // Actually in Mods, often "1.2.3" means "at least 1.2.3" or "exact" depend on context.
        // For now, let's assume if it doesn't have [ or (, it is a minimum version or exact.
        // But safely: if it doesn't look like a range, compare exact.
        if (!range.startsWith('[') && !range.startsWith('(')) {
            return compareVersions(version, range) === 0;
        }

        // Parse range
        // Format: startChar ( [ ) minVersion , maxVersion endChar ( ] )
        const match = range.match(/^([[(])([^,]*),([^,]*)([\])])$/);
        if (!match) {
            // Fallback for single strict range like "[1.2.3]"
            if (range.startsWith('[') && range.endsWith(']')) {
                const v = range.slice(1, -1);
                return compareVersions(version, v) === 0;
            }
            return true; // Unknown format
        }

        const [, leftBracket, minVer, maxVer, rightBracket] = match;

        // Check lower bound
        if (minVer) {
            const cmp = compareVersions(version, minVer.trim());
            if (leftBracket === '[' && cmp < 0) return false; // inclusive: must be >= 0
            if (leftBracket === '(' && cmp <= 0) return false; // exclusive: must be > 0
        }

        // Check upper bound
        if (maxVer) {
            const cmp = compareVersions(version, maxVer.trim());
            if (rightBracket === ']' && cmp > 0) return false;
            if (rightBracket === ')' && cmp >= 0) return false;
        }

        return true;
    });
}
