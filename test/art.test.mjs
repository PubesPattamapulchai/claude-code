import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { listThemes } from '../lib/themes.js';
import { STYLES, styleFor } from '../public/art.js';

const themes = await listThemes(fileURLToPath(new URL('../themes', import.meta.url)));
const pairKey = (t) => [t.accent, t.secondary].sort().join('|');

test('there are exactly six styles and 108 real themes', () => {
  assert.equal(STYLES.length, 6);
  assert.equal(themes.length, 108);
});

test('every one of the 108 themes gets a style, and all six styles are used', () => {
  const map = styleFor(themes);
  assert.equal(map.size, 108);
  for (const t of themes) assert.ok(STYLES.includes(map.get(t.key).style), t.key);
  assert.equal(new Set([...map.values()].map((v) => v.style)).size, 6);
});

test('themes that share a colour pair never share a style', () => {
  const map = styleFor(themes);
  const groups = new Map();
  for (const t of themes) groups.set(pairKey(t), [...(groups.get(pairKey(t)) ?? []), t.key]);
  const shared = [...groups.values()].filter((g) => g.length > 1);
  assert.ok(shared.length >= 8, 'the real data has at least eight shared-colour groups');
  for (const g of shared) {
    const styles = g.map((k) => map.get(k).style);
    assert.equal(new Set(styles).size, g.length, `${g.join(', ')} -> ${styles.join(', ')}`);
  }
});

test('styleFor is stable and independent of input order', () => {
  const a = styleFor(themes);
  assert.deepEqual([...a], [...styleFor(themes)]);
  const reversed = styleFor([...themes].reverse());
  for (const t of themes) assert.deepEqual(reversed.get(t.key), a.get(t.key), t.key);
});

test('parameters stay in range', () => {
  for (const v of styleFor(themes).values()) {
    assert.ok(v.angle >= 0 && v.angle < 360, `angle ${v.angle}`);
    assert.ok(v.density >= 0.6 && v.density <= 1.4, `density ${v.density}`);
    assert.ok(v.phase >= 0 && v.phase < 1, `phase ${v.phase}`);
  }
});

test('a colour group larger than the style count is rejected loudly', () => {
  const same = Array.from({ length: 7 }, (_, i) => ({ key: 'x' + i, accent: '#111111', secondary: '#222222' }));
  assert.throws(() => styleFor(same), /colour group/);
});
