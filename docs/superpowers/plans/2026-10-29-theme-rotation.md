# Theme Rotation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the character dropdown with automatic rotation: a new theme every 60 seconds through all 108 themes (one lap = 108 minutes).

**Architecture:** A pure function `themeAt(themes, start, now)` maps wall-clock time to a theme using a seeded per-lap shuffle, so reloads and extra tabs agree and need no stored state beyond one `start` timestamp. `startRotation` ticks once a second and applies the theme when the slot changes. Colours crossfade through registered CSS custom properties; background media crossfades as stacked layers.

**Tech Stack:** Vanilla browser JS (`public/theme.js`), CSS `@property`, `node:test` for the pure functions. No new dependencies.

**Spec:** Grilling session 2026-10-29 (second feature), confirmed by the user; restated under Global Constraints. Builds on `docs/superpowers/plans/2026-10-29-claude-local-ui.md`.

## Global Constraints

- Interval: 60 seconds, a constant (`SLOT_MS = 60000`) in `public/theme.js`; no setting, no URL parameter.
- All 108 themes rotate, including villains and themes with no media. No picker, no pause, skip or pin control.
- Order: shuffled each lap, no repeats inside a lap; the first theme of a lap differs from the last theme of the previous lap. Seeded PRNG `mulberry32`; seed derived from `(start, lap)`.
- Clock: `slot = max(0, floor((now - start) / SLOT_MS))`, `lap = floor(slot / n)`, `index = slot % n` (`n` = number of themes). `start` is stored once in `localStorage` key `rotateStart` (milliseconds since epoch, as a decimal string). If storage is unavailable, `start` = page load time.
- Old messages re-skin to the current theme (existing behaviour, unchanged).
- Transition: colours and background crossfade over 600 ms; none when `prefers-reduced-motion: reduce`. No toast, no sound.
- Remove `#themeSelect` and the `localStorage` key `theme` logic entirely. Keep `applyTheme`, `avatar`, `thinkingAvatar`, `flash`, `mediaNode` as they are.
- Git: work on branch `feat/theme-rotation` from `main`; plain commit messages with no Claude/Anthropic attribution (user's CLAUDE.md); do not push or open a PR unless asked.
- Run tests with `node --test test/*.test.mjs` (bare `node --test` also runs `test/fake-claude.mjs` and hangs).

## Review Focus

- `rotateStart` missing, `"abc"`, empty, negative or in the future → `resolveStart` returns `now`, never throws, and never yields a negative slot. (Task 2)
- System clock moves backwards after `start` was stored → slot clamps to 0 instead of a negative index. (Task 1)
- Lap boundary and later boundaries (lap 1→2, 2→3) never repeat the same theme back to back. (Task 1)
- `/api/themes` fails or returns an empty list → the app still loads and no timer errors appear. (Task 2)
- Background timers are throttled in a hidden tab → on return the theme is current without waiting for the next tick. (Task 2)

## File Structure

```
public/theme.js      themeAt, resolveStart, startRotation (new); loadThemes loses the picker
public/index.html    remove the Character <label>/<select>
public/style.css     @property colours + root transition, #bg layer fade, reduced-motion guard
test/theme-client.test.mjs   themeAt and resolveStart tests
README.md            Themes section: rotation replaces the picker
```

---

### Task 1: `themeAt` (pure rotation maths)

**Files:**
- Modify: `public/theme.js`
- Test: `test/theme-client.test.mjs`

**Interfaces:**
- Produces:
  - `export const SLOT_MS = 60000`
  - `export function themeAt(themes: Theme[], start: number, now: number): Theme | undefined` — `undefined` for an empty list.

- [ ] **Step 1: Write failing tests** in `test/theme-client.test.mjs` using `const list = (n) => Array.from({ length: n }, (_, i) => ({ key: 'k' + i }))` and `const keyAt = (ts, start, slot) => themeAt(ts, start, start + slot * SLOT_MS).key`:
  - `themeAt covers every theme exactly once per lap` — for `ts = list(108)`, slots `0..107` give 108 distinct keys; slots `108..215` also give 108 distinct keys.
  - `themeAt is stable inside a slot and changes at the boundary` — keys at `start + 0`, `start + 59_999` equal; key at `start + 60_000` differs from slot 0's key.
  - `themeAt is deterministic and start-dependent` — same arguments twice give the same key; the 108-key sequences for `start = 1_000` and `start = 2_000` are not deepEqual.
  - `themeAt never repeats across lap boundaries` — for 50 different starts and `n = 108`, `keyAt(slot 107) !== keyAt(slot 108)` and `keyAt(slot 215) !== keyAt(slot 216)`; also for `n = 2`, slots `1` vs `2` and `3` vs `4` differ.
  - `themeAt clamps time before start` — `themeAt(ts, 10_000, 0).key === keyAt(ts, 10_000, 0)`.
  - `themeAt handles one theme and no themes` — `themeAt(list(1), 0, 9e9).key === 'k0'`; `themeAt([], 0, 0) === undefined`.
- [ ] **Step 2: Run** `node --test test/theme-client.test.mjs`. Expected: FAIL (`themeAt` not exported).
- [ ] **Step 3: Implement** `themeAt` and `SLOT_MS` in `public/theme.js` (pure; no DOM). Algorithm: `orderOf(n, start, lap)` iterates laps `0..lap`; each lap is a Fisher-Yates shuffle of `[0..n-1]` driven by `mulberry32(hash(start, l))` (`hash` = any integer mix of the two numbers, e.g. `(start ^ Math.imul(l + 1, 0x9e3779b1)) >>> 0`); from lap 1 on, if the shuffled order starts with the previous lap's last index and `n > 1`, swap its first two entries; remember this lap's last index for the next. Return `themes[order[index]]`.
- [ ] **Step 4: Run** the same command. Expected: PASS, all tests in the file green.
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: themeAt maps wall-clock time to a seeded theme rotation"`.

### Task 2: Start the rotation, remove the picker

**Files:**
- Modify: `public/theme.js`, `public/index.html`
- Test: `test/theme-client.test.mjs`

**Interfaces:**
- Consumes: `themeAt`, `SLOT_MS` (Task 1); existing `applyTheme(t: Theme): void`.
- Produces:
  - `export function resolveStart(raw: string | null, now: number): number`
  - `loadThemes(): Promise<void>` — fetches `/api/themes`, applies the current theme, starts the rotation. `app.js` already calls it at boot; its import line must not change.

- [ ] **Step 1: Write failing tests**: `resolveStart(null, 5000) === 5000`; `resolveStart('abc', 5000) === 5000`; `resolveStart('', 5000) === 5000`; `resolveStart('-10', 5000) === 5000`; `resolveStart('9000', 5000) === 5000` (future); `resolveStart('1234', 5000) === 1234`; `resolveStart('1234.5', 5000) === 1234.5`.
- [ ] **Step 2: Run** `node --test test/theme-client.test.mjs`. Expected: FAIL (`resolveStart` not exported).
- [ ] **Step 3: Implement `resolveStart`** in `public/theme.js` (finite number, `0 <= v <= now`, else `now`).
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Rewrite `loadThemes`** in `public/theme.js`: `try { themes = await (await fetch('/api/themes')).json(); } catch { return; }`; if the list is empty return; read `store.get('rotateStart')` through `resolveStart(raw, Date.now())` and `store.set('rotateStart', String(start))` when the stored value was not valid; define `tick()` = apply `themeAt(themes, start, Date.now())` when its key differs from `current?.key`; call `tick()` now, then `setInterval(tick, 1000)` and `document.addEventListener('visibilitychange', tick)` and `window.addEventListener('focus', tick)`. Delete the `#themeSelect` code and the `theme` localStorage read/write (including `store.set('theme', …)` inside `applyTheme`).
- [ ] **Step 6: Remove** the `Character` `<label class="field">…</label>` from `public/index.html`.
- [ ] **Step 7: Verify in the browser** (shiba-ui-verify): start the app (`node -e` with `launch({open(){}})`), open it. In the page set `localStorage.rotateStart` to `String(Date.now() - 107*60000 - 59000)`, reload: the theme shown must equal what `themeAt` returns for that start (read via `import('/public/theme.js')`), and about one second later it changes to the next slot's theme without reload. Reload again: same theme. Set `rotateStart` to `"abc"`: page loads, no console error, the key is rewritten to a valid number. Block `/api/themes` (temporarily rename `themes/` or use a test server with an empty dir): page still loads with the default look and no console errors. Confirm there is no Character control (`document.getElementById('themeSelect') === null`). Dispatch `visibilitychange` after moving `rotateStart` back one slot: theme updates immediately.
- [ ] **Step 8: Run the full suite** `node --test test/*.test.mjs`. Expected: all pass.
- [ ] **Step 9: Commit** `git add -A && git commit -m "feat: rotate themes every minute and remove the character picker"`.

### Task 3: Crossfade and README

**Files:**
- Modify: `public/theme.js` (`applyTheme`), `public/style.css`, `README.md`

**Interfaces:**
- Consumes: `applyTheme` (existing). Produces: no new exports; `applyTheme` keeps its signature.

- [ ] **Step 1: CSS** in `public/style.css`: register `--accent`, `--secondary`, `--on-accent` with `@property` (`syntax: '<color>'`, `inherits: true`, initial values `#ffd23f`, `#3ec6ff`, `#0c0e1d`); add `:root { transition: --accent 600ms, --secondary 600ms, --on-accent 600ms; }`; give `#bg > *` `position: absolute; inset: 0` and `#bg > .fade-in { animation: bgfade 600ms ease-out; }` with `@keyframes bgfade { from { opacity: 0 } }`; inside the existing `prefers-reduced-motion: reduce` block set `:root { transition: none; }` and `#bg > .fade-in { animation: none; }`.
- [ ] **Step 2: `applyTheme` background swap**: instead of `bg.replaceChildren()` + append, when a new `bg` media node exists append it with class `fade-in` on top and remove the previous children after 600 ms (immediately when reduced motion is on or on the first call); when the new theme has no `bg` media, remove the old media after 600 ms so the gradient shows through. Keep avatar, brand and hero-name updates unchanged.
- [ ] **Step 3: README** — in the Themes section replace "Pick a character in the top bar" with: the theme changes by itself every minute through all 108 characters in a shuffled order (one lap is 108 minutes, the same in every tab, reload keeps your place); there is no picker. Mention that the rotation clock starts at the first launch and can be restarted by clearing `rotateStart` in the browser's local storage.
- [ ] **Step 4: Verify in the browser** (shiba-ui-verify) using temporary media in two theme folders (ffmpeg as before, deleted afterwards): when the slot flips between a theme with `bg.mp4` and one without, `#bg` briefly holds two layers and then one; `getComputedStyle(document.documentElement).getPropertyValue('--accent')` moves through intermediate colours within 600 ms (sample twice 200 ms apart); with `prefers-reduced-motion` emulated (or by checking the CSS rule applies via `matchMedia` override unavailable: then inspect the stylesheet rule text) the transition is `none`; console has no errors.
- [ ] **Step 5: Run the full suite** `node --test test/*.test.mjs`. Expected: all pass.
- [ ] **Step 6: Commit** `git add -A && git commit -m "feat: crossfade colours and background on theme change; document rotation"`.
