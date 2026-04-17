
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

export type VersionRequirementDescriptor =
  | { kind: 'any'; raw: string | string[] | undefined }
  | { kind: 'exact'; version: string; raw: string }
  | { kind: 'minimum'; version: string; inclusive: boolean; raw: string }
  | { kind: 'maximum'; version: string; inclusive: boolean; raw: string }
  | {
      kind: 'between';
      min: string;
      max: string;
      minInclusive: boolean;
      maxInclusive: boolean;
      raw: string;
    }
  | { kind: 'oneOf'; items: VersionRequirementDescriptor[]; raw: string[] }
  | { kind: 'raw'; value: string; raw: string };

function parseSingleRequirement(rangeSpec: string): VersionRequirementDescriptor {
    const range = rangeSpec.trim();

    if (!range || range === '*') {
        return { kind: 'any', raw: rangeSpec };
    }

    if (!range.startsWith('[') && !range.startsWith('(')) {
        return { kind: 'exact', version: range, raw: rangeSpec };
    }

    if (range.startsWith('[') && range.endsWith(']') && !range.includes(',')) {
        const version = range.slice(1, -1).trim();
        return version
            ? { kind: 'exact', version, raw: rangeSpec }
            : { kind: 'raw', value: rangeSpec, raw: rangeSpec };
    }

    const match = range.match(/^([[()])\s*([^,]*)\s*,\s*([^,]*)\s*([\])])$/);
    if (!match) {
        return { kind: 'raw', value: rangeSpec, raw: rangeSpec };
    }

    const [, leftBracket, minVerRaw, maxVerRaw, rightBracket] = match;
    const minVer = minVerRaw.trim();
    const maxVer = maxVerRaw.trim();

    if (minVer && maxVer) {
        if (minVer === maxVer && leftBracket === '[' && rightBracket === ']') {
            return { kind: 'exact', version: minVer, raw: rangeSpec };
        }

        return {
            kind: 'between',
            min: minVer,
            max: maxVer,
            minInclusive: leftBracket === '[',
            maxInclusive: rightBracket === ']',
            raw: rangeSpec,
        };
    }

    if (minVer) {
        return {
            kind: 'minimum',
            version: minVer,
            inclusive: leftBracket === '[',
            raw: rangeSpec,
        };
    }

    if (maxVer) {
        return {
            kind: 'maximum',
            version: maxVer,
            inclusive: rightBracket === ']',
            raw: rangeSpec,
        };
    }

    return { kind: 'any', raw: rangeSpec };
}

export function describeVersionRequirement(rangeSpec: string | string[] | undefined): VersionRequirementDescriptor {
    if (!rangeSpec) {
        return { kind: 'any', raw: rangeSpec };
    }

    if (Array.isArray(rangeSpec)) {
        const parsed = rangeSpec
            .map(parseSingleRequirement)
            .filter((item) => item.kind !== 'any');

        if (parsed.length === 0) {
            return { kind: 'any', raw: rangeSpec };
        }

        if (parsed.length === 1) {
            return parsed[0];
        }

        return { kind: 'oneOf', items: parsed, raw: rangeSpec };
    }

    return parseSingleRequirement(rangeSpec);
}

function requirementMatches(version: string, requirement: VersionRequirementDescriptor): boolean {
    switch (requirement.kind) {
        case 'any':
            return true;
        case 'exact':
            return compareVersions(version, requirement.version) === 0;
        case 'minimum': {
            const cmp = compareVersions(version, requirement.version);
            return requirement.inclusive ? cmp >= 0 : cmp > 0;
        }
        case 'maximum': {
            const cmp = compareVersions(version, requirement.version);
            return requirement.inclusive ? cmp <= 0 : cmp < 0;
        }
        case 'between': {
            const lowerCmp = compareVersions(version, requirement.min);
            const upperCmp = compareVersions(version, requirement.max);
            const lowerOk = requirement.minInclusive ? lowerCmp >= 0 : lowerCmp > 0;
            const upperOk = requirement.maxInclusive ? upperCmp <= 0 : upperCmp < 0;
            return lowerOk && upperOk;
        }
        case 'oneOf':
            return requirement.items.some((item) => requirementMatches(version, item));
        case 'raw':
            return true;
        default:
            return true;
    }
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

    const version = installedVersion.startsWith('v') ? installedVersion.slice(1) : installedVersion;
    return requirementMatches(version, describeVersionRequirement(rangeSpec));
}
