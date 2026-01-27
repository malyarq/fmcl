/**
 * Parse arguments from a textarea-like input.
 * Supports simple quoting with "..." and '...'.
 */
export function parseArgs(raw: string): string[] {
  const s = (raw || '').trim();
  if (!s) return [];
  const out: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const token = (m[1] ?? m[2] ?? m[3] ?? '').trim();
    if (token) out.push(token);
  }
  return out;
}

/**
 * Format an argv array into a newline-separated textarea-like string.
 */
export function formatArgs(args: unknown): string {
  if (!Array.isArray(args)) return '';
  return args
    .filter((x) => typeof x === 'string')
    .map((x) => x.trim())
    .filter(Boolean)
    .join('\n');
}

