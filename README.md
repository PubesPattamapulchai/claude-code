# Plus Ultra Terminal

A local web app that wraps the installed `claude` CLI. Paste screenshots, drop files, and skin the whole thing as any of 108 My Hero Academia characters, with your own gifs, images and videos.

Everything runs on your machine. It uses the Claude Code login you already have.

## Run it

Double-click `start.bat`. It checks that `node` and `claude` are installed (Node 22 or newer is expected), starts the server, and opens your browser. Double-click again and it reopens the running instance instead of starting a second one. Close the console window to quit.

Not logged in? Run `claude` once in a terminal and log in, then retry.

## What it does

- Streams replies, renders markdown and code, shows each tool call as a collapsible card.
- Asks before every tool runs (permission dialog). Modes: ask every time, accept edits, plan only, bypass all (needs a red confirmation).
- Uses Claude Code's own session store, so chats started in a terminal show up in the sidebar and `claude --resume` sees chats started here.
- Attach with Ctrl+V (screenshots), drag and drop, or the paperclip. Images go to Claude directly. Other files are saved to `<folder>/.claude-uploads/` and Claude reads them by path. Limit 25 MB per file.

## Themes and your own media

There is no picker: the character changes by itself every minute, through all 108 in a shuffled order that never repeats inside a lap (one lap is 108 minutes). Every tab shows the same character and a reload keeps your place. To restart the rotation, delete the `rotateStart` entry from the page's local storage. Each theme is `themes/<key>/theme.json` (colours, icon, hero name). Media is optional and found by file name. Drop files in `themes/<key>/`:

| File | Where it shows |
|---|---|
| `bg.mp4` / `bg.webm` / `bg.gif` / `bg.png` / `bg.jpg` / `bg.webp` | Full-page background, dimmed so text stays readable |
| `claude.*` | The character's avatar next to Claude's messages |
| `thinking.*` | Avatar while Claude is working |
| `done.*` | Pops up when a reply finishes |
| `error.*` | Pops up on errors |
| `user.*` | Your avatar for this theme |

`themes/_user.png` (any supported extension) is your avatar for every theme that has no `user.*` of its own. Missing files fall back to the character's emoji and a gradient from the theme colours. Media files are git-ignored: bring your own.

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
