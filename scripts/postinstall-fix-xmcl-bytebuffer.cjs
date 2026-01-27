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

  if (!changed) return { ok: true, skipped: true, reason: 'already patched' };

  pkg.exports = exp;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
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
  console.warn('[postinstall] Failed to patch @xmcl/bytebuffer exports:', e);
  // Don't hard-fail install; the runtime error will be obvious otherwise.
}

