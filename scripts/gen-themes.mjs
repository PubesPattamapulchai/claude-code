// One-shot: turn mha-statusline's statusline.ps1 theme catalogue into themes/<key>/theme.json.
// Usage: node scripts/gen-themes.mjs <statusline.ps1> themes
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const BASE16 = ['#000000', '#800000', '#008000', '#808000', '#000080', '#800080', '#008080', '#c0c0c0',
  '#808080', '#ff0000', '#00ff00', '#ffff00', '#0000ff', '#ff00ff', '#00ffff', '#ffffff'];
const LEVELS = [0, 95, 135, 175, 215, 255];
const hex2 = (n) => n.toString(16).padStart(2, '0');

export function ansiToHex(kind, n) {
  if (kind === 'sgr') {
    if (n >= 30 && n <= 37) return BASE16[n - 30];
    if (n >= 90 && n <= 97) return BASE16[n - 90 + 8];
    throw new Error(`unsupported SGR colour ${n}`);
  }
  if (n < 16) return BASE16[n];
  if (n >= 232) { const g = 8 + 10 * (n - 232); return `#${hex2(g)}${hex2(g)}${hex2(g)}`; }
  const i = n - 16;
  return '#' + [Math.floor(i / 36), Math.floor((i % 36) / 6), i % 6].map((c) => hex2(LEVELS[c])).join('');
}

// Section header comment -> group; headers that match nothing keep the previous group.
const GROUP_RULES = [
  [/Rest of Class 1-A/i, 'Class 1-A'], [/Class 1-B/i, 'Class 1-B'], [/Big 3/i, 'Big 3'],
  [/One For All/i, 'One For All'], [/faculty|sidekick|mentor|Pussycats/i, 'U.A. Faculty'], [/Pro heroes/i, 'Pro Heroes'],
];
const OVERRIDES = { allmight: 'U.A. Faculty', aizawa: 'U.A. Faculty', shinzo: 'Class 1-A' };
const str = (s) => s.replace(/''/g, "'");

export function parseThemes(src) {
  const themes = [];
  let group = 'Class 1-A';
  let cur = null;
  for (const line of src.split(/\r?\n/)) {
    const header = line.match(/^\s*# ----\s*(.*?)\s*-*\s*$/);
    if (header) { for (const [re, g] of GROUP_RULES) if (re.test(header[1])) group = g; continue; }
    const start = line.match(/^\s*'([a-z0-9]+)'\s*=\s*@\{/);
    if (start) { cur = { key: start[1], villain: false, group: OVERRIDES[start[1]] ?? group }; continue; }
    if (!cur) continue;
    if (/^\s*\}\s*$/.test(line)) { if (cur.villain) cur.group = 'Villains'; themes.push(finish(cur)); cur = null; continue; }
    let m;
    if ((m = line.match(/^\s*Label\s*=\s*'((?:[^']|'')*)'/))) cur.label = str(m[1]);
    else if ((m = line.match(/^\s*QuirkIcon\s*=\s*'((?:[^']|'')*)'/))) cur.icon = str(m[1]);
    else if ((m = line.match(/^\s*Hero\s*=\s*(?:'((?:[^']|'')*)'|"([^"]*)")/))) cur.hero = m[2] ?? str(m[1]);
    else if ((m = line.match(/^\s*(Quirk|Cooldown)\s*=\s*(Ansi256|Ansi)\s+(\d+)/))) {
      cur[m[1] === 'Quirk' ? 'accent' : 'secondary'] = ansiToHex(m[2] === 'Ansi256' ? '256' : 'sgr', Number(m[3]));
    } else if (/^\s*Villain\s*=\s*\$true/.test(line)) cur.villain = true;
  }
  return themes;
}

function finish(t) {
  const { key, label, icon, accent, secondary, hero, villain, group } = t;
  return { key, label, icon, accent, secondary, hero, villain, group };
}

export async function writeThemes(srcPath, outDir) {
  const themes = parseThemes(await readFile(srcPath, 'utf8'));
  for (const t of themes) {
    await mkdir(join(outDir, t.key), { recursive: true });
    await writeFile(join(outDir, t.key, 'theme.json'), JSON.stringify(t, null, 2) + '\n');
  }
  return themes.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [src, out] = process.argv.slice(2);
  console.log(`wrote ${await writeThemes(src, out)} themes`);
}
