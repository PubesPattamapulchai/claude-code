// One `claude -p` stream-json child per chat; normalises its stdout into ChatEvents.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

export const MODES = ['manual', 'acceptEdits', 'plan', 'bypassPermissions'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOGIN_HINT = /log ?in|not authenticated|api key/i;

export function createChat({ cwd, mode, resume, command = ['claude'], onEvent }) {
  if (!MODES.includes(mode)) throw new Error('invalid mode');
  if (resume !== undefined && !UUID.test(resume)) throw new Error('invalid resume id');

  const flags = ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose',
    '--include-partial-messages', '--permission-mode', mode, '--permission-prompt-tool', 'stdio'];
  if (resume) flags.push('--resume', resume);
  const argv = [...command.slice(1), ...flags];

  // shell only for the bare `claude` command: on Windows it is a .cmd shim.
  // cmd.exe would otherwise look for claude.bat/.exe in the project folder (cwd) before PATH: never run code from an untrusted repo.
  const env = { ...process.env, NoDefaultCurrentDirectoryInExePath: '1' };
  const child = spawn(command[0], argv, { cwd, env, shell: command.length === 1 && process.platform === 'win32' });
  child.stdin.on('error', () => {}); // writing while the child dies is expected; the exit event reports it

  let sessionId = null;
  let busy = false;
  const pending = new Map(); // request_id -> { tool, input }
  const always = new Set(); // tool names allowed for the rest of this chat
  let stderr = '';
  let dead = false; // set once we kill the child: late output must not reach the UI

  const emit = (e) => onEvent(e);
  const write = (o) => child.stdin.writable && child.stdin.write(JSON.stringify(o) + '\n');
  let initId = 0;
  const reply = (id, response) => write({ type: 'control_response', response: { subtype: 'success', request_id: id, response } });

  createInterface({ input: child.stdout }).on('line', (line) => {
    if (dead) return;
    let m;
    try { m = JSON.parse(line); } catch { return; }
    switch (m.type) {
      case 'system':
        if (m.subtype === 'init') { sessionId = m.session_id; emit({ kind: 'init', sessionId }); }
        else if (m.subtype === 'hook_response' && m.outcome === 'error') {
          const line = String(m.stderr || m.output || '').split('\n').map((s) => s.trim()).find(Boolean) ?? '';
          emit({ kind: 'hook_warning', name: m.hook_name, message: line.slice(0, 200) });
        }
        break;
      case 'control_response': // the answer to our initialize request: the CLI's command list
        if (String(m.response?.request_id).startsWith('init-')) emit({ kind: 'commands', commands: m.response.response?.commands ?? [] });
        break;
      case 'conversation_reset': // /clear: a fresh conversation with a new session id
        sessionId = m.new_conversation_id;
        emit({ kind: 'reset', sessionId });
        break;
      case 'stream_event': {
        const d = m.event?.delta;
        if (d?.type === 'text_delta') emit({ kind: 'text_delta', text: d.text });
        break;
      }
      case 'assistant':
        emit({ kind: 'assistant', content: m.message.content });
        break;
      case 'user':
        for (const b of m.message?.content ?? []) {
          if (b.type === 'tool_result') emit({ kind: 'tool_result', toolUseId: b.tool_use_id, content: b.content, isError: !!b.is_error });
        }
        break;
      case 'control_request': {
        const r = m.request;
        if (r?.subtype !== 'can_use_tool') break;
        if (always.has(r.tool_name)) { reply(m.request_id, { behavior: 'allow', updatedInput: r.input }); break; }
        pending.set(m.request_id, { tool: r.tool_name, input: r.input });
        emit({ kind: 'permission', requestId: m.request_id, tool: r.tool_name, input: r.input, description: r.description });
        break;
      }
      case 'result':
        busy = false;
        if (m.is_error && LOGIN_HINT.test(m.result ?? '')) emit({ kind: 'login_required' });
        emit({ kind: 'result', sessionId: m.session_id, costUsd: m.total_cost_usd, stopReason: m.stop_reason, isError: !!m.is_error, text: m.result });
        break;
    }
  });

  child.stderr.on('data', (d) => {
    stderr = (stderr + d).slice(-2000);
    if (LOGIN_HINT.test(String(d))) emit({ kind: 'login_required' });
  });
  child.on('error', (err) => { busy = false; emit({ kind: 'error', message: `Cannot start claude: ${err.message}` }); });
  child.on('exit', (code) => {
    busy = false;
    if (code && !dead) emit({ kind: 'error', message: `claude exited with code ${code}. ${stderr.trim().split('\n').pop() ?? ''}`.trim() });
    emit({ kind: 'exit', code });
  });

  write({ type: 'control_request', request_id: 'init-' + (++initId), request: { subtype: 'initialize' } }); // ask the CLI for its command list

  // On Windows the child is a cmd.exe shim around the real claude: kill the whole tree or claude keeps running.
  const kill = () => {
    dead = true;
    if (process.platform === 'win32' && child.pid) spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    else child.kill();
  };

  return {
    argv,
    get sessionId() { return sessionId; },
    get busy() { return busy; },
    send(content) {
      if (busy) throw new Error('busy');
      busy = true;
      write({ type: 'user', message: { role: 'user', content } });
    },
    answer(requestId, { allow, always: remember }) {
      const p = pending.get(requestId);
      if (!p) return;
      pending.delete(requestId);
      if (allow && remember) always.add(p.tool);
      reply(requestId, allow ? { behavior: 'allow', updatedInput: p.input } : { behavior: 'deny', message: 'Denied in UI' });
    },
    interrupt() { kill(); },
    close() { child.stdin.end(); kill(); },
  };
}
