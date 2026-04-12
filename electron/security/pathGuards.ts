import fs from 'node:fs';
import path from 'node:path';

const WINDOWS_DRIVE_PATH_RE = /^[A-Za-z]:[\\/]/;
const WINDOWS_UNC_PATH_RE = /^\\\\/;

function normalizePathInput(value: string, label: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a string`);
  }
  if (value.includes('\0')) {
    throw new Error(`${label} contains invalid characters`);
  }
  if (!value.trim()) {
    throw new Error(`${label} must not be empty`);
  }
  return value;
}

function isAbsolutePathLike(value: string): boolean {
  return path.isAbsolute(value) || WINDOWS_DRIVE_PATH_RE.test(value) || WINDOWS_UNC_PATH_RE.test(value);
}

function findNearestExistingAncestor(targetPath: string): { existingPath: string; realPath: string } {
  let currentPath = path.resolve(targetPath);

  while (!fs.existsSync(currentPath)) {
    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) {
      return { existingPath: currentPath, realPath: currentPath };
    }
    currentPath = parentPath;
  }

  return {
    existingPath: currentPath,
    realPath: fs.realpathSync.native(currentPath),
  };
}

function canonicalizeForContainment(targetPath: string): string {
  const resolvedPath = path.resolve(targetPath);
  const { existingPath, realPath } = findNearestExistingAncestor(resolvedPath);
  const remainder = path.relative(existingPath, resolvedPath);

  return remainder ? path.resolve(realPath, remainder) : realPath;
}

export function assertAbsolutePath(value: string, label = 'Path'): string {
  const normalizedValue = normalizePathInput(value, label);
  if ((WINDOWS_DRIVE_PATH_RE.test(normalizedValue) || WINDOWS_UNC_PATH_RE.test(normalizedValue)) && path.sep !== '\\') {
    throw new Error(`${label} must be an absolute path`);
  }
  if (!isAbsolutePathLike(normalizedValue)) {
    throw new Error(`${label} must be an absolute path`);
  }
  return path.resolve(normalizedValue);
}

export function assertRelativePath(value: string, label = 'Path'): string {
  const normalizedValue = normalizePathInput(value, label);
  if (isAbsolutePathLike(normalizedValue)) {
    throw new Error(`${label} must stay inside the launcher root`);
  }

  const segments = normalizedValue.split(/[\\/]+/);
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    throw new Error(`${label} must stay inside the launcher root`);
  }

  return segments.join(path.sep);
}

export function assertChildName(value: string, label = 'Path'): string {
  const relativePath = assertRelativePath(value, label);
  if (relativePath.includes(path.sep)) {
    throw new Error(`${label} must not include path separators`);
  }
  return relativePath;
}

export function assertChildNameList(values: string[], label = 'Path'): string[] {
  if (!Array.isArray(values)) {
    throw new Error(`${label} must be a list of names`);
  }
  return values.map((value) => assertChildName(value, label));
}

export function assertPathWithinRoot(rootPath: string, targetPath: string, label = 'Path'): string {
  const canonicalRootPath = canonicalizeForContainment(assertAbsolutePath(rootPath, 'Root path'));
  const canonicalTargetPath = canonicalizeForContainment(assertAbsolutePath(targetPath, label));
  const relativeTargetPath = path.relative(canonicalRootPath, canonicalTargetPath);

  const isContained = (
    relativeTargetPath === ''
    || (!relativeTargetPath.startsWith('..') && !path.isAbsolute(relativeTargetPath))
  );

  if (!isContained) {
    throw new Error(`${label} must stay inside the launcher root`);
  }

  return canonicalTargetPath;
}

export function resolvePathWithinRoot(rootPath: string, relativePath: string, label = 'Path'): string {
  const canonicalRootPath = canonicalizeForContainment(assertAbsolutePath(rootPath, 'Root path'));
  const normalizedRelativePath = assertRelativePath(relativePath, label);
  const candidatePath = path.resolve(canonicalRootPath, normalizedRelativePath);

  return assertPathWithinRoot(canonicalRootPath, candidatePath, label);
}
