// Applies a theme: colours, hero name, motto, background and avatar media. Pure helpers are exported for tests.
const INK = '#0c0e1d';
const MOTTO = { hero: 'Go beyond, Plus Ultra! 💪', villain: 'Go beyond, Plus Chaos! 😈' };

const channel = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const luminance = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel(n >> 16) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
};

// Text colour for a surface painted in `hex`: ink or white, whichever contrasts more.
export function onAccent(hex) {
  const l = luminance(hex);
  const contrastInk = (l + 0.05) / (luminance(INK) + 0.05);
  const contrastWhite = 1.05 / (l + 0.05);
  return contrastInk >= contrastWhite ? INK : '#ffffff';
}
export const isVideo = (url) => /\.(mp4|webm)$/i.test(url ?? '');
export const mediaFor = (theme, slot) => ({ url: theme.media?.[slot], icon: theme.icon });
export function groupThemes(list) {
  const groups = new Map();
  for (const t of list) groups.set(t.group, [...(groups.get(t.group) ?? []), t]);
  return [...groups];
}

// ── rotation: wall-clock time -> theme, identical in every tab and across reloads ──
export const SLOT_MS = 60000;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Shuffled index order for one lap; each lap starts on a different theme than the previous lap ended on.
function lapOrder(n, start, lap) {
  let last = -1;
  let order;
  for (let l = 0; l <= lap; l++) {
    const rand = mulberry32((Math.floor(start) ^ Math.imul(l + 1, 0x9e3779b1)) >>> 0);
    order = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    if (n > 1 && order[0] === last) [order[0], order[1]] = [order[1], order[0]];
    last = order[n - 1];
  }
  return order;
}

export function themeAt(themes, start, now) {
  const n = themes.length;
  if (!n) return undefined;
  const slot = Math.max(0, Math.floor((now - start) / SLOT_MS));
  return themes[lapOrder(n, start, Math.floor(slot / n))[slot % n]];
}

// ── browser side ──
let themes = [];
let current = null;
const root = () => document.documentElement;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
};

// Video, image or emoji for one slot.
export function mediaNode(slot, { loopVideo = true } = {}) {
  const { url, icon } = mediaFor(current ?? { icon: '⚡' }, slot);
  if (!url) return document.createTextNode(icon);
  if (isVideo(url)) {
    const v = document.createElement('video');
    v.src = url; v.muted = true; v.loop = loopVideo; v.playsInline = true; v.autoplay = !reduced(); v.setAttribute('aria-hidden', 'true');
    return v;
  }
  const img = document.createElement('img');
  img.src = url; img.alt = '';
  return img;
}

export function avatar(role) {
  const a = document.createElement('div');
  a.className = 'avatar';
  a.append(mediaNode(role === 'user' ? 'user' : 'claude'));
  if (role === 'user' && !current?.media?.user) a.textContent = '🙂';
  return a;
}

export function thinkingAvatar() {
  const a = document.createElement('div');
  a.className = 'avatar';
  a.append(mediaNode('thinking'));
  return a;
}

let flashTimer;
export function flash(slot) {
  const f = document.getElementById('flash');
  const { url } = mediaFor(current ?? { icon: '' }, slot);
  const node = url ? mediaNode(slot) : Object.assign(document.createElement('div'), { className: 'emoji', textContent: slot === 'error' ? '💢' : current?.icon ?? '💥' });
  f.replaceChildren(node);
  f.classList.remove('show');
  void f.offsetWidth; // restart the animation
  f.classList.add('show');
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => f.classList.remove('show'), 2500);
}

export function applyTheme(t) {
  current = t;
  const r = root();
  r.style.setProperty('--accent', t.accent);
  r.style.setProperty('--secondary', t.secondary);
  r.style.setProperty('--on-accent', onAccent(t.accent));
  r.dataset.villain = String(!!t.villain);
  document.getElementById('heroName').textContent = t.hero;
  document.getElementById('motto').textContent = t.villain ? MOTTO.villain : MOTTO.hero;

  const bg = document.getElementById('bg');
  bg.replaceChildren();
  if (t.media?.bg) bg.append(mediaNode('bg'));

  const brand = document.getElementById('brandIcon');
  brand.replaceChildren(mediaNode('claude'));

  for (const row of document.querySelectorAll('.msg')) {
    row.querySelector('.avatar')?.replaceWith(row.classList.contains('thinking') ? thinkingAvatar() : avatar(row.classList.contains('user') ? 'user' : 'claude'));
  }
  store.set('theme', t.key);
}

export async function loadThemes() {
  themes = await (await fetch('/api/themes')).json();
  const select = document.getElementById('themeSelect');
  select.replaceChildren(...groupThemes(themes).map(([group, list]) => {
    const og = document.createElement('optgroup');
    og.label = group;
    og.append(...list.map((t) => Object.assign(document.createElement('option'), { value: t.key, textContent: `${t.hero} (${t.label})` })));
    return og;
  }));
  const wanted = themes.find((t) => t.key === store.get('theme')) ?? themes.find((t) => t.key === 'deku') ?? themes[0];
  if (!wanted) return;
  select.value = wanted.key;
  applyTheme(wanted);
  select.addEventListener('change', () => applyTheme(themes.find((t) => t.key === select.value)));
}
