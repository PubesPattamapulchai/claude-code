import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onAccent, isVideo, mediaFor, groupThemes } from '../public/theme.js';

test('onAccent picks the text colour with the higher contrast', () => {
  assert.equal(onAccent('#ffd23f'), '#0c0e1d'); // gold: dark ink
  assert.equal(onAccent('#ffffff'), '#0c0e1d');
  assert.equal(onAccent('#0000ff'), '#ffffff'); // blue: white
  assert.equal(onAccent('#000000'), '#ffffff');
});

test('isVideo recognises mp4 and webm only', () => {
  assert.equal(isVideo('/themes/a/bg.mp4'), true);
  assert.equal(isVideo('/themes/a/bg.WEBM'), true);
  assert.equal(isVideo('/themes/a/bg.gif'), false);
  assert.equal(isVideo(undefined), false);
});

test('mediaFor returns the slot url and always the emoji fallback', () => {
  const t = { icon: '🧠', media: { bg: '/themes/a/bg.mp4' } };
  assert.deepEqual(mediaFor(t, 'bg'), { url: '/themes/a/bg.mp4', icon: '🧠' });
  assert.deepEqual(mediaFor(t, 'claude'), { url: undefined, icon: '🧠' });
  assert.deepEqual(mediaFor({ icon: 'x' }, 'bg'), { url: undefined, icon: 'x' });
});

test('groupThemes keeps first-seen group order and theme order inside groups', () => {
  const list = [{ key: 'a', group: 'G1' }, { key: 'b', group: 'G2' }, { key: 'c', group: 'G1' }];
  assert.deepEqual(groupThemes(list).map(([g, ts]) => [g, ts.map((t) => t.key)]), [['G1', ['a', 'c']], ['G2', ['b']]]);
});
