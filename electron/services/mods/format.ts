import type { ModEntry } from './types';

export function formatModLine(m: ModEntry) {
  const loader = m.loaders.length > 0 ? m.loaders.join('+') : 'unknown';
  const namePart = m.name && m.name !== m.id ? ` (${m.name})` : '';
  return `${m.id}${namePart} @ ${m.version} [${loader}]`;
}

export function groupByFile(mods: ModEntry[]) {
  const by = new Map<string, ModEntry[]>();
  for (const m of mods) {
    const key = m.file.path;
    const arr = by.get(key) ?? [];
    arr.push(m);
    by.set(key, arr);
  }
  return by;
}

