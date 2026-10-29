// Which generated background each theme gets. Pure: no DOM, so Node tests can import it.
export const STYLES = ['speed-lines', 'halftone-burst', 'diagonal-stripes', 'comic-grid', 'sunburst', 'checker-pop'];

// FNV-1a, 32 bit.
function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
const unit = (str) => hash(str) / 4294967296; // [0, 1)

// Themes that share an (unordered) colour pair get different styles, so neighbours never look the same.
export function styleFor(themes) {
  const sorted = [...themes].sort((a, b) => (a.key < b.key ? -1 : 1));
  const groups = new Map();
  for (const t of sorted) {
    const id = [t.accent, t.secondary].sort().join('|');
    groups.set(id, [...(groups.get(id) ?? []), t]);
  }

  const out = new Map();
  for (const group of groups.values()) {
    if (group.length > STYLES.length) throw new Error(`colour group of ${group.length} themes exceeds the ${STYLES.length} styles`);
    const base = hash(group[0].key);
    group.forEach((t, i) => {
      out.set(t.key, {
        style: STYLES[(base + i) % STYLES.length],
        angle: unit(`${t.key}:angle`) * 360,
        density: 0.6 + unit(`${t.key}:density`) * 0.8,
        phase: unit(`${t.key}:phase`),
      });
    });
  }
  return out;
}
