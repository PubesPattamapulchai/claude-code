import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onAccent, isVideo, mediaFor, themeAt, SLOT_MS, resolveStart, formatLeft, rotationInfo } from '../public/theme.js';

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

test('resolveStart accepts a past timestamp and rejects everything else', () => {
  assert.equal(resolveStart('1234', 5000), 1234);
  assert.equal(resolveStart('1234.5', 5000), 1234.5);
  assert.equal(resolveStart('0', 5000), 0);
  for (const bad of [null, undefined, 'abc', '', ' ', '-10', '9000', 'NaN', 'Infinity']) {
    assert.equal(resolveStart(bad, 5000), 5000, String(bad));
  }
});

// The original lap-by-lap algorithm, kept as the specification the fast path must match.
function referenceKey(themes, start, now) {
  const n = themes.length;
  const slot = Math.max(0, Math.floor((now - start) / SLOT_MS));
  const lap = Math.floor(slot / n);
  const mulberry32 = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  let last = -1;
  let order;
  for (let l = 0; l <= lap; l++) {
    const rand = mulberry32((Math.floor(start) ^ Math.imul(l + 1, 0x9e3779b1)) >>> 0);
    order = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    if (n > 1 && order[0] === last) [order[0], order[1]] = [order[1], order[0]];
    last = order[n - 1];
  }
  return themes[order[slot % n]].key;
}

test('themeAt matches the lap-by-lap reference for many starts, laps and sizes', () => {
  for (const n of [3, 5, 88, 108]) {
    const ts = list(n);
    for (let s = 0; s < 40; s++) {
      const start = 1_793_000_000_000 + s * 12_345_679;
      for (const lap of [0, 1, 2, 3, 7, 50, 400]) {
        for (const off of [0, 1, n - 1]) {
          const now = start + (lap * n + off) * SLOT_MS + 5;
          assert.equal(themeAt(ts, start, now).key, referenceKey(ts, start, now), `n=${n} start=${start} lap=${lap} off=${off}`);
        }
      }
    }
  }
});

test('themeAt cost does not grow with the number of elapsed laps', () => {
  const ts = list(108);
  const start = 1_793_000_000_000;
  const now = start + 20_000 * 108 * SLOT_MS; // ~4 years of rotation
  const t0 = performance.now();
  for (let i = 0; i < 200; i++) themeAt(ts, start, now + i * SLOT_MS);
  assert.ok(performance.now() - t0 < 400, `200 calls took ${Math.round(performance.now() - t0)} ms`);
});

test('formatLeft rounds up to whole seconds as m:ss', () => {
  assert.equal(formatLeft(42_000), '0:42');
  assert.equal(formatLeft(59_999), '1:00');
  assert.equal(formatLeft(60_000), '1:00');
  assert.equal(formatLeft(1_000), '0:01');
  assert.equal(formatLeft(1), '0:01');
  assert.equal(formatLeft(0), '0:00');
  assert.equal(formatLeft(-500), '0:00');
});

test('rotationInfo returns the current theme, the next one and the time left', () => {
  const ts = list(108);
  const a = rotationInfo(ts, 0, 30_000);
  assert.equal(a.current.key, themeAt(ts, 0, 30_000).key);
  assert.equal(a.next.key, themeAt(ts, 0, 60_000).key);
  assert.equal(a.msLeft, 30_000);
  assert.equal(rotationInfo(ts, 0, 0).msLeft, 60_000);
  assert.equal(rotationInfo(ts, 0, 59_999).msLeft, 1);
  const early = rotationInfo(ts, 10_000, 0); // clock before start behaves like slot 0
  assert.equal(early.current.key, themeAt(ts, 10_000, 10_000).key);
  assert.equal(early.msLeft, 60_000);
  assert.equal(rotationInfo([], 0, 0), undefined);
});
