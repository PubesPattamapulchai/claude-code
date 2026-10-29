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

export async function listDrives({ timeoutMs = 500 } = {}) {
  if (process.platform !== 'win32') return ['/'];
  const letters = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i) + ':\\');
  const answered = await Promise.all(letters.map((d) => withTimeout(access(d), timeoutMs).then(() => d, () => null)));
  return answered.filter(Boolean);
}

export const defaultStart = (drives) => drives.find((d) => d.toLowerCase() === 'd:\\') ?? drives[0];
