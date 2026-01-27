import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import {
  fetchJavaRuntimeManifest,
  installJavaRuntimeTask,
  JavaRuntimeTargetType,
} from '@xmcl/installer';
import type { Task } from '@xmcl/task';
import { findJavaExecutable } from './findJavaExecutable';
import { findLocalJava } from './discovery';
import { getJavaVersion, validateJavaPath, verifyJava } from './validation';

/**
 * Manages the Java Runtime Environment (JRE) required for Minecraft.
 * Handles detection, downloading, and verification of Java installations.
 */
export class JavaManager {
  private readonly runtimeRoot = path.join(app.getPath('userData'), 'runtime');

  public async getJavaVersion(javaPath: string): Promise<number> {
    return await getJavaVersion(javaPath);
  }

  public async validateJavaPath(javaPath: string): Promise<boolean> {
    return await validateJavaPath(javaPath);
  }

  /**
   * Retrieves a valid path to the requested Java version.
   * Downloads and installs it if missing or corrupted.
   *
   * @param version 8 (Legacy), 17 (Modern), or 21 (Latest)
   * @param onProgress Callback for status updates
   * @returns Absolute path to java.exe
   */
  public async getJavaPath(
    version: 8 | 17 | 21,
    onProgress: (status: string, current?: number, total?: number) => void
  ): Promise<string> {
    let runtimeDir: string;
    let targetCandidates: Array<JavaRuntimeTargetType | string>;

    if (version === 8) {
      runtimeDir = path.join(this.runtimeRoot, 'jre-legacy');
      targetCandidates = [JavaRuntimeTargetType.Legacy];
    } else if (version === 17) {
      runtimeDir = path.join(this.runtimeRoot, 'java17');
      // Gamma is commonly Java 17 in Mojang runtime naming.
      targetCandidates = [JavaRuntimeTargetType.Gamma, JavaRuntimeTargetType.Beta, JavaRuntimeTargetType.Alpha];
    } else {
      runtimeDir = path.join(this.runtimeRoot, 'java21');
      // Delta is expected to be newer than Gamma; fallback keeps launcher usable across manifest variations.
      targetCandidates = [JavaRuntimeTargetType.Delta, JavaRuntimeTargetType.Gamma];
    }

    const existingJava = findJavaExecutable(runtimeDir);
    if (existingJava) {
      try {
        await verifyJava(existingJava);
        const actualVersion = await getJavaVersion(existingJava);
        if (actualVersion === version) return existingJava;
        console.warn(`Existing Java installation is version ${actualVersion}, not ${version}. Re-downloading...`);
        try {
          fs.rmSync(runtimeDir, { recursive: true, force: true });
        } catch (delErr) {
          console.error('Failed to clear runtime dir:', delErr);
        }
      } catch (e) {
        console.error(`Existing Java ${version} is corrupted, re-downloading...`, e);
        try {
          fs.rmSync(runtimeDir, { recursive: true, force: true });
        } catch (delErr) {
          console.error('Failed to clear runtime dir:', delErr);
        }
      }
    }

    onProgress(`Scanning local Java installations (need Java ${version})...`);
    const localJava = await findLocalJava(version);
    if (localJava) {
      onProgress(`Using local Java ${version}: ${localJava}`);
      return localJava;
    }

    onProgress(`Fetching Java ${version} runtime manifest...`);
    let lastError: Error | null = null;
    for (const target of targetCandidates) {
      try {
        const manifest = await fetchJavaRuntimeManifest({ target });
        onProgress(`Downloading Java ${version} (target: ${String(target)})...`, 0, 0);
        const task = installJavaRuntimeTask({ destination: runtimeDir, manifest });

        await task.startAndWait({
          onStart: (t: Task) => {
            const total = typeof t.total === 'number' ? t.total : 0;
            if (total > 0) onProgress(`Downloading Java ${version}...`, 0, total);
          },
          onUpdate: (t: Task) => {
            const total = typeof t.total === 'number' ? t.total : 0;
            const progress = typeof t.progress === 'number' ? t.progress : 0;
            if (total > 0) onProgress(`Downloading Java ${version}...`, progress, total);
          },
        });

        const newJava = findJavaExecutable(runtimeDir);
        if (!newJava) throw new Error(`Java ${version} installed but java.exe not found in runtime directory`);
        await verifyJava(newJava);
        const actualVersion = await getJavaVersion(newJava);
        if (actualVersion !== version) {
          lastError = new Error(
            `Downloaded Java is version ${actualVersion}, expected ${version} (target: ${String(target)})`
          );
          try {
            fs.rmSync(runtimeDir, { recursive: true, force: true });
          } catch {
            /* ignore */
          }
          continue;
        }
        return newJava;
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
        continue;
      }
    }

    // Final fallback: re-scan local java (maybe installed meanwhile) before failing.
    const fallbackLocal = await findLocalJava(version);
    if (fallbackLocal) return fallbackLocal;

    throw new Error(
      `Failed to provision Java ${version}. ` +
        `Tried local scan + Mojang runtime targets (${targetCandidates.map(String).join(', ')}). ` +
        `Last error: ${lastError?.message ?? 'Unknown error'}`
    );
  }
}

