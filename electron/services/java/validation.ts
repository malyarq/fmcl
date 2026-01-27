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
      // Parse version from output like: openjdk version "21.0.1"
      const versionMatch = output.match(/version ["']?(\d+)/);
      if (versionMatch) {
        const majorVersion = parseInt(versionMatch[1], 10);
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

