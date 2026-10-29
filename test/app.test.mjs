import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { utimesSync } from 'node:fs';
import { createApp } from '../lib/app.js';

const FAKE = fileURLToPath(new URL('./fake-claude.mjs', import.meta.url));
const HOME = fileURLToPath(new URL('./fixtures/home', import.meta.url));
const TOKEN = 'tok-' + 'a1b2c3d4'.repeat(4);
const DIR = fileURLToPath(new URL('./fixtures/home/.claude/projects/D--proj-a', import.meta.url));
utimesSync(DIR + '/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1.jsonl', 1000, 1000); // A older than B
utimesSync(DIR + '/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2.jsonl', 2000, 2000);
let server, port, root, cwd;

before(async () => {
  root = await mkdtemp(join(tmpdir(), 'lui-root-'));
  cwd = await mkdtemp(join(tmpdir(), 'lui-cwd-'));
  await mkdir(join(root, 'public')); await mkdir(join(root, 'vendor')); await mkdir(join(root, 'themes', 'a'), { recursive: true });
  await writeFile(join(root, 'public', 'index.html'), '<h1>ui</h1>');
  await writeFile(join(root, 'vendor', 'v.js'), 'x');
  await writeFile(join(root, 'server.js'), 'SECRET');
  await writeFile(join(root, 'themes', 'a', 'theme.json'), JSON.stringify({ key: 'a', label: 'A', icon: 'i', accent: '#000000', secondary: '#000000', hero: 'A', villain: false, group: 'Class 1-A' }));
  await writeFile(join(root, 'themes', 'a', 'bg.mp4'), Buffer.from('0123456789'.repeat(10)));
  server = createApp({ token: TOKEN, root, command: [process.execPath, FAKE], home: HOME });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  port = server.address().port;
});
after(() => server.shutdown());

function req(method, path, { headers = {}, body, auth = true } = {}) {
  return new Promise((resolve, reject) => {
    const r = http.request({ agent: false, host: '127.0.0.1', port, method, path, headers: { ...(auth ? { cookie: `lui=${TOKEN}` } : {}), ...headers } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    r.on('error', reject);
    r.end(body);
  });
}
const post = (path, obj, opts = {}) => req('POST', path, { ...opts, headers: { 'content-type': 'application/json', ...opts.headers }, body: JSON.stringify(obj) });

function sse() {
  const events = [];
  const waiters = [];
  const r = http.request({ host: '127.0.0.1', port, path: '/api/events', headers: { cookie: `lui=${TOKEN}` } }, (res) => {
    let buf = '';
    res.on('data', (d) => {
      buf += d;
      for (const part of buf.split('\n\n').slice(0, -1)) {
        const line = part.split('\n').find((l) => l.startsWith('data: '));
        if (line) events.push(JSON.parse(line.slice(6)));
      }
      buf = buf.slice(buf.lastIndexOf('\n\n') + 2);
      waiters.slice().forEach((w) => w());
    });
  });
  r.end();
  const until = (pred) => new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('timeout; saw ' + JSON.stringify(events.map((e) => e.kind)))), 5000);
    const w = () => { if (events.some(pred)) { clearTimeout(t); waiters.splice(waiters.indexOf(w), 1); res(); } };
    waiters.push(w); w();
  });
  return { events, until, close: () => r.destroy() };
}
const say = (text) => ({ content: [{ type: 'text', text }] });

test('requests without a valid cookie are 403', async () => {
  assert.equal((await req('GET', '/', { auth: false })).status, 403);
  assert.equal((await req('GET', '/?t=wrong', { auth: false })).status, 403);
  assert.equal((await req('GET', '/api/themes', { headers: { cookie: 'lui=nope' }, auth: false })).status, 403);
});

test('the right token sets an HttpOnly SameSite=Strict cookie and redirects to /', async () => {
  const r = await req('GET', `/?t=${TOKEN}`, { auth: false });
  assert.equal(r.status, 302);
  assert.equal(r.headers.location, '/');
  assert.match(r.headers['set-cookie'][0], /lui=.*HttpOnly/);
  assert.match(r.headers['set-cookie'][0], /SameSite=Strict/);
  assert.equal((await req('GET', '/')).body.toString(), '<h1>ui</h1>');
});

test('a foreign Host header is 403 (DNS rebinding)', async () => {
  assert.equal((await req('GET', '/api/themes', { headers: { host: 'evil.com' } })).status, 403);
});

test('a foreign Origin on POST is 403 and starts no chat', async () => {
  const r = await post('/api/chat', { cwd, mode: 'manual' }, { headers: { origin: 'http://evil.com' } });
  assert.equal(r.status, 403);
  assert.equal((await post('/api/send', say('hi'))).status, 409); // still no chat
});

test('path traversal in static routes is 404', async () => {
  for (const p of ['/themes/../server.js', '/public/..%2fserver.js', '/vendor/..%5cserver.js', '/themes/%2e%2e/server.js']) {
    const r = await req('GET', p);
    assert.equal(r.status, 404, p);
    assert.ok(!r.body.toString().includes('SECRET'), p);
  }
  assert.equal((await req('GET', '/vendor/v.js')).body.toString(), 'x');
});

test('GET /api/themes lists themes with media urls', async () => {
  const r = JSON.parse((await req('GET', '/api/themes')).body);
  assert.equal(r[0].key, 'a');
  assert.equal(r[0].media.bg, '/themes/a/bg.mp4');
});

test('GET /api/projects, /api/sessions and /api/history read the claude store', async () => {
  assert.equal(JSON.parse((await req('GET', '/api/projects')).body)[0].cwd, 'D:\\proj\\a');
  const s = JSON.parse((await req('GET', `/api/sessions?cwd=${encodeURIComponent('D:\\proj\\a')}`)).body);
  assert.equal(s.length, 2);
  const h = JSON.parse((await req('GET', `/api/history?cwd=${encodeURIComponent('D:\\proj\\a')}&id=${s[1].id}`)).body);
  assert.equal(h[0].kind, 'user_text');
  assert.equal((await req('GET', '/api/history?cwd=x&id=../x')).status, 400);
});

test('range request on theme media returns 206 with the slice', async () => {
  const r = await req('GET', '/themes/a/bg.mp4', { headers: { range: 'bytes=0-3' } });
  assert.equal(r.status, 206);
  assert.equal(r.headers['content-range'], 'bytes 0-3/100');
  assert.equal(r.body.toString(), '0123');
});

test('POST /api/chat rejects a bad mode and a missing directory', async () => {
  assert.equal((await post('/api/chat', { cwd, mode: 'nope' })).status, 400);
  assert.equal((await post('/api/chat', { cwd: join(cwd, 'missing'), mode: 'manual' })).status, 400);
});

test('chat, send and stream: init, text_delta, result; second send during a turn is 409', async () => {
  const s = sse();
  assert.equal((await post('/api/chat', { cwd, mode: 'manual' })).status, 200);
  assert.equal((await post('/api/send', say('hi'))).status, 200);
  assert.equal((await post('/api/send', say('again'))).status, 409);
  await s.until((e) => e.kind === 'result');
  assert.equal(s.events.filter((e) => e.kind === 'text_delta').map((e) => e.text).join(''), 'Hello');
  s.close();
});

test('permission flow over HTTP: permission event, answer, tool_result', async () => {
  const s = sse();
  await post('/api/chat', { cwd, mode: 'manual' });
  await post('/api/send', say('WRITE'));
  await s.until((e) => e.kind === 'permission');
  const p = s.events.find((e) => e.kind === 'permission');
  assert.equal((await post('/api/answer', { requestId: p.requestId, allow: true })).status, 200);
  await s.until((e) => e.kind === 'tool_result' && !e.isError);
  s.close();
});

test('upload saves under cwd/.claude-uploads and returns the path', async () => {
  const r = await req('POST', `/api/upload?cwd=${encodeURIComponent(cwd)}&name=${encodeURIComponent('../a.txt')}`, { body: 'hello' });
  assert.equal(r.status, 200);
  const { path } = JSON.parse(r.body);
  assert.equal(await readFile(path, 'utf8'), 'hello');
  assert.ok(path.includes('.claude-uploads'));
});

test('upload over 25 MB is 413', async () => {
  const r = await req('POST', `/api/upload?cwd=${encodeURIComponent(cwd)}&name=big.bin`, { body: Buffer.alloc(26 * 1024 * 1024) });
  assert.equal(r.status, 413);
});

test('upload to a missing directory is 400', async () => {
  const r = await req('POST', `/api/upload?cwd=${encodeURIComponent(join(cwd, 'nope'))}&name=a.txt`, { body: 'x' });
  assert.equal(r.status, 400);
  await assert.rejects(access(join(cwd, 'nope')));
});
