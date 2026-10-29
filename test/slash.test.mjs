import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UNAVAILABLE, filterCommands, completionFor, shortDescription } from '../public/slash.js';

const cmd = (name, extra = {}) => ({ name, description: `${name} desc`, argumentHint: '', ...extra });
const commands = [
  cmd('clear', { aliases: ['reset'], builtin: true }), cmd('help', { builtin: true }), cmd('resume', { builtin: true }),
  cmd('focus', { builtin: true }), cmd('model', { builtin: true }), cmd('mattpocock-skills:grilling'),
  cmd('ponytail:ponytail-help'), cmd('caveman:caveman-help'), cmd('grill'),
];
const names = (list) => list.map((c) => c.name);

test('commands the CLI refuses in this mode are never offered', () => {
  assert.deepEqual(UNAVAILABLE, ['help', 'resume', 'focus']);
  for (const q of ['/', '/h', '/help', '/res', '/foc']) {
    for (const n of UNAVAILABLE) assert.ok(!names(filterCommands(commands, q)).includes(n), `${n} offered for ${q}`);
  }
});

test('a bare slash lists everything available, alphabetically', () => {
  const all = names(filterCommands(commands, '/'));
  assert.deepEqual(all, [...all].sort());
  assert.ok(all.includes('model') && all.includes('ponytail:ponytail-help'));
});

test('the part after the plugin prefix matches too', () => {
  assert.deepEqual(names(filterCommands(commands, '/grilling')), ['mattpocock-skills:grilling']);
  assert.deepEqual(names(filterCommands(commands, '/ponytail:p')), ['ponytail:ponytail-help']);
});

test('ranking: exact name, then prefix, then the rest', () => {
  assert.equal(filterCommands(commands, '/grill')[0].name, 'grill');
  assert.deepEqual(names(filterCommands(commands, '/grill')), ['grill', 'mattpocock-skills:grilling']);
});

test('an alias matches and returns the command', () => {
  assert.deepEqual(names(filterCommands(commands, '/reset')), ['clear']);
});

test('the menu closes once there is whitespace (the user is typing arguments)', () => {
  assert.deepEqual(filterCommands(commands, '/model arg'), []);
  assert.deepEqual(filterCommands(commands, '/model '), []);
});

test('text that is not a command gives no menu, so Enter sends it normally', () => {
  assert.deepEqual(filterCommands(commands, 'hello'), []);
  assert.deepEqual(filterCommands(commands, ''), []);
  assert.deepEqual(filterCommands(commands, '/usr/bin/env'), []);
  assert.deepEqual(filterCommands(commands, 'a /clear'), []);
});

test('results are capped at 60', () => {
  const many = Array.from({ length: 200 }, (_, i) => cmd(`c${String(i).padStart(3, '0')}`));
  assert.equal(filterCommands(many, '/').length, 60);
});

test('completionFor gives the slash name and a trailing space', () => {
  assert.equal(completionFor(cmd('clear')), '/clear ');
  assert.equal(completionFor(cmd('ponytail:ponytail-help')), '/ponytail:ponytail-help ');
});

test('shortDescription uses the first line, drops the source marker and truncates', () => {
  assert.equal(shortDescription('Clear the screen (user)'), 'Clear the screen');
  assert.equal(shortDescription('first line\nsecond line'), 'first line');
  const long = 'x'.repeat(500);
  const out = shortDescription(long);
  assert.equal(out.length, 90);
  assert.ok(out.endsWith('…'));
  assert.equal(shortDescription('short'), 'short');
  assert.equal(shortDescription('long enough text here', 8), 'long en…');
});
