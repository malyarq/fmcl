import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AtomicJsonStore,
  AtomicJsonStoreError,
  getAtomicJsonBackupPath,
} from '../atomicJsonStore';

type TestState = Record<string, unknown> & {
  selected: string;
  values: string[];
};

describe('AtomicJsonStore', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  function createStore() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-atomic-json-'));
    tempDirs.push(root);
    const filePath = path.join(root, 'state.json');
    const store = new AtomicJsonStore<TestState>(filePath, {
      version: 1,
      validate: (value): value is TestState => {
        if (!value || typeof value !== 'object') return false;
        const candidate = value as Partial<TestState>;
        return typeof candidate.selected === 'string' && Array.isArray(candidate.values);
      },
    });
    return { filePath, store };
  }

  it('writes versioned state and preserves the previous valid state as a backup', () => {
    const { filePath, store } = createStore();
    store.write({ selected: 'one', values: ['a'] });
    store.write({ selected: 'two', values: ['b'] });

    expect(store.read()).toMatchObject({
      value: { selected: 'two', values: ['b'] },
      source: 'primary',
      legacy: false,
    });
    expect(JSON.parse(fs.readFileSync(filePath, 'utf8'))).toMatchObject({
      _fmclSchemaVersion: 1,
      selected: 'two',
    });
    expect(JSON.parse(fs.readFileSync(getAtomicJsonBackupPath(filePath), 'utf8'))).toMatchObject({
      _fmclSchemaVersion: 1,
      selected: 'one',
    });
  });

  it('opens a copied backup writable before fsync so Windows can persist it', () => {
    const openSync = vi.spyOn(fs, 'openSync');
    const { store } = createStore();

    store.write({ selected: 'one', values: ['a'] });
    store.write({ selected: 'two', values: ['b'] });

    expect(openSync.mock.calls.some(([candidate, flags]) => (
      String(candidate).includes('.state.json.bak.') && flags === 'r+'
    ))).toBe(true);
  });

  it('owns the schema marker even if an input object contains a conflicting field', () => {
    const { filePath, store } = createStore();
    store.write({
      selected: 'one',
      values: [],
      _fmclSchemaVersion: 99,
    } as TestState);

    expect(JSON.parse(fs.readFileSync(filePath, 'utf8'))).toMatchObject({
      _fmclSchemaVersion: 1,
      selected: 'one',
    });
    expect(store.read()?.value).not.toHaveProperty('_fmclSchemaVersion');
  });

  it('recovers a corrupt primary from the last-known-good backup', () => {
    const { filePath, store } = createStore();
    store.write({ selected: 'one', values: ['a'] });
    store.write({ selected: 'two', values: ['b'] });
    fs.writeFileSync(filePath, '{broken');

    expect(store.read()).toMatchObject({
      value: { selected: 'one', values: ['a'] },
      source: 'backup',
    });
  });

  it('never overwrites corrupt state when recovery is unavailable', () => {
    const { filePath, store } = createStore();
    fs.writeFileSync(filePath, '{broken');
    const original = fs.readFileSync(filePath);

    expect(() => store.read()).toThrowError(AtomicJsonStoreError);
    expect(() => store.write({ selected: 'replacement', values: [] })).toThrowError(
      expect.objectContaining({ code: 'WRITE_CONFLICT' }),
    );
    expect(fs.readFileSync(filePath)).toEqual(original);
  });

  it('rejects unsupported versions without falling back to an older backup', () => {
    const { filePath, store } = createStore();
    fs.writeFileSync(filePath, JSON.stringify({
      _fmclSchemaVersion: 99,
      selected: 'future',
      values: [],
    }));
    fs.writeFileSync(getAtomicJsonBackupPath(filePath), JSON.stringify({
      _fmclSchemaVersion: 1,
      selected: 'old',
      values: [],
    }));

    expect(() => store.read()).toThrowError(expect.objectContaining({
      code: 'UNSUPPORTED_VERSION',
    }));
    expect(JSON.parse(fs.readFileSync(filePath, 'utf8'))).toMatchObject({ selected: 'future' });
  });
});
