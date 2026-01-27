import fs from 'node:fs';
import path from 'node:path';
import { findJavaExecutable } from './findJavaExecutable';

/**
 * Resolve either a Java "home" directory or an executable path to a runnable java binary.
 * - Accepts: `C:\\...\\java.exe`, `C:\\...\\javaw.exe`, or `C:\\...\\jdk-xx` (home)
 * - Returns: absolute path to `java(.exe)` when possible, otherwise the original input.
 */
export function resolveJavaExecutable(javaPathOrHome: string): string {
  const input = (javaPathOrHome || '').trim();
  if (!input) return input;

  // If the user already provided an executable, use it.
  const base = path.basename(input).toLowerCase();
  if (base === 'java.exe' || base === 'javaw.exe' || base === 'java') return input;

  // If a directory was provided, attempt common locations first.
  try {
    if (fs.existsSync(input) && fs.statSync(input).isDirectory()) {
      const binJava = path.join(input, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
      if (fs.existsSync(binJava)) return binJava;

      // Fall back to a recursive scan (best-effort).
      const found = findJavaExecutable(input);
      if (found) return found;
    }
  } catch {
    // ignore
  }

  // If a non-directory string was provided (e.g. "C:\\...\\jdk-xx" without existence),
  // keep it as-is and let spawn throw a helpful error.
  return input;
}

/**
 * Convert a java executable path to a likely JAVA_HOME (installation root).
 * XMCL `scanLocalJava` expects home paths (not executables).
 */
export function toJavaHome(javaExecPath: string): string | null {
  try {
    // Typical layout: <JAVA_HOME>/bin/java(.exe)
    const binDir = path.dirname(javaExecPath);
    return path.dirname(binDir);
  } catch {
    return null;
  }
}

