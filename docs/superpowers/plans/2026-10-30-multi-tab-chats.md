# Multi-Tab Independent Chats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every browser tab on `http://127.0.0.1:3777/` runs its own independent chat (own project folder, session, permission prompts, Stop button), like separate terminals.

**Architecture:** Today `lib/app.js` holds one `chat`, one `commands`, one `chatCwd` and one SSE client set for the whole server, so a second tab replaces the first tab's chat and receives its events. Replace those with a `tabs` map keyed by a client-generated tab id; every chat-bound request carries the id, events go only to that tab's streams. The browser keeps its tab id in `sessionStorage` (survives reload, not shared between tabs). A tab with no open event stream for a grace period has its chat closed; its transcript stays in Claude's own session store and is reopenable from the sessions list.

**Tech Stack:** Node 22 stdlib only, browser vanilla JS, `node:test`.

**Spec:** Brainstorm + user answers 2026-10-30 (no separate spec file). Decisions are restated under Global Constraints.

## Global Constraints

- Runtime: Node 22, zero npm dependencies, no build step; `npm test` (`node --test test/*.test.mjs`) must stay green after every task.
- Tab id format: `/^[A-Za-z0-9_-]{8,64}$/`. Anything else, or a missing id, on a tab-bound request → HTTP 400 `{"error":"bad_tab"}` with no side effect.
- Tab-bound endpoints: `GET /api/events?tab=<id>`, and `POST /api/chat`, `/api/send`, `/api/answer`, `/api/interrupt`, `/api/close` with `tab` in the JSON body. All other endpoints (`themes`, `projects`, `sessions`, `history`, `dirs`, `upload`) stay stateless and unchanged.
- Closed-tab policy (the user's decision): when a tab's last event stream disconnects, keep its chat running for a grace period, `graceMs` default `10 * 60 * 1000`, then close the chat and forget the tab. Reconnecting with the same tab id within the grace period cancels the timer and replays `chat` / `init` / `commands` as today. The conversation itself needs no extra storage: Claude's session store under `~/.claude/projects` already keeps it.
- Token/cookie, Host and Origin checks, port logic, `launch()` and the lock file are untouched. Usage-limit chips stay shared (they are account-wide).
- Git: plain commit messages. No `Co-Authored-By` trailer and no Claude/Anthropic attribution in commits or PR text (the user's global CLAUDE.md overrides harness defaults). Work on branch `feat/multi-tab-chats` created from `main`.

## Review Focus

- Chat in tab A and tab B at once, send in A → B receives none of A's events and B can still send itself. (Task 1)
- `tab` missing, empty, `../x`, or 65 characters on any tab-bound endpoint → 400 `bad_tab`, no chat started. (Task 1)
- `/api/close` or `/api/interrupt` from tab A leaves tab B's chat running. (Task 1)
- Reload within the grace period re-attaches (chat event and command list replayed); after the grace period the chat is gone and a send gets 409. (Task 2)
- Reloading tab A while tab B was the last to pick a folder → tab A still shows its own folder, not B's. (Task 3)
- Known ceiling, not fixed: browser "Duplicate tab" copies `sessionStorage`, so the copy shares the original's tab id and both attach to one chat. Mark with a `ponytail:` comment in `public/tab.js`.

## File Structure

```
lib/app.js            modify: per-tab chat state, tab validation, grace-period cleanup
public/tab.js         create: getTabId(storage), withTab(path, tab) — tiny pure helpers
public/app.js         modify: send tab id on every request/stream, per-tab cwd memory
test/app.test.mjs     modify: helpers carry a tab id; new multi-tab + grace tests
test/tab.test.mjs     create: unit tests for public/tab.js
README.md             modify: one paragraph on multi-tab behaviour
```

### Task 1: Per-tab chat state on the server

**Files:**
- Modify: `lib/app.js` (state at the top of `createApp`, the `/api/events` branch, the five POST branches, `server.shutdown`)
- Test: `test/app.test.mjs`

**Interfaces:**
- Consumes: `createChat({ cwd, mode, resume, command, onEvent })` from `lib/engine.js` (unchanged).
- Produces: `createApp({ token, root, command, home, graceMs })` — new optional `graceMs` (used by Task 2). Tab-bound endpoints per Global Constraints.

- [ ] **Step 1: Update the test helpers so existing tests carry a tab id.** In `test/app.test.mjs` add `const TAB = 'tab-default-0001'`; make `post(path, obj, opts)` merge `tab: opts.tab ?? TAB` into the body and `sse(tab = TAB)` request `/api/events?tab=${tab}`. Run `npm test`: existing tests still fail only where the server ignores `tab` — expected to pass, since it does; this step must leave the suite green.

- [ ] **Step 2: Write the failing tests** (names exact):
  - `two tabs run independent chats: events stay in their own tab` — `sse('tab-aaaaaaaa')` and `sse('tab-bbbbbbbb')`, `post('/api/chat', …, { tab })` for both, send `say('hi')` in A, `await a.until(result)`, wait 300 ms, assert `b.events` has no `text_delta`/`result`/`init`-with-result, then `post('/api/send', say('hi'), { tab: 'tab-bbbbbbbb' })` is 200 (B's chat survived A's activity).
  - `starting a chat in a second tab does not replace the first tab's chat` — after both tabs started, A's `post('/api/send')` is 200 and A's stream never saw `exit`.
  - `close and interrupt only touch their own tab` — close tab A; tab B send is still 200; tab A send is 409.
  - `tab-bound endpoints reject a missing or malformed tab id` — for each of `undefined`, `''`, `'../x'`, `'a'.repeat(65)`: `POST /api/chat` → 400 with body error `bad_tab`; `GET /api/events` with that tab → 400.

- [ ] **Step 3: Run `node --test test/app.test.mjs`** — the four new tests FAIL (shared chat / no `bad_tab`).

- [ ] **Step 4: Implement in `lib/app.js`.** Replace `chat`, `commands`, `chatCwd`, `clients`, `broadcast` with `const tabs = new Map()` of `{ chat, commands, cwd, clients: Set<res>, timer }`. Add `const TAB_ID = /^[A-Za-z0-9_-]{8,64}$/`, `tabFor(id)` (throws `HttpError(400, 'bad_tab')`, creates the entry on first use) and `broadcast(tab, e)`. Route changes:
  - `/api/events`: `tabFor(q.get('tab'))`; replay and register on that tab only; on `res.close` remove the client (Task 2 adds the timer).
  - `/api/chat`, `/api/send`, `/api/answer`, `/api/interrupt`, `/api/close`: read `tab` from the already-parsed body, operate on that tab's fields. Keep the stale-event guard `if (tab.chat !== c) return` and the "events of a replaced chat are stale" behaviour per tab.
  - `server.shutdown`: close every tab's chat and end every tab's clients.
  - Validate `tab` before any other body checks so `bad_tab` wins over `bad_cwd`.

- [ ] **Step 5: Run `npm test`** — all pass (existing ones prove nothing regressed for a single tab).

- [ ] **Step 6: Commit** — `git add lib/app.js test/app.test.mjs && git commit -m "feat: keep one chat per browser tab on the server"`

### Task 2: Close a tab's chat after the grace period

**Files:**
- Modify: `lib/app.js`
- Test: `test/app.test.mjs`

**Interfaces:**
- Consumes: `tabs` map, `tabFor`, `graceMs` option from Task 1.
- Produces: no new API; behaviour only.

- [ ] **Step 1: Write the failing tests** using a second server, `createApp({ token: TOKEN, root, command: [process.execPath, FAKE], home: HOME, graceMs: 200 })` listening on port 0, with request helpers parameterised by port (extend the existing `req`/`post`/`sse` helpers with an optional port argument rather than copying them):
  - `a tab whose stream stays gone past the grace period loses its chat` — start chat, close the stream, wait 500 ms, new stream for the same tab receives no `chat` event within 400 ms, `send` → 409.
  - `reconnecting within the grace period keeps the chat` — start chat, close stream, reconnect after 50 ms, wait 500 ms, new stream saw `chat`, `send` → 200.
  - `a closed tab does not affect other tabs` — tab B (stream open) still sends 200 after tab A timed out.

- [ ] **Step 2: Run them** — FAIL (chat is never closed).

- [ ] **Step 3: Implement in `lib/app.js`.** In the `res.on('close')` handler: delete the client; if the tab then has zero clients, `tab.timer = setTimeout(() => { tab.chat?.close(); tabs.delete(id); }, graceMs)`. On a new `/api/events` connection `clearTimeout(tab.timer)`. `graceMs` defaults to `10 * 60 * 1000`; call `timer.unref()` so it never keeps the process alive. A tab that never opens a stream creates no timer (acceptable: it also has no chat unless it called `/api/chat`; `shutdown` still closes it).

- [ ] **Step 4: Run `npm test`** — all pass.

- [ ] **Step 5: Commit** — `git commit -am "feat: close an abandoned tab's chat after a grace period"`

### Task 3: Browser sends its tab id and remembers its own folder

**Files:**
- Create: `public/tab.js`
- Modify: `public/app.js` (`api()` at line 27, `connectEvents()` at 160, `localStorageGet/Set('cwd')` uses at 215, 267, 386), `README.md`
- Test: `test/tab.test.mjs`

**Interfaces:**
- Produces (`public/tab.js`):
  - `getTabId(storage: Pick<Storage,'getItem'|'setItem'>, makeId?: () => string): string` — returns `storage.getItem('tab')` when it matches the tab id format, else generates (default `crypto.randomUUID()`), stores and returns it.
  - `withTab(path: string, tab: string): string` — appends `tab=<tab>` as a query parameter (`?` or `&` as the path requires).

- [ ] **Step 1: Write the failing tests** in `test/tab.test.mjs` (import style as in `test/compose.test.mjs`), with a `Map`-backed fake storage:
  - `getTabId generates once and then returns the stored id` (two calls → equal, `makeId` called once).
  - `getTabId replaces a stored value that is not a valid tab id` (stored `'../x'` → new id returned and stored).
  - `withTab adds the parameter with ? or & as needed` (`/api/events` → `/api/events?tab=T`, `/api/sessions?cwd=x` → `/api/sessions?cwd=x&tab=T`).

- [ ] **Step 2: Run `node --test test/tab.test.mjs`** — FAIL (module missing).

- [ ] **Step 3: Implement `public/tab.js`** per the interfaces; add the `ponytail:` comment about "Duplicate tab" sharing the id.

- [ ] **Step 4: Wire `public/app.js`.** `const TAB = getTabId(sessionStorage)`. In `api()`: GET → `fetch(withTab(path, TAB))`; POST → body `{ ...body, tab: TAB }`. `connectEvents` → `new EventSource(withTab('/api/events', TAB))`. The upload `fetch` is left alone. Per-tab folder memory: add `tabGet/tabSet` over `sessionStorage` (same try/catch shape as `localStorageGet/Set`); at the three `cwd` sites write both stores and read `sessionStorage` first, `localStorage` as the default for a brand-new tab (`loadRecents`: `tabGet('cwd') || localStorageGet('cwd') || list[0]?.cwd`).

- [ ] **Step 5: README.** Add a short "Several projects at once" paragraph: each tab is an independent chat; closing a tab keeps its chat for 10 minutes, after which the conversation remains in the sessions list.

- [ ] **Step 6: Run `npm test`** — all pass.

- [ ] **Step 7: Verify in a real browser** (`shiba-ui-verify`): start `node server.js`, open the URL in two tabs, pick different folders, send a message in each at the same time → each shows only its own stream and its own permission dialog; reload tab 1 → still shows its folder and re-attaches; console and network clean at desktop and phone widths.

- [ ] **Step 8: Commit** — `git add public/tab.js public/app.js test/tab.test.mjs README.md && git commit -m "feat: give each browser tab its own chat and remembered folder"`

## Self-Review

- Spec coverage: independent chats per tab (T1), closed-tab keeps chat then history remains (T2), reload re-attach with own folder (T2, T3), docs (T3).
- Names consistent: `tabs`, `tabFor`, `graceMs`, `TAB`, `getTabId`, `withTab`, `bad_tab` used identically across tasks.
- Out of scope (YAGNI): cap on number of tabs/processes, cross-tab sync of the sessions list, detecting duplicated tabs.
