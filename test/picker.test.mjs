import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crumbsOf, basename } from '../public/picker.js';

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
