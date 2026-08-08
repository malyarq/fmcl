import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { resolvePathWithinRoot } from '../../security/pathGuards';

const RETRY_MS = 25;
const PROBE_TIMEOUT_MS = 250;
const PROTOCOL = 3;
const CHOOSING_PREFIX = 'mutation.lock.choosing-';
const TICKET_PREFIX = 'mutation.lock.ticket-';
const BRIDGE_NAME = 'mutation.lock';
const MARKER_NAME = 'mutation.lock.v3';

type Endpoint = { path: string };
type Descriptor = { protocol: 3; pid: number; token: string; endpoint: Endpoint };
type Ticket = Descriptor & { ticket: number; filePath: string };
type Liveness = 'LIVE' | 'DEAD' | 'UNKNOWN';
type RootMutationLockOptions = {
  afterTicketSelected?: (ticket: number) => void | Promise<void>;
  afterBakeryTurn?: () => void | Promise<void>;
};

/**
 * Cross-process writer lock for one launcher root.
 *
 * V3 uses immutable Lamport bakery records and a token-authenticated local
 * liveness pipe. A ticket whose token is dead is safe to unlink, but its
 * endpoint is not: one process shares one endpoint between all of its leases.
 * An ambiguous probe stays live and therefore fails closed.
 * The canonical bridge remains held throughout work for ordinary old O_EXCL
 * owners, but v3 only supports upgrades while every older launcher is offline.
 */
export class RootMutationLock {
  public constructor(private readonly options: RootMutationLockOptions = {}) {}

  public async run<T>(rootPath: string, work: () => Promise<T>): Promise<T> {
    const lease = await this.acquire(rootPath);
    try {
      return await work();
    } finally {
      await lease.release();
    }
  }

  private async acquire(rootPath: string): Promise<Lease> {
    const directory = resolvePathWithinRoot(rootPath, '.fmcl-operations/locks', 'Operation lock directory');
    fs.mkdirSync(directory, { recursive: true });
    ensureProtocolMarker(directory);

    const token = randomUUID();
    const endpoint = await livenessRegistry.register(token);
    const descriptor: Descriptor = { protocol: PROTOCOL, pid: process.pid, token, endpoint };
    const choosingPath = path.join(directory, `${CHOOSING_PREFIX}${token}`);
    publishDescriptor(directory, choosingPath, descriptor);
    let ticketPath: string | undefined;
    let bridgePath: string | undefined;
    try {
      const ticket = await this.nextTicket(directory);
      await this.options.afterTicketSelected?.(ticket);
      ticketPath = path.join(directory, `${TICKET_PREFIX}${ticket}-${token}`);
      publishDescriptor(directory, ticketPath, { ...descriptor, ticket });
      fs.rmSync(choosingPath, { force: true });
      fsyncDirectory(directory);

      await this.waitForEarlierTickets(directory, token, ticketPath);
      await this.options.afterBakeryTurn?.();
      bridgePath = await this.acquireBridge(directory, descriptor);
      return new Lease(ticketPath, bridgePath, directory, token);
    } catch (error) {
      fs.rmSync(choosingPath, { force: true });
      if (ticketPath) fs.rmSync(ticketPath, { force: true });
      fsyncDirectory(directory);
      livenessRegistry.unregister(token);
      throw error;
    }
  }

  private async nextTicket(directory: string): Promise<number> {
    const tickets = await this.readActiveTickets(directory);
    return tickets.reduce((maximum, entry) => Math.max(maximum, entry.ticket), 0) + 1;
  }

  private async waitForEarlierTickets(directory: string, token: string, ticketPath: string): Promise<void> {
    const own = readTicket(ticketPath);
    if (!own || own.token !== token) throw new Error('ROOT_LOCK_RECOVERY_REQUIRED');
    for (;;) {
      const choosing = await this.readActiveChoosing(directory);
      if (choosing.some((entry) => entry.token !== token)) {
        await delay(RETRY_MS);
        continue;
      }
      const earlier = (await this.readActiveTickets(directory)).some((entry) => entry.token !== token && compareTickets(entry, own) < 0);
      if (!earlier) return;
      await delay(RETRY_MS);
    }
  }

  private async acquireBridge(directory: string, descriptor: Descriptor): Promise<string> {
    const bridgePath = path.join(directory, BRIDGE_NAME);
    for (;;) {
      try {
        publishDescriptor(directory, bridgePath, descriptor);
        return bridgePath;
      } catch (error) {
        if (!isAlreadyExists(error)) throw new Error('ROOT_LOCK_RECOVERY_REQUIRED');
      }
      const bridge = readDescriptor(bridgePath);
      if (!bridge) continue;
      const status = await probeLiveness(bridge);
      if (status !== 'DEAD') {
        await delay(RETRY_MS);
        continue;
      }
      await reclaimDeadBridge(directory, bridgePath, bridge);
    }
  }

  private async readActiveChoosing(directory: string): Promise<Descriptor[]> {
    return (await this.readActiveEntries(directory, CHOOSING_PREFIX, readDescriptor))
      .map(({ filePath: _filePath, ...entry }) => entry);
  }

  private async readActiveTickets(directory: string): Promise<Ticket[]> {
    return await this.readActiveEntries(directory, TICKET_PREFIX, readTicket);
  }

  private async readActiveEntries<T extends Descriptor>(directory: string, prefix: string, read: (filePath: string) => T | undefined): Promise<Array<T & { filePath: string }>> {
    const entries = readEntries(directory, prefix, read);
    const active: Array<T & { filePath: string }> = [];
    for (const entry of entries) {
      const status = await probeLiveness(entry);
      if (status === 'DEAD') {
        fs.rmSync(entry.filePath ?? path.join(directory, `${prefix}${entry.token}`), { force: true });
        fsyncDirectory(directory);
      } else {
        active.push(entry);
      }
    }
    return active;
  }
}

function readEntries<T>(directory: string, prefix: string, read: (filePath: string) => T | undefined): Array<T & { filePath: string }> {
  try {
    const records: Array<T & { filePath: string }> = [];
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.startsWith(prefix)) continue;
      const filePath = path.join(directory, entry.name);
      const value = read(filePath);
      if (value) records.push({ ...value, filePath });
    }
    return records;
  } catch (error) {
    if (isMissing(error)) return [];
    throw new Error('ROOT_LOCK_RECOVERY_REQUIRED');
  }
}

function readTicket(filePath: string): Ticket | undefined {
  const descriptor = readDescriptor(filePath) as (Descriptor & { ticket?: unknown }) | undefined;
  const ticket = descriptor?.ticket;
  if (!descriptor || typeof ticket !== 'number' || !Number.isSafeInteger(ticket) || ticket < 1) {
    if (descriptor) throw new Error('ROOT_LOCK_RECOVERY_REQUIRED');
    return undefined;
  }
  return { ...descriptor, ticket, filePath };
}

function readDescriptor(filePath: string): Descriptor | undefined {
  try {
    const value = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Partial<Descriptor>;
    if (value.protocol !== PROTOCOL
      || typeof value.pid !== 'number' || !Number.isInteger(value.pid) || value.pid < 1
      || typeof value.token !== 'string'
      || typeof value.endpoint?.path !== 'string' || !isValidLivenessPipePath(value.endpoint.path)) {
      throw new Error('ROOT_LOCK_OFFLINE_UPGRADE_REQUIRED');
    }
    return value as Descriptor;
  } catch (error) {
    if (isMissing(error)) return undefined;
    throw error;
  }
}

function ensureProtocolMarker(directory: string): void {
  const markerPath = path.join(directory, MARKER_NAME);
  try {
    publishDescriptor(directory, markerPath, { protocol: PROTOCOL });
  } catch (error) {
    if (!isAlreadyExists(error)) throw new Error('ROOT_LOCK_RECOVERY_REQUIRED');
    try {
      const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8')) as { protocol?: unknown };
      if (marker.protocol !== PROTOCOL) throw new Error('ROOT_LOCK_OFFLINE_UPGRADE_REQUIRED');
    } catch (readError) {
      if (readError instanceof Error && readError.message === 'ROOT_LOCK_OFFLINE_UPGRADE_REQUIRED') throw readError;
      throw new Error('ROOT_LOCK_OFFLINE_UPGRADE_REQUIRED');
    }
  }
}

async function reclaimDeadBridge(directory: string, bridgePath: string, expected: Descriptor): Promise<void> {
  const proofPath = path.join(directory, `.mutation.lock.bridge-proof-${process.pid}-${randomUUID()}`);
  try {
    fs.linkSync(bridgePath, proofPath);
    const current = fs.statSync(bridgePath);
    const proof = fs.statSync(proofPath);
    const descriptor = readDescriptor(bridgePath);
    if (!descriptor || current.dev !== proof.dev || current.ino !== proof.ino || descriptor.token !== expected.token || descriptor.endpoint.path !== expected.endpoint.path) return;
    if (await probeLiveness(descriptor) !== 'DEAD') return;
    fs.unlinkSync(bridgePath);
    fsyncDirectory(directory);
  } catch (error) {
    if (!isMissing(error)) throw error;
  } finally {
    fs.rmSync(proofPath, { force: true });
  }
}

function publishDescriptor(directory: string, filePath: string, value: object): void {
  const candidate = path.join(directory, `.${path.basename(filePath)}.candidate-${process.pid}-${randomUUID()}`);
  const descriptor = fs.openSync(candidate, 'wx', 0o600);
  try {
    fs.writeFileSync(descriptor, JSON.stringify(value), 'utf8');
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  try {
    fs.linkSync(candidate, filePath);
    fsyncDirectory(directory);
  } finally {
    fs.rmSync(candidate, { force: true });
  }
}

class Lease {
  public constructor(private readonly ticketPath: string, private readonly bridgePath: string, private readonly directory: string, private readonly token: string) {}

  public async release(): Promise<void> {
    try {
      const bridge = readDescriptor(this.bridgePath);
      if (!bridge || bridge.token !== this.token) throw new Error('ROOT_LOCK_RECOVERY_REQUIRED');
      fs.unlinkSync(this.bridgePath);
      fs.unlinkSync(this.ticketPath);
      fsyncDirectory(this.directory);
    } finally {
      livenessRegistry.unregister(this.token);
    }
  }
}

function compareTickets(left: Ticket, right: Ticket): number {
  return left.ticket - right.ticket || left.token.localeCompare(right.token);
}

async function probeLiveness(descriptor: Descriptor): Promise<Liveness> {
  return await new Promise((resolve) => {
    let settled = false;
    let response = '';
    const finish = (status: Liveness): void => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(status);
    };
    const socket = net.createConnection({ path: descriptor.endpoint.path });
    socket.setTimeout(PROBE_TIMEOUT_MS, () => finish('UNKNOWN'));
    socket.once('connect', () => socket.write(`${descriptor.token}\n`));
    socket.on('data', (chunk: Buffer) => {
      response += chunk.toString('utf8');
      if (!response.includes('\n')) return;
      finish(response === `LIVE ${descriptor.token}\n` ? 'LIVE' : 'DEAD');
    });
    socket.once('end', () => finish('DEAD'));
    socket.once('error', (error: NodeJS.ErrnoException) => finish(['ECONNREFUSED', 'ENOENT'].includes(error.code ?? '') ? 'DEAD' : 'UNKNOWN'));
  });
}

class LivenessRegistry {
  private readonly tokens = new Set<string>();
  private endpoint: Endpoint | undefined;
  private starting: Promise<Endpoint> | undefined;

  public async register(token: string): Promise<Endpoint> {
    const endpoint = await this.start();
    this.tokens.add(token);
    return endpoint;
  }

  public unregister(token: string): void { this.tokens.delete(token); }

  private async start(): Promise<Endpoint> {
    if (this.endpoint) return this.endpoint;
    this.starting ??= new Promise<Endpoint>((resolve, reject) => {
      const server = net.createServer((socket) => this.handle(socket));
      server.unref();
      server.once('error', reject);
      const socketPath = createLivenessPipePath();
      server.listen(socketPath, () => {
        server.off('error', reject);
        const address = server.address();
        if (!address || typeof address !== 'string') {
          reject(new Error('ROOT_LOCK_RECOVERY_REQUIRED'));
          return;
        }
        this.endpoint = { path: address };
        resolve(this.endpoint);
      });
    });
    return await this.starting;
  }

  private handle(socket: net.Socket): void {
    socket.setTimeout(PROBE_TIMEOUT_MS, () => socket.destroy());
    let request = '';
    socket.on('data', (chunk: Buffer) => {
      request += chunk.toString('utf8');
      if (!request.includes('\n')) {
        if (request.length > 256) socket.end('DEAD\n');
        return;
      }
      const token = request.slice(0, request.indexOf('\n'));
      socket.end(this.tokens.has(token) ? `LIVE ${token}\n` : 'DEAD\n');
    });
    socket.once('error', () => socket.destroy());
  }
}

const livenessRegistry = new LivenessRegistry();

function isValidLivenessPipePath(socketPath: string): boolean {
  const suffix = '[0-9a-f]{32}';
  const windowsPrefix = '\\\\.\\pipe\\burrow-lock-';
  if (process.platform === 'win32') return socketPath.startsWith(windowsPrefix) && new RegExp(`^${suffix}$`, 'i').test(socketPath.slice(windowsPrefix.length));
  return [os.tmpdir(), '/tmp'].includes(path.dirname(socketPath))
    && new RegExp(`^burrow-lock-${suffix}[.]sock$`, 'i').test(path.basename(socketPath));
}

function createLivenessPipePath(): string {
  const suffix = randomBytes(16).toString('hex');
  if (process.platform === 'win32') return `\\\\.\\pipe\\burrow-lock-${suffix}`;
  const name = `burrow-lock-${suffix}.sock`;
  const preferred = path.join(os.tmpdir(), name);
  return Buffer.byteLength(preferred) <= 100 ? preferred : path.join('/tmp', name);
}

function fsyncDirectory(directory: string): void {
  try {
    const descriptor = fs.openSync(directory, 'r');
    try { fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (!['EINVAL', 'ENOTSUP', 'EPERM', 'EISDIR'].includes(code ?? '')) throw error;
  }
}

function isAlreadyExists(error: unknown): boolean { return (error as NodeJS.ErrnoException).code === 'EEXIST'; }
function isMissing(error: unknown): boolean { return (error as NodeJS.ErrnoException).code === 'ENOENT'; }
function delay(ms: number): Promise<void> { return new Promise((resolve) => setTimeout(resolve, ms)); }
