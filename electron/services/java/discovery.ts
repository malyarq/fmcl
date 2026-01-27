import fs from 'node:fs';
import path from 'node:path';
import { getPotentialJavaLocations, scanLocalJava } from '@xmcl/installer';
import { resolveJavaExecutable, toJavaHome } from './pathResolver';

/**
 * Finds local Java of a specific major version using XMCL discovery utilities.
 */
export async function findLocalJava(requiredVersion: 8 | 17 | 21): Promise<string | null> {
  const homes = new Set<string>();

  // 1) Candidates from PATH / system discovery (XMCL)
  try {
    const execs = await getPotentialJavaLocations();
    for (const execPath of execs) {
      const home = toJavaHome(execPath);
      if (home) homes.add(home);
    }
  } catch {
    // ignore
  }

  // 2) JAVA_HOME if set
  if (process.env.JAVA_HOME) {
    homes.add(process.env.JAVA_HOME);
  }

  // 3) Common Windows install roots (best-effort, still fed into XMCL scan)
  if (process.platform === 'win32') {
    const baseRoots = ['C:\\\\Program Files\\\\Java', 'C:\\\\Program Files (x86)\\\\Java'];
    for (const root of baseRoots) {
      if (!fs.existsSync(root)) continue;
      try {
        const entries = fs.readdirSync(root, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          homes.add(path.join(root, entry.name));
        }
      } catch {
        // ignore
      }
    }
  }

  const infos = await scanLocalJava(Array.from(homes));
  const matches = infos.filter((i) => i.majorVersion === requiredVersion);
  if (matches.length === 0) return null;

  // Prefer newer versions (cheap heuristic).
  matches.sort((a, b) => (b.version ?? '').localeCompare(a.version ?? ''));
  // XMCL scan returns "home" paths, but our launcher needs the executable path.
  const candidate = matches[0].path;
  const exec = resolveJavaExecutable(candidate);
  return exec || null;
}

