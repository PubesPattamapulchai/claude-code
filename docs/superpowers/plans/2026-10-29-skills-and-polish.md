# Skills Through the App, Autocomplete and Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every installed skill and slash command usable from Plus Ultra Terminal exactly as in the terminal (add `/` autocomplete, `/clear`, hook warnings), and fix the eight deferred minors from the last review (everything except the `C:\` listing noise).

**Architecture:** The CLI already expands `/name args` itself, so the app only sends the user's text unchanged. The engine asks the CLI for its command list with an `initialize` control request, and the UI shows it in a menu. Small pure helpers (`composeContent`, `filterCommands`, `samePath`, `latestOnly`) carry the logic that tests can reach.

**Tech Stack:** Node 22 stdlib, vanilla browser JS and CSS, `node:test`. No new dependencies.

**Spec:** The conversation of 2026-10-29 ("skills must work as before", the user's "yes to all" for the non-image items, "ตามแผนเลย") plus the evidence report on how `claude -p` stream-json treats skills, restated below. No separate spec file. Builds on `docs/superpowers/plans/2026-10-29-visual-refresh.md`.

## Facts verified against the real CLI (2.1.312, Windows), used by this plan

- `/name args` sent as an ordinary text block is expanded by the CLI like the terminal (skills and user commands). Model-initiated `Skill` tool calls work and trigger no permission request. Plugin hooks, `~/.claude/CLAUDE.md` and project skills load by default.
- Stdin `{"type":"control_request","request_id":"<id>","request":{"subtype":"initialize"}}` answers at once, without an API call, with `{"type":"control_response","response":{"subtype":"success","request_id":"<id>","response":{"commands":[{"name","description","argumentHint","aliases"?,"builtin"?}, ...]}}}` (214 commands, 52 built in; descriptions can be 500+ characters). The `system/init` event only arrives after the first user message.
- Built-ins that do not work in this mode and reply that they are unavailable: `/help`, `/resume`, `/focus`. `/clear` works but emits `{"type":"conversation_reset","new_conversation_id":"…","trigger":"clear","session_id":"…"}` followed by a fresh `system/init` with a new `session_id`. Local built-ins such as `/model`, `/context`, `/cost`, `/usage` return a synthetic assistant text (already rendered).
- `system/hook_response` events carry `hook_name`, `outcome` (`success` or `error`), `output`, `stderr`, `exit_code`. `user` events with `isSynthetic: true` carry the skill body and must stay ignored.
- When `claude` is started from a Git Bash-launched process on this machine, Git Bash is not found and three bash SessionStart hooks error; started from a native shell (PowerShell, `start.bat`) all succeed.

## Global Constraints

- Windows, Node 22, zero runtime dependencies, no build step, vanilla JS in `public/`. Run tests with `node --test test/*.test.mjs` (bare `node --test` hangs on `test/fake-claude.mjs`).
- The user's text is sent to Claude unchanged: no rewriting of a leading `/`, no wrapping, no expansion by the app. Only leading and trailing whitespace may be trimmed.
- Hidden from the autocomplete menu because the CLI refuses them in this mode: `help`, `resume`, `focus`. Everything else the CLI lists is shown.
- Do not touch the `C:\` listing behaviour (the user asked for that minor to be left alone). No image, video or silhouette work (the user will generate media separately).
- Real-CLI runs cost the user's quota: keep them to the few listed in the verification steps, each with a tiny prompt.
- Working files are CRLF after branch switches: for multi-line edits use a CRLF-tolerant script or single-line anchors. Files containing backslashes must be written with the Write tool, not shell heredocs.
- Git: continue on branch `feat/visual-refresh` (unmerged, unpushed); plain commit messages with no Claude/Anthropic attribution (user's CLAUDE.md); do not push or open a PR unless asked.

## Review Focus

- Slash text reaches Claude byte-for-byte: leading `/`, arguments with quotes, newlines and Thai text, with and without attachments. (Task 3)
- The menu opens only while the input is `/word` with no whitespace; Enter sends normally when the menu is closed or nothing matches (a path like `/usr/bin` must send, not get swallowed); Esc closes; Thai IME composition never selects. (Tasks 4, 5)
- `/clear`: transcript cleared, new session id adopted, queued permission prompts dropped, no late events from the old session rendered. (Tasks 1, 5)
- The command list missing or stale (no chat started yet, mode change respawn, SSE reconnect): the menu degrades silently or still works. (Tasks 2, 5)
- Folder equality edge cases (case, trailing and forward slashes), a stale folder listing overwriting a newer one, switching while Claude works. (Task 6)

## File Structure

```
lib/engine.js            initialize request, 'commands' / 'reset' / 'hook_warning' events
lib/app.js               cache and replay the command list per chat
public/compose.js        composeContent (pure)
public/slash.js          filterCommands, UNAVAILABLE (pure) + menu DOM
public/picker.js         samePath, latestOnly (pure), dialog opens first
public/app.js            send via composeContent, menu wiring, reset, hook warnings, folder fixes
public/art.js            oversize colour groups, near-duplicate colours
public/index.html, style.css   menu markup/styles, drawer, art sizes
test/fake-claude.mjs     answers initialize, emits hook error and /clear reset
test/*.test.mjs          new tests per task
README.md                skills, autocomplete, picker wording
```

---

### Task 1: Engine — commands, reset and hook warnings

**Files:**
- Modify: `lib/engine.js`, `test/fake-claude.mjs`
- Test: `test/engine.test.mjs`

**Interfaces:**
- Produces new `ChatEvent` kinds (the existing ones are unchanged):
  - `{ kind: 'commands', commands: { name: string, description: string, argumentHint: string, aliases?: string[], builtin?: boolean }[] }` — emitted once per chat, shortly after spawn, from the `initialize` answer.
  - `{ kind: 'reset', sessionId: string }` — from a `conversation_reset` line (`new_conversation_id`).
  - `{ kind: 'hook_warning', name: string, message: string }` — from a `system/hook_response` whose `outcome` is `error`; `message` is the first non-empty line of `stderr` or `output`, at most 200 characters.
- The engine sends the `initialize` control request right after spawn (before any user message), with `request_id` `init-<n>`.

- [ ] **Step 1: Extend `test/fake-claude.mjs`**: on a `control_request` with `subtype: "initialize"` answer `{type:'control_response', response:{subtype:'success', request_id, response:{commands:[{name:'clear',description:'Clear',argumentHint:'',builtin:true,aliases:['reset']},{name:'help',description:'Help',argumentHint:'',builtin:true},{name:'ponytail:ponytail-help',description:'Ponytail help (user)',argumentHint:''}]}}}`; when a user message text is exactly `/clear` emit `{type:'conversation_reset', new_conversation_id:'00000000-0000-4000-8000-000000000002', trigger:'clear', session_id:'…0001'}`, a `system/init` with the new id, then a `result`; when the text contains `HOOKFAIL` emit a `system/hook_response` with `hook_name:'SessionStart:startup'`, `outcome:'error'`, `stderr:'boom\nsecond line'` before the normal turn.
- [ ] **Step 2: Write failing tests** in `test/engine.test.mjs`:
  - `engine emits the command list from the initialize answer` — create a chat, wait for `commands`; names include `'clear'` and `'ponytail:ponytail-help'`; the `help` entry is still present (hiding is the UI's job).
  - `engine turns a conversation_reset into a reset event with the new session id` — `send(say('/clear'))` → `reset` event with `sessionId === '00000000-0000-4000-8000-000000000002'`, then `result`; `chat.sessionId` equals the new id afterwards.
  - `engine turns a failed hook into a hook_warning` — `send(say('HOOKFAIL'))` → `{kind:'hook_warning', name:'SessionStart:startup', message:'boom'}`; a successful hook response (extend the fake: a second `hook_response` with `outcome:'success'`) produces no warning.
  - `engine sends slash text to the child untouched` — the fake records each user text line to stderr as `USER <json>`; the test sends `'/ponytail:ponytail-help "quoted arg" with ไทย'` and asserts the engine forwarded exactly that string in the `text` block (read via a new `chat.lastInput` read-only property or by having the fake echo the text back in the `assistant` event — pick the echo; assert the `assistant` text equals the sent string).
- [ ] **Step 3: Run** `node --test test/engine.test.mjs`. Expected: the new tests FAIL, the existing 11 still pass.
- [ ] **Step 4: Implement** in `lib/engine.js`: write the `initialize` request after spawn; in the stdout switch add `case 'control_response'` (match `m.response.request_id` starting with `init-`, emit `commands` from `m.response.response.commands ?? []`; ignore errors), `case 'conversation_reset'` (set `sessionId = m.new_conversation_id`, emit `reset`), and in `case 'system'` handle `subtype === 'hook_response' && m.outcome === 'error'` (emit `hook_warning`). Keep ignoring `user` events that are not `tool_result`.
- [ ] **Step 5: Run** `node --test test/*.test.mjs`. Expected: all pass.
- [ ] **Step 6: Commit** `git add -A && git commit -m "feat: engine reports the command list, /clear resets and failed hooks"`.

### Task 2: Server — keep and replay the command list

**Files:**
- Modify: `lib/app.js`
- Test: `test/app.test.mjs`

**Interfaces:**
- Consumes: the `commands` event (Task 1).
- Produces: a new SSE connection receives `{kind:'commands', commands}` right after `init` replay when a chat exists and its list is known; the cache is dropped when the chat is replaced or closed (`POST /api/chat`, `POST /api/close`, chat exit).

- [ ] **Step 1: Write failing tests** in `test/app.test.mjs`: `a new event stream replays the command list of the running chat` — start a chat, wait on SSE for `commands`, open a second SSE, assert it receives a `commands` event with the same names; `the cached command list is dropped when the chat is closed` — after `POST /api/close`, a fresh SSE receives no `commands`.
- [ ] **Step 2: Run** `node --test test/app.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement** in `lib/app.js`: a `commands` variable beside `chat`, set from the `onEvent` callback when `e.kind === 'commands'` (only for the current chat, as the existing stale-event guard does), cleared where `chat` is replaced, closed or exits; in the `/api/events` branch write it after the `init` replay.
- [ ] **Step 4: Run** the full suite. Expected: all pass.
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: replay the command list to new event streams"`.

### Task 3: Compose the message unchanged (`public/compose.js`)

**Files:**
- Create: `public/compose.js`, `test/compose.test.mjs`
- Modify: `public/app.js`

**Interfaces:**
- Produces: `export function composeContent(typed: string, images: { block: object }[], files: { path: string }[]): object[]` — image blocks first (their `block`), then one text block. Text is `typed` when non-empty (trimmed of surrounding whitespace only), else `'See the attached image.'` (images present) or `'See the attached file.'`; when `files` is non-empty append `\n\nAttached files:\n- <path>` lines. Returns `[]` when there is nothing to send (no text, no attachments).

- [ ] **Step 1: Write failing tests** in `test/compose.test.mjs`: a slash command with arguments, quotes, a newline and Thai text, e.g. `'/mattpocock-skills:grilling เรื่อง "x"\nบรรทัดสอง'`, yields exactly one text block whose `text` equals the input (no files, no images); with one file the text starts with the exact input and ends with `'\n\nAttached files:\n- C:\\p\\a.txt'`; leading and trailing spaces are trimmed but inner spacing is kept; empty typed + one image → `[imageBlock, {type:'text', text:'See the attached image.'}]`; empty typed + one file → `'See the attached file.\n\nAttached files:\n- …'`; nothing at all → `[]`; the text never starts with anything but the user's first character.
- [ ] **Step 2: Run** `node --test test/compose.test.mjs`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement `composeContent`** in `public/compose.js` (no DOM). Then in `public/app.js` replace the inline content building in `submitComposer` with `composeContent(typed, images, files)`; keep the echo and attachment handling as they are.
- [ ] **Step 4: Run** the full suite. Expected: all pass.
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: compose the outgoing message in one tested place, slash text untouched"`.

### Task 4: Command filtering (`public/slash.js`, pure part)

**Files:**
- Create: `public/slash.js`, `test/slash.test.mjs`

**Interfaces:**
- Produces:
  - `export const UNAVAILABLE = ['help', 'resume', 'focus']`
  - `export function filterCommands(commands: Command[], text: string): Command[]` — `[]` unless `text` starts with `/` and has no whitespace after it; otherwise commands (minus `UNAVAILABLE`) matching `text.slice(1)` case-insensitively, ranked: exact name, name or alias starts with the query, the part after the last `:` starts with the query (so `grilling` finds `mattpocock-skills:grilling`), name contains the query; ties alphabetical by name; at most 60 results; an empty query returns everything (same ordering rules, alphabetical).
  - `export function completionFor(command: Command): string` — `'/' + name + ' '`.
  - `export function shortDescription(text: string, max?: number): string` — first line, trailing `(user)`/`(project)` marker removed, truncated with `…` at `max` (default 90).

- [ ] **Step 1: Write failing tests** in `test/slash.test.mjs` with a small command list (`clear` with alias `reset`, `help`, `resume`, `focus`, `model`, `mattpocock-skills:grilling`, `ponytail:ponytail-help`, `caveman:caveman-help`): `help`, `resume`, `focus` never returned; `'/'` returns the rest alphabetically; `'/gril'` returns `mattpocock-skills:grilling` (part after the colon); `'/ponytail:p'` returns `ponytail:ponytail-help`; the exact name ranks before prefix matches; an alias matches (`'/reset'` → `clear`); `'/model arg'` (has whitespace) → `[]`; `'hello'`, `''` and `'/usr/bin/env'` (no command matches) → `[]` or no menu-worthy result; `completionFor(clear) === '/clear '`; `shortDescription` cuts a 500-character description at 90 with `…`, keeps a short one, drops a trailing ` (user)`, and uses only the first line.
- [ ] **Step 2: Run** `node --test test/slash.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement** the three functions in `public/slash.js` (no DOM at import time).
- [ ] **Step 4: Run** the full suite. Expected: all pass.
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: pure slash-command filtering for the autocomplete menu"`.

### Task 5: Autocomplete menu, /clear and hook warnings in the UI

**Files:**
- Modify: `public/index.html`, `public/style.css`, `public/app.js`, `public/slash.js`

**Interfaces:**
- Consumes: `commands`, `reset`, `hook_warning` events (Task 1), the replay (Task 2), `filterCommands`, `completionFor`, `shortDescription` (Task 4), `composeContent` (Task 3).
- Produces: `public/slash.js` also exports `attachSlashMenu({ input, menu, getCommands, onChange }): { refresh(): void, close(): void }` (DOM part).

- [ ] **Step 1: Markup and CSS.** Add `<ul id="slashMenu" role="listbox" hidden>` inside `#composer` above the input row; the input gets `aria-autocomplete="list"` and `aria-controls="slashMenu"`. Style it as a panel in the existing look (opacity >= 0.92, hard shadow, max height 40vh with scroll, the active row highlighted with `--accent`, name in the mono font, description muted, argument hint after the name).
- [ ] **Step 2: Implement `attachSlashMenu`** in `slash.js`: on `input`, `focus` and `click` call `refresh()` which renders `filterCommands(getCommands(), input.value)` (hidden when empty); ArrowUp/ArrowDown move the active row (wrapping), Tab and Enter pick it (`input.value = completionFor(cmd)`, caret at the end, menu closes) but only when the menu is open and a row is active, otherwise the key does its normal job; Esc closes without clearing the text; clicking a row picks it; `aria-activedescendant` follows the active row; ignore keys while `e.isComposing`; blur closes (with a short delay so a click on a row still lands).
- [ ] **Step 3: Wire in `app.js`:** `state.commands = []` filled by the `commands` SSE event; create the menu with `getCommands: () => state.commands`; when the input value starts with `/` and `!state.alive` and a folder is set, start the chat early (`startChat(state.sessionId ?? undefined)`, errors ignored) so the list exists before the first send; `reset` event → `clearConversation()`, clear `state.permQueue` and close the permission dialog if open, `state.sessionId = e.sessionId`; `hook_warning` event → one small note per hook name per chat: `Hook "<name>" failed: <message>` (use the existing note element); `gist()` also uses `input.skill` so a `Skill` tool card reads `Skill ponytail:ponytail-help`.
- [ ] **Step 4: Verify in the browser** (shiba-ui-verify, real CLI, few prompts): type `/` → menu with the full list (no `help`, `resume`, `focus`), typing `/gril` narrows to `mattpocock-skills:grilling`, ArrowDown + Enter completes `/mattpocock-skills:grilling ` without sending, Esc closes; type `/usr/bin` and Enter → it is sent as a message (menu empty); a Thai message starting with `/` after IME composition does not select; first-message case (fresh page, no chat yet): typing `/` still shows the list (early start); send `/ponytail:ponytail-help` → the skill's help card appears as the reply; send `/clear` → transcript clears and the next message works; `/model` renders its text; a failed hook (temporarily start the app from a Git Bash-launched node) shows the one-line warning, and from `start.bat`-style native launch (PowerShell `Start-Process`) shows none; console clean.
- [ ] **Step 5: Run the full suite.** Expected: all pass.
- [ ] **Step 6: Commit** `git add -A && git commit -m "feat: slash-command autocomplete, /clear and hook warnings in the UI"`.

### Task 6: Folder fixes (minors: same-folder check, stale listing, busy, label)

**Files:**
- Modify: `public/picker.js`, `public/app.js`
- Test: `test/picker.test.mjs`

**Interfaces:**
- Produces in `public/picker.js`: `export function samePath(a: string, b: string): boolean` — for Windows-style paths (a drive letter or a backslash): compare case-insensitively, `/` equals `\`, trailing separators ignored except for a drive root (`D:\` equals `d:/`, not `D:` or ``); POSIX paths compare case-sensitively; two empty strings are not "the same". `export function latestOnly<T>(fn: (...a: unknown[]) => Promise<T>): (...a: unknown[]) => Promise<{ stale: boolean, value?: T }>` — wraps an async function so that only the most recent call is `stale: false`.

- [ ] **Step 1: Write failing tests** in `test/picker.test.mjs` (Write tool for backslashes): `samePath('D:\\POE\\app','d:/poe/app/')` true; `('D:\\','d:/')` true; `('D:\\POE','D:\\POE2')` false; `('/a/b','/a/b/')` true; `('/a/b','/A/B')` false; `('','')` false; `latestOnly` — start two overlapping calls where the first resolves after the second: the second result is `stale: false` and the first is `stale: true`; a single call is `stale: false`; an error from the wrapped function rejects the returned promise.
- [ ] **Step 2: Run** `node --test test/picker.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement** `samePath` and `latestOnly` in `picker.js`. Use `latestOnly` for the dialog's listing calls so a late response never overwrites a newer one. Open the dialog (`showModal`) first with a "Loading…" line in the folder list, then fill it. In `app.js`: `chooseFolder` returns immediately when `state.busy`, and uses `samePath` instead of `===`; keep `state.chatCwd` (set when a chat starts) and make `updateFolderBtn` show the running chat's folder when a chat is alive, otherwise the field's.
- [ ] **Step 4: Run** the full suite. Expected: all pass.
- [ ] **Step 5: Verify in the browser:** picking the same folder spelled differently (`d:\poe\claude-code\` against the stored path) keeps the conversation; clicking two folders quickly shows the last one; the dialog appears at once with "Loading…" when opened; while a turn runs the picker will not select; after typing a new path in the field (without New chat) the top-bar label still names the folder the running chat uses.
- [ ] **Step 6: Commit** `git add -A && git commit -m "fix: folder picker equality, stale listings, busy guard and top-bar label"`.

### Task 7: Drawer focus, art fallbacks, GPU size, README

**Files:**
- Modify: `public/app.js`, `public/art.js`, `public/theme.js`, `public/style.css`, `README.md`
- Test: `test/art.test.mjs`

**Interfaces:**
- Changes `styleFor`: a colour group larger than six no longer throws; its themes get styles by index modulo six and a `console.warn` names the group. Themes whose both colours are within 48 (Euclidean RGB distance) of another theme's matching colours (unordered pair) are treated as the same colour group, so near-duplicates also get different styles whenever the group has at most six members.

- [ ] **Step 1: Update/write failing tests** in `test/art.test.mjs`: replace the old "rejected loudly" test with `an oversized colour group still gets a style for every theme and warns` (7 identical-colour themes → 7 entries, all valid styles, a stubbed `console.warn` called once); add `near-identical colours never share a style when the group fits` using the real 108 themes — group them with the same 48-distance rule inside the test and assert every group of size <= 6 has pairwise distinct styles, and `bakugo` and `sato` differ (the reviewer's example); keep the existing exact-pair, stability and range tests.
- [ ] **Step 2: Run** `node --test test/art.test.mjs`. Expected: FAIL (old throw behaviour, near-duplicates share styles).
- [ ] **Step 3: Implement** the clustering in `styleFor` (union of themes whose accent and secondary are each within 48 of the other's, unordered; deal styles by sorted key inside a cluster; modulo plus warn when the cluster exceeds six). In `theme.js` stop swallowing the oversize case silently (the `try/catch` stays for unexpected errors only).
- [ ] **Step 4: CSS:** replace `inset: -60%` on `.art-speed-lines::before` and `.art-sunburst::before` with a square of side `142vmax` centred (`inset: auto; left: 50%; top: 50%; width: 142vmax; height: 142vmax; margin: -71vmax 0 0 -71vmax;`) so it still covers the viewport at every rotation with less area.
- [ ] **Step 5: Drawer focus (`app.js`):** `closeDrawer` returns focus to `#menu` whenever the drawer closes from the scrim, the close button or Escape (not only when focus was inside it), but not when a session or New chat closes it (those focus the input).
- [ ] **Step 6: README:** line "There is no picker" becomes "There is no theme picker"; add short notes that skills and slash commands work as in the terminal, the `/` autocomplete, `/clear` and which built-ins (`/help`, `/resume`, `/focus`) are unavailable here.
- [ ] **Step 7: Run** the full suite. Expected: all pass.
- [ ] **Step 8: Verify in the browser:** a real mouse click on the scrim closes the drawer and `document.activeElement.id === 'menu'`; `getBoundingClientRect` of the speed-lines and sunburst layers is the new square and the screenshot shows no blank corner at rotation 0, 45 and 90 degrees (set the animation time); console clean.
- [ ] **Step 9: Commit** `git add -A && git commit -m "fix: drawer focus, art fallbacks for crowded colour groups, smaller rotating layers, README"`.
