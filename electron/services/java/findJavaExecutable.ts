import fs from 'node:fs';
import path from 'node:path';

/** Recursively search a downloaded runtime for the platform Java executable. */
export function findJavaExecutable(startDir: string): string | null {
  if (!fs.existsSync(startDir)) return null;
  let files: fs.Dirent[];
  try {
    files = fs.readdirSync(startDir, { withFileTypes: true });
  } catch {
    return null;
  }

  const consoleExecutable = process.platform === 'win32' ? 'java.exe' : 'java';
  for (const file of files) {
    const fullPath = path.join(startDir, file.name);
    if (file.isDirectory()) {
      const found = findJavaExecutable(fullPath);
      if (found) return found;
    } else {
      if (file.name.toLowerCase() === consoleExecutable) return fullPath;
    }
  }
  // Windows distributions may expose only the windowed executable.
  if (process.platform !== 'win32') return null;
  try {
    for (const file of files) {
      if (!file.isFile()) continue;
      const lower = file.name.toLowerCase();
      if (lower === 'javaw.exe') return path.join(startDir, file.name);
    }
  } catch {
    // ignore
  }
  return null;
}

/** Downloaded POSIX runtimes may lose executable bits while being extracted. */
export function ensureJavaExecutablePermission(javaPath: string): void {
  if (process.platform === 'win32') return;
  const stats = fs.statSync(javaPath);
  if ((stats.mode & 0o111) !== 0o111) fs.chmodSync(javaPath, stats.mode | 0o111);
}
