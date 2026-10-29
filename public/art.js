// Which generated background each theme gets. Pure: no DOM, so Node tests can import it.
export const STYLES = ['speed-lines', 'halftone-burst', 'diagonal-stripes', 'comic-grid', 'sunburst', 'checker-pop'];

// FNV-1a, 32 bit.
function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
const unit = (str) => hash(str) / 4294967296; // [0, 1)

// Colours this close (RGB distance, about one xterm shade) look the same to a person.
const SIMILAR = 48;
const channel = (hex, i) => parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16);
const dist = (a, b) => Math.hypot(...[0, 1, 2].map((i) => channel(a, i) - channel(b, i)));
const near = (a, b) => dist(a, b) <= SIMILAR;
const alike = (a, b) => (near(a.accent, b.accent) && near(a.secondary, b.secondary)) || (near(a.accent, b.secondary) && near(a.secondary, b.accent));

// Colour the "looks alike" graph: themes are taken in key order and each gets a style no lookalike already has,
// starting the search at a style picked by its key so the choice varies. Exact same-colour themes are lookalikes
// too. If every style is taken by a lookalike (a crowd of seven or more), it takes the least used and warns.
export function styleFor(themes) {
  const sorted = [...themes].sort((a, b) => (a.key < b.key ? -1 : 1));
  const out = new Map();
  for (const t of sorted) {
    const used = new Map(); // style -> how many lookalikes already have it
    for (const o of sorted) {
      if (o !== t && out.has(o.key) && alike(t, o)) used.set(out.get(o.key).style, (used.get(out.get(o.key).style) ?? 0) + 1);
    }
    const start = hash(t.key) % STYLES.length;
    const order = STYLES.map((_, k) => STYLES[(start + k) % STYLES.length]);
    let style = order.find((s) => !used.has(s));
    if (!style) {
      style = order.reduce((best, s) => (used.get(s) < used.get(best) ? s : best), order[0]);
      console.warn(`art: no distinct background style left for theme "${t.key}"; it repeats one of its lookalikes`);
    }
    out.set(t.key, {
      style,
      angle: unit(`${t.key}:angle`) * 360,
      density: 0.6 + unit(`${t.key}:density`) * 0.8,
      phase: unit(`${t.key}:phase`),
    });
  }
  return out;
}
