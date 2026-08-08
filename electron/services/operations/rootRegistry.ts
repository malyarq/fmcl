import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { AtomicJsonStore } from '../storage/atomicJsonStore';

type RootDescriptor = { rootPath: string; registeredAt: string };

/** Shared-machine registry: userData differs for a second Electron process. */
export class OperationRootRegistry {
  public constructor(private readonly basePath: string) {}

  public register(rootPath: string): void {
    const canonical = fs.realpathSync.native(rootPath);
    const directory = path.join(this.basePath, 'Burrow', 'operation-roots');
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    const id = createHash('sha256').update(canonical).digest('hex');
    const target = path.join(directory, `${id}.json`);
    new AtomicJsonStore<RootDescriptor>(target, { version: 1, validate: isDescriptor }).write({ rootPath: canonical, registeredAt: new Date().toISOString() });
  }

  public list(): { roots: string[]; errors: Error[] } {
    const directory = path.join(this.basePath, 'Burrow', 'operation-roots');
    if (!fs.existsSync(directory)) return { roots: [], errors: [] };
    const roots: string[] = [];
    const errors: Error[] = [];
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /^[a-f0-9]{64}\.json$/.test(entry.name))
    ) {
      try { roots.push(new AtomicJsonStore<RootDescriptor>(path.join(directory, entry.name), { version: 1, validate: isDescriptor }).read()!.value.rootPath); }
      catch (error) { errors.push(error instanceof Error ? error : new Error('Registry descriptor is unreadable')); }
    }
    return { roots, errors };
  }
}

function isDescriptor(value: unknown): value is RootDescriptor {
  return Boolean(value) && typeof value === 'object' && typeof (value as RootDescriptor).rootPath === 'string' && typeof (value as RootDescriptor).registeredAt === 'string';
}
