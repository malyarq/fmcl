export type ComputedContrastKind = 'text' | 'border' | 'focus';

export type ComputedContrastCandidate = Readonly<{
    kind: ComputedContrastKind;
    foreground: string;
    background: string;
    fontSizePx?: number;
    fontWeight?: string | number;
}>;

export type ComputedContrastResult = Readonly<{
    kind: ComputedContrastKind;
    foreground: string;
    background: string;
    threshold: number;
    ratio?: number;
    verdict: 'pass' | 'fail' | 'unsupported';
    failureReason?:
        | 'contrast-below-threshold'
        | 'unsupported-transparent-color'
        | 'unsupported-inherited-color'
        | 'unsupported-unparseable-color';
}>;

export type ComputedColorValue = Readonly<{
    property: string;
    value: string;
}>;

export type ComputedColorSelectionFailure = Readonly<{
    failureReason: 'unsupported-no-opaque-computed-color';
    candidates: readonly ComputedColorValue[];
}>;

type Rgb = readonly [red: number, green: number, blue: number];

const LARGE_TEXT_PX = 24;
const LARGE_BOLD_TEXT_PX = 18.66;
const NORMAL_TEXT_THRESHOLD = 4.5;
const LARGE_TEXT_THRESHOLD = 3;
const NON_TEXT_THRESHOLD = 3;

function unsupportedColorReason(value: string): ComputedContrastResult['failureReason'] {
    const normalized = value.trim().toLowerCase();

    if (normalized === 'transparent' || normalized === 'rgba(0, 0, 0, 0)') {
        return 'unsupported-transparent-color';
    }

    if (normalized === 'inherit' || normalized === 'initial' || normalized === 'unset' || normalized === 'currentcolor') {
        return 'unsupported-inherited-color';
    }

    return 'unsupported-unparseable-color';
}

function parseOpaqueComputedRgb(value: string): Rgb | undefined {
    const normalized = value.trim();
    const match = normalized.match(/^rgba?\((.*)\)$/i);
    if (!match) {
        return undefined;
    }

    const parts = match[1]
        .replace(/\//g, ' ')
        .split(/[\s,]+/)
        .filter(Boolean);
    if (parts.length !== 3 && parts.length !== 4) {
        return undefined;
    }

    const channels = parts.slice(0, 3).map((channel) => Number(channel));
    if (channels.some((channel) => !Number.isInteger(channel) || channel < 0 || channel > 255)) {
        return undefined;
    }

    if (parts.length === 4) {
        const alpha = parts[3].endsWith('%')
            ? Number(parts[3].slice(0, -1)) / 100
            : Number(parts[3]);
        if (!Number.isFinite(alpha) || alpha !== 1) {
            return undefined;
        }
    }

    return [channels[0], channels[1], channels[2]];
}

function relativeLuminance([red, green, blue]: Rgb): number {
    const linear = [red, green, blue].map((channel) => {
        const srgb = channel / 255;
        return srgb <= 0.04045
            ? srgb / 12.92
            : ((srgb + 0.055) / 1.055) ** 2.4;
    });

    return (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2]);
}

function contrastRatio(foreground: Rgb, background: Rgb): number {
    const foregroundLuminance = relativeLuminance(foreground);
    const backgroundLuminance = relativeLuminance(background);
    const lighter = Math.max(foregroundLuminance, backgroundLuminance);
    const darker = Math.min(foregroundLuminance, backgroundLuminance);

    return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(4));
}

function isLargeText(candidate: ComputedContrastCandidate): boolean {
    const fontSizePx = candidate.fontSizePx ?? 0;
    if (fontSizePx >= LARGE_TEXT_PX) {
        return true;
    }

    const fontWeight = typeof candidate.fontWeight === 'number'
        ? candidate.fontWeight
        : Number(candidate.fontWeight ?? 400);
    return fontSizePx >= LARGE_BOLD_TEXT_PX && fontWeight >= 700;
}

function thresholdFor(candidate: ComputedContrastCandidate): number {
    if (candidate.kind !== 'text') {
        return NON_TEXT_THRESHOLD;
    }

    return isLargeText(candidate) ? LARGE_TEXT_THRESHOLD : NORMAL_TEXT_THRESHOLD;
}

export function evaluateComputedContrastCandidate(
    candidate: ComputedContrastCandidate,
): ComputedContrastResult {
    const threshold = thresholdFor(candidate);
    const foreground = parseOpaqueComputedRgb(candidate.foreground);
    if (!foreground) {
        return {
            ...candidate,
            threshold,
            verdict: 'unsupported',
            failureReason: unsupportedColorReason(candidate.foreground),
        };
    }

    const background = parseOpaqueComputedRgb(candidate.background);
    if (!background) {
        return {
            ...candidate,
            threshold,
            verdict: 'unsupported',
            failureReason: unsupportedColorReason(candidate.background),
        };
    }

    const ratio = contrastRatio(foreground, background);
    return {
        ...candidate,
        threshold,
        ratio,
        verdict: ratio >= threshold ? 'pass' : 'fail',
        failureReason: ratio >= threshold ? undefined : 'contrast-below-threshold',
    };
}

export function selectComputedColorCandidate(
    candidates: readonly ComputedColorValue[],
): ComputedColorValue | ComputedColorSelectionFailure {
    const selected = candidates.find((candidate) => parseOpaqueComputedRgb(candidate.value));
    return selected ?? {
        failureReason: 'unsupported-no-opaque-computed-color',
        candidates,
    };
}
