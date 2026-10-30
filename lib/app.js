// The whole HTTP surface: token/Host/Origin gate, JSON API, one SSE stream, static files.
import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { timingSafeEqual } from 'node:crypto';
import { join, resolve, sep, extname } from 'node:path';
import { createChat } from './engine.js';
import { listProjects, listSessions, readHistory } from './sessions.js';
import { listThemes } from './themes.js';
import { listDirs, listDrives, defaultStart } from './dirs.js';
import { saveUpload, MAX_BYTES } from './uploads.js';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.mp4': 'video/mp4', '.webm': 'video/webm',
};
const STATIC_ROOTS = ['public', 'vendor', 'themes'];
const JSON_LIMIT = 1024 * 1024;
const SEND_LIMIT = 20 * 1024 * 1024;

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

const same = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const isDir = async (p) => (await stat(p).catch(() => null))?.isDirectory() ?? false;

// Read and discard the rest of a body so the client can finish sending and see our answer.
async function drain(it, limit, req) {
  let n = 0;
  for (let r = await it.next(); !r.done; r = await it.next()) if ((n += r.value.length) > limit) return req.destroy();
}

async function readJson(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw new HttpError(413, 'too_large');
    chunks.push(c);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { throw new HttpError(400, 'bad_json'); }
}

const TAB_ID = /^[A-Za-z0-9_-]{8,64}$/;

export function createApp({ token, root, command, home, graceMs = 10 * 60 * 1000 }) {
  // One entry per browser tab: its chat, the chat's command list and folder (replayed to a reloaded page), and its event streams.
  const tabs = new Map();
  const tabFor = (id) => {
    if (typeof id !== 'string' || !TAB_ID.test(id)) throw new HttpError(400, 'bad_tab');
    if (!tabs.has(id)) tabs.set(id, { chat: null, commands: null, cwd: null, clients: new Set(), timer: null });
    return tabs.get(id);
  };
  const broadcast = (tab, e) => { for (const res of tab.clients) res.write(`data: ${JSON.stringify(e)}\n\n`); };

  const allowedHosts = () => { const p = server.address()?.port; return [`127.0.0.1:${p}`, `localhost:${p}`]; };
  const authorised = (req) => {
    if (!allowedHosts().includes(req.headers.host)) return false;
    if (req.headers.origin && !allowedHosts().map((h) => `http://${h}`).includes(req.headers.origin)) return false;
    const cookie = /(?:^|;\s*)lui=([^;]+)/.exec(req.headers.cookie ?? '')?.[1];
    return !!cookie && same(cookie, token);
  };

  const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };

  async function serveStatic(req, res, url) {
    const [, top, ...rest] = url.pathname.split('/');
    let rel;
    try { rel = decodeURIComponent([top, ...rest].join('/')); } catch { return json(res, 404, { error: 'not_found' }); }
    const base = resolve(root, STATIC_ROOTS.includes(top) ? top : '.');
    const file = resolve(root, rel);
    if (!STATIC_ROOTS.includes(top) || rel.includes('\0') || !file.startsWith(base + sep)) return json(res, 404, { error: 'not_found' });
    const st = await stat(file).catch(() => null);
    if (!st?.isFile()) return json(res, 404, { error: 'not_found' });

    const headers = { 'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream', 'accept-ranges': 'bytes' };
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
    if (range && (range[1] || range[2])) {
      const start = range[1] ? Number(range[1]) : st.size - Number(range[2]);
      const end = range[1] && range[2] ? Math.min(Number(range[2]), st.size - 1) : st.size - 1;
      if (start > end || start >= st.size) { res.writeHead(416, { 'content-range': `bytes */${st.size}` }); return res.end(); }
      res.writeHead(206, { ...headers, 'content-range': `bytes ${start}-${end}/${st.size}`, 'content-length': end - start + 1 });
      return createReadStream(file, { start, end }).on('error', () => res.destroy()).pipe(res);
    }
    res.writeHead(200, { ...headers, 'content-length': st.size });
    createReadStream(file).on('error', () => res.destroy()).pipe(res);
  }

  async function route(req, res, url) {
    const p = url.pathname;
    const q = url.searchParams;
    if (req.method === 'GET') {
      if (p === '/') return serveStatic(req, res, new URL('/public/index.html', 'http://x'));
      if (p === '/api/themes') return json(res, 200, await listThemes(join(root, 'themes')));
      if (p === '/api/projects') return json(res, 200, await listProjects({ home }));
      if (p === '/api/sessions') return json(res, 200, await listSessions(q.get('cwd') ?? '', { home }));
      if (p === '/api/history') {
        try { return json(res, 200, await readHistory(q.get('cwd') ?? '', q.get('id') ?? '', { home })); } catch (e) { throw new HttpError(400, e.message); }
      }
      if (p === '/api/dirs') {
        const drives = await listDrives();
        try { return json(res, 200, { ...(await listDirs(q.get('path') || defaultStart(drives))), drives }); } catch (e) {
          const status = { bad_path: 400, denied: 403, timeout: 504 }[e.message];
          if (!status) throw e;
          throw new HttpError(status, e.message);
        }
      }
      if (p === '/api/events') {
        const tab = tabFor(q.get('tab'));
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
        res.write(':ok\n\n');
        if (tab.chat) res.write(`data: ${JSON.stringify({ kind: 'chat', cwd: tab.cwd })}\n\n`);
        if (tab.chat?.sessionId) res.write(`data: ${JSON.stringify({ kind: 'init', sessionId: tab.chat.sessionId })}\n\n`);
        if (tab.chat && tab.commands) res.write(`data: ${JSON.stringify({ kind: 'commands', commands: tab.commands })}\n\n`);
        const ka = setInterval(() => res.write(':ka\n\n'), 15000);
        tab.clients.add(res);
        res.on('close', () => { clearInterval(ka); tab.clients.delete(res); });
        return;
      }
      return serveStatic(req, res, url);
    }
    if (req.method !== 'POST') throw new HttpError(405, 'method');

    if (p === '/api/chat') {
      const { cwd, mode, resume, tab: id } = await readJson(req, JSON_LIMIT);
      const tab = tabFor(id);
      if (typeof cwd !== 'string' || !(await isDir(cwd))) throw new HttpError(400, 'bad_cwd');
      const old = tab.chat;
      let c;
      try {
        c = createChat({ cwd, mode, resume, command, onEvent: (e) => { if (tab.chat !== c) return; if (e.kind === 'commands') tab.commands = e.commands; broadcast(tab, e); if (e.kind === 'exit') { tab.chat = null; tab.commands = null; tab.cwd = null; } } }); // events of a replaced chat are stale
      } catch (e) { throw new HttpError(400, e.message); }
      tab.chat = c;
      tab.commands = null;
      tab.cwd = cwd;
      broadcast(tab, { kind: 'chat', cwd });
      old?.close();
      return json(res, 200, { ok: true });
    }
    if (p === '/api/send') {
      const { content, tab: id } = await readJson(req, SEND_LIMIT);
      const { chat } = tabFor(id);
      if (!chat) throw new HttpError(409, 'no_chat');
      if (!Array.isArray(content)) throw new HttpError(400, 'bad_content');
      try { chat.send(content); } catch { throw new HttpError(409, 'busy'); }
      return json(res, 200, { ok: true });
    }
    if (p === '/api/answer') {
      const { requestId, allow, always, tab: id } = await readJson(req, JSON_LIMIT);
      tabFor(id).chat?.answer(String(requestId), { allow: !!allow, always: !!always });
      return json(res, 200, { ok: true });
    }
    if (p === '/api/interrupt') { tabFor((await readJson(req, JSON_LIMIT)).tab).chat?.interrupt(); return json(res, 200, { ok: true }); }
    if (p === '/api/close') {
      // End the chat on purpose (the UI moved to another folder): no replayed session, no stale exit event.
      const tab = tabFor((await readJson(req, JSON_LIMIT)).tab);
      const old = tab.chat;
      tab.chat = null;
      tab.commands = null;
      tab.cwd = null;
      old?.close();
      return json(res, 200, { ok: true });
    }
    if (p === '/api/upload') {
      const cwd = q.get('cwd') ?? '';
      if (!(await isDir(cwd))) throw new HttpError(400, 'bad_cwd');
      // iterate without `return` so a throw does not destroy the socket before we can answer 413
      const it = req[Symbol.asyncIterator]();
      try {
        return json(res, 200, await saveUpload(cwd, q.get('name') ?? '', { [Symbol.asyncIterator]: () => ({ next: () => it.next() }) }));
      } catch (e) {
        if (e.message === 'too_large') { await drain(it, 4 * MAX_BYTES, req); throw new HttpError(413, 'too_large'); }
        throw e;
      }
    }
    throw new HttpError(404, 'not_found');
  }

  const server = http.createServer(async (req, res) => {
    try {
      if (!authorised(req)) {
        const url = new URL(req.url, 'http://x');
        const t = url.searchParams.get('t');
        const hostOk = allowedHosts().includes(req.headers.host);
        if (req.method === 'GET' && url.pathname === '/' && hostOk && t && same(t, token)) {
          res.writeHead(302, { location: '/', 'set-cookie': `lui=${token}; HttpOnly; SameSite=Strict; Path=/` });
          return res.end();
        }
        return json(res, 403, { error: 'forbidden' });
      }
      await route(req, res, new URL(req.url, 'http://x'));
    } catch (e) {
      req.resume(); // drain any unread body so the connection stays usable
      if (res.headersSent) return res.end();
      json(res, e.status ?? 500, { error: e.status ? e.message : 'server_error' });
    }
  });

  server.shutdown = () => new Promise((done) => {
    for (const tab of tabs.values()) { tab.chat?.close(); for (const res of tab.clients) res.end(); }
    server.close(done);
    server.closeAllConnections();
  });
  return server;
}
