export type LauncherProgressEvent = { type: string; task: number; total: number };

const PROGRESS_TYPES = new Set(['assets', 'natives', 'classes', 'Forge', 'OptiFine']);

export function isTrackableProgressType(type: string) {
  return PROGRESS_TYPES.has(type) || type.startsWith('Java');
}

export function toPercent(task: number, total: number) {
  if (!Number.isFinite(task) || !Number.isFinite(total) || total <= 0) return 0;
  return (task / total) * 100;
}

