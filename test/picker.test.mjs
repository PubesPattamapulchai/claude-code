import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crumbsOf, basename, samePath, latestOnly } from '../public/picker.js';

test('crumbsOf splits a Windows path into clickable segments', () => {
  assert.deepEqual(crumbsOf('D:\\POE\\claude-code'), [
    { label: 'D:\\', path: 'D:\\' },
    { label: 'POE', path: 'D:\\POE' },
    { label: 'claude-code', path: 'D:\\POE\\claude-code' },
  ]);
});

test('crumbsOf handles a drive root, forward slashes and trailing separators', () => {
  assert.deepEqual(crumbsOf('D:\\'), [{ label: 'D:\\', path: 'D:\\' }]);
  assert.deepEqual(crumbsOf('D:/POE/x'), [
    { label: 'D:\\', path: 'D:\\' },
    { label: 'POE', path: 'D:\\POE' },
    { label: 'x', path: 'D:\\POE\\x' },
  ]);
  assert.deepEqual(crumbsOf('D:\\POE\\'), [{ label: 'D:\\', path: 'D:\\' }, { label: 'POE', path: 'D:\\POE' }]);
});

test('crumbsOf handles POSIX paths and empty input', () => {
  assert.deepEqual(crumbsOf('/a/b'), [{ label: '/', path: '/' }, { label: 'a', path: '/a' }, { label: 'b', path: '/a/b' }]);
  assert.deepEqual(crumbsOf('/'), [{ label: '/', path: '/' }]);
  assert.deepEqual(crumbsOf(''), []);
});

test('basename returns the last segment, a root as itself, and empty for empty', () => {
  assert.equal(basename('D:\\POE\\claude-code'), 'claude-code');
  assert.equal(basename('D:\\POE\\'), 'POE');
  assert.equal(basename('D:\\'), 'D:\\');
  assert.equal(basename('/a/b'), 'b');
  assert.equal(basename('/'), '/');
  assert.equal(basename(''), '');
});

test('samePath ignores case, slash direction and trailing separators on Windows paths', () => {
  assert.equal(samePath('D:\\POE\\app', 'd:/poe/app/'), true);
  assert.equal(samePath('D:\\', 'd:/'), true);
  assert.equal(samePath('D:\\POE', 'D:\\POE2'), false);
  assert.equal(samePath('D:\\POE\\a', 'D:\\POE\\a\\b'), false);
  assert.equal(samePath('D:', 'D:\\'), false);
});

test('samePath compares POSIX paths case-sensitively and ignores a trailing slash', () => {
  assert.equal(samePath('/a/b', '/a/b/'), true);
  assert.equal(samePath('/a/b', '/A/B'), false);
  assert.equal(samePath('/', '/'), true);
});

test('samePath never treats two empty paths as the same folder', () => {
  assert.equal(samePath('', ''), false);
  assert.equal(samePath('D:\\x', ''), false);
});

test('latestOnly marks every call but the most recent as stale, whatever order they finish in', async () => {
  const finish = [];
  const f = latestOnly((n) => new Promise((res) => finish.push(() => res(n))));
  const first = f(1);
  const second = f(2);
  finish[1](); // the newer request answers first
  finish[0]();
  assert.deepEqual(await second, { stale: false, value: 2 });
  assert.deepEqual(await first, { stale: true });
});

test('latestOnly: a lone call is fresh, its error rejects, and a stale call error is swallowed', async () => {
  const ok = latestOnly(async (n) => n * 2);
  assert.deepEqual(await ok(21), { stale: false, value: 42 });

  const boom = latestOnly(async () => { throw new Error('x'); });
  await assert.rejects(boom(), /x/);

  const gates = [];
  const mixed = latestOnly((fail) => new Promise((res, rej) => gates.push(() => (fail ? rej(new Error('old')) : res('new')))));
  const older = mixed(true);
  const newer = mixed(false);
  gates[1]();
  gates[0]();
  assert.deepEqual(await newer, { stale: false, value: 'new' });
  assert.deepEqual(await older, { stale: true });
});
