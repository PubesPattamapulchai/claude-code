import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, isAbsolute } from 'node:path';
import { MAX_BYTES, safeName, saveUpload } from '../lib/uploads.js';

const body = async function* (...chunks) { for (const c of chunks) yield Buffer.from(c); };
const tmp = () => mkdtemp(join(tmpdir(), 'lui-up-'));

test('safeName strips directories and illegal names', () => {
  assert.equal(safeName('../../evil'), 'evil');
  assert.equal(safeName('C:\\x\\y.txt'), 'y.txt');
  assert.equal(safeName(''), 'file');
  assert.equal(safeName('..'), 'file');
  assert.equal(safeName('a<b>:c|?.txt'), 'abc.txt');
});

test('saved file holds the body and stays inside .claude-uploads', async () => {
  const cwd = await tmp();
  const { path } = await saveUpload(cwd, '../../evil.txt', body('he', 'llo'));
  assert.equal(await readFile(path, 'utf8'), 'hello');
  const rel = relative(join(cwd, '.claude-uploads'), path);
  assert.ok(!rel.startsWith('..') && !isAbsolute(rel), rel);
  assert.match(rel, /^\d+-evil\.txt$/);
});

test('a body over MAX_BYTES rejects too_large and leaves no file', async () => {
  const cwd = await tmp();
  const big = async function* () { const mb = Buffer.alloc(1024 * 1024); for (let i = 0; i <= MAX_BYTES / mb.length; i++) yield mb; };
  await assert.rejects(saveUpload(cwd, 'big.bin', big()), /too_large/);
  const left = (await readdir(join(cwd, '.claude-uploads'))).filter((n) => n !== '.gitignore');
  assert.deepEqual(left, []);
});

test('two uploads with the same name get distinct paths', async () => {
  const cwd = await tmp();
  const a = await saveUpload(cwd, 'same.txt', body('1'));
  const b = await saveUpload(cwd, 'same.txt', body('2'));
  assert.notEqual(a.path, b.path);
  assert.equal(await readFile(a.path, 'utf8'), '1');
});
