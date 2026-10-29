import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { createChat, MODES } from '../lib/engine.js';

const FAKE = fileURLToPath(new URL('./fake-claude.mjs', import.meta.url));
const UUID = '11111111-2222-4333-8444-555555555555';

function start(extra = {}) {
  const events = [];
  const waiters = [];
  const chat = createChat({
    cwd: tmpdir(), mode: 'manual', command: [process.execPath, FAKE], ...extra,
    onEvent: (e) => { events.push(e); waiters.slice().forEach((w) => w()); },
  });
  const until = (pred) => new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('timeout; saw ' + JSON.stringify(events.map((e) => e.kind)))), 5000);
    const check = () => { if (events.some(pred)) { clearTimeout(t); res(); return true; } };
    if (!check()) { const w = () => { if (check()) waiters.splice(waiters.indexOf(w), 1); }; waiters.push(w); }
  });
  return { chat, events, until };
}
const say = (text) => [{ type: 'text', text }];

test('text turn emits init, text_delta x2, assistant, result', async () => {
  const { chat, events, until } = start();
  chat.send(say('hi'));
  assert.equal(chat.busy, true);
  await until((e) => e.kind === 'result');
  assert.deepEqual(events.map((e) => e.kind), ['init', 'text_delta', 'text_delta', 'assistant', 'result']);
  assert.equal(events.filter((e) => e.kind === 'text_delta').map((e) => e.text).join(''), 'Hello');
  assert.equal(chat.busy, false);
  assert.equal(chat.sessionId, '00000000-0000-4000-8000-000000000001');
  chat.close();
});

test('send while busy throws busy', async () => {
  const { chat, until } = start();
  chat.send(say('hi'));
  assert.throws(() => chat.send(say('again')), /busy/);
  await until((e) => e.kind === 'result');
  chat.close();
});

test('permission round trip allow and deny', async () => {
  const { chat, events, until } = start();
  chat.send(say('WRITE'));
  await until((e) => e.kind === 'permission');
  const p = events.find((e) => e.kind === 'permission');
  assert.equal(p.requestId, 'req-1');
  assert.equal(p.tool, 'Write');
  chat.answer('req-1', { allow: true });
  await until((e) => e.kind === 'tool_result');
  assert.equal(events.find((e) => e.kind === 'tool_result').isError, false);
  await until((e) => e.kind === 'result');

  chat.send(say('WRITE'));
  await until((e) => e.kind === 'permission' && e.requestId === 'req-2');
  chat.answer('req-2', { allow: false });
  await until((e) => e.kind === 'tool_result' && e.isError);
  chat.close();
});

test('always allow auto-answers later requests of same tool', async () => {
  const { chat, events, until } = start();
  chat.send(say('WRITE'));
  await until((e) => e.kind === 'permission');
  chat.answer('req-1', { allow: true, always: true });
  await until((e) => e.kind === 'result');
  const before = events.filter((e) => e.kind === 'permission').length;
  chat.send(say('WRITE'));
  await until((e) => e.kind === 'result' && events.filter((x) => x.kind === 'result').length === 2);
  assert.equal(events.filter((e) => e.kind === 'permission').length, before);
  assert.equal(events.filter((e) => e.kind === 'tool_result' && !e.isError).length, 2);
  chat.close();
});

test('login error maps to login_required', async () => {
  const { chat, events, until } = start();
  chat.send(say('LOGIN'));
  await until((e) => e.kind === 'result');
  const kinds = events.map((e) => e.kind);
  assert.ok(kinds.indexOf('login_required') >= 0 && kinds.indexOf('login_required') < kinds.indexOf('result'));
  chat.close();
});

test('non-zero exit emits exit code 3 and error', async () => {
  const { chat, events, until } = start();
  chat.send(say('DIE'));
  await until((e) => e.kind === 'exit');
  assert.equal(events.find((e) => e.kind === 'exit').code, 3);
  assert.ok(events.some((e) => e.kind === 'error'));
  assert.equal(chat.busy, false);
});

test('argv contains whitelisted mode and resume only', async () => {
  const { chat, events, until } = start({ mode: 'plan', resume: UUID });
  chat.send(say('hi'));
  await until((e) => e.kind === 'result');
  chat.close();
  const argv = chat.argv;
  for (const want of ['--permission-mode', 'plan', '--resume', UUID, '--permission-prompt-tool', 'stdio', '--output-format', 'stream-json']) {
    assert.ok(argv.includes(want), `missing ${want} in ${argv.join(' ')}`);
  }
  assert.ok(events.length > 0);
});

test('createChat rejects bad mode and bad resume', () => {
  assert.throws(() => createChat({ cwd: tmpdir(), mode: 'x', onEvent() {} }), /invalid/);
  assert.throws(() => createChat({ cwd: tmpdir(), mode: 'manual', resume: '../x', onEvent() {} }), /invalid/);
  assert.deepEqual(MODES, ['manual', 'acceptEdits', 'plan', 'bypassPermissions']);
});

test('interrupt kills the child and emits exit', async () => {
  const { chat, until } = start();
  chat.send(say('WRITE')); // child now blocks waiting for a permission answer
  await until((e) => e.kind === 'permission');
  chat.interrupt();
  await until((e) => e.kind === 'exit');
  assert.equal(chat.busy, false);
});

test('interrupt kills the whole process tree, not just the shell wrapper', { skip: process.platform !== 'win32' }, async () => {
  const { statSync } = await import('node:fs');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const beat = `${tmpdir()}/lui-beat-${Date.now()}.txt`;
  process.env.FAKE_HEARTBEAT = beat;
  try {
    const { chat, until } = start({ command: ['cmd.exe', '/c', process.execPath, FAKE] });
    chat.send(say('hi'));
    await until((e) => e.kind === 'result');
    await sleep(300); // let the grandchild write a few heartbeats
    chat.interrupt();
    await until((e) => e.kind === 'exit');
    await sleep(600);
    const a = statSync(beat).size;
    await sleep(600);
    assert.equal(statSync(beat).size, a, 'heartbeat kept growing: the claude process survived interrupt()');
  } finally { delete process.env.FAKE_HEARTBEAT; }
});

test('a deliberate interrupt emits exit but no error event', async () => {
  const { chat, events, until } = start();
  chat.send(say('WRITE'));
  await until((e) => e.kind === 'permission');
  chat.interrupt();
  await until((e) => e.kind === 'exit');
  assert.equal(events.some((e) => e.kind === 'error'), false);
});

test('claude is not resolved from the project folder (planted claude.bat must not run)', { skip: process.platform !== 'win32' }, async () => {
  const { mkdtemp, writeFile, access } = await import('node:fs/promises');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const dir = await mkdtemp(`${tmpdir()}/lui-plant-`);
  await writeFile(`${dir}/claude.bat`, '@echo off\r\necho hijacked> "%~dp0marker.txt"\r\n');
  const saved = process.env.NoDefaultCurrentDirectoryInExePath;
  delete process.env.NoDefaultCurrentDirectoryInExePath; // a double-clicked start.bat does not set it
  try {
    const chat = createChat({ cwd: dir, mode: 'manual', onEvent() {} });
    await sleep(2000);
    chat.close();
    await assert.rejects(access(`${dir}/marker.txt`), 'the project folder claude.bat ran');
  } finally { if (saved !== undefined) process.env.NoDefaultCurrentDirectoryInExePath = saved; }
});

test('a write racing the child exit does not crash the process', async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const { chat, until } = start({ command: [process.execPath, '-e', 'setTimeout(() => process.exit(0), 50)'] });
  chat.send([{ type: 'text', text: 'x'.repeat(8 * 1024 * 1024) }]);
  await until((e) => e.kind === 'exit');
  await sleep(300); // an unhandled stdin 'error' would surface here as an uncaught exception
});
