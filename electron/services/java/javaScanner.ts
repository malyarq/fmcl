import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import os from 'node:os';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export interface DetectedJava {
  path: string;
  version: string;
  majorVersion: number;
  valid: boolean;
  arch?: string;
}

export class JavaScanner {
  /**
   * Scans common directories for Java installations.
   */
  async scanJava(): Promise<DetectedJava[]> {
    const candidates = new Set<string>();

    // 1. Check JAVA_HOME
    if (process.env.JAVA_HOME) {
      this.addCandidate(candidates, path.join(process.env.JAVA_HOME, 'bin', 'java.exe'));
    }

    // 2. Common directories
    const commonDirs = [
      'C:\\Program Files\\Java',
      'C:\\Program Files (x86)\\Java',
      'C:\\Program Files\\Eclipse Adoptium',
      'C:\\Program Files\\BellSoft',
      'C:\\Program Files\\Amazon Corretto',
      'C:\\Program Files\\Microsoft',
      'C:\\Program Files\\Azul',
      path.join(os.homedir(), 'AppData\\Local\\Programs\\Eclipse Adoptium'),
      path.join(os.homedir(), '.jdks'), // IntelliJ
    ];

    for (const dir of commonDirs) {
      await this.scanDir(dir, candidates);
    }

    // 3. Verify each candidate
    const results: DetectedJava[] = [];
    for (const javaPath of candidates) {
      const info = await this.getJavaInfo(javaPath);
      if (info) {
        results.push(info);
      }
    }

    return results.sort((a, b) => b.majorVersion - a.majorVersion);
  }

  private async scanDir(dir: string, candidates: Set<string>) {
    if (!fs.existsSync(dir)) return;

    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const binJava = path.join(dir, entry.name, 'bin', 'java.exe');
          this.addCandidate(candidates, binJava);

          // Also check for direct java.exe in the directory (less common but possible)
          const rootJava = path.join(dir, entry.name, 'java.exe');
          this.addCandidate(candidates, rootJava);
        }
      }
    } catch {
      // ignore access errors
    }
  }

  private addCandidate(candidates: Set<string>, javaPath: string) {
    if (fs.existsSync(javaPath)) {
      candidates.add(javaPath);
    }
  }

  private async getJavaInfo(javaPath: string): Promise<DetectedJava | null> {
    try {
      const { stdout, stderr } = await execAsync(`"${javaPath}" -version`);
      const output = stderr || stdout; // java -version output is often in stderr

      // "java version "1.8.0_202"" or "openjdk version "17.0.2" 2022-01-18"
      const versionMatch = output.match(/version "([^"]+)"/);
      if (versionMatch) {
        const versionStr = versionMatch[1];
        let major = 0;
        if (versionStr.startsWith('1.')) {
          major = parseInt(versionStr.split('.')[1], 10);
        } else {
          major = parseInt(versionStr.split('.')[0], 10);
        }

        let arch = 'x64'; // default assumption
        if (output.includes('64-Bit')) arch = 'x64';
        else if (output.includes('Client VM')) arch = 'x86'; // usually 32-bit client
        else if (output.includes('32-Bit')) arch = 'x86';

        return {
          path: javaPath,
          version: versionStr,
          majorVersion: major,
          valid: true,
          arch
        }
      }
      return null;
    } catch {
      return null;
    }
  }
}

export const javaScanner = new JavaScanner();
