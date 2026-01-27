import fs from 'node:fs';
import path from 'node:path';

export function nowIsoCompact(): string {
  const iso = new Date().toISOString();
  return iso.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z').replace('T', '-');
}

export function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return JSON.stringify({ error: 'Failed to stringify value' }, null, 2);
  }
}

export function createFileLogger(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, '', { encoding: 'utf8' });

  const log = (line: string) => {
    const ts = new Date().toISOString();
    fs.appendFileSync(filePath, `[${ts}] ${line}\n`, { encoding: 'utf8' });
    console.log(line);
  };

  return { log };
}
