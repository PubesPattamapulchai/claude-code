# Plus Ultra Terminal

A local web app that wraps the installed `claude` CLI. Paste screenshots, drop files, and watch the app skin itself as each of 108 My Hero Academia characters in turn, with your own gifs, images and videos if you add them.

Everything runs on your machine. It uses the Claude Code login you already have.

## Run it

Double-click `start.bat`. It checks that `node` and `claude` are installed (Node 22 or newer is expected), starts the server, and opens your browser. Double-click again and it reopens the running instance instead of starting a second one. Close the console window to quit.

Not logged in? Run `claude` once in a terminal and log in, then retry.

## What it does

- Streams replies, renders markdown and code, shows each tool call as a collapsible card.
- Asks before every tool runs (permission dialog). Modes: ask every time, accept edits, plan only, bypass all (needs a red confirmation).
- Uses Claude Code's own session store, so chats started in a terminal show up in the sessions drawer (the menu button, top left) and `claude --resume` sees chats started here.
- Pick the project with the folder button in the top bar, or Browse in the drawer. The picker opens at your `D:\` drive (or at the current folder), you walk into sub-folders, and recent projects are one click away. Choosing a different folder starts fresh so messages and attachments stay with one project. You can still type a path.
- The title card shows the current character and a countdown to the next one.
- Skills and slash commands work as in the terminal: type `/name arguments` and Claude Code expands it, exactly as it would in a terminal session (your installed plugins, skills and hooks all load). A `/` menu above the box lists every installed skill and command; arrow keys move, Tab or Enter completes, Esc closes. `/clear` starts a fresh conversation. `/help`, `/resume` and `/focus` do not work in this mode and are left out of the menu.
- Attach with Ctrl+V (screenshots), drag and drop, or the paperclip. Images go to Claude directly. Other files are saved to `<folder>/.claude-uploads/` and Claude reads them by path. Limit 25 MB per file.

## Themes and your own media

There is no theme picker: the character changes by itself every minute, through all 108 in a shuffled order that never repeats inside a lap (one lap is 108 minutes). Every tab shows the same character and a reload keeps your place. To restart the rotation, delete the `rotateStart` entry from the page's local storage. Each theme is `themes/<key>/theme.json` (colours, icon, hero name). Media is optional and found by file name. Drop files in `themes/<key>/`:

| File | Where it shows |
|---|---|
| `bg.mp4` / `bg.webm` / `bg.gif` / `bg.png` / `bg.jpg` / `bg.webp` | Full-page background, dimmed so text stays readable |
| `claude.*` | The character's avatar next to Claude's messages |
| `thinking.*` | Avatar while Claude is working |
| `done.*` | Pops up when a reply finishes |
| `error.*` | Pops up on errors |
| `user.*` | Your avatar for this theme |

`themes/_user.png` (any supported extension) is your avatar for every theme that has no `user.*` of its own. A theme with no `bg.*` gets a generated animated background instead: one of six manga-style patterns (speed lines, halftone burst, stripes, comic grid, sunburst, checkers) drawn from the theme's two colours, with the character's emoji as a faint watermark. It is drawn by the page itself, so there is nothing to download, and your own `bg.*` always wins. Avatars fall back to the character's emoji. Media files are git-ignored: bring your own.

To regenerate the theme files from `mha-statusline`:

```
node scripts/gen-themes.mjs D:/POE/mha-statusline/statusline.ps1 themes
```

## Security

The server listens on `127.0.0.1` only (port 3777, then 3778 and up). Every launch gets a random token, sent as an HttpOnly cookie. Requests with a wrong token, `Host` or `Origin` get 403, which blocks other websites from driving Claude through your browser. Claude can still run commands on your machine in the folder you pick, subject to the permission mode.

## Not included

Slash commands, MCP and plugin screens, a diff viewer, a folder-browse dialog (type the path or pick a recent one), sound, roleplay prompts.

## Develop

```
npm test
```

Tests use `node:test` and a scripted fake `claude` (`test/fake-claude.mjs`), so they need no login and cost nothing.
