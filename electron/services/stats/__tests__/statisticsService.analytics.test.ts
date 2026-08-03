import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StatisticsService } from '../statisticsService';
import { AtomicJsonStore } from '../../storage/atomicJsonStore';

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-statistics-service-'));
}

describe('StatisticsService analytics', () => {
  const tempDirs: string[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();

    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('derives popular modpacks and usage trends from persisted local stats', () => {
    const root = createTempDir();
    tempDirs.push(root);
    const service = new StatisticsService(path.join(root, 'statistics.json'));

    vi.setSystemTime(new Date('2026-04-10T10:00:00Z'));
    service.recordLaunch('alpha', 'Alpha Pack');
    service.recordPlayTime(45 * 60 * 1000, 'alpha');

    vi.setSystemTime(new Date('2026-04-11T12:00:00Z'));
    service.recordLaunch('beta', 'Beta Pack');
    service.recordPlayTime(15 * 60 * 1000, 'beta');
    service.recordLaunch('alpha', 'Alpha Pack');

    const stats = service.getStats();

    expect(stats.popularModpacks.map((modpack) => modpack.name)).toEqual(['Alpha Pack', 'Beta Pack']);
    expect(stats.usageTrend).toEqual([
      { date: '2026-04-10', launches: 1, playTime: 45 * 60 * 1000 },
      { date: '2026-04-11', launches: 2, playTime: 15 * 60 * 1000 },
    ]);
  });

  it('exports the derived overview as JSON for backup or analysis', () => {
    const root = createTempDir();
    tempDirs.push(root);
    const service = new StatisticsService(path.join(root, 'statistics.json'));
    const exportPath = path.join(root, 'exports', 'stats.json');

    vi.setSystemTime(new Date('2026-04-12T08:15:00Z'));
    service.recordLaunch('alpha', 'Alpha Pack');
    service.recordPlayTime(5 * 60 * 1000, 'alpha');

    const result = service.exportStats(exportPath);
    const payload = JSON.parse(fs.readFileSync(exportPath, 'utf8')) as {
      version: number;
      exportedAt: string;
      statistics: {
        popularModpacks: Array<{ name: string }>;
        usageTrend: Array<{ date: string }>;
      };
    };

    expect(result.filePath).toBe(exportPath);
    expect(result.exportedAt).toBe('2026-04-12T08:15:00.000Z');
    expect(payload.version).toBe(1);
    expect(payload.statistics.popularModpacks[0]?.name).toBe('Alpha Pack');
    expect(payload.statistics.usageTrend[0]?.date).toBe('2026-04-12');
  });

  it('does not silently replace malformed statistics with zeroes', () => {
    const root = createTempDir();
    tempDirs.push(root);
    const statsPath = path.join(root, 'statistics.json');
    fs.writeFileSync(statsPath, '{broken statistics');
    const original = fs.readFileSync(statsPath);

    expect(() => new StatisticsService(statsPath)).toThrow(/recovery backup are unavailable/);
    expect(fs.readFileSync(statsPath)).toEqual(original);
  });

  it('does not advance in-memory statistics when persistence fails', () => {
    const root = createTempDir();
    tempDirs.push(root);
    const service = new StatisticsService(path.join(root, 'statistics.json'));
    const before = service.getStats();
    vi.spyOn(AtomicJsonStore.prototype, 'write').mockImplementationOnce(() => {
      throw new Error('disk full');
    });

    expect(() => service.recordLaunch('alpha', 'Alpha Pack')).toThrow('disk full');
    expect(service.getStats()).toEqual(before);
  });
});
