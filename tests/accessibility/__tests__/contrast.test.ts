import { describe, expect, it } from 'vitest';
import {
    evaluateComputedContrastCandidate,
    selectComputedColorCandidate,
} from '../contrast';

describe('evaluateComputedContrastCandidate', () => {
    it('measures opaque black text on white and applies the normal-text threshold', () => {
        expect(evaluateComputedContrastCandidate({
            kind: 'text',
            foreground: 'rgb(0, 0, 0)',
            background: 'rgb(255, 255, 255)',
            fontSizePx: 16,
            fontWeight: '400',
        })).toEqual(expect.objectContaining({
            ratio: 21,
            threshold: 4.5,
            verdict: 'pass',
        }));
    });

    it('fails normal text below 4.5:1 and preserves the measured colors', () => {
        expect(evaluateComputedContrastCandidate({
            kind: 'text',
            foreground: 'rgb(119, 119, 119)',
            background: 'rgb(255, 255, 255)',
            fontSizePx: 16,
            fontWeight: '400',
        })).toEqual(expect.objectContaining({
            foreground: 'rgb(119, 119, 119)',
            background: 'rgb(255, 255, 255)',
            threshold: 4.5,
            verdict: 'fail',
            failureReason: 'contrast-below-threshold',
        }));
    });

    it('allows large bold text and focus indicators at the 3:1 boundary', () => {
        expect(evaluateComputedContrastCandidate({
            kind: 'text',
            foreground: 'rgb(148, 148, 148)',
            background: 'rgb(255, 255, 255)',
            fontSizePx: 19,
            fontWeight: '700',
        })).toEqual(expect.objectContaining({
            threshold: 3,
            verdict: 'pass',
        }));

        expect(evaluateComputedContrastCandidate({
            kind: 'focus',
            foreground: 'rgb(148, 148, 148)',
            background: 'rgb(255, 255, 255)',
        })).toEqual(expect.objectContaining({
            threshold: 3,
            verdict: 'pass',
        }));
    });

    it.each([
        'transparent',
        'rgba(0, 0, 0, 0.5)',
        'inherit',
        'not-a-color',
    ])('fails closed for unsupported computed foreground %s', (foreground) => {
        expect(evaluateComputedContrastCandidate({
            kind: 'text',
            foreground,
            background: 'rgb(255, 255, 255)',
            fontSizePx: 16,
            fontWeight: '400',
        })).toEqual(expect.objectContaining({
            verdict: 'unsupported',
            failureReason: expect.stringMatching(/^unsupported-/),
        }));
    });
});

describe('selectComputedColorCandidate', () => {
    it('selects declared opaque browser values and fails closed when none are usable', () => {
        expect(selectComputedColorCandidate([
            { property: 'color', value: 'inherit' },
            { property: 'color', value: 'rgb(0, 0, 0)' },
        ])).toEqual({ property: 'color', value: 'rgb(0, 0, 0)' });

        expect(selectComputedColorCandidate([
            { property: 'outlineColor', value: 'transparent' },
        ])).toEqual(expect.objectContaining({
            failureReason: 'unsupported-no-opaque-computed-color',
        }));
    });
});
