import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { listThemes } from '../lib/themes.js';
import { STYLES, styleFor } from '../public/art.js';

const themes = await listThemes(fileURLToPath(new URL('../themes', import.meta.url)));
const pairKey = (t) => [t.accent, t.secondary].sort().join('|');

test('there are exactly six styles and 62 real themes without Class 1-B', () => {
  assert.equal(STYLES.length, 6);
  assert.equal(themes.length, 62);
  assert.ok(themes.every((t) => t.group !== 'Class 1-B'));
});

test('every one of the 62 themes gets a style, and all six styles are used', () => {
  const map = styleFor(themes);
  assert.equal(map.size, 62);
  for (const t of themes) assert.ok(STYLES.includes(map.get(t.key).style), t.key);
  assert.equal(new Set([...map.values()].map((v) => v.style)).size, 6);
});

test('themes that share a colour pair never share a style', () => {
  const map = styleFor(themes);
  const groups = new Map();
  for (const t of themes) groups.set(pairKey(t), [...(groups.get(pairKey(t)) ?? []), t.key]);
  const shared = [...groups.values()].filter((g) => g.length > 1);
  assert.ok(shared.length > 0, 'the real data contains shared-colour groups');
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

const channel = (hex, i) => parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16);
const dist = (a, b) => Math.hypot(...[0, 1, 2].map((i) => channel(a, i) - channel(b, i)));
const lookalike = (a, b) => (dist(a.accent, b.accent) <= 48 && dist(a.secondary, b.secondary) <= 48) || (dist(a.accent, b.secondary) <= 48 && dist(a.secondary, b.accent) <= 48);

test('themes whose colours are one shade apart never share a style either', () => {
  const map = styleFor(themes);
  const clashes = [];
  for (let i = 0; i < themes.length; i++) for (let j = i + 1; j < themes.length; j++) {
    if (lookalike(themes[i], themes[j]) && map.get(themes[i].key).style === map.get(themes[j].key).style) clashes.push(`${themes[i].key}/${themes[j].key}`);
  }
  assert.deepEqual(clashes, []);
  assert.notEqual(map.get('bakugo').style, map.get('sato').style);
});

test('a crowd of identical colours still gets a valid style for every theme, and warns', () => {
  const same = Array.from({ length: 7 }, (_, i) => ({ key: 'x' + i, accent: '#111111', secondary: '#222222' }));
  const warn = console.warn;
  let warned = 0;
  console.warn = () => { warned++; };
  try {
    const map = styleFor(same);
    assert.equal(map.size, 7);
    for (const v of map.values()) assert.ok(STYLES.includes(v.style));
    assert.ok(warned >= 1, 'running out of distinct styles must be reported');
  } finally { console.warn = warn; }
});

test('three-digit hex colours are understood: identical ones never share a style', () => {
  const six = Array.from({ length: 6 }, (_, i) => ({ key: `short${i}`, accent: '#fff', secondary: '#000' }));
  const map = styleFor(six);
  assert.equal(new Set([...map.values()].map((v) => v.style)).size, 6, 'six identical colour themes need six different styles');
  assert.ok(Number.isFinite(map.get('short0').angle));
});
