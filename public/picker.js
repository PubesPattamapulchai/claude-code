// Folder picker dialog. crumbsOf and basename are pure (no DOM at import time) so Node tests can load them.

// "D:\POE\app" -> D:\ > POE > app, each with the full path to jump to. POSIX paths start at "/".
export function crumbsOf(path) {
  if (!path) return [];
  const parts = path.split(/[\\/]+/).filter(Boolean);
  const crumbs = [];
  if (/^[A-Za-z]:/.test(path)) {
    let cur = '';
    parts.forEach((p, i) => {
      cur = i === 0 ? `${p}\\` : `${cur}${cur.endsWith('\\') ? '' : '\\'}${p}`;
      crumbs.push({ label: i === 0 ? cur : p, path: cur });
    });
    return crumbs;
  }
  crumbs.push({ label: '/', path: '/' });
  let cur = '';
  for (const p of parts) { cur += `/${p}`; crumbs.push({ label: p, path: cur }); }
  return crumbs;
}

export function basename(path) {
  const crumbs = crumbsOf(path);
  return crumbs.length ? crumbs[crumbs.length - 1].label : '';
}

const winLike = (path) => /^[A-Za-z]:/.test(path) || path.includes('\\');
function canon(path) {
  if (winLike(path)) {
    const s = path.replace(/\//g, '\\').toLowerCase();
    return /^[a-z]:\\$/.test(s) ? s : s.replace(/\\+$/, ''); // keep the backslash of a drive root
  }
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

// Same folder? Windows paths ignore case, slash direction and trailing separators; POSIX paths are exact.
export const samePath = (a, b) => !!a && !!b && canon(a) === canon(b);

// Wraps an async function so only the newest call counts: older ones resolve { stale: true } (their errors are dropped).
export function latestOnly(fn) {
  let latest = 0;
  return async (...args) => {
    const id = ++latest;
    try {
      const value = await fn(...args);
      return id === latest ? { stale: false, value } : { stale: true };
    } catch (e) {
      if (id === latest) throw e;
      return { stale: true };
    }
  };
}

const ERRORS = {
  bad_path: 'That folder is not available.',
  denied: 'Windows would not let the app open that folder.',
  timeout: 'That folder took too long to open.',
};

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

async function listing(path) {
  const res = await fetch(path ? `/api/dirs?path=${encodeURIComponent(path)}` : '/api/dirs');
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'failed');
  return data;
}

// Shows the dialog. `start` may be '' (the server picks D:\ or the first drive).
export async function openPicker({ start, recents, onSelect }) {
  const dlg = $('picker');
  const fetchDir = latestOnly(listing); // a slow answer must never overwrite a newer one
  let here = '';
  const sepOf = (p) => (p.includes('/') && !p.includes('\\') ? '/' : '\\');
  const join = (dir, name) => `${dir}${dir.endsWith(sepOf(dir)) ? '' : sepOf(dir)}${name}`;

  function showError(message) { $('pickerError').textContent = message; $('pickerError').hidden = !message; }

  function render(data) {
    here = data.path;
    $('pickerPath').textContent = data.path;
    showError('');

    $('crumbs').replaceChildren(...crumbsOf(data.path).map((c, i, all) => {
      const b = el('button', 'crumb', c.label);
      b.type = 'button';
      if (i === all.length - 1) b.setAttribute('aria-current', 'location');
      b.onclick = () => go(c.path);
      return b;
    }));

    const root = crumbsOf(data.path)[0]?.path.toLowerCase();
    $('drives').replaceChildren(...data.drives.map((d) => { const o = el('option', null, d); o.value = d; o.selected = d.toLowerCase() === root; return o; }));

    const list = $('dirList');
    list.replaceChildren();
    const row = (label, target, cls) => {
      const li = el('li');
      const b = el('button', `dir ${cls ?? ''}`.trim(), label);
      b.type = 'button';
      b.onclick = () => go(target);
      li.append(b);
      list.append(li);
    };
    if (data.parent) row('..', data.parent, 'up');
    for (const name of data.dirs) row(name, join(data.path, name));
    if (!data.dirs.length) list.append(el('li', 'empty', 'No sub-folders here.'));
  }

  async function go(path) {
    try {
      const r = await fetchDir(path);
      if (!r.stale) render(r.value);
    } catch (e) { showError(ERRORS[e.message] ?? 'Could not open that folder.'); }
  }

  const recentBox = $('recentBox');
  const recentList = $('recentList');
  recentList.replaceChildren(...recents.slice(0, 6).map((r) => {
    const b = el('button', 'recent', r.cwd);
    b.type = 'button';
    b.title = r.cwd;
    b.onclick = () => go(r.cwd);
    return b;
  }));
  recentBox.hidden = !recents.length;

  $('drives').onchange = () => go($('drives').value);
  $('pickerCancel').onclick = () => dlg.close();
  $('pickerSelect').onclick = () => { const chosen = here; dlg.close(); if (chosen) onSelect(chosen); };

  // Open at once with a loading line; the listing can take a moment (a slow drive).
  if (!dlg.open) dlg.showModal();
  $('dirList').replaceChildren(el('li', 'empty', 'Loading…'));
  const first = await fetchDir(start).catch(() => null);
  if (first === null) await go(''); // the working folder may be gone: fall back to the default
  else if (!first.stale) render(first.value);
}
