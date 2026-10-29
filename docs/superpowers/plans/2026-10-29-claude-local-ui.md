# Claude Local UI (MHA-themed) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A double-click local web app that wraps the installed `claude` CLI with paste/drag/attach uploads and a 108-character My Hero Academia theme system that accepts gif/video/image media.

**Architecture:** `server.js` (launcher: lock file, port pick, open browser) hosts `lib/app.js` (one `http.Server`, token-gated routes, one SSE stream). `lib/engine.js` owns one `claude -p` stream-json child per chat and normalises its events. Vanilla-JS UI in `public/`, no build step; `vendor/` holds three pinned minified libs.

**Tech Stack:** Node 22 stdlib only at runtime (`node:http`, `node:test`), browser vanilla JS, vendored `marked` + `DOMPurify` + `highlight.js`.

**Spec:** Grilling session 2026-10-29, confirmed by the user. Decisions are restated under Global Constraints; there is no separate spec file.

## Global Constraints

- Runtime: Node 22, zero npm dependencies, no build step; `node --test` runs all tests (`node:test`, `node:assert/strict`).
- Server binds `127.0.0.1` only; port 3777, on `EADDRINUSE` try 3778, 3779, … up to 3799.
- Every request needs the per-launch random token (cookie `lui`, set by `GET /?t=<token>` then 302 to `/`); `Host` must be `127.0.0.1:<port>` or `localhost:<port>`; any request with an `Origin` header must equal `http://<that host>`. Otherwise 403.
- Engine = installed `claude` CLI, existing login. Flags, verified by spike: `-p --input-format stream-json --output-format stream-json --verbose --include-partial-messages --permission-mode <mode> --permission-prompt-tool stdio` plus `--resume <uuid>` when resuming. Spawn with `shell: true` only for the default `claude` command (Windows `.cmd` shim). Only `mode` (whitelist) and `resume` (UUID regex) reach argv; cwd goes through the `cwd` spawn option.
- Modes: `manual` (default), `acceptEdits`, `plan`, `bypassPermissions` (UI needs a red confirm before selecting it).
- Verified wire format. Stdin user message: `{"type":"user","message":{"role":"user","content":[{"type":"image","source":{"type":"base64","media_type":"image/png","data":"…"}},{"type":"text","text":"…"}]}}`. Stdout lines: `system` (ignore all but `subtype:"init"` → `session_id`), `stream_event` (`event.delta.type` `text_delta` → `.text`), `assistant` (`message.content[]` blocks `text`/`thinking`/`tool_use`), `user` (`message.content[]` `tool_result` with `tool_use_id`, `content`, `is_error`), `control_request` (`request_id`, `request.subtype:"can_use_tool"`, `request.tool_name`, `request.input`, `request.description`), `result` (`session_id`, `is_error`, `result`, `total_cost_usd`, `stop_reason`), `rate_limit_event` (ignore). Permission reply on stdin: `{"type":"control_response","response":{"subtype":"success","request_id":"<id>","response":{"behavior":"allow","updatedInput":<input>}}}`; deny uses `{"behavior":"deny","message":"Denied in UI"}`.
- Sessions use Claude Code's own store `~/.claude/projects/<cwd with every non-alphanumeric char replaced by "-">/<session_id>.jsonl`. No app database.
- Uploads: images go as base64 image blocks from the browser; other files to `<cwd>/.claude-uploads/<timestamp>-<safeName>`; max 25 MB (`25*1024*1024` bytes) per file.
- Theme media slots and filenames: `bg.*`, `claude.*`, `thinking.*`, `done.*`, `error.*`, `user.*` (per theme) and `themes/_user.*` (global user avatar fallback); extensions `gif png jpg jpeg webp mp4 webm`. No media is committed (`.gitignore` the media extensions under `themes/`). No sound. No roleplay system prompt.
- Villain themes: heading text red, motto `Go beyond, Plus Chaos! 😈`; hero themes motto `Go beyond, Plus Ultra! 💪`. UI language English; Thai input must round-trip (UTF-8).
- Out of scope v1: slash commands, MCP/plugin UI, diff viewer, Rank/Lv/shop/banner/villain-alert/agency-sim, tray icon, folder-browse dialog (cwd = text input + recents).
- Git: plain commit messages. No `Co-Authored-By` trailer, no Claude/Anthropic attribution anywhere in commits (user's CLAUDE.md overrides harness defaults).

## Review Focus

- Request with missing/wrong token, foreign `Host` (DNS rebinding), or foreign `Origin` on a POST → 403 and no side effect. (Task 5)
- Upload name `../../evil`, `C:\x\y.txt`, empty name, or a body over 25 MB → file stays inside `.claude-uploads/`, empty name becomes `file`, oversize gives 413 and leaves no partial file. (Task 3)
- Static path traversal `/themes/../server.js`, `/public/..%2fserver.js`, encoded backslashes → 404. (Task 5)
- `claude` missing, exits non-zero, or reports a login error mid-chat → UI shows a banner and stays usable; send while a turn is running → 409, not a queued double turn. (Tasks 1, 7)
- Model output containing `<img src=x onerror=…>` or `<script>` inside markdown renders inert. (Task 7)

## File Structure

```
start.bat                  double-click entry: check node+claude, run server.js
server.js                  launcher: lock file, port pick, createApp().listen, open browser
lib/engine.js              createChat(): claude child, event normalising, permission answering
lib/sessions.js            list projects/sessions, read history from ~/.claude jsonl
lib/uploads.js             safeName, saveUpload
lib/themes.js              listThemes(): theme.json + media discovery
lib/app.js                 createApp(): auth, routes, SSE, static
scripts/gen-themes.mjs     one-shot: statusline.ps1 -> themes/<key>/theme.json
public/{index.html,style.css,app.js,theme.js,md.js}
vendor/{marked.min.js,purify.min.js,highlight.min.js,hljs.css}
themes/<key>/theme.json    108 generated; themes/_user.* optional
test/*.test.mjs, test/fake-claude.mjs, test/fixtures/
```

---

### Task 1: Engine (claude child wrapper)

**Files:**
- Create: `lib/engine.js`, `test/fake-claude.mjs`, `test/engine.test.mjs`, `.gitignore`, `package.json` (`{"private":true,"type":"module"}`)

**Interfaces:**
- Produces:
  - `export const MODES = ['manual','acceptEdits','plan','bypassPermissions']`
  - `export function createChat(opts: { cwd: string, mode: string, resume?: string, command?: string[], onEvent: (e: ChatEvent) => void }): Chat`
  - `Chat = { send(content: Block[]): void, answer(requestId: string, a: { allow: boolean, always?: boolean }): void, interrupt(): void, close(): void, readonly sessionId: string|null, readonly busy: boolean }`
  - `ChatEvent` = `{kind:'init',sessionId}` | `{kind:'text_delta',text}` | `{kind:'assistant',content:Block[]}` | `{kind:'tool_result',toolUseId,content,isError}` | `{kind:'permission',requestId,tool,input,description}` | `{kind:'result',sessionId,costUsd,stopReason,isError,text}` | `{kind:'login_required'}` | `{kind:'error',message}` | `{kind:'exit',code}`
- `command` default `['claude']`; tests pass `[process.execPath, 'test/fake-claude.mjs']` (extra argv are appended after the command's own args).

- [ ] **Step 1: Write `test/fake-claude.mjs`.** Reads JSON lines on stdin. On each `user` message: emit `system/init` (fixed `session_id` `00000000-0000-4000-8000-000000000001`), a noisy `system/hook_started`, two `stream_event` `text_delta`s (`"Hel"`, `"lo"`), an `assistant` text message. If the user text contains `WRITE`: emit a `control_request` (`tool_name:"Write"`, id `req-1`), wait for the matching `control_response`, then emit `user/tool_result` (`is_error:true` when behavior is `deny`). If it contains `LOGIN`: emit `result` with `is_error:true`, `result:"Invalid API key · Please run /login"`. If it contains `DIE`: `process.exit(3)`. Always finish a turn with a `result`. Record argv to stderr as `ARGV <json>` on startup.
- [ ] **Step 2: Write failing tests in `test/engine.test.mjs`** (each collects events via `onEvent`):
  - `text turn emits init, text_delta x2, assistant, result` — `send([{type:'text',text:'hi'}])`; kinds in order exclude system noise; deltas join to `"Hello"`; `chat.busy` true during, false after result.
  - `send while busy throws busy` — `assert.throws(() => chat.send(...), /busy/)`.
  - `permission round trip` — `WRITE` message → `permission` event with `requestId:'req-1'`, `tool:'Write'`; `answer('req-1',{allow:true})` → `tool_result` with `isError:false`; deny variant → `isError:true`.
  - `always allow auto-answers later requests of same tool` — first `answer(...,{allow:true,always:true})`, second `WRITE` turn emits no `permission` event and still yields `tool_result`.
  - `login error maps to login_required` — `LOGIN` message → `login_required` event before `result`.
  - `non-zero exit emits exit code 3 and error` — `DIE` → `{kind:'exit',code:3}` and an `error` event; `chat.busy` false afterwards.
  - `argv contains whitelisted mode and resume only` — spawn with `mode:'plan', resume:<uuid>`; fake's `ARGV` stderr contains `--permission-mode`,`plan`,`--resume`,`<uuid>`,`--permission-prompt-tool`,`stdio`.
  - `createChat rejects bad mode and bad resume` — `mode:'x'` and `resume:'../x'` throw `/invalid/`.
  - `interrupt kills the child and emits exit` .
- [ ] **Step 3: Run `node --test test/engine.test.mjs`.** Expected: FAIL (module missing).
- [ ] **Step 4: Implement `lib/engine.js`** per the Interfaces and the wire format in Global Constraints. Line-buffered stdout via `node:readline`; ignore malformed JSON lines. `busy` = a user message was sent and its `result` not yet seen. `always` stores `tool_name` in a per-chat `Set` that auto-replies allow. On stderr text matching `/log ?in|not authenticated|api key/i` also emit `login_required`. Pending permission inputs are kept by `request_id` so `answer` can echo `updatedInput`.
- [ ] **Step 5: Run the tests.** Expected: all PASS.
- [ ] **Step 6: Commit** `git add -A && git commit -m "feat: engine wrapper for claude stream-json"`.

### Task 2: Sessions reader

**Files:**
- Create: `lib/sessions.js`, `test/sessions.test.mjs`, `test/fixtures/home/.claude/projects/D--proj-a/<uuid>.jsonl` (2 files, hand-written lines)

**Interfaces:**
- Consumes: none.
- Produces:
  - `export function encodeCwd(cwd: string): string` — every `[^A-Za-z0-9]` → `-`.
  - `export async function listProjects(opts?: { home?: string }): Promise<{ cwd: string, lastActive: number }[]>` — newest first; `cwd` read from the first jsonl line carrying a `cwd` field.
  - `export async function listSessions(cwd: string, opts?: { home?: string }): Promise<{ id: string, title: string, mtime: number }[]>` — newest first; `title` = first real user text, ≤80 chars.
  - `export async function readHistory(cwd: string, id: string, opts?: { home?: string }): Promise<ChatEvent[]>` — only `assistant` and `tool_result` events plus `{kind:'user_text',text}`; skips `isMeta`, sidechain, hook and non-message lines.

- [ ] **Step 1: Write failing tests.** `encodeCwd('D:\\POE\\claude-code') === 'D--POE-claude-code'`; `listSessions` on the fixture returns 2 items ordered by mtime with the expected titles; `listProjects` returns the fixture cwd; `readHistory` returns `[user_text, assistant, tool_result, assistant]` for the fixture; `readHistory` with `id` `'../x'` rejects `/invalid/`; missing project dir → `[]`.
- [ ] **Step 2: Run `node --test test/sessions.test.mjs`.** Expected: FAIL.
- [ ] **Step 3: Implement `lib/sessions.js`.** `id` validated by UUID regex. Parse lines tolerantly (skip bad JSON).
- [ ] **Step 4: Run tests.** Expected: PASS.
- [ ] **Step 5: Commit** `git commit -am "feat: read sessions from claude store"` (after `git add -A`).

### Task 3: Uploads

**Files:**
- Create: `lib/uploads.js`, `test/uploads.test.mjs`

**Interfaces:**
- Produces:
  - `export const MAX_BYTES: number` (25*1024*1024)
  - `export function safeName(name: string): string` — basename after splitting on `/` and `\`, strips `[<>:"|?*\x00-\x1f]`, trims leading dots/spaces, empty → `'file'`, max 120 chars.
  - `export async function saveUpload(cwd: string, name: string, body: AsyncIterable<Buffer>): Promise<{ path: string }>` — writes `<cwd>/.claude-uploads/<Date.now()>-<safeName>`; throws `Error('too_large')` once `MAX_BYTES` exceeded and unlinks the partial file.

- [ ] **Step 1: Write failing tests** (temp dir cwd): `safeName('../../evil')==='evil'`; `safeName('C:\\x\\y.txt')==='y.txt'`; `safeName('')==='file'`; `safeName('..')==='file'`; saved file content equals body and `path` starts with `<cwd>/.claude-uploads/` (`path.relative` has no `..`); body of `MAX_BYTES+1` bytes rejects `/too_large/` and the directory contains no file; two uploads with same name get distinct paths.
- [ ] **Step 2: Run `node --test test/uploads.test.mjs`.** Expected: FAIL.
- [ ] **Step 3: Implement.** Stream to disk with a byte counter; `mkdir -p` the folder; also write `<cwd>/.claude-uploads/.gitignore` containing `*` if absent.
- [ ] **Step 4: Run tests.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: upload saving with size cap and safe names`.

### Task 4: Themes (generator, listing) 

**Files:**
- Create: `scripts/gen-themes.mjs`, `lib/themes.js`, `test/themes.test.mjs`, `test/fixtures/statusline-sample.ps1` (6 themes copied verbatim in shape from `D:\POE\mha-statusline\statusline.ps1`: `deku`, `aizawa`, `shinzo`, `monoma`, `mirio`, `dabi` with section headers), generated `themes/*/theme.json` (108)
- Modify: `.gitignore` (add `themes/**/*.{gif,png,jpg,jpeg,webp,mp4,webm}` expanded to one line per extension)

**Interfaces:**
- Produces:
  - `scripts/gen-themes.mjs`: `export function ansiToHex(kind: 'sgr'|'256', n: number): string`; `export function parseThemes(src: string): { key, label, icon, accent, secondary, hero, villain, group }[]`; CLI `node scripts/gen-themes.mjs <statusline.ps1> themes` writes `themes/<key>/theme.json` with exactly those fields.
  - `lib/themes.js`: `export const SLOTS`, `export async function listThemes(dir: string): Promise<Theme[]>` where `Theme = {key,label,icon,accent,secondary,hero,villain,group, media: Partial<Record<Slot,string>>}`; media value is `/themes/<key>/<file>` (or `/themes/_user.<ext>` for `user` fallback); sorted by group order `Class 1-A, Class 1-B, Big 3, One For All, U.A. Faculty, Pro Heroes, Villains` then label.
- Source mapping: `Quirk` → `accent`, `Cooldown` → `secondary`, `QuirkIcon` → `icon`, `Hero` → `hero`, `Label` → `label`, `Villain = $true` → `villain` and group `Villains`. Group otherwise from the nearest preceding `# ---- … ---` header (`Class 1-A` before the first header and for `Rest of Class 1-A`; `Rest of Class 1-B*` → Class 1-B; `Big 3`; `One For All`; `More U.A. faculty`, `Named sidekicks`, `Wild, Wild Pussycats` → U.A. Faculty; `Pro heroes`). Overrides: `allmight`, `aizawa` → U.A. Faculty; `shinzo` → Class 1-A. Colour conversion: xterm — `256`: 16–231 cube levels `[0,95,135,175,215,255]`, 232–255 grey `8+10*(n-232)`, 0–15 standard table; `sgr`: 30–37 and 90–97.

- [ ] **Step 1: Write failing tests.** `ansiToHex('256',46)==='#00ff00'`, `(…,208)==='#ff8700'`, `(…,211)==='#ff87af'`, `ansiToHex('sgr',97)==='#ffffff'`; `parseThemes(fixture)` returns 6 items, `deku` has icon `✊`, group `Class 1-A`, `villain:false`; `dabi` has `villain:true`, group `Villains`; `aizawa` group `U.A. Faculty`; `shinzo` group `Class 1-A`; `listThemes` on a temp dir with `a/theme.json`, `a/bg.mp4`, `a/claude.gif`, `_user.png` and no `a/user.*` → `media.bg==='/themes/a/bg.mp4'`, `media.user==='/themes/_user.png'`, `media.thinking===undefined`; a theme dir with malformed `theme.json` is skipped, not thrown.
- [ ] **Step 2: Run `node --test test/themes.test.mjs`.** Expected: FAIL.
- [ ] **Step 3: Implement both files.**
- [ ] **Step 4: Run tests.** Expected: PASS.
- [ ] **Step 5: Generate.** Run `node scripts/gen-themes.mjs D:/POE/mha-statusline/statusline.ps1 themes`. Verify: `ls themes | wc -l` → 108; `grep -l '"villain": true' themes/*/theme.json | wc -l` → 22.
- [ ] **Step 6: Commit** `feat: theme generator and 108 generated themes`.

### Task 5: HTTP app (auth, routes, SSE, static)

**Files:**
- Create: `lib/app.js`, `test/app.test.mjs`

**Interfaces:**
- Consumes: `createChat`, `MODES` (Task 1); `listProjects`, `listSessions`, `readHistory` (Task 2); `saveUpload` (Task 3); `listThemes` (Task 4).
- Produces:
  - `export function createApp(opts: { token: string, root: string, port: number, command?: string[], home?: string }): http.Server`
  - Routes (all token+Host+Origin gated, else 403): `GET /?t=<token>` (sets cookie, 302 `/`); `GET /` → `public/index.html`; `GET /public/*`, `/vendor/*`, `/themes/*` static with `Range` support for video, 404 on any resolved path outside its root; `GET /api/themes`; `GET /api/projects`; `GET /api/sessions?cwd=`; `GET /api/history?cwd=&id=`; `GET /api/events` (SSE, one JSON `ChatEvent` per `data:` line, `:ka` keep-alive every 15 s; replays `{kind:'init'}` if a chat exists); `POST /api/chat` `{cwd,mode,resume?}` (closes any existing chat, creates new; 400 on bad mode/cwd not a directory); `POST /api/send` `{content: Block[]}` (409 `busy` if turn running, 409 `no_chat` if none); `POST /api/answer` `{requestId,allow,always?}`; `POST /api/interrupt`; `POST /api/upload?cwd=&name=` raw body → `{path}` (413 `too_large`).

- [ ] **Step 1: Write failing tests** (start server on port 0 with `command:[process.execPath,'test/fake-claude.mjs']`, tiny `fetch` helper that sends cookie): no cookie → 403; `GET /?t=wrong` → 403; right token → 302 + `Set-Cookie` containing `HttpOnly` and `SameSite=Strict`; `Host: evil.com` with valid cookie → 403; POST with `Origin: http://evil.com` → 403 and `/api/chat` not executed; `GET /themes/../server.js`, `/public/..%2fserver.js`, `/vendor/..%5cserver.js` → 404; `GET /api/themes` returns array; `POST /api/chat` bad mode → 400; chat → send → SSE stream (read with `fetch` body reader) yields `init`, `text_delta`, `result` for `hi`; second `send` during a turn → 409; `WRITE` flow: SSE yields `permission`, `POST /api/answer` allow → `tool_result` `isError:false`; upload → file exists under `cwd/.claude-uploads`; 26 MB upload → 413; mp4 `Range: bytes=0-3` on a fixture theme media → 206 with 4 bytes.
- [ ] **Step 2: Run `node --test test/app.test.mjs`.** Expected: FAIL.
- [ ] **Step 3: Implement `lib/app.js`.** Compare the token with `crypto.timingSafeEqual`. Static resolver: `path.resolve(root, rel)` must start with `root + path.sep`, decode URI once, reject `\0`. Single global `chat`; SSE clients in a `Set`, events fan out to all. `POST` bodies capped at 20 MB for `/api/send` (base64 images), JSON elsewhere 1 MB.
- [ ] **Step 4: Run tests.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: http app with token auth, SSE and static serving`.

### Task 6: Launcher (`server.js`, `start.bat`)

**Files:**
- Create: `server.js`, `start.bat`, `test/launcher.test.mjs`

**Interfaces:**
- Consumes: `createApp` (Task 5).
- Produces: `export async function launch(opts?: { lockPath?: string, open?: (url: string) => void, port?: number }): Promise<{ url: string, reused: boolean }>`. Lock file `%TEMP%/claude-local-ui.json` = `{pid,port,token}`. If `GET http://127.0.0.1:<lock.port>/?t=<lock.token>` answers 302 → open `http://127.0.0.1:<port>/?t=<token>` and return `reused:true`; else pick the port, random 24-byte hex token, listen, write lock, open URL, delete lock on exit/SIGINT. `start.bat` checks `where node` and `where claude` (each prints install hint + `pause` + `exit /b 1` on failure), then `node "%~dp0server.js"`. `server.js` calls `launch()` when run directly.

- [ ] **Step 1: Write failing tests** (temp `lockPath`, fake `open` recording URLs, port 0): first `launch` → `reused:false`, URL contains `?t=` and the lock file exists; second `launch` with same lock → `reused:true`, same URL, only one listener; stale lock (dead port) → starts fresh and rewrites lock; occupied preferred port (listen a dummy on it) → picks the next one.
- [ ] **Step 2: Run `node --test test/launcher.test.mjs`.** Expected: FAIL.
- [ ] **Step 3: Implement.** Default `open` = `child_process.exec('start "" "<url>"')` on win32. Add a console banner listing the URL and "Close this window to quit".
- [ ] **Step 4: Run the full suite `node --test`.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: launcher with single-instance lock and start.bat`.

### Task 7: UI — chat core, markdown, permissions

**Files:**
- Create: `public/index.html`, `public/style.css`, `public/app.js`, `public/md.js`, `vendor/*` (download step below)

**Interfaces:**
- Consumes: Task 5 routes and `ChatEvent` shapes.
- Produces: `public/md.js` `export function renderMarkdown(src: string): string` (marked → DOMPurify with default profile → highlight.js on `pre code`); `app.js` state `{chat, mode, cwd, sessions, turn}` and DOM ids used by later tasks: `#messages`, `#input`, `#send`, `#attach`, `#cwd`, `#mode`, `#themeSelect`, `#sessions`, `#banner`, `#bg`, `#drop`.

- [ ] **Step 1: Fetch vendor files** (pinned):
  `curl -fL -o vendor/marked.min.js https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js`
  `curl -fL -o vendor/purify.min.js https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.min.js`
  `curl -fL -o vendor/highlight.min.js https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/highlight.min.js`
  `curl -fL -o vendor/hljs.css https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/github-dark.min.css`
  Expected: four non-empty files.
- [ ] **Step 2: Build `index.html` + `style.css` + `app.js`.** Layout: sidebar (cwd input + recent-projects datalist, sessions list, "New chat"), top bar (mode `<select>` with `bypassPermissions` guarded by a red confirm dialog, theme select placeholder), message list, composer. Behaviour: `POST /api/chat` on New chat / session click (history from `/api/history` rendered first, `resume` = id); Enter sends, Shift+Enter newline; `text_delta` appends to a live bubble, `assistant` finalises it through `renderMarkdown`; `tool_use` blocks render as `<details>` with tool name, JSON input, and the matching `tool_result` filled in by `toolUseId`; `permission` opens a modal with tool, input, **Allow**, **Allow for session** (`always:true`), **Deny**; `login_required` → `#banner` "Run `claude` in a terminal to log in, then retry."; `error`/`exit` → banner with message; Stop button calls `/api/interrupt`; mode change while idle re-posts `/api/chat` with the current `resume`; changing mode mid-turn is disabled.
- [ ] **Step 3: Verify in a real browser (shiba-ui-verify).** `node server.js`, then at 1280px and 390px widths: send "say hi" → streamed reply renders; ask for a file write in `manual` → modal appears, Deny gives an error tool_result, Allow creates the file; console clean; network has no 4xx. Inject `renderMarkdown('<img src=x onerror=window.__x=1><script>window.__x=1</script>')` via `javascript_tool` and assert `window.__x === undefined` and no `<script>`/`onerror` in the output.
- [ ] **Step 4: Commit** `feat: chat UI with markdown, tool calls and permission modal`.

### Task 8: UI — uploads

**Files:**
- Modify: `public/app.js`, `public/index.html`, `public/style.css`

**Interfaces:**
- Consumes: `POST /api/upload`, `POST /api/send` (Tasks 5, 7). Produces: composer attachment tray; `send` content = image blocks (base64) + one text block whose body is the user text followed by `\n\nAttached files:\n- <path>` lines for non-images.

- [ ] **Step 1: Implement.** `paste` handler on `#input` reads `clipboardData.items` of `kind==='file'`; `dragover/drop` on the window shows `#drop` overlay; `#attach` opens a hidden multiple `<input type=file>`. Images (`image/png|jpeg|gif|webp`) → `FileReader` base64 + thumbnail chip; others → `POST /api/upload?cwd=<cwd>&name=<name>` with the `File` as body, chip shows name and a failure state on 413/other. Files > 25 MB are rejected client-side with a banner before upload. Chips removable before send; sent messages show the thumbnails.
- [ ] **Step 2: Verify in browser.** Paste a screenshot with Ctrl+V → chip appears, Claude describes it; drag a `.txt` → saved under `<cwd>/.claude-uploads/`, Claude can read it via the path; 30 MB file → rejected with banner and nothing in `.claude-uploads`; two images + one file in one message works.
- [ ] **Step 3: Commit** `feat: paste, drag-drop and attach uploads`.

### Task 9: UI — theme application

**Files:**
- Create: `public/theme.js`
- Modify: `public/app.js`, `public/style.css`, `public/index.html`

**Interfaces:**
- Consumes: `GET /api/themes` (Task 5). Produces: `export function applyTheme(t: Theme): void` — sets CSS vars `--accent`, `--secondary`, toggles `data-villain`, sets motto text, sets `#bg` (video for `.mp4/.webm` with `autoplay muted loop playsinline`, `<img>` otherwise, else CSS gradient from the two colours) with a dim overlay (`--bg-dim: 0.6`), swaps avatar sources; `export function mediaFor(t: Theme, slot: Slot): { url?: string, icon: string }` falling back to `t.icon` emoji.

- [ ] **Step 1: Implement.** `#themeSelect` built from `<optgroup>` per `group`; selection stored in `localStorage` key `theme` (try/catch) and applied without reload, default `deku`. Message avatars: Claude = `claude` slot, user = `user` slot, each rendered as `<video>` or `<img>` by extension, emoji fallback. While a turn is running show the `thinking` slot in place of the spinner (emoji bounce animation as fallback). On `result` flash the `done` slot for 2.5 s; on `error`/`exit`/`login_required` flash `error`. Villain themes: heading colour red via `[data-villain]`, motto per Global Constraints. Respect `prefers-reduced-motion` (no bounce/flash animation; static avatar still shown).
- [ ] **Step 2: Verify in browser.** Put a temp `themes/deku/bg.mp4`, `claude.gif`, `thinking.gif` (any small files) → bg video loops under dim overlay, avatar animates, thinking media shows during a turn; switch to `dabi` (no media) → emoji avatar, red heading, "Plus Chaos! 😈", gradient background; switch back without reload; text stays readable (contrast of message text over bg) at 1280px and 390px; console clean. Remove temp media; confirm `git status` shows none (gitignored).
- [ ] **Step 3: Commit** `feat: MHA theme application with media slots`.

### Task 10: End-to-end check and README

**Files:**
- Create: `README.md` (replace stub)

- [ ] **Step 1: Cold-start check.** Close everything; double-click `start.bat` → browser opens already authenticated; double-click again → no second server, browser opens the same instance; run `node --test` → all PASS.
- [ ] **Step 2: Real-CLI multi-turn check.** Two sequential messages in one chat both complete (confirms the child accepts a second user message on open stdin); Stop mid-turn then send again resumes the same session id; start the app on a machine state where `claude` is not found → `start.bat` prints the install hint and pauses. If the second message on an open child does not work, change `engine.js` to respawn with `--resume <sessionId>` per turn and re-run Task 1's tests.
- [ ] **Step 3: README** — what it is, `start.bat`, where to drop theme media (the slot table), `node scripts/gen-themes.mjs` regeneration, security notes (127.0.0.1 + token), out-of-scope list.
- [ ] **Step 4: Commit** `docs: README and e2e verification`.
