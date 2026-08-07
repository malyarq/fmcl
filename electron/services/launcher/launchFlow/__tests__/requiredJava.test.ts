import { describe, expect, it } from 'vitest';
import { getRequiredJavaForMinecraftVersion } from '../requiredJava';

describe('Minecraft Java requirement', () => {
  it.each([
    ['1.12.2', 8],
    ['1.16.5', 8],
    ['1.17', 17],
    ['1.20.4', 17],
    ['1.20.5', 21],
    ['1.21.8', 21],
    ['26.1', 25],
    ['26.2', 25],
  ] as const)('maps %s to Java %s', (version, expected) => {
    expect(getRequiredJavaForMinecraftVersion(version)).toBe(expected);
  });
});
