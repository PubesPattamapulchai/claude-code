# Visual Refresh, Folder Picker and Generated Backgrounds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Plus Ultra Terminal the bright "poster" layout (layout B), a folder picker that opens at `D:\`, and generated animated backgrounds so all 108 themes look finished with no media files.

**Architecture:** A new `lib/dirs.js` lists sub-folders and drives behind a token-gated `GET /api/dirs`. `public/art.js` assigns each theme one of six CSS background styles (pure function of the theme list); `public/theme.js` renders it as an ordinary background layer that joins the existing crossfade. The layout moves the title card into the top bar and the sessions list into a slide-in drawer; `public/picker.js` is the dialog.

**Tech Stack:** Node 22 stdlib, vanilla browser JS and CSS, `node:test`. No new dependencies, no build step.

**Spec:** `docs/superpowers/specs/2026-10-29-visual-refresh-and-folder-picker-design.md` (including its "Calls made after the builder check" section). Builds on `docs/superpowers/plans/2026-10-29-claude-local-ui.md` and `2026-10-29-theme-rotation.md`.

## Global Constraints

- Windows, Node 22, zero runtime dependencies, no build step, works offline, vanilla JS in `public/`. Run tests with `node --test test/*.test.mjs` (bare `node --test` also runs `test/fake-claude.mjs` and hangs).
- No `backdrop-filter` anywhere. Message and input panels at 90% opacity or more (`--panel` alpha >= 0.9). Background dim about 0.25 (`--bg-dim`), down from 0.6.
- Six background styles exactly (`STYLES` in `public/art.js`), assigned by colour pair: themes that share an unordered colour pair never share a style; every theme also shows its own emoji as a faint large watermark in the art. User media (`themes/<key>/bg.*`) always wins over generated art. Generated art takes part in the existing 600 ms crossfade and is static under `prefers-reduced-motion`.
- Folder picker: opens at `D:\` when no working folder is set, otherwise at the working folder; if `D:\` does not exist, at the first available drive. Folders only, never files; hidden folders left out (names starting with `.`, `$RECYCLE.BIN`, `System Volume Information`); sorted by name, case-insensitive, numeric-aware. UNC paths (`\\server\share`), relative paths, missing paths and non-directories are rejected with 400. Every drive letter is checked with a 500 ms timeout and dropped if it does not answer; a directory read that exceeds 2000 ms is a 504. The text field for the working folder stays editable beside a "Browse" button.
- Choosing a folder different from the current one ends the current chat and clears the conversation. Choosing the same folder changes nothing. The Browse buttons are disabled while Claude is working.
- Layout B: top bar holds the title card (emoji or avatar, hero name in the slanted display type, a "next: <hero> in m:ss" countdown), the permissions menu, a menu button (opens the sessions drawer) and a folder button showing the working folder's name; a burst-line strip runs along the top edge. Chat column centred, max 860 px. The sessions drawer slides in from the left on every width, closes on scrim click or Escape, returns focus to the menu button.
- Keep visible keyboard focus, `prefers-reduced-motion` support, existing rotation (60 s) and its 600 ms crossfade. No colour fade on first page load.
- Git: work on branch `feat/visual-refresh`; plain commit messages with no Claude/Anthropic attribution (user's CLAUDE.md); do not push or open a PR unless asked. Files containing backslashes must be written with the Write tool, not shell heredocs.

## Review Focus

- `GET /api/dirs` with relative, UNC, forward-slash, trailing-slash, missing, file and unreadable (EACCES) paths: clean 400/403/504, never a crash or a file listing. (Task 1)
- Hidden/system folders and all files never appear; the filesystem root has no parent; drives that hang are dropped. (Task 1)
- Two themes that share colours never share a style, for the real 108 themes. (Task 2)
- Picking a different folder while idle clears the chat and the next message goes to the new folder; the picker cannot be opened while Claude works. (Task 5)
- The drawer works by keyboard (Escape, focus return) and at 390 px; message text stays readable over bright generated art. (Tasks 3, 4)

## File Structure

```
lib/dirs.js              listDirs, listDrives, defaultStart (folder browsing, no HTTP)
lib/app.js               GET /api/dirs
public/art.js            STYLES, styleFor (pure: theme list -> style per theme)
public/picker.js         crumbsOf, basename (pure) + the dialog
public/theme.js          art layer, rotationInfo + formatLeft, countdown, no-fade first apply
public/index.html        top bar title card, drawer + scrim, folder button, picker dialog
public/style.css         layout B, six art styles, drawer, picker
public/app.js            drawer, picker wiring, tab-title cue
test/dirs.test.mjs, test/art.test.mjs, additions to test/theme-client.test.mjs
README.md                layout, picker, generated art
```

---

### Task 1: Folder listing (`lib/dirs.js`) and `GET /api/dirs`

**Files:**
- Create: `lib/dirs.js`, `test/dirs.test.mjs`
- Modify: `lib/app.js`

**Interfaces:**
- Produces:
  - `export async function listDirs(path: string, opts?: { readdir?: typeof fs.promises.readdir, timeoutMs?: number }): Promise<{ path: string, parent: string | null, dirs: string[] }>` — rejects with `Error('bad_path')` (not absolute, UNC, missing, not a directory), `Error('denied')` (EACCES/EPERM), `Error('timeout')` (read exceeds `timeoutMs`, default 2000).
  - `export async function listDrives(opts?: { timeoutMs?: number }): Promise<string[]>` — win32: `['C:\\', 'D:\\', ...]` for letters that answer within `timeoutMs` (default 500); other platforms: `['/']`.
  - `export function defaultStart(drives: string[]): string` — `'D:\\'` if present (case-insensitive), else `drives[0]`.
  - Route `GET /api/dirs?path=<abs path>` (optional `path`; without it the response is for `defaultStart`) → `200 { path, parent, dirs, drives }`; 400 `bad_path`, 403 `denied`, 504 `timeout`. Gated by the existing token/Host/Origin check.

- [ ] **Step 1: Write failing tests** in `test/dirs.test.mjs` (temp dir with folders `a`, `B`, `10`, `2`, `.hidden`, `$RECYCLE.BIN`, `System Volume Information` and a file `f.txt`; for the route, a `createApp({ token, root, home })` server on port 0 and a small `http.request` helper with the cookie, as in `test/app.test.mjs`; write the file with the Write tool because it contains backslashes):
  - `listDirs lists folders only, hides hidden and system names, sorts case-insensitively and numerically` — result `dirs` deepEqual `['2', '10', 'a', 'B']`.
  - `listDirs reports the parent and null at a filesystem root` — `parent === path.dirname(tmp)`; for `path.parse(tmp).root`, `parent === null`.
  - `listDirs rejects relative, UNC, missing and file paths with bad_path` — `'rel/path'`, `'\\\\server\\share'`, a nonexistent child, and `f.txt` all reject `/bad_path/`.
  - `listDirs maps EACCES to denied and a hung read to timeout` — inject `readdir` that rejects with `Object.assign(new Error('x'), { code: 'EACCES' })` → `/denied/`; inject a never-resolving `readdir` with `timeoutMs: 50` → `/timeout/`.
  - `listDrives returns drives that answer` — on win32 includes the drive root of `tmpdir()` (e.g. `C:\\`), every entry matches `/^[A-Z]:\\\\$/`; elsewhere equals `['/']`.
  - `defaultStart prefers D: and falls back to the first drive` — `['C:\\','D:\\'] -> 'D:\\'`, `['C:\\','E:\\'] -> 'C:\\'`, `['d:\\'] -> 'd:\\'`.
  - `GET /api/dirs requires the token` — no cookie → 403.
  - `GET /api/dirs lists folders for a path and includes drives` — `dirs` as above, `drives` non-empty, no `f.txt`.
  - `GET /api/dirs without a path answers for the default start` — 200, `path` is one of `drives`' roots.
  - `GET /api/dirs maps errors` — relative path → 400 `bad_path`; UNC → 400; missing → 400.
- [ ] **Step 2: Run** `node --test test/dirs.test.mjs`. Expected: FAIL (`lib/dirs.js` missing).
- [ ] **Step 3: Implement `lib/dirs.js`** as specified above (race `readdir` against a timer; `readdir(path, { withFileTypes: true })`; keep entries that are directories, following junctions/symlinks through `fs.promises.stat` inside try/catch; sort with `localeCompare(b, undefined, { sensitivity: 'base', numeric: true })`; reject UNC when the path starts with `\\` or `//`; `listDrives` checks each of `A`-`Z` with `fs.promises.access(letter + ':\\')` raced against its timeout, all in parallel).
- [ ] **Step 4: Add the route** in `lib/app.js` next to the other GET routes (inside the existing `route` function): resolve `drives = await listDrives()`, `path = q.get('path') || defaultStart(drives)`, respond `{ ...(await listDirs(path)), drives }`; translate `bad_path`/`denied`/`timeout` into `HttpError(400|403|504, <code>)`.
- [ ] **Step 5: Run** `node --test test/*.test.mjs`. Expected: all pass.
- [ ] **Step 6: Commit** `git add -A && git commit -m "feat: folder listing endpoint for the project picker"`.

### Task 2: Background style assignment (`public/art.js`)

**Files:**
- Create: `public/art.js`, `test/art.test.mjs`

**Interfaces:**
- Produces:
  - `export const STYLES: string[]` — exactly six: `['speed-lines', 'halftone-burst', 'diagonal-stripes', 'comic-grid', 'sunburst', 'checker-pop']`.
  - `export function styleFor(themes: Theme[]): Map<string, { style: string, angle: number, density: number, phase: number }>` — keyed by `theme.key`; `angle` in `[0, 360)`, `density` in `[0.6, 1.4]`, `phase` in `[0, 1)`. Pure and independent of input order (sort by key internally). Themes sharing an unordered `{accent, secondary}` pair get pairwise different styles; others get `STYLES[hash(key) % 6]`.

- [ ] **Step 1: Write failing tests** in `test/art.test.mjs`, loading the real themes with `listThemes('themes')` from `lib/themes.js` and `STYLES`/`styleFor` from `../public/art.js`:
  - `every one of the 108 themes gets a style, and all six styles are used` — map size 108; `new Set(styles).size === 6`.
  - `themes that share a colour pair never share a style` — group by `[accent, secondary].sort().join('|')`; inside every group of 2+ themes all styles distinct (this includes the five yellow themes).
  - `styleFor is stable and independent of input order` — deepEqual of two calls, and of a call on a reversed copy.
  - `parameters stay in range` — angle in `[0, 360)`, density in `[0.6, 1.4]`, phase in `[0, 1)` for all 108.
  - `a group larger than the style count is rejected loudly` — a synthetic list of 7 themes with identical colours makes `styleFor` throw `/colour group/` (so a future theme set cannot silently break the rule).
- [ ] **Step 2: Run** `node --test test/art.test.mjs`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement `public/art.js`.** Hash: FNV-1a 32-bit over the theme key. Within a colour group (sorted by key, size g <= 6) style index = `(hash(firstKey) + i) % 6`; angle/density/phase from further bits of `hash(key + ':a')`, `':d'`, `':p'`. No DOM access (it is imported by Node tests).
- [ ] **Step 4: Run** the new tests and the full suite. Expected: PASS.
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: assign each theme a generated background style"`.

### Task 3: Render generated backgrounds

**Files:**
- Modify: `public/theme.js`, `public/style.css`

**Interfaces:**
- Consumes: `styleFor`, `STYLES` (Task 2); existing `applyTheme(t)`, `mediaNode`, the `fade-in`/`fade-out` background layer logic.
- Produces: `applyTheme` always puts a background layer in `#bg`: the user's `bg.*` media when present, otherwise `<div class="art art-<style>">` with inline custom properties `--angle` (deg), `--density`, `--phase` and a child `<span class="mark">` holding the theme's emoji. `loadThemes` computes `styleFor(themes)` once and keeps it for `applyTheme`.

- [ ] **Step 1: CSS** in `public/style.css`: `.art { position: absolute; inset: 0; overflow: hidden; background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 70%, #fff 0%), var(--secondary)); }` plus one rule block per style (`.art-speed-lines`, `.art-halftone-burst`, `.art-diagonal-stripes`, `.art-comic-grid`, `.art-sunburst`, `.art-checker-pop`), each built from `::before`/`::after` gradients that use `--accent`, `--secondary`, `--angle`, `--density` (as a multiplier on stripe/dot sizes via `calc`) and `--phase` (as a negative `animation-delay` fraction); slow `transform` animations only (rotate/translate, 40-90 s); `.art .mark { position: absolute; right: 6%; bottom: 8%; font-size: min(38vw, 420px); opacity: 0.12; line-height: 1; }`; inside the existing `prefers-reduced-motion: reduce` block set `.art *, .art::before, .art::after { animation: none; }`. Raise `--panel` alpha to `0.92` and `--bg-dim` to `0.25`.
- [ ] **Step 2: `theme.js`**: import `styleFor` from `/public/art.js` (browser path; keep the relative import style used by `app.js`, `'/public/art.js'`); in `loadThemes` create `const art = styleFor(themes)` before the first `tick()` and pass it to `applyTheme` through a module variable; in `applyTheme` replace the media-or-nothing branch with: `next = t.media?.bg ? mediaNode('bg') : artNode(t)`, add `fade-in` when animating, append, and remove old layers after `FADE_MS` (the old `fade-out`-only branch goes away).
- [ ] **Step 3: Verify in the browser** (shiba-ui-verify; start the app with `launch({ open() {} })`, drive it with the Chrome tools): for six themes, one per style (pick them with `styleFor` in the page), take a screenshot each and check: art fills `#bg`, the emoji watermark is visible but faint, message panel `getComputedStyle(...).backgroundColor` has alpha >= 0.9, no console errors. Put a temporary `themes/deku/bg.mp4` in place (ffmpeg `testsrc`) and confirm it replaces the art for deku, then delete it. Force the crossfade by stubbing `Date.now` as in the rotation work: between an art theme and a media theme, `#bg` briefly holds two layers, then one. With `prefers-reduced-motion` the stylesheet rule text sets `animation: none` for `.art` pseudo-elements.
- [ ] **Step 4: Run the full suite.** Expected: all pass.
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: render generated animated backgrounds for themes without media"`.

### Task 4: Layout B (top bar, drawer, centred column, countdown)

**Files:**
- Modify: `public/index.html`, `public/style.css`, `public/app.js`, `public/theme.js`
- Test: `test/theme-client.test.mjs`

**Interfaces:**
- Consumes: existing `themeAt`, `SLOT_MS`, `loadThemes` tick.
- Produces:
  - `export function formatLeft(ms: number): string` — whole seconds rounded up, `m:ss`: `42000 -> '0:42'`, `59999 -> '1:00'`, `0 -> '0:00'`, negative -> `'0:00'`.
  - `export function rotationInfo(themes: Theme[], start: number, now: number): { current: Theme, next: Theme, msLeft: number } | undefined` — `undefined` for an empty list; `msLeft` is the time until the next slot, `0 < msLeft <= SLOT_MS`; before `start` it behaves as slot 0.
  - DOM ids for later tasks: `#folderBtn` (button, label = working folder's name or "Choose folder"), `#scrim`, `#countdown`; `#side` becomes the drawer; `#menu` toggles it.

- [ ] **Step 1: Write failing tests** in `test/theme-client.test.mjs`: `formatLeft` cases above (plus `60000 -> '1:00'`, `1000 -> '0:01'`, `1 -> '0:01'`); `rotationInfo returns current, next and the time left` — for `list(108)`, `start = 0`, `now = 30_000`: `current.key === themeAt(ts, 0, 30_000).key`, `next.key === themeAt(ts, 0, 60_000).key`, `msLeft === 30_000`; at `now = 0`: `msLeft === 60_000`; `now = 59_999`: `msLeft === 1`; before start (`now = -5`): same as slot 0 with `msLeft === 60_000`; `rotationInfo([], 0, 0) === undefined`.
- [ ] **Step 2: Run** `node --test test/theme-client.test.mjs`. Expected: FAIL (exports missing).
- [ ] **Step 3: Implement `formatLeft` and `rotationInfo`** in `public/theme.js`; make `loadThemes`' tick also write `next: <hero> in <m:ss>` into `#countdown` every second (the element is `aria-hidden="true"`).
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Markup and CSS.** In `index.html`: move the brand (icon, hero name) and `#countdown` into `#bar` as the title card; add `#folderBtn` and keep `#menu`; keep the permissions select; make `#side` a drawer (`position: fixed; inset: 0 auto 0 0; width: min(340px, 86vw); transform: translateX(-102%)`, `#side.open { transform: none }`, transition disabled under reduced motion) with `#scrim` behind it; the working-folder form and sessions list stay inside the drawer. In `style.css`: single-column `#app`, centred `.msg`/`#composer .row`/`#tray` at max 860 px, a static burst-line strip along the top of `#bar` in `--accent`/`--secondary`, bar and composer bands transparent over the art with opaque inner panels (>= 0.92), the title card in the slanted display type.
- [ ] **Step 6: `app.js`**: `#menu` opens the drawer, focusing `#cwd`; `#scrim` click and Escape close it and return focus to `#menu`; opening a session or pressing "New chat" closes it (existing `closeDrawer`); `#folderBtn` label follows `#cwd` (basename or "Choose folder"), updated on load and whenever the folder changes; clicking it opens the drawer for now (Task 5 replaces this with the picker).
- [ ] **Step 7: Verify in the browser:** drawer opens/closes by button, scrim and Escape, focus returns; keyboard Tab stays inside only while open is not required but focus must be visible everywhere; at 390 px (same-origin iframe, the host window cannot be resized) no horizontal scroll and the title card fits; `#countdown` text changes each second and matches `rotationInfo`; for three bright themes message text contrast over the art is readable in a screenshot; console clean.
- [ ] **Step 8: Run the full suite.** Expected: all pass.
- [ ] **Step 9: Commit** `git add -A && git commit -m "feat: poster layout with title card, sessions drawer and next-theme countdown"`.

### Task 5: Folder picker UI

**Files:**
- Create: `public/picker.js`
- Modify: `public/index.html`, `public/style.css`, `public/app.js`
- Test: `test/picker.test.mjs`

**Interfaces:**
- Consumes: `GET /api/dirs` (Task 1), `GET /api/projects` (existing), `#folderBtn`, drawer (Task 4).
- Produces:
  - `export function crumbsOf(path: string): { label: string, path: string }[]` — Windows `'D:\\POE\\claude-code'` -> `[{ label: 'D:\\', path: 'D:\\' }, { label: 'POE', path: 'D:\\POE' }, { label: 'claude-code', path: 'D:\\POE\\claude-code' }]`; `'D:\\'` -> one crumb; POSIX `'/a/b'` -> `[{ '/', '/' }, { a, '/a' }, { b, '/a/b' }]`.
  - `export function basename(path: string): string` — last segment; a root returns itself; empty -> `''`.
  - `export function openPicker(opts: { start: string, recents: { cwd: string }[], onSelect: (path: string) => void }): void` — shows the dialog.

- [ ] **Step 1: Write failing tests** in `test/picker.test.mjs` (Write tool, backslashes): the `crumbsOf` and `basename` cases above plus `'D:/POE/x'` (forward slashes treated like backslashes, returned paths use backslashes), a trailing slash `'D:\\POE\\'` equals `'D:\\POE'`, and `basename('')===''`.
- [ ] **Step 2: Run** `node --test test/picker.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement `crumbsOf`, `basename` and `openPicker`** in `public/picker.js` (pure helpers have no DOM access at import time). Dialog is the native `<dialog id="picker">` already added to `index.html`: title, clickable breadcrumb, drive `<select>`, "Recent projects" list (hidden when empty), folder list (a `..` row first when `parent` is not null; click enters the folder by fetching `/api/dirs?path=`), an inline error line for failed listings, footer with the full path and a "Select this folder" button; `start` falls back to the server default when the fetch for `start` fails.
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Wire it in `app.js`:** a "Browse" button next to `#cwd` and `#folderBtn` both call `openPicker({ start: <cwd if set else ''>, recents, onSelect })`; both are `disabled` while `state.busy`. `onSelect(path)`: if `path === $('cwd').value.trim()` do nothing; otherwise set `#cwd`, store it, `state.alive = false`, `clearConversation()`, refresh the sessions list and the `#folderBtn` label (the old child process is replaced on the next send by the existing `/api/chat` call).
- [ ] **Step 6: Verify in the browser:** the picker opens at `D:\` with no working folder (clear `localStorage.cwd`), at the folder when one is set; drilling into a sub-folder and "Select" sets the field; `..` and the breadcrumb go up; the drive switcher works; hidden folders and files are absent; selecting the same folder changes nothing (chat stays); selecting a different folder clears the conversation, and a message sent next runs in the new folder (ask Claude for its working directory); while a turn is running both Browse buttons are disabled; Escape closes the dialog; console clean.
- [ ] **Step 7: Run the full suite.** Expected: all pass.
- [ ] **Step 8: Commit** `git add -A && git commit -m "feat: folder picker dialog opening at D:\\"`.

### Task 6: Small additions and docs

**Files:**
- Modify: `public/theme.js`, `public/app.js`, `README.md`

**Interfaces:**
- Consumes: `applyTheme`, the `first` flag from the rotation work, the `result` handler in `app.js`.

- [ ] **Step 1: No colour fade on first load.** In `applyTheme`, when `first` is true set `r.style.transition = 'none'` before the three `setProperty` calls, read `r.offsetWidth` to flush, then remove the inline `transition` so later changes crossfade as before.
- [ ] **Step 2: Tab-title cue.** In `app.js`, remember the base title; on a non-error `result` while `document.hidden`, set `document.title` to the base title prefixed with `"✓ "`; restore it on `visibilitychange` (when visible) and `window` `focus`. No Notification API.
- [ ] **Step 3: README**: fix line 3 (the app skins itself as each of the 108 characters in turn); describe the poster layout, the sessions drawer, the folder picker (opens at `D:\`, Browse button, picking another folder starts fresh), the generated backgrounds (six styles, your own `bg.*` files win), and the countdown.
- [ ] **Step 4: Verify in the browser:** at first paint of a reload `getComputedStyle(document.documentElement).getPropertyValue('--accent')` equals the theme's accent immediately (no transition running: `document.getAnimations()` has no `--accent` transition); after a slot flip it still crossfades; with the tab hidden (override `document.hidden` via `Object.defineProperty`) a finished turn sets the title prefix and a `visibilitychange` restores it.
- [ ] **Step 5: Run the full suite.** Expected: all pass.
- [ ] **Step 6: Commit** `git add -A && git commit -m "feat: no colour fade on load, tab title cue, README for the refresh"`.
