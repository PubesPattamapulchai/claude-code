# Visual refresh, folder picker and generated backgrounds: design

Builds on Plus Ultra Terminal (see `README.md` and `docs/superpowers/plans/`). Written 2026-10-29 after a conversation with the user; the user's own words are marked as decisions, everything else is a call by the writer and flagged so.

## Intent

The user uses the app as its main Claude Code front end and finds two things lacking:

1. **It looks plain.** The dark panels read as a standard chat app. The user wants the My Hero Academia theme to be the point of the screen: bright, loud, full of motion.
2. **Choosing a project is typing a path.** They want a button that opens at their `D:` drive and lets them walk into folders and sub-folders.

They also asked for images and video "that have no copyright" to fill the themes, because the repo ships no media and 106 of 108 themes are just an emoji and a gradient today.

## Goals

- **Layout "B, poster"** (the user picked it from three mockups): the background art fills the screen and stays bright; the chat sits in a centred column; the session list is a drawer that slides in on request instead of a permanent sidebar.
- **A folder picker** that opens at `D:\`, lets the user go into folders and back up, switch drives, jump to recent projects, and pick the folder they are standing in.
- **Every one of the 108 themes looks different and finished with no files added**, using art the app draws itself from the theme's two colours. No copyrighted material, no downloaded media, no repo bloat.
- User media in `themes/<key>/` keeps winning over generated art, exactly as today.

## Non-goals

- Browser-side "upload a whole project" (dragging a folder in and copying its contents elsewhere). *Writer's call:* the user's phrase was taken to mean picking an existing folder on this machine as the working folder, because the app and Claude both run locally and already work in place. Revisit if that was wrong.
- Downloading stock photos or video. Chosen over generated art by the user ("เอาแบบที่เสนอมาเลย" after both options were offered; the writer read this as the generated option, which was listed first and recommended).
- New character artwork or avatars. Avatars, "thinking" and "done" pop-ups stay emoji unless the user supplies files.
- A different layout for phones beyond what already works; no new framework, no build step.

## Anti-goals (a failure even if it technically works)

- Message text that is hard to read over bright art.
- A background that makes the page stutter or the fan spin. The app already hit a rendering stall with a video background and blurred panels; generated art must be cheaper than that.
- Anything that looks copied from a manga or anime.
- Two themes that look the same.

## Constraints

- Windows, Node 22, zero runtime dependencies, no build step, works offline. Vanilla JS, current `public/` structure. Tests use `node:test`.
- Bright art, so panels get more opaque, not blurrier: message and input panels at 90% opacity or more. No `backdrop-filter`.
- Respect `prefers-reduced-motion` (generated art becomes still) and keep visible keyboard focus, as today.
- The folder picker can only be used by someone holding the app's token cookie, like every other route. It lists folder names only, never file names or contents.
- Rotation (a new theme every minute, 600 ms crossfade) stays. Generated art takes part in the same crossfade as media files.

## What the user decided

- Layout B from the mockup: bright full-screen background, centred chat column, slide-in sessions drawer, burst-line strip across the top.
- The folder picker opens at `D:\` and shows folders and sub-folders to walk through (their words: default in drive D, choose a folder and sub-folder in it).
- Art is generated, not downloaded or sourced.
- "Anything else you think should be fixed or added, go ahead."

## Design

### Layout B
- Top bar: the character's title card (hero name in the slanted display type, emoji or avatar, a small "next: <hero> in m:ss" countdown), the permissions menu, a menu button that opens the sessions drawer, and the folder button. A strip of burst lines in the theme colours runs along the top edge.
- Chat column centred, up to 860 px wide; message panels at 90%+ opacity with the existing hard shadows. Composer in the same column.
- Sessions drawer slides in from the left over the art, closes on outside click or Escape. It holds the working-folder control and the session list that live in the sidebar today. On phones it is the same drawer.
- The background dim is much lighter than today (writer's call: about 0.25 instead of 0.6) because panels now carry the contrast.

### Generated backgrounds
- A theme with no `bg.*` file gets a generated layer. *Writer's call:* drawn with CSS only (layered gradients and a slowly rotating conic gradient), not canvas or video files, so there is nothing to store and it costs almost nothing to render.
- The style is chosen from a small set (writer's call: four, for example speed lines, halftone burst, diagonal stripes, comic-panel grid) by hashing the theme key, so the same character always gets the same style. The two theme colours set the palette; the hash also varies angle, density and phase so neighbours differ.
- Animation is slow and subtle; under reduced motion it is static.
- The layer is an ordinary child of the background element, so the existing fade-in/fade-out between themes applies unchanged.

### Folder picker
- A "Browse…" button next to the working-folder field opens a dialog (writer's call: the text field stays editable beside it, so typing a path still works).
- Contents: clickable breadcrumb (`D:\` › POE › claude-code), a drive switcher, a "recent projects" list, then the folders in the current directory (a `..` row first), sorted by name, hidden folders (dot-names, `$RECYCLE.BIN`, `System Volume Information`) left out, and a "Select this folder" button showing the full path.
- Opens at `D:\`; if that does not exist, at the first available drive.
- Selecting sets the working folder and refreshes the session list; it does not start a chat by itself.
- New route (token-gated like the rest): the list of sub-folders of an absolute directory path, plus its parent and the available drives. An invalid, missing or non-directory path is a 400. Network (UNC) paths are rejected so a dead share cannot hang the picker.

### Small additions (writer's calls, the user said to add what seems right)
- The two known minors: no gold-to-theme colour fade on page load; the README line that implies the character is chosen.
- A tab title cue when Claude finishes while the tab is in the background (title gets a check mark prefix until the tab is focused). No browser notification permission prompts.

## Left to the builder
Exact colours, opacity values, gradient recipes and the four background styles; drawer animation and focus handling; the dialog's look; the countdown's wording and formatting; where the new route and its helper live; how to test the pure parts (style choice by theme key, directory listing and filtering).

## How it will be checked
Existing 62 tests stay green. New tests for: choosing a background style from a theme key (stable, covers all styles across the 108 themes, no empty result); the directory-listing route (hidden folders filtered, files omitted, parent and drives reported, bad and UNC paths rejected, no access without the token). Visual checks in a real browser for the layout, the drawer, the picker, readable text over each generated style, and the reduced-motion path.
