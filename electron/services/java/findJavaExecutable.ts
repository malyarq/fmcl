import fs from 'node:fs';
import path from 'node:path';

/**
 * Recursively search for java.exe in a directory.
 */
export function findJavaExecutable(startDir: string): string | null {
  if (!fs.existsSync(startDir)) return null;
  let files: fs.Dirent[];
  try {
    files = fs.readdirSync(startDir, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const file of files) {
    const fullPath = path.join(startDir, file.name);
    if (file.isDirectory()) {
      const found = findJavaExecutable(fullPath);
      if (found) return found;
    } else {
      const lower = file.name.toLowerCase();
      // Prefer console java for verification, but accept javaw as fallback.
      if (lower === 'java.exe') return fullPath;
    }
  }
  // Second pass: javaw.exe fallback (useful for some distributions/layouts).
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

