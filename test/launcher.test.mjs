import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { mkdtemp, readFile, access, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launch } from '../server.js';

const lockIn = async () => join(await mkdtemp(join(tmpdir(), 'lui-lock-')), 'lock.json');
const freePort = () => new Promise((res) => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });

test('first launch starts a server, writes the lock and opens an authenticated url', async () => {
  const lockPath = await lockIn();
  const opened = [];
  const a = await launch({ lockPath, port: await freePort(), open: (u) => opened.push(u) });
  try {
    assert.equal(a.reused, false);
    assert.match(a.url, /^http:\/\/127\.0\.0\.1:\d+\/\?t=[0-9a-f]{48}$/);
    assert.deepEqual(opened, [a.url]);
    const lock = JSON.parse(await readFile(lockPath, 'utf8'));
    assert.equal(lock.port, Number(new URL(a.url).port));
    assert.equal(lock.pid, process.pid);
  } finally { await a.close(); }
  await assert.rejects(access(lockPath));
});

test('second launch reuses the running instance and starts no new server', async () => {
  const lockPath = await lockIn();
  const opened = [];
  const a = await launch({ lockPath, port: await freePort(), open: (u) => opened.push(u) });
  try {
    const b = await launch({ lockPath, port: await freePort(), open: (u) => opened.push(u) });
    assert.equal(b.reused, true);
    assert.equal(b.server, undefined);
    assert.equal(b.url, a.url);
    assert.deepEqual(opened, [a.url, a.url]);
  } finally { await a.close(); }
});

test('a stale lock (nothing listening) is replaced by a fresh server', async () => {
  const lockPath = await lockIn();
  await writeFile(lockPath, JSON.stringify({ pid: 1, port: await freePort(), token: 'stale' }));
  const a = await launch({ lockPath, port: await freePort(), open() {} });
  try {
    assert.equal(a.reused, false);
    assert.notEqual(JSON.parse(await readFile(lockPath, 'utf8')).token, 'stale');
  } finally { await a.close(); }
});

test('an occupied preferred port falls through to the next one', async () => {
  const lockPath = await lockIn();
  const taken = net.createServer();
  await new Promise((r) => taken.listen(0, '127.0.0.1', r));
  const p = taken.address().port;
  const a = await launch({ lockPath, port: p, open() {} });
  try { assert.equal(Number(new URL(a.url).port), p + 1); } finally { await a.close(); taken.close(); }
});
