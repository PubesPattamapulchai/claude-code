import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, parse } from 'node:path';
import { listDirs, listDrives, defaultStart, createDriveLister } from '../lib/dirs.js';
import { createApp } from '../lib/app.js';

const TOKEN = 'tok-' + 'f00dcafe'.repeat(4);
let tmp, server, port;

before(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'lui-dirs-'));
  for (const d of ['a', 'B', '10', '2', '.hidden', '$RECYCLE.BIN', 'System Volume Information']) await mkdir(join(tmp, d));
  await writeFile(join(tmp, 'f.txt'), 'x');
  server = createApp({ token: TOKEN, root: tmp, home: tmp });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  port = server.address().port;
});
after(() => server.shutdown());

function get(path, { auth = true } = {}) {
  return new Promise((resolve, reject) => {
    const r = http.request({ agent: false, host: '127.0.0.1', port, path, headers: auth ? { cookie: `lui=${TOKEN}` } : {} }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString() || '{}') }));
    });
    r.on('error', reject);
    r.end();
  });
}

test('listDirs lists folders only, hides hidden and system names, sorts case-insensitively and numerically', async () => {
  const r = await listDirs(tmp);
  assert.deepEqual(r.dirs, ['2', '10', 'a', 'B']);
  assert.equal(r.path, tmp);
});

test('listDirs reports the parent, and null at a filesystem root', async () => {
  assert.equal((await listDirs(tmp)).parent, dirname(tmp));
  assert.equal((await listDirs(parse(tmp).root)).parent, null);
});

test('listDirs rejects relative, UNC, missing and file paths with bad_path', async () => {
  for (const bad of ['rel/path', '\\\\server\\share', '//server/share', join(tmp, 'nope'), join(tmp, 'f.txt')]) {
    await assert.rejects(listDirs(bad), /bad_path/, bad);
  }
});

test('listDirs maps EACCES to denied and a hung read to timeout', async () => {
  const eacces = async () => { throw Object.assign(new Error('x'), { code: 'EACCES' }); };
  await assert.rejects(listDirs(tmp, { readdir: eacces }), /denied/);
  const hang = () => new Promise(() => {});
  await assert.rejects(listDirs(tmp, { readdir: hang, timeoutMs: 50 }), /timeout/);
});

test('listDrives returns the drives that answer', async () => {
  const drives = await listDrives();
  if (process.platform === 'win32') {
    assert.ok(drives.includes(parse(tmp).root.toUpperCase()), drives.join(','));
    for (const d of drives) assert.match(d, /^[A-Z]:\\$/);
  } else assert.deepEqual(drives, ['/']);
});

test('defaultStart prefers D: and falls back to the first drive', () => {
  assert.equal(defaultStart(['C:\\', 'D:\\']), 'D:\\');
  assert.equal(defaultStart(['C:\\', 'E:\\']), 'C:\\');
  assert.equal(defaultStart(['d:\\']), 'd:\\');
});

test('GET /api/dirs requires the token', async () => {
  assert.equal((await get(`/api/dirs?path=${encodeURIComponent(tmp)}`, { auth: false })).status, 403);
});

test('GET /api/dirs lists folders for a path and includes drives', async () => {
  const r = await get(`/api/dirs?path=${encodeURIComponent(tmp)}`);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.dirs, ['2', '10', 'a', 'B']);
  assert.ok(r.body.drives.length > 0);
  assert.equal(JSON.stringify(r.body).includes('f.txt'), false);
});

test('GET /api/dirs without a path answers for the default start', async () => {
  const r = await get('/api/dirs');
  assert.equal(r.status, 200);
  assert.ok(r.body.drives.some((d) => d.toLowerCase() === parse(r.body.path).root.toLowerCase()), r.body.path);
});

test('GET /api/dirs maps errors to 400 bad_path', async () => {
  for (const bad of ['rel/path', '\\\\server\\share', join(tmp, 'nope')]) {
    const r = await get(`/api/dirs?path=${encodeURIComponent(bad)}`);
    assert.equal(r.status, 400, bad);
    assert.equal(r.body.error, 'bad_path');
  }
});

test('listDrives never starts a second check for a drive whose last check is still running', async () => {
  const calls = new Map();
  const access = (d) => { calls.set(d, (calls.get(d) ?? 0) + 1); return d === 'C:\\' || d === 'D:\\' ? Promise.resolve() : new Promise(() => {}); };
  const list = createDriveLister({ access, timeoutMs: 30, ttlMs: 0, platform: 'win32' });
  assert.deepEqual(await list(), ['C:\\', 'D:\\']);
  assert.deepEqual(await list(), ['C:\\', 'D:\\']);
  assert.equal(calls.get('Z:\\'), 1, 'a dead drive must not get a second check while the first still hangs');
  assert.equal(calls.get('C:\\'), 2);
});

test('listDrives caches its answer for ttlMs', async () => {
  let n = 0;
  const list = createDriveLister({ access: async () => { n++; }, ttlMs: 60_000, platform: 'win32' });
  await list();
  const first = n;
  await list();
  assert.equal(n, first);
});
