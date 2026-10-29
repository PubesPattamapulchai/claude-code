// Launcher: reuse a running instance or start one on 127.0.0.1, then open the browser.
import { randomBytes } from 'node:crypto';
import { exec } from 'node:child_process';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createApp } from './lib/app.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DEFAULT_LOCK = join(tmpdir(), 'claude-local-ui.json');
const PORT_SPAN = 23; // 3777..3799

const openDefault = (url) => exec(process.platform === 'win32' ? `start "" "${url}"` : `xdg-open "${url}"`);
const urlFor = (port, token) => `http://127.0.0.1:${port}/?t=${token}`;

async function isAlive({ port, token }) {
  try {
    const r = await fetch(urlFor(port, token), { redirect: 'manual', signal: AbortSignal.timeout(1500) });
    return r.status === 302;
  } catch { return false; }
}

function listenOnFirstFree(server, from) {
  return new Promise((resolve, reject) => {
    const attempt = (port) => {
      if (port >= from + PORT_SPAN) return reject(new Error('no free port'));
      server.once('error', (e) => (e.code === 'EADDRINUSE' ? attempt(port + 1) : reject(e)));
      server.listen(port, '127.0.0.1', () => { server.removeAllListeners('error'); resolve(server.address().port); });
    };
    attempt(from);
  });
}

export async function launch({ lockPath = DEFAULT_LOCK, open = openDefault, port = 3777, root = ROOT, command, home } = {}) {
  const lock = await readFile(lockPath, 'utf8').then(JSON.parse, () => null);
  if (lock && (await isAlive(lock))) {
    const url = urlFor(lock.port, lock.token);
    open(url);
    return { url, reused: true, close: async () => {} };
  }

  const token = randomBytes(24).toString('hex');
  const server = createApp({ token, root, command, home });
  const bound = await listenOnFirstFree(server, port);
  await writeFile(lockPath, JSON.stringify({ pid: process.pid, port: bound, token }));
  const url = urlFor(bound, token);
  const cleanup = () => { try { unlinkSync(lockPath); } catch { /* already gone */ } };
  process.once('exit', cleanup);
  open(url);
  return {
    url, reused: false, server,
    close: async () => { process.off('exit', cleanup); await server.shutdown(); await unlink(lockPath).catch(() => {}); },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { url, reused } = await launch();
  console.log(reused ? `Claude Local UI is already running.\nOpened ${url}` : `Claude Local UI running.\n${url}\n\nClose this window to quit.`);
  if (reused) process.exit(0);
  process.on('SIGINT', () => process.exit(0));
}
