import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { assertAbsolutePath } from './pathGuards';

const AUTHORIZATION_TTL_MS = 5 * 60 * 1_000;

type ArchiveReferenceAuthorization = Readonly<{
  ownerId: number;
  filePath: string;
  expiresAt: number;
}>;

const authorizedReferences = new Map<string, ArchiveReferenceAuthorization>();

function assertOwnerId(ownerId: number): void {
  if (!Number.isSafeInteger(ownerId) || ownerId < 0) {
    throw new Error('Archive reference authorization owner is invalid');
  }
}

function pruneExpired(now = Date.now()): void {
  for (const [reference, authorization] of authorizedReferences) {
    if (authorization.expiresAt <= now) authorizedReferences.delete(reference);
  }
}

/**
 * Main-process-only registry for a native-selected archive. Module state is
 * deliberately volatile, so unconsumed references cannot survive a restart.
 */
export function authorizeArchiveReference(ownerId: number, candidate: string): string {
  assertOwnerId(ownerId);
  pruneExpired();
  const filePath = path.normalize(assertAbsolutePath(candidate, 'Archive path'));
  let reference: string;
  do {
    reference = randomBytes(32).toString('base64url');
  } while (authorizedReferences.has(reference));

  authorizedReferences.set(reference, {
    ownerId,
    filePath,
    expiresAt: Date.now() + AUTHORIZATION_TTL_MS,
  });
  return reference;
}

/** Atomically validate ownership and consume a one-time archive reference. */
export function consumeArchiveReference(ownerId: number, reference: string): string {
  assertOwnerId(ownerId);
  pruneExpired();
  if (typeof reference !== 'string' || !reference) {
    throw new Error('Archive reference was not authorized by a recent native archive selection');
  }

  const authorization = authorizedReferences.get(reference);
  if (!authorization || authorization.ownerId !== ownerId) {
    throw new Error('Archive reference was not authorized by a recent native archive selection');
  }

  authorizedReferences.delete(reference);
  return authorization.filePath;
}

export function clearArchiveReferenceAuthorizationsForTests(): void {
  authorizedReferences.clear();
}
