// Scripted stand-in for `claude -p --input-format stream-json` used by tests.
import { createInterface } from 'node:readline';
import { appendFileSync } from 'node:fs';

const SID = '00000000-0000-4000-8000-000000000001';
const SID2 = '00000000-0000-4000-8000-000000000002';
const out = (o) => process.stdout.write(JSON.stringify(o) + '\n');
console.error('ARGV ' + JSON.stringify(process.argv.slice(2)));

const waiting = new Map(); // request_id -> resolve(response)
let n = 0;

async function turn(text) {
  if (text === '/clear') {
    out({ type: 'conversation_reset', new_conversation_id: SID2, trigger: 'clear', session_id: SID });
    out({ type: 'system', subtype: 'init', session_id: SID2, cwd: process.cwd() });
    out({ type: 'result', session_id: SID2, is_error: false, result: '', stop_reason: 'end_turn', total_cost_usd: 0 });
    return;
  }
  out({ type: 'system', subtype: 'init', session_id: SID, cwd: process.cwd() });
  if (text.includes('HOOKFAIL')) {
    out({ type: 'system', subtype: 'hook_response', hook_name: 'SessionStart:startup', outcome: 'error', stderr: 'boom\nsecond line', output: '' });
    out({ type: 'system', subtype: 'hook_response', hook_name: 'SessionStart:ok', outcome: 'success', stderr: '', output: 'fine' });
  }
  out({ type: 'rate_limit_event', rate_limit_info: { status: 'allowed', unifiedWindows: { five_hour: { utilization: 0.23, resetsAt: 1793334000, status: 'allowed' }, seven_day: { utilization: 0.62, resetsAt: 1793505600, status: 'allowed' } } } });
  out({ type: 'system', subtype: 'hook_started', hook_name: 'noise' });
  if (text.includes('DIE')) process.exit(3);
  const delta = (t) => out({ type: 'stream_event', event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: t } } });
  delta('Hel');
  delta('lo');
  out({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: text.startsWith('/') ? text : 'Hello' }] } }); // slash text is echoed so tests can see what arrived
  if (text.includes('WRITE')) {
    const id = 'req-' + ++n;
    const input = { file_path: 'x.txt', content: 'hello' };
    out({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'tu-' + n, name: 'Write', input }] } });
    out({ type: 'control_request', request_id: id, request: { subtype: 'can_use_tool', tool_name: 'Write', input, description: 'x.txt' } });
    const r = await new Promise((res) => waiting.set(id, res));
    out({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu-' + n, content: r.behavior === 'allow' ? 'File created' : 'denied', is_error: r.behavior !== 'allow' }] } });
  }
  if (text.includes('LOGIN')) {
    out({ type: 'result', session_id: SID, is_error: true, result: 'Invalid API key · Please run /login', stop_reason: 'end_turn', total_cost_usd: 0 });
    return;
  }
  out({ type: 'result', session_id: SID, is_error: false, result: 'Hello', stop_reason: 'end_turn', total_cost_usd: 0.01 });
}

createInterface({ input: process.stdin }).on('line', (l) => {
  const m = JSON.parse(l);
  if (m.type === 'user') {
    const text = m.message.content.filter((b) => b.type === 'text').map((b) => b.text).join(' ');
    turn(text);
  } else if (m.type === 'control_request' && m.request?.subtype === 'initialize') {
    out({ type: 'control_response', response: { subtype: 'success', request_id: m.request_id, response: { commands: [
      { name: 'clear', description: 'Clear', argumentHint: '', builtin: true, aliases: ['reset'] },
      { name: 'help', description: 'Help', argumentHint: '', builtin: true },
      { name: 'ponytail:ponytail-help', description: 'Ponytail help (user)', argumentHint: '' },
    ] } } });
  } else if (m.type === 'control_response') {
    waiting.get(m.response.request_id)?.(m.response.response);
    waiting.delete(m.response.request_id);
  }
});

// Optional liveness signal so tests can tell whether this process is still running.
if (process.env.FAKE_HEARTBEAT) {
  setInterval(() => appendFileSync(process.env.FAKE_HEARTBEAT, '.'), 100);
  setTimeout(() => process.exit(0), 8000); // safety net: never outlive a failed test for long
}
