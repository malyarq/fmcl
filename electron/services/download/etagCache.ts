import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export type ETagEntry = {
  etag?: string;
  lastModified?: string;
  updatedAt: number;
};

const CACHE_FILENAME = 'download-cache.json';

export class ETagCache {
  private static loaded = false;
  private static cache: Record<string, ETagEntry> = {};
  private static filePath(): string {
    return path.join(app.getPath('userData'), CACHE_FILENAME);
  }

  private static loadIfNeeded() {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = fs.readFileSync(this.filePath(), 'utf-8');
      this.cache = JSON.parse(raw);
    } catch {
      this.cache = {};
    }
  }

  static get(url: string): ETagEntry | undefined {
    this.loadIfNeeded();
    return this.cache[url];
  }

  static set(url: string, entry: ETagEntry) {
    this.loadIfNeeded();
    this.cache[url] = entry;
    try {
      fs.mkdirSync(path.dirname(this.filePath()), { recursive: true });
      fs.writeFileSync(this.filePath(), JSON.stringify(this.cache, null, 2));
    } catch {
      // Ignore cache write failures.
    }
  }
}

