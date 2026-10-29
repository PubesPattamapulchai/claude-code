import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onAccent, isVideo, mediaFor, groupThemes, themeAt, SLOT_MS } from '../public/theme.js';

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

const list = (n) => Array.from({ length: n }, (_, i) => ({ key: 'k' + i }));
const keyAt = (ts, start, slot) => themeAt(ts, start, start + slot * SLOT_MS).key;
const keys = (ts, start, from, to) => Array.from({ length: to - from }, (_, i) => keyAt(ts, start, from + i));

test('themeAt covers every theme exactly once per lap', () => {
  const ts = list(108);
  assert.equal(new Set(keys(ts, 1_000, 0, 108)).size, 108);
  assert.equal(new Set(keys(ts, 1_000, 108, 216)).size, 108);
});

test('themeAt is stable inside a slot and changes at the boundary', () => {
  const ts = list(108);
  assert.equal(themeAt(ts, 5_000, 5_000).key, themeAt(ts, 5_000, 5_000 + 59_999).key);
  assert.notEqual(themeAt(ts, 5_000, 5_000).key, themeAt(ts, 5_000, 5_000 + 60_000).key);
});

test('themeAt is deterministic and depends on start', () => {
  const ts = list(108);
  assert.deepEqual(keys(ts, 1_000, 0, 108), keys(ts, 1_000, 0, 108));
  assert.notDeepEqual(keys(ts, 1_000, 0, 108), keys(ts, 2_000, 0, 108));
});

test('themeAt never repeats a theme across lap boundaries', () => {
  const ts = list(108);
  for (let s = 1; s <= 50; s++) {
    assert.notEqual(keyAt(ts, s * 7_919, 107), keyAt(ts, s * 7_919, 108), `lap 0->1 start ${s}`);
    assert.notEqual(keyAt(ts, s * 7_919, 215), keyAt(ts, s * 7_919, 216), `lap 1->2 start ${s}`);
  }
  const two = list(2);
  for (let s = 1; s <= 50; s++) {
    assert.notEqual(keyAt(two, s * 31, 1), keyAt(two, s * 31, 2));
    assert.notEqual(keyAt(two, s * 31, 3), keyAt(two, s * 31, 4));
  }
});

test('themeAt clamps time before start to slot 0', () => {
  const ts = list(108);
  assert.equal(themeAt(ts, 10_000, 0).key, keyAt(ts, 10_000, 0));
});

test('themeAt handles one theme and no themes', () => {
  assert.equal(themeAt(list(1), 0, 9e9).key, 'k0');
  assert.equal(themeAt([], 0, 0), undefined);
});
