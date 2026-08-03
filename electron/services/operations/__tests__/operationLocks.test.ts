import { describe, expect, it } from 'vitest';
import { OperationLocks } from '../operationLocks';

describe('OperationLocks', () => {
  it('serializes mutations of the same root and instance while allowing another instance to run', async () => {
    const locks = new OperationLocks();
    const order: string[] = [];
    let releaseFirst: (() => void) | undefined;
    const firstReady = new Promise<void>((resolve) => { releaseFirst = resolve; });

    const first = locks.run({ rootPath: '/launcher', instanceId: 'one' }, async () => {
      order.push('first-start');
      await firstReady;
      order.push('first-end');
    });
    const second = locks.run({ rootPath: '/launcher', instanceId: 'one' }, async () => {
      order.push('second');
    });
    const independent = locks.run({ rootPath: '/launcher', instanceId: 'two' }, async () => {
      order.push('independent');
    });

    await Promise.resolve();
    expect(order).toEqual(['first-start', 'independent']);
    releaseFirst?.();
    await Promise.all([first, second, independent]);
    expect(order).toEqual(['first-start', 'independent', 'first-end', 'second']);
  });

  it('makes a root-wide mutation conflict with every instance below that root', async () => {
    const locks = new OperationLocks();
    const order: string[] = [];
    let releaseRoot: (() => void) | undefined;
    const rootReady = new Promise<void>((resolve) => { releaseRoot = resolve; });

    const root = locks.run({ rootPath: '/launcher' }, async () => {
      order.push('root-start');
      await rootReady;
      order.push('root-end');
    });
    const child = locks.run({ rootPath: '/launcher', instanceId: 'one' }, async () => {
      order.push('child');
    });

    await Promise.resolve();
    expect(order).toEqual(['root-start']);
    releaseRoot?.();
    await Promise.all([root, child]);
    expect(order).toEqual(['root-start', 'root-end', 'child']);
  });
});
