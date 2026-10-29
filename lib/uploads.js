// Saves non-image uploads under <cwd>/.claude-uploads so Claude can read them by path.
import { createWriteStream } from 'node:fs';
import { mkdir, unlink, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';

export const MAX_BYTES = 25 * 1024 * 1024;
let last = 0;
const stamp = () => (last = Math.max(Date.now(), last + 1)); // unique even within one millisecond

export function safeName(name) {
  const base = String(name).split(/[\\/]/).pop();
  const clean = base.replace(/[<>:"|?*\x00-\x1f]/g, '').replace(/^[. ]+/, '').slice(0, 120);
  return clean || 'file';
}

export async function saveUpload(cwd, name, body) {
  const dir = join(cwd, '.claude-uploads');
  await mkdir(dir, { recursive: true });
  const ignore = join(dir, '.gitignore');
  await access(ignore).catch(() => writeFile(ignore, '*\n'));

  const path = join(dir, `${stamp()}-${safeName(name)}`);
  const out = createWriteStream(path, { flags: 'wx' });
  const done = new Promise((res, rej) => { out.on('finish', res); out.on('error', rej); });
  let size = 0;
  try {
    for await (const chunk of body) {
      size += chunk.length;
      if (size > MAX_BYTES) throw new Error('too_large');
      if (!out.write(chunk)) await new Promise((r) => out.once('drain', r));
    }
    out.end();
    await done;
  } catch (err) {
    out.destroy();
    await unlink(path).catch(() => {});
    throw err;
  }
  return { path };
}
