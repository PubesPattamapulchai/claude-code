import { renderMarkdown } from '/public/md.js';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

const state = {
  alive: false, // a chat process exists on the server for the current settings
  busy: false,
  sessionId: null,
  mode: 'manual',
  live: null, // { bubble, text } while an assistant reply is streaming
  tools: new Map(), // tool_use id -> { card, result }
  permQueue: [],
};

// ── api ──
async function api(path, body) {
  const res = await fetch(path, body === undefined ? undefined : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error ?? res.statusText), { status: res.status });
  return data;
}

// ── small ui helpers ──
function banner(text) { const b = $('banner'); b.textContent = text ?? ''; b.hidden = !text; }
function setBusy(on) {
  state.busy = on;
  $('stage').classList.toggle('busy', on);
  $('send').disabled = on;
  $('stop').hidden = !on;
  $('mode').disabled = on;
}
function scrollDown() { const m = $('messages'); m.scrollTop = m.scrollHeight; }

// Overridden once themes load (theme.js): who is speaking, as an avatar element.
export const avatars = { make: (role) => el('div', 'avatar', role === 'user' ? '🙂' : '⚡') };

function addMessage(role) {
  const row = el('div', `msg ${role}`);
  const bubble = el('div', 'bubble');
  row.append(avatars.make(role), bubble);
  $('messages').append(row);
  return bubble;
}
function addNote(text) { $('messages').append(el('div', 'note', text)); scrollDown(); }

function gist(input) {
  const v = input?.command ?? input?.file_path ?? input?.pattern ?? input?.path ?? input?.url ?? input?.description ?? '';
  return String(v).split('\n')[0].slice(0, 120);
}
function addToolCard(block) {
  const card = el('div', 'tool');
  const d = el('details');
  const s = el('summary');
  s.append(el('span', 'name', block.name), el('span', 'gist', gist(block.input)));
  const input = el('pre', null, JSON.stringify(block.input, null, 2));
  const result = el('pre', null, 'Waiting for result…');
  d.append(s, input, result);
  card.append(d);
  $('messages').append(card);
  state.tools.set(block.id, { card, result });
}

// ── event handling ──
function finishLive(html) {
  if (!state.live) return false;
  state.live.bubble.innerHTML = html;
  state.live = null;
  return true;
}
function assistantBlocks(blocks) {
  for (const b of blocks) {
    if (b.type === 'text' && b.text.trim()) {
      const html = renderMarkdown(b.text);
      if (!finishLive(html)) addMessage('assistant').innerHTML = html;
    } else if (b.type === 'tool_use') {
      if (state.live) state.live = null;
      addToolCard(b);
    }
  }
  scrollDown();
}
function toolResult(e) {
  const t = state.tools.get(e.toolUseId);
  if (!t) return;
  const text = typeof e.content === 'string' ? e.content : (e.content ?? []).map((c) => c.text ?? '').join('\n');
  t.result.textContent = text.length > 6000 ? `${text.slice(0, 6000)}\n… (${text.length - 6000} more characters)` : text || '(no output)';
  t.card.classList.toggle('error', !!e.isError);
}

function handle(e) {
  switch (e.kind) {
    case 'init': state.sessionId = e.sessionId; break;
    case 'text_delta':
      if (!state.live) state.live = { bubble: addMessage('assistant'), text: '' };
      state.live.text += e.text;
      state.live.bubble.textContent = state.live.text;
      scrollDown();
      break;
    case 'assistant': assistantBlocks(e.content); break;
    case 'tool_result': toolResult(e); break;
    case 'permission': state.permQueue.push(e); if (!$('perm').open) nextPermission(); break;
    case 'result':
      state.live = null;
      setBusy(false);
      if (e.isError && !state.loginHint) banner(e.text || 'Claude reported an error.');
      refreshSessions();
      break;
    case 'login_required':
      state.loginHint = true;
      banner('Claude is not logged in. Run `claude` in a terminal, log in, then try again.');
      break;
    case 'error': setBusy(false); banner(e.message); break;
    case 'exit': state.alive = false; setBusy(false); state.live = null; break;
  }
}

function connectEvents() {
  const es = new EventSource('/api/events');
  es.onmessage = (m) => handle(JSON.parse(m.data));
}

// ── permissions ──
function nextPermission() {
  const p = state.permQueue.shift();
  if (!p) return;
  $('permTool').textContent = p.tool;
  $('permDesc').textContent = p.description ?? '';
  $('permDesc').hidden = !p.description;
  const text = JSON.stringify(p.input, null, 2);
  $('permInput').textContent = text.length > 4000 ? `${text.slice(0, 4000)}\n…` : text;
  $('perm').returnValue = '';
  $('perm').dataset.id = p.requestId;
  $('perm').showModal();
}
$('perm').addEventListener('close', async () => {
  const v = $('perm').returnValue;
  await api('/api/answer', { requestId: $('perm').dataset.id, allow: v === 'allow' || v === 'always', always: v === 'always' }).catch((e) => banner(e.message));
  nextPermission();
});

// ── chat lifecycle ──
function clearConversation() {
  $('messages').textContent = '';
  state.tools.clear();
  state.live = null;
  state.sessionId = null;
  state.loginHint = false;
  banner('');
}

function renderHistory(events) {
  for (const e of events) {
    if (e.kind === 'user_text') addMessage('user').textContent = e.text;
    else if (e.kind === 'assistant') assistantBlocks(e.content);
    else if (e.kind === 'tool_result') toolResult(e);
  }
  state.live = null;
  scrollDown();
}

async function startChat(resume) {
  const cwd = $('cwd').value.trim();
  if (!cwd) { banner('Enter a working folder first.'); $('cwd').focus(); throw new Error('no cwd'); }
  banner('');
  try { await api('/api/chat', { cwd, mode: state.mode, resume }); } catch (e) {
    banner(e.message === 'bad_cwd' ? `Folder not found: ${cwd}` : `Cannot start chat: ${e.message}`);
    throw e;
  }
  state.alive = true;
  localStorageSet('cwd', cwd);
}

async function newChat() {
  clearConversation();
  try { await startChat(); } catch { return; }
  refreshSessions();
  $('input').focus();
}

async function openSession(id) {
  const cwd = $('cwd').value.trim();
  clearConversation();
  state.sessionId = id;
  try {
    renderHistory(await api(`/api/history?cwd=${encodeURIComponent(cwd)}&id=${id}`));
    await startChat(id);
  } catch { return; }
  refreshSessions();
  closeDrawer();
}

// ── sessions list ──
const ago = (ms) => {
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
};
async function refreshSessions() {
  const cwd = $('cwd').value.trim();
  const nav = $('sessions');
  nav.textContent = '';
  if (!cwd) return;
  const list = await api(`/api/sessions?cwd=${encodeURIComponent(cwd)}`).catch(() => []);
  if (!list.length) { nav.append(el('div', 'empty', 'No sessions in this folder yet.')); return; }
  for (const s of list) {
    const b = el('button');
    b.type = 'button';
    b.append(el('span', 'title', s.title), el('span', 'when', ago(s.mtime)));
    if (s.id === state.sessionId) b.setAttribute('aria-current', 'true');
    b.onclick = () => openSession(s.id);
    nav.append(b);
  }
}
async function loadRecents() {
  const list = await api('/api/projects').catch(() => []);
  $('recents').replaceChildren(...list.map((p) => { const o = el('option'); o.value = p.cwd; return o; }));
  if (!$('cwd').value) $('cwd').value = localStorageGet('cwd') || list[0]?.cwd || '';
}

// ── sending ──
export async function sendMessage(content, echo) {
  if (state.busy) return;
  banner('');
  if (!state.alive) {
    try { await startChat(state.sessionId ?? undefined); } catch { return; }
  }
  echo();
  setBusy(true);
  try { await api('/api/send', { content }); } catch (e) {
    if (e.message === 'no_chat') { state.alive = false; setBusy(false); banner('The chat process ended. Press Send again to resume.'); return; }
    setBusy(false);
    banner(`Send failed: ${e.message}`);
  }
}

function submitText(text) {
  const t = text.trim();
  if (!t) return;
  $('input').value = '';
  autosize();
  sendMessage([{ type: 'text', text: t }], () => { addMessage('user').textContent = t; scrollDown(); });
}

function autosize() { const i = $('input'); i.style.height = 'auto'; i.style.height = `${Math.min(i.scrollHeight, window.innerHeight * 0.4)}px`; }

// ── storage that may be unavailable ──
function localStorageGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function localStorageSet(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } }

// ── drawer (phones) ──
function closeDrawer() { $('side').classList.remove('open'); }

// ── wiring ──
$('cwdForm').addEventListener('submit', (e) => { e.preventDefault(); newChat(); });
$('cwd').addEventListener('change', refreshSessions);
$('composer').addEventListener('submit', (e) => { e.preventDefault(); submitText($('input').value); });
$('input').addEventListener('input', autosize);
$('input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('composer').requestSubmit(); }
});
$('stop').addEventListener('click', async () => { await api('/api/interrupt', {}).catch(() => {}); addNote('Stopped.'); });
$('menu').addEventListener('click', () => $('side').classList.toggle('open'));
$('mode').addEventListener('change', () => {
  const next = $('mode').value;
  if (next === 'bypassPermissions') {
    $('danger').returnValue = '';
    $('danger').showModal();
    $('danger').addEventListener('close', () => {
      if ($('danger').returnValue === 'ok') applyMode(next); else $('mode').value = state.mode;
    }, { once: true });
  } else applyMode(next);
});
function applyMode(mode) { state.mode = mode; state.alive = false; } // next send respawns the child with --resume

connectEvents();
await loadRecents();
await refreshSessions();
