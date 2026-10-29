import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ansiToHex, parseThemes, writeThemes } from '../scripts/gen-themes.mjs';
import { listThemes, SLOTS } from '../lib/themes.js';

const SAMPLE = fileURLToPath(new URL('./fixtures/statusline-sample.ps1', import.meta.url));
const by = (list, key) => list.find((t) => t.key === key);

test('ansiToHex converts xterm-256 and SGR colours', () => {
  assert.equal(ansiToHex('256', 46), '#00ff00');
  assert.equal(ansiToHex('256', 208), '#ff8700');
  assert.equal(ansiToHex('256', 211), '#ff87af');
  assert.equal(ansiToHex('256', 243), '#767676');
  assert.equal(ansiToHex('sgr', 97), '#ffffff');
  assert.equal(ansiToHex('sgr', 31), '#800000');
});

test('parseThemes reads fields, groups and villain flag from the sample', () => {
  const t = parseThemes(readFileSync(SAMPLE, 'utf8'));
  assert.equal(t.length, 5);
  assert.deepEqual(by(t, 'deku'), { key: 'deku', label: 'Deku (Midoriya Izuku)', icon: '✊', accent: '#00ff00', secondary: '#00ffff', hero: 'Deku', villain: false, group: 'Class 1-A' });
  assert.equal(by(t, 'dabi').villain, true);
  assert.equal(by(t, 'dabi').group, 'Villains');
  assert.equal(by(t, 'aizawa').group, 'U.A. Faculty');
  assert.equal(by(t, 'shinzo').group, 'Class 1-A');
  assert.equal(by(t, 'monoma'), undefined, 'Class 1-B must not be generated');
  assert.equal(by(t, 'mirio').group, 'Big 3');
});

test('parseThemes unescapes doubled single quotes in names', () => {
  const src = "# ---- Rest of Class 1-A ---\n'x' = @{\n Label = 'X'\n QuirkIcon = 'q'\n Quirk = Ansi256 1\n Cooldown = Ansi 97\n Hero = 'Can''t Stop'\n}\n";
  assert.equal(parseThemes(src)[0].hero, "Can't Stop");
});

test('writeThemes writes one theme.json per key', async () => {
  const out = await mkdtemp(join(tmpdir(), 'lui-th-'));
  assert.equal(await writeThemes(SAMPLE, out), 5);
  await assert.rejects(readFile(join(out, 'monoma', 'theme.json')), { code: 'ENOENT' });
  const j = JSON.parse(await readFile(join(out, 'dabi', 'theme.json'), 'utf8'));
  assert.deepEqual(Object.keys(j).sort(), ['accent', 'group', 'hero', 'icon', 'key', 'label', 'secondary', 'villain']);
});

test('listThemes finds media by slot name and falls back to the global user avatar', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lui-th-'));
  await mkdir(join(dir, 'a'));
  await writeFile(join(dir, 'a', 'theme.json'), JSON.stringify({ key: 'a', label: 'A', icon: '🅰', accent: '#111111', secondary: '#222222', hero: 'A', villain: false, group: 'Class 1-A' }));
  for (const f of ['bg.mp4', 'claude.gif', 'hero.webp', 'notes.txt']) await writeFile(join(dir, 'a', f), 'x');
  await writeFile(join(dir, '_user.png'), 'x');
  const [t] = await listThemes(dir);
  assert.equal(t.media.bg, '/themes/a/bg.mp4');
  assert.equal(t.media.claude, '/themes/a/claude.gif');
  assert.equal(t.media.user, '/themes/_user.png');
  assert.equal(t.media.hero, '/themes/a/hero.webp');
  assert.equal(t.media.thinking, undefined);
  assert.deepEqual(SLOTS, ['bg', 'hero', 'claude', 'thinking', 'done', 'error', 'user']);
});

test('listThemes skips a theme with malformed json and orders by group then label', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lui-th-'));
  const mk = async (k, over) => { await mkdir(join(dir, k)); await writeFile(join(dir, k, 'theme.json'), JSON.stringify({ key: k, label: k, icon: 'i', accent: '#000000', secondary: '#000000', hero: k, villain: false, group: 'Class 1-A', ...over })); };
  await mk('z', { group: 'Villains', villain: true });
  await mk('b', {});
  await mk('a', {});
  await mk('monoma', { group: 'Class 1-B' });
  await mkdir(join(dir, 'bad'));
  await writeFile(join(dir, 'bad', 'theme.json'), '{nope');
  assert.deepEqual((await listThemes(dir)).map((t) => t.key), ['a', 'b', 'z']);
});

test('parseThemes accepts double-quoted Hero strings', () => {
  const src = '# ---- Rest of Class 1-A ---\n\'x\' = @{\n Label = \'X\'\n QuirkIcon = \'q\'\n Quirk = Ansi256 1\n Cooldown = Ansi 97\n Hero = "Can\'t Stop Twinkling"\n}\n';
  assert.equal(parseThemes(src)[0].hero, "Can't Stop Twinkling");
});
