/* global process, console */
/**
 * Workaround for @xmcl/bytebuffer@0.1.1 invalid "exports" map.
 *
 * Electron/Node enforces that "exports" is either:
 * - an object of main entry condition keys (import/require/...), OR
 * - an object of subpath keys starting with "." (e.g. ".", "./debug").
 *
 * @xmcl/bytebuffer@0.1.1 publishes ".", plus "debug"/"hex"/... (missing "./"),
 * which crashes module resolution at runtime.
 *
 * This script normalizes those keys after install.
 */

const fs = require('node:fs');
const path = require('node:path');

function patchBytebuffer() {
  const pkgPath = path.join(process.cwd(), 'node_modules', '@xmcl', 'bytebuffer', 'package.json');
  if (!fs.existsSync(pkgPath)) return { ok: true, skipped: true, reason: 'not installed' };

  const raw = fs.readFileSync(pkgPath, 'utf-8');
  const pkg = JSON.parse(raw);
  const exp = pkg && typeof pkg === 'object' ? pkg.exports : undefined;
  if (!exp || typeof exp !== 'object') return { ok: true, skipped: true, reason: 'no exports' };

  // If exports contains ".", it must be a subpath map (all keys must start with ".").
  const isSubpathMap = Object.prototype.hasOwnProperty.call(exp, '.');

  let changed = false;
  if (isSubpathMap) {
    for (const key of Object.keys(exp)) {
      if (key === '.') continue;
      if (key.startsWith('.')) continue;
      const to = `./${key}`;
      if (Object.prototype.hasOwnProperty.call(exp, to)) continue;
      exp[to] = exp[key];
      delete exp[key];
      changed = true;
    }
  } else {
    // Conditional main exports map (import/require/default/etc) — leave as-is.
    return { ok: true, skipped: true, reason: 'conditional exports' };
  }

  const validateExports = () => {
    for (const [key, conditions] of Object.entries(exp)) {
      if (!key.startsWith('.')) throw new Error(`invalid export key remains: ${key}`);
      if (!conditions || typeof conditions !== 'object') continue;
      for (const target of Object.values(conditions)) {
        if (typeof target !== 'string' || !target.startsWith('./')) continue;
        if (!fs.existsSync(path.resolve(path.dirname(pkgPath), target))) {
          throw new Error(`export target does not exist: ${target}`);
        }
      }
    }
  };

  if (!changed) {
    validateExports();
    return { ok: true, skipped: true, reason: 'already patched' };
  }

  pkg.exports = exp;
  const tempPath = `${pkgPath}.fmcl-patch-${process.pid}`;
  const backupPath = `${pkgPath}.fmcl-backup-${process.pid}`;
  fs.writeFileSync(tempPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
  fs.renameSync(pkgPath, backupPath);
  try {
    fs.renameSync(tempPath, pkgPath);
    fs.rmSync(backupPath, { force: true });
  } catch (error) {
    fs.renameSync(backupPath, pkgPath);
    fs.rmSync(tempPath, { force: true });
    throw error;
  }
  validateExports();
  return { ok: true, skipped: false };
}

try {
  const res = patchBytebuffer();
  if (!res.skipped) {
    console.log('[postinstall] Patched @xmcl/bytebuffer exports');
  } else {
    console.log(`[postinstall] @xmcl/bytebuffer exports: ${res.reason}`);
  }
} catch (e) {
  console.error('[postinstall] Failed to patch @xmcl/bytebuffer exports:', e);
  process.exitCode = 1;
}
