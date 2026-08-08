import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { RootMutationLock } from '../rootMutationLock';

const childTest = path.resolve('electron/services/operations/__tests__/rootMutationLock.child.test.ts');
const vitestEntry = path.resolve('node_modules/vitest/vitest.mjs');

describe('RootMutationLock', () => {
  const temporary: string[] = [];
  const children: ChildProcess[] = [];

  afterEach(async () => {
    const started = children.splice(0);
    for (const child of started) {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }
    await Promise.all(started.map(waitForExit));
    for (const directory of temporary.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
  });

  it('serializes child-process contenders after a production stale lease without deleting the winner', async () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-root-lock-child-'));
    temporary.push(rootPath);
    const eventsPath = path.join(rootPath, 'events.log');
    const startPath = path.join(rootPath, 'start');
    const releasePath = path.join(rootPath, 'release');

    const staleOwner = spawnLockChild('stale-owner', rootPath, eventsPath, releasePath);
    children.push(staleOwner);
    await waitForEvents(eventsPath, 1);
    staleOwner.kill('SIGKILL');
    await waitForExit(staleOwner);

    const first = spawnLockChild('first', rootPath, eventsPath, releasePath, startPath);
    const second = spawnLockChild('second', rootPath, eventsPath, releasePath, startPath);
    children.push(first, second);
    await waitForEvent(eventsPath, 'ready first');
    await waitForEvent(eventsPath, 'ready second');
    fs.writeFileSync(startPath, 'go');

    await waitForEventCount(eventsPath, 'enter', 2);
    await delay(150);
    const beforeRelease = readEvents(eventsPath);
    expect(contenderEvents(beforeRelease, 'enter')).toHaveLength(1);
    expect(contenderEvents(beforeRelease, 'exit')).toHaveLength(0);

    const locksDirectory = path.join(rootPath, '.burrow-operations', 'locks');
    await waitForActiveTickets(locksDirectory, 2);
    expect(activeTicketPids(locksDirectory)).toHaveLength(2);

    fs.writeFileSync(releasePath, 'release');
    await Promise.all([waitForExit(first), waitForExit(second)]);
    const events = readEvents(eventsPath).filter((event) => /^(enter|exit) (first|second)$/.test(event));
    expect(events).toHaveLength(4);
    expect(events[0].startsWith('enter ')).toBe(true);
    expect(events[1]).toBe(`exit ${events[0].split(' ')[1]}`);
    expect(events[2].startsWith('enter ')).toBe(true);
    expect(events[3]).toBe(`exit ${events[2].split(' ')[1]}`);
  }, 30_000);

  it('serializes simultaneous child contenders that select the same bakery ticket', async () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-root-lock-tie-'));
    temporary.push(rootPath);
    const eventsPath = path.join(rootPath, 'events.log');
    const ticketBarrierPath = path.join(rootPath, 'ticket-barrier');
    const releasePath = path.join(rootPath, 'release');
    const first = spawnLockChild('first', rootPath, eventsPath, releasePath, undefined, ticketBarrierPath);
    const second = spawnLockChild('second', rootPath, eventsPath, releasePath, undefined, ticketBarrierPath);
    children.push(first, second);

    await waitForEvent(eventsPath, 'ticket first 1');
    await waitForEvent(eventsPath, 'ticket second 1');
    fs.writeFileSync(ticketBarrierPath, 'publish');
    await waitForEventCount(eventsPath, 'enter', 1);
    await delay(150);
    expect(contenderEvents(readEvents(eventsPath), 'enter')).toHaveLength(1);
    expect(activeTicketPids(path.join(rootPath, '.burrow-operations', 'locks'))).toHaveLength(2);

    fs.writeFileSync(releasePath, 'release');
    await Promise.all([waitForExit(first), waitForExit(second)]);
    const events = readEvents(eventsPath).filter((event) => /^(enter|exit) (first|second)$/.test(event));
    expect(events).toHaveLength(4);
    expect(events[1]).toBe(`exit ${events[0].split(' ')[1]}`);
    expect(events[3]).toBe(`exit ${events[2].split(' ')[1]}`);
  }, 30_000);

  it('removes a forged same-PID ticket only after its authenticated endpoint is dead', async () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-root-lock-forged-'));
    temporary.push(rootPath);
    const directory = path.join(rootPath, '.burrow-operations', 'locks');
    fs.mkdirSync(directory, { recursive: true });
    const forgedPath = path.join(directory, 'mutation.lock.ticket-1-forged');
    fs.writeFileSync(forgedPath, JSON.stringify({ protocol: 3, pid: process.pid, token: 'forged', endpoint: { path: path.join(os.tmpdir(), `burrow-lock-${randomBytes(16).toString('hex')}.sock`) }, ticket: 1 }));

    let completed = false;
    await new RootMutationLock().run(rootPath, async () => { completed = true; });
    expect(completed).toBe(true);
    expect(fs.existsSync(forgedPath)).toBe(false);
  });

  it('cleans repeated crashed v3 tickets instead of growing the bakery queue', async () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-root-lock-crashes-'));
    temporary.push(rootPath);
    const eventsPath = path.join(rootPath, 'events.log');
    const releasePath = path.join(rootPath, 'release');
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const child = spawnLockChild(`crash-${attempt}`, rootPath, eventsPath, releasePath);
      children.push(child);
      await waitForEvent(eventsPath, `enter crash-${attempt}`);
      child.kill('SIGKILL');
      await waitForExit(child);
    }

    await new RootMutationLock().run(rootPath, async () => undefined);
    const directory = path.join(rootPath, '.burrow-operations', 'locks');
    expect(fs.readdirSync(directory).filter((name) => name.startsWith('mutation.lock.ticket-') || name.startsWith('mutation.lock.choosing-'))).toEqual([]);
    expect(fs.existsSync(path.join(directory, 'mutation.lock'))).toBe(false);
  }, 30_000);

  it('removes a forged ticket without unlinking its live owner endpoint', async () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-root-lock-shared-endpoint-'));
    temporary.push(rootPath);
    const eventsPath = path.join(rootPath, 'events.log');
    const releasePath = path.join(rootPath, 'release');
    const owner = spawnLockChild('owner', rootPath, eventsPath, releasePath);
    children.push(owner);
    await waitForEvent(eventsPath, 'enter owner');

    const directory = path.join(rootPath, '.burrow-operations', 'locks');
    const ownerTicketPath = fs.readdirSync(directory).find((name) => name.startsWith('mutation.lock.ticket-'));
    expect(ownerTicketPath).toBeDefined();
    const ownerTicket = JSON.parse(fs.readFileSync(path.join(directory, ownerTicketPath!), 'utf8')) as {
      endpoint: { path: string };
    };
    const forgedPath = path.join(directory, 'mutation.lock.ticket-99-forged-token');
    fs.writeFileSync(forgedPath, JSON.stringify({
      protocol: 3,
      pid: process.pid,
      token: 'forged-token',
      endpoint: ownerTicket.endpoint,
      ticket: 99,
    }));

    const contender = spawnLockChild('contender', rootPath, eventsPath, releasePath);
    children.push(contender);
    await waitForFileRemoval(forgedPath);
    await delay(150);
    expect(eventsFor(readEvents(eventsPath), 'enter', 'owner', 'contender')).toEqual(['enter owner']);

    fs.writeFileSync(releasePath, 'release');
    await Promise.all([waitForExit(owner), waitForExit(contender)]);
    expect(eventsFor(readEvents(eventsPath), 'enter', 'owner', 'contender')).toEqual(['enter owner', 'enter contender']);
    expect(eventsFor(readEvents(eventsPath), 'exit', 'owner', 'contender')).toEqual(['exit owner', 'exit contender']);
  }, 30_000);

  it('fails closed at the offline-upgrade boundary for an old canonical O_EXCL owner', async () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-root-lock-old-owner-'));
    temporary.push(rootPath);
    const eventsPath = path.join(rootPath, 'events.log');
    const releasePath = path.join(rootPath, 'release');
    const bakeryTurnBarrierPath = path.join(rootPath, 'turn-barrier');
    const contender = spawnLockChild('first', rootPath, eventsPath, releasePath, undefined, undefined, bakeryTurnBarrierPath);
    children.push(contender);
    await waitForEvent(eventsPath, 'turn first');

    const oldReleasePath = path.join(rootPath, 'old-release');
    const oldOwner = spawnOldCanonicalOwner(path.join(rootPath, '.burrow-operations', 'locks', 'mutation.lock'), oldReleasePath);
    children.push(oldOwner);
    await waitForEvent(eventsPath, 'old-ready');
    fs.writeFileSync(bakeryTurnBarrierPath, 'bridge');
    await waitForExitCode(contender, 1);
    expect(contenderEvents(readEvents(eventsPath), 'enter')).toHaveLength(0);

    fs.writeFileSync(oldReleasePath, 'release');
    await waitForExit(oldOwner);
  }, 30_000);
});

function spawnLockChild(id: string, rootPath: string, eventsPath: string, releasePath: string, startPath?: string, ticketBarrierPath?: string, bakeryTurnBarrierPath?: string): ChildProcess {
  return spawn(process.execPath, [vitestEntry, 'run', childTest, '--pool=threads', '--maxWorkers=1', '--no-file-parallelism', '--silent'], {
    cwd: path.resolve('.'),
    env: {
      ...process.env,
      BURROW_ROOT_LOCK_CHILD: '1',
      BURROW_ROOT_LOCK_ID: id,
      BURROW_ROOT_LOCK_ROOT: rootPath,
      BURROW_ROOT_LOCK_EVENTS: eventsPath,
      BURROW_ROOT_LOCK_RELEASE: releasePath,
      BURROW_ROOT_LOCK_START: startPath ?? '',
      BURROW_ROOT_LOCK_TICKET_BARRIER: ticketBarrierPath ?? '',
      BURROW_ROOT_LOCK_BAKERY_TURN_BARRIER: bakeryTurnBarrierPath ?? '',
    },
    stdio: ['ignore', 'ignore', 'ignore'],
  });
}

function spawnOldCanonicalOwner(lockPath: string, releasePath: string): ChildProcess {
  const script = `const fs=require('fs');const p=${JSON.stringify(lockPath)};const r=${JSON.stringify(releasePath)};fs.mkdirSync(require('path').dirname(p),{recursive:true});const fd=fs.openSync(p,'wx',0o600);fs.writeFileSync(fd,JSON.stringify({pid:process.pid}));fs.closeSync(fd);fs.appendFileSync(${JSON.stringify(path.join(path.dirname(releasePath), 'events.log'))},'old-ready\\n');const timer=setInterval(()=>{if(fs.existsSync(r)){clearInterval(timer);fs.unlinkSync(p);process.exit(0)}},10)`;
  return spawn(process.execPath, ['-e', script], { stdio: ['ignore', 'ignore', 'ignore'] });
}


function activeTicketPids(directory: string): number[] {
  return fs.readdirSync(directory)
    .filter((name) => name.startsWith('mutation.lock.ticket-'))
    .map((name) => JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8')) as { pid: number })
    .filter(({ pid }) => isPidAlive(pid))
    .map(({ pid }) => pid);
}

async function waitForActiveTickets(directory: string, count: number): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (activeTicketPids(directory).length >= count) return;
    await delay(25);
  }
  throw new Error(`Timed out waiting for ${count} active tickets`);
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForEvent(filePath: string, event: string): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (readEvents(filePath).includes(event)) return;
    await delay(25);
  }
  throw new Error(`Timed out waiting for ${event}`);
}

async function waitForEvents(filePath: string, count: number): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (readEvents(filePath).length >= count) return;
    await delay(25);
  }
  throw new Error(`Timed out waiting for ${count} events`);
}

async function waitForEventCount(filePath: string, prefix: string, count: number): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (readEvents(filePath).filter((event) => event.startsWith(prefix)).length >= count) return;
    await delay(25);
  }
  throw new Error(`Timed out waiting for ${count} ${prefix} events`);
}

async function waitForFileRemoval(filePath: string): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (!fs.existsSync(filePath)) return;
    await delay(25);
  }
  throw new Error(`Timed out waiting for ${filePath} to be removed`);
}

function readEvents(filePath: string): string[] {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8').trim().split('\n').filter(Boolean) : [];
}

function contenderEvents(events: string[], prefix: string): string[] {
  return events.filter((event) => new RegExp(`^${prefix} (first|second)$`).test(event));
}

function eventsFor(events: string[], prefix: string, ...ids: string[]): string[] {
  return events.filter((event) => new RegExp(`^${prefix} (${ids.join('|')})$`).test(event));
}

function waitForExit(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolve, reject) => child.once('exit', (code, signal) => {
    if (code === 0 || signal === 'SIGKILL') resolve();
    else reject(new Error(`Lock child exited with ${code ?? signal}`));
  }));
}

function waitForExitCode(child: ChildProcess, expected: number): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    if (child.exitCode === expected) return Promise.resolve();
    return Promise.reject(new Error(`Lock child exited with ${child.exitCode ?? child.signalCode}`));
  }
  return new Promise((resolve, reject) => child.once('exit', (code) => {
    if (code === expected) resolve();
    else reject(new Error(`Lock child exited with ${code}`));
  }));
}

function delay(ms: number): Promise<void> { return new Promise((resolve) => setTimeout(resolve, ms)); }
