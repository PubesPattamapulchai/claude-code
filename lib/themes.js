// Lists themes/<key>/theme.json and discovers media by filename convention.
import { readdir, readFile } from 'node:fs/promises';
import { join, parse } from 'node:path';

export const SLOTS = ['bg', 'claude', 'thinking', 'done', 'error', 'user'];
const EXTS = new Set(['.gif', '.png', '.jpg', '.jpeg', '.webp', '.mp4', '.webm']);
const GROUPS = ['Class 1-A', 'Class 1-B', 'Big 3', 'One For All', 'U.A. Faculty', 'Pro Heroes', 'Villains'];

const findSlot = (names, slot) => names.find((n) => { const p = parse(n); return p.name === slot && EXTS.has(p.ext.toLowerCase()); });

export async function listThemes(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const rootFiles = entries.filter((e) => e.isFile()).map((e) => e.name);
  const globalUser = findSlot(rootFiles.filter((n) => n.startsWith('_')).map((n) => n.slice(1)), 'user');
  const themes = [];
  for (const e of entries) {
    if (!e.isDirectory() || e.name.startsWith('_')) continue;
    let theme;
    try { theme = JSON.parse(await readFile(join(dir, e.name, 'theme.json'), 'utf8')); } catch { continue; }
    const files = (await readdir(join(dir, e.name))).filter((n) => n !== 'theme.json');
    const media = {};
    for (const slot of SLOTS) {
      const f = findSlot(files, slot);
      if (f) media[slot] = `/themes/${e.name}/${f}`;
    }
    if (!media.user && globalUser) media.user = `/themes/_${globalUser}`;
    themes.push({ ...theme, media });
  }
  const rank = (g) => { const i = GROUPS.indexOf(g); return i < 0 ? GROUPS.length : i; };
  return themes.sort((a, b) => rank(a.group) - rank(b.group) || a.label.localeCompare(b.label));
}
