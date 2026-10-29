// Reads Claude Code's own session store: ~/.claude/projects/<encoded cwd>/<session>.jsonl
import { readdir, readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const encodeCwd = (cwd) => cwd.replace(/[^A-Za-z0-9]/g, '-');
const projectsDir = (home = homedir()) => join(home, '.claude', 'projects');

async function lines(file) {
  const out = [];
  for (const l of (await readFile(file, 'utf8')).split('\n')) {
    try { out.push(JSON.parse(l)); } catch { /* skip blank/bad lines */ }
  }
  return out;
}
const userText = (m) => {
  const c = m.message?.content;
  if (typeof c === 'string') return c;
  return Array.isArray(c) ? c.filter((b) => b.type === 'text').map((b) => b.text).join('\n') : '';
};
// "<command-name>/clear</command-name> … <command-args>x</command-args>" -> "/clear x" (how the user typed it).
function plainCommand(text) {
  const name = /<command-name>([\s\S]*?)<\/command-name>/.exec(text)?.[1]?.trim();
  if (!name) return text;
  const args = /<command-args>([\s\S]*?)<\/command-args>/.exec(text)?.[1]?.trim();
  return args ? `${name} ${args}` : name;
}
const isReal = (m) => m.type === 'user' && !m.isMeta && !m.isSidechain;

async function jsonlFiles(dir) {
  let names;
  try { names = await readdir(dir); } catch { return []; }
  const files = [];
  for (const n of names.filter((x) => x.endsWith('.jsonl'))) {
    files.push({ id: n.slice(0, -6), file: join(dir, n), mtime: (await stat(join(dir, n))).mtimeMs });
  }
  return files.sort((a, b) => b.mtime - a.mtime);
}

export async function listProjects({ home } = {}) {
  const root = projectsDir(home);
  let dirs;
  try { dirs = await readdir(root); } catch { return []; }
  const out = [];
  for (const d of dirs) {
    const newest = (await jsonlFiles(join(root, d)))[0];
    const cwd = newest && (await lines(newest.file)).find((m) => m.cwd)?.cwd;
    if (cwd) out.push({ cwd, lastActive: newest.mtime });
  }
  return out.sort((a, b) => b.lastActive - a.lastActive);
}

export async function listSessions(cwd, { home } = {}) {
  const files = await jsonlFiles(join(projectsDir(home), encodeCwd(cwd)));
  return Promise.all(files.map(async ({ id, file, mtime }) => {
    const first = (await lines(file)).find((m) => isReal(m) && userText(m).trim());
    return { id, title: first ? userText(first).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) : '(empty)', mtime };
  }));
}

export async function readHistory(cwd, id, { home } = {}) {
  if (!UUID.test(id)) throw new Error('invalid session id');
  const events = [];
  for (const m of await lines(join(projectsDir(home), encodeCwd(cwd), `${id}.jsonl`))) {
    if (m.isSidechain || m.isMeta) continue;
    if (m.type === 'assistant') events.push({ kind: 'assistant', content: m.message.content });
    else if (m.type === 'user') {
      const c = m.message?.content;
      const results = Array.isArray(c) ? c.filter((b) => b.type === 'tool_result') : [];
      for (const b of results) events.push({ kind: 'tool_result', toolUseId: b.tool_use_id, content: b.content, isError: !!b.is_error });
      const text = userText(m);
      if (!results.length && text.trim()) events.push({ kind: 'user_text', text: plainCommand(text) });
    }
  }
  return events;
}
