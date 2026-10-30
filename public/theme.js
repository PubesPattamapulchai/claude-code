// Applies a theme: colours, hero name, motto, background and avatar media. Pure helpers are exported for tests.
import { STYLES, styleFor } from './art.js';

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
// The character's real name is the trailing "(...)" of the label, e.g. "Deku (Midoriya Izuku)"; empty when there is none.
export const realName = (theme) => /\(([^()]+)\)\s*$/.exec(theme.label ?? '')?.[1].trim() ?? '';
export const mediaFor = (theme, slot) => ({ url: theme.media?.[slot], icon: theme.icon });
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

// The plain seeded shuffle of 0..n-1 for one lap.
function shuffled(n, start, lap) {
  const rand = mulberry32((Math.floor(start) ^ Math.imul(lap + 1, 0x9e3779b1)) >>> 0);
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  return order;
}

// Order for one lap. A lap that would open on the theme the previous lap closed on swaps its first two,
// so no theme shows twice in a row across the boundary.
function lapOrder(n, start, lap) {
  if (n <= 2) { // the swap can change the last entry too, so replay the chain (n this small never happens in practice)
    let last = -1;
    let order;
    for (let l = 0; l <= lap; l++) {
      order = shuffled(n, start, l);
      if (n > 1 && order[0] === last) [order[0], order[1]] = [order[1], order[0]];
      last = order[n - 1];
    }
    return order;
  }
  // For n > 2 the swap only touches positions 0 and 1, so the previous lap's last entry is just its plain shuffle's last:
  // constant cost however many laps have passed.
  const order = shuffled(n, start, lap);
  if (lap > 0 && order[0] === shuffled(n, start, lap - 1)[n - 1]) [order[0], order[1]] = [order[1], order[0]];
  return order;
}

export function themeAt(themes, start, now) {
  const n = themes.length;
  if (!n) return undefined;
  const slot = Math.max(0, Math.floor((now - start) / SLOT_MS));
  return themes[lapOrder(n, start, Math.floor(slot / n))[slot % n]];
}

// The stored rotation start, or `now` when it is missing, malformed or in the future.
export function resolveStart(raw, now) {
  const v = raw === null || raw === undefined || raw.trim() === '' ? NaN : Number(raw);
  return Number.isFinite(v) && v >= 0 && v <= now ? v : now;
}

// Whole seconds, rounded up, as m:ss.
export function formatLeft(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// What is showing, what comes next and how long until it does.
export function rotationInfo(themes, start, now) {
  if (!themes.length) return undefined;
  const slot = Math.max(0, Math.floor((now - start) / SLOT_MS));
  const boundary = start + (slot + 1) * SLOT_MS;
  return {
    current: themeAt(themes, start, start + slot * SLOT_MS),
    next: themeAt(themes, start, boundary),
    msLeft: boundary - Math.max(now, start),
  };
}

// ── browser side ──
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

const FADE_MS = 600; // keep in sync with the CSS transition/animation below

// Generated background for a theme without its own media: a CSS-drawn layer (see .art-* in style.css).
let artMap = null;
function artNode(t) {
  const p = artMap?.get(t.key);
  const el = document.createElement('div');
  el.className = `art art-${p?.style ?? STYLES[0]}`;
  if (p) {
    el.style.setProperty('--angle', `${p.angle.toFixed(1)}deg`);
    el.style.setProperty('--density', p.density.toFixed(3));
    el.style.setProperty('--phase', p.phase.toFixed(3));
  }
  if (t.media?.hero) {
    const hero = document.createElement('img');
    hero.className = 'hero'; hero.src = t.media.hero; hero.alt = '';
    el.append(hero);
    return el;
  }
  const mark = document.createElement('span');
  mark.className = 'mark';
  mark.setAttribute('aria-hidden', 'true');
  mark.textContent = t.icon;
  el.append(mark);
  return el;
}

export function applyTheme(t) {
  const first = !current;
  current = t;
  const r = root();
  if (first) r.style.transition = 'none'; // the very first colours snap in instead of fading from the defaults
  r.style.setProperty('--accent', t.accent);
  r.style.setProperty('--secondary', t.secondary);
  r.style.setProperty('--on-accent', onAccent(t.accent));
  if (first) { void r.offsetWidth; r.style.transition = ''; }
  r.dataset.villain = String(!!t.villain);
  document.getElementById('heroName').textContent = t.hero;
  const real = document.getElementById('realName');
  real.textContent = realName(t);
  real.hidden = !real.textContent;
  document.getElementById('motto').textContent = t.villain ? MOTTO.villain : MOTTO.hero;

  const bg = document.getElementById('bg');
  // The new background (the user's media, else generated art) fades in over the old one, which is then removed.
  const old = [...bg.children];
  const animate = !first && !reduced();
  const next = t.media?.bg ? mediaNode('bg') : artNode(t);
  if (animate) next.classList.add('fade-in');
  bg.append(next);
  if (animate && old.length) setTimeout(() => old.forEach((c) => c.remove()), FADE_MS);
  else old.forEach((c) => c.remove());

  const brand = document.getElementById('brandIcon');
  brand.replaceChildren(mediaNode('claude'));

  for (const row of document.querySelectorAll('.msg')) {
    row.querySelector('.avatar')?.replaceWith(row.classList.contains('thinking') ? thinkingAvatar() : avatar(row.classList.contains('user') ? 'user' : 'claude'));
  }
}

export async function loadThemes() {
  let themes;
  try { themes = await (await fetch('/api/themes')).json(); } catch { return; }
  if (!Array.isArray(themes) || !themes.length) return;

  const bar = document.getElementById('bar');
  if (bar && window.ResizeObserver) new ResizeObserver(() => root().style.setProperty('--bar-h', `${bar.offsetHeight}px`)).observe(bar);

  try { artMap = styleFor(themes); } catch { artMap = null; } // styling the backgrounds must never stop the app from loading

  const raw = store.get('rotateStart');
  const start = resolveStart(raw, Date.now());
  if (String(start) !== raw) store.set('rotateStart', String(start));

  const tick = () => {
    const info = rotationInfo(themes, start, Date.now());
    if (info.current.key !== current?.key) applyTheme(info.current);
    const countdown = document.getElementById('countdown');
    if (countdown) countdown.textContent = `next: ${info.next.hero} in ${formatLeft(info.msLeft)}`;
  };
  tick();
  setInterval(tick, 1000);
  // background timers are throttled in hidden tabs: catch up as soon as the tab is back
  document.addEventListener('visibilitychange', tick);
  window.addEventListener('focus', tick);
}
