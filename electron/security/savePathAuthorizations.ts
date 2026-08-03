import path from 'node:path';
import { assertAbsolutePath } from './pathGuards';

const AUTHORIZATION_TTL_MS = 5 * 60 * 1_000;
const authorizedPaths = new Map<string, number>();

function normalize(candidate: string): string {
  return path.normalize(assertAbsolutePath(candidate, 'Save path'));
}

function pruneExpired(now = Date.now()): void {
  for (const [candidate, expiresAt] of authorizedPaths) {
    if (expiresAt <= now) authorizedPaths.delete(candidate);
  }
}

export function authorizeSavePath(candidate: string): string {
  pruneExpired();
  const safePath = normalize(candidate);
  authorizedPaths.set(safePath, Date.now() + AUTHORIZATION_TTL_MS);
  return safePath;
}

export function consumeAuthorizedSavePath(candidate: string): string {
  pruneExpired();
  const safePath = normalize(candidate);
  if (!authorizedPaths.delete(safePath)) {
    throw new Error('Save path was not authorized by a recent native save dialog');
  }
  return safePath;
}

export function clearSavePathAuthorizationsForTests(): void {
  authorizedPaths.clear();
}
