import { spawn } from 'node:child_process';
import { resolveJavaExecutable } from './pathResolver';

/**
 * Ensures validity of a Java executable at a specific path.
 */
export function verifyJava(javaPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const exec = resolveJavaExecutable(javaPath);
    const child = spawn(exec, ['-version']);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Java verification failed with code ${code}`));
    });
    child.on('error', (err) => reject(err));
  });
}

/**
 * Gets the Java version number from a Java executable.
 * @returns major version number (e.g., 8, 17, 21)
 */
export async function getJavaVersion(javaPath: string): Promise<number> {
  return await new Promise((resolve, reject) => {
    const exec = resolveJavaExecutable(javaPath);
    const child = spawn(exec, ['-version']);
    let output = '';
    child.stderr?.on('data', (data) => {
      output += data.toString();
    });
    child.stdout?.on('data', (data) => {
      output += data.toString();
    });
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Failed to get Java version: exit code ${code}`));
        return;
      }
      // Parse version from output like:
      // - Modern: openjdk version "21.0.1" or "17.0.2"
      // - Legacy: java version "1.8.0_392" (where 8 is the actual major version)
      const versionMatch = output.match(/version ["']?(\d+)(?:\.(\d+))?/);
      if (versionMatch) {
        const first = parseInt(versionMatch[1], 10);
        const second = versionMatch[2] ? parseInt(versionMatch[2], 10) : 0;
        // For legacy Java (1.x format), the second number is the actual major version
        // e.g., "1.8.0" means Java 8, "1.7.0" means Java 7
        const majorVersion = first === 1 ? second : first;
        resolve(majorVersion);
      } else {
        reject(new Error(`Could not parse Java version from output: ${output}`));
      }
    });
    child.on('error', (err) => reject(err));
  });
}

export async function validateJavaPath(javaPath: string): Promise<boolean> {
  try {
    await verifyJava(javaPath);
    return true;
  } catch {
    return false;
  }
}
