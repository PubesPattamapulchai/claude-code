// Folder browsing for the project picker: sub-folders of a directory, and the drives that answer.
import { readdir as fsReaddir, stat, access } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';

const HIDDEN = new Set(['$recycle.bin', 'system volume information']);

// Rejects with Error('timeout') when `promise` takes longer than `ms`.
function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export async function listDirs(path, { readdir = fsReaddir, timeoutMs = 2000 } = {}) {
  // UNC paths are refused: a dead network share would hang the read.
  if (typeof path !== 'string' || !isAbsolute(path) || /^[\\/]{2}/.test(path)) throw new Error('bad_path');
  const full = resolve(path);

  const st = await withTimeout(stat(full), timeoutMs).catch((e) => { throw new Error(e.message === 'timeout' ? 'timeout' : 'bad_path'); });
  if (!st.isDirectory()) throw new Error('bad_path');

  let entries;
  try { entries = await withTimeout(readdir(full, { withFileTypes: true }), timeoutMs); } catch (e) {
    if (e.message === 'timeout') throw e;
    throw new Error(e.code === 'EACCES' || e.code === 'EPERM' ? 'denied' : 'bad_path');
  }

  const visible = entries.filter((e) => !e.name.startsWith('.') && !HIDDEN.has(e.name.toLowerCase()));
  const kept = await Promise.all(visible.map(async (e) => {
    if (e.isDirectory()) return e.name;
    if (!e.isSymbolicLink()) return null;
    // junctions and symlinks: keep only those that point at a folder
    const target = await withTimeout(stat(join(full, e.name)), timeoutMs).catch(() => null);
    return target?.isDirectory() ? e.name : null;
  }));

  const dirs = kept.filter(Boolean).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }));
  return { path: full, parent: dirname(full) === full ? null : dirname(full), dirs };
}

// A check on a dead network drive can block a libuv thread for the whole SMB timeout, and giving up waiting does
// not free it. So: never start a second check for a drive whose last one is still running (it counts as absent),
// and remember the answer for `ttlMs` so folder clicks do not re-probe every letter.
export function createDriveLister({ access: check = access, timeoutMs = 500, ttlMs = 30_000, platform = process.platform } = {}) {
  const running = new Map(); // drive -> its check, until that check finishes
  let cached = null;
  let cachedAt = 0;
  return async function listDrives() {
    if (platform !== 'win32') return ['/'];
    if (cached && Date.now() - cachedAt < ttlMs) return cached;
    const letters = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i) + ':\\');
    const answered = await Promise.all(letters.map((d) => {
      if (running.has(d)) return null;
      const p = check(d);
      running.set(d, p);
      const done = () => running.delete(d);
      p.then(done, done);
      return withTimeout(p, timeoutMs).then(() => d, () => null);
    }));
    cached = answered.filter(Boolean);
    cachedAt = Date.now();
    return cached;
  };
}

export const listDrives = createDriveLister();

export const defaultStart = (drives) => drives.find((d) => d.toLowerCase() === 'd:\\') ?? drives[0];
