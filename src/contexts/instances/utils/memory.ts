import type { ModpackConfig } from '../types';

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function toMbFromGb(gb: number) {
  const v = gb * 1024;
  return Math.round(v);
}

export function toGbFromMb(mb: number) {
  return mb / 1024;
}

export function getInstanceRamGb(cfg: ModpackConfig | null | undefined, fallbackGb = 4) {
  const mb = cfg?.memory?.maxMb;
  if (typeof mb === 'number' && Number.isFinite(mb) && mb > 0) return toGbFromMb(mb);
  return fallbackGb;
}

