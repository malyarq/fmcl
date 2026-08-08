import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { AtomicJsonStore, getAtomicJsonBackupPath } from '../../../services/storage/atomicJsonStore';

type State = { selected: string; values: string[] };

type FaultName = 'temp-write' | 'backup' | 'rename';

const faults: Record<FaultName, 'beforeTempWrite' | 'beforeBackupPublish' | 'beforePrimaryPublish'> = {
  'temp-write': 'beforeTempWrite',
  backup: 'beforeBackupPublish',
  rename: 'beforePrimaryPublish',
};

function state(selected: string): State {
  return { selected, values: [selected] };
}

function isState(value: unknown): value is State {
  return Boolean(value)
    && typeof value === 'object'
    && typeof (value as Partial<State>).selected === 'string'
    && Array.isArray((value as Partial<State>).values);
}

describe('persistent control-plane fault matrix', () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
  });

  function createStore(fault?: FaultName) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-control-plane-fault-'));
    roots.push(root);
    const filePath = path.join(root, 'instance-control-plane.json');
    const store = new AtomicJsonStore<State>(filePath, {
      version: 1,
      validate: isState,
      ...(fault ? {
        faultHooks: {
          [faults[fault]]: () => { throw new Error(`injected ${fault} failure`); },
        },
      } : {}),
    } as never);
    return { root, filePath, store };
  }

  function expectNoTemporaryResidue(root: string): void {
    expect(fs.readdirSync(root).filter((entry) => entry.startsWith('.instance-control-plane.json'))).toEqual([]);
  }

  it('uses the last valid backup for malformed bytes and rejects unsupported bytes without a false recovery claim', () => {
    const { filePath, store } = createStore();
    store.write(state('first'));
    store.write(state('second'));
    const backupBytes = fs.readFileSync(getAtomicJsonBackupPath(filePath));
    fs.writeFileSync(filePath, '{broken');

    expect(store.read()).toMatchObject({ source: 'backup', value: state('first') });
    expect(fs.readFileSync(getAtomicJsonBackupPath(filePath))).toEqual(backupBytes);
    expectNoTemporaryResidue(path.dirname(filePath));

    fs.writeFileSync(filePath, JSON.stringify({ _fmclSchemaVersion: 99, ...state('future') }));
    expect(() => store.read()).toThrow(/Unsupported state schema version/);
    expect(fs.readFileSync(filePath, 'utf8')).toContain('future');
  });

  it('rejects malformed candidate validation without changing durable bytes and reads the original snapshot after restart', () => {
    const { filePath, store } = createStore();
    store.write(state('first'));
    const originalBytes = fs.readFileSync(filePath);

    expect(() => store.write({ selected: 42, values: [] } as unknown as State)).toThrow(/expected schema/);
    expect(fs.readFileSync(filePath)).toEqual(originalBytes);
    expect(new AtomicJsonStore<State>(filePath, { version: 1, validate: isState }).read()).toMatchObject({
      source: 'primary',
      value: state('first'),
    });
    expectNoTemporaryResidue(path.dirname(filePath));
  });

  it.each(Object.keys(faults) as FaultName[])('preserves original bytes, removes temporary residue, and retries after a %s failure', (fault) => {
    const { root, filePath, store } = createStore(fault);
    const baseline = new AtomicJsonStore<State>(filePath, { version: 1, validate: isState });
    baseline.write(state('first'));
    baseline.write(state('second'));
    const originalBytes = fs.readFileSync(filePath);

    let failure: unknown;
    try {
      store.write(state('replacement'));
    } catch (error) {
      failure = error;
    }
    expect(failure).toMatchObject({
      code: 'WRITE_FAILED',
      cause: expect.objectContaining({ message: `injected ${fault} failure` }),
    });
    expect(fs.readFileSync(filePath)).toEqual(originalBytes);
    expect(store.read()).toMatchObject({ source: 'primary', value: state('second') });
    expectNoTemporaryResidue(root);

    const retry = new AtomicJsonStore<State>(filePath, { version: 1, validate: isState });
    retry.write(state('replacement'));
    expect(retry.read()).toMatchObject({ source: 'primary', value: state('replacement') });
  });
});
