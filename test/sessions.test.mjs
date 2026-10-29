import { test } from 'node:test';
import assert from 'node:assert/strict';
import { utimesSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { encodeCwd, listProjects, listSessions, readHistory } from '../lib/sessions.js';

const home = fileURLToPath(new URL('./fixtures/home', import.meta.url));
const dir = `${home}/.claude/projects/D--proj-a`;
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
utimesSync(`${dir}/${A}.jsonl`, 1000, 1000);
utimesSync(`${dir}/${B}.jsonl`, 2000, 2000);
const cwd = 'D:\\proj\\a';

test('encodeCwd replaces every non-alphanumeric with dash', () => {
  assert.equal(encodeCwd('D:\\POE\\claude-code'), 'D--POE-claude-code');
});

test('listSessions returns newest first with titles', async () => {
  const s = await listSessions(cwd, { home });
  assert.deepEqual(s.map((x) => [x.id, x.title]), [[B, 'second chat'], [A, 'first question']]);
  assert.equal(s[0].mtime, 2000000);
});

test('listProjects reads cwd from the jsonl and skips dirs without one', async () => {
  const p = await listProjects({ home });
  assert.deepEqual(p.map((x) => x.cwd), [cwd]);
});

test('readHistory returns user_text, assistant, tool_result, assistant', async () => {
  const h = await readHistory(cwd, A, { home });
  assert.deepEqual(h.map((e) => e.kind), ['user_text', 'assistant', 'tool_result', 'assistant']);
  assert.equal(h[0].text, 'first question');
  assert.deepEqual(h[2], { kind: 'tool_result', toolUseId: 't1', content: 'file text', isError: false });
  assert.equal(h[3].content[0].text, 'answer two');
});

test('readHistory rejects a non-uuid id', async () => {
  await assert.rejects(readHistory(cwd, '../x', { home }), /invalid/);
});

test('unknown project dir gives empty list', async () => {
  assert.deepEqual(await listSessions('Z:\\nope', { home }), []);
});

test('listSessions titles strip slash-command markup', async () => {
  const { mkdtemp, mkdir, writeFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const h = await mkdtemp(`${tmpdir()}/lui-home-`);
  await mkdir(`${h}/.claude/projects/Z--t`, { recursive: true });
  const line = { type: 'user', cwd: 'Z:/t', message: { role: 'user', content: '<command-message>grilling</command-message> <command-args>plan the app</command-args>' } };
  await writeFile(`${h}/.claude/projects/Z--t/dddddddd-dddd-4ddd-8ddd-ddddddddddd4.jsonl`, JSON.stringify(line) + '\n');
  assert.equal((await listSessions('Z:/t', { home: h }))[0].title, 'grilling plan the app');
});
