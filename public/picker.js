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
    try { render(await listing(path)); } catch (e) { showError(ERRORS[e.message] ?? 'Could not open that folder.'); }
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

  try { render(await listing(start)); } catch { await go(''); } // the working folder may be gone: fall back to the default
  if (!dlg.open) dlg.showModal();
}
