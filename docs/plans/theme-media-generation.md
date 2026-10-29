# Theme media generation plan (for Codex)

Goal: give each of the 108 themes its own images and video by generating them, so the app looks finished beyond the built-in generated backgrounds. This is a plan for a person or an agent (Codex) to follow; nothing in the app has to change, the app already picks up the files by name.

## What the app does with the files

Every theme is a folder `themes/<key>/` holding a `theme.json` (do not edit it) and optional media. The app finds media by file name, any of these extensions: `gif png jpg jpeg webp mp4 webm`. If several files match a slot, one is used, so keep one file per slot.

| Slot (file name) | Where it shows | Spec |
|---|---|---|
| `bg.*` | Full-screen background, behind everything (the most important one) | 16:9, at least 1280x720. Video (`mp4` or `webm`, no audio, seamless loop of 6 to 10 s, under 4 MB) or a still (`jpg`, `png`, `webp`) or animated `gif`/`webp`. It is dimmed a little. The bottom 25% is mostly covered by the message box, and a centred column of chat sits over the middle, so put interest at the edges and top. |
| `claude.*` | The character's avatar next to Claude's replies and in the title card | Square, 256x256, shown as a circle of 46 to 52 px: keep the face or emblem centred with a margin. `png`, `webp`, `gif`. Animated files under 500 KB. |
| `thinking.*` | The avatar while Claude is working (it bobs) | Same crop as `claude.*`. A 1 to 2 s loop, under 500 KB. |
| `done.*` | Pops up in the corner for 2.5 s when a reply finishes | About 260 px wide, transparent background (`png`, `webp`, `gif` with alpha), under 1 MB. |
| `error.*` | Pops up for 2.5 s when something fails | Same as `done.*`. |
| `user.*` | Your own avatar for this theme | Same crop as `claude.*`. Optional. |

`themes/_user.<ext>` (in the `themes/` folder itself, not in a theme folder) is your avatar for every theme that has no `user.*`.

Missing slots are fine: a theme with no `bg.*` gets a generated background, and avatars fall back to the character's emoji. So work can be done in any order and any amount.

## Rules

- Files go straight into `themes/<key>/` with the exact slot names above. Never rename a folder and never edit `theme.json`.
- Media files are git-ignored on purpose (`.gitignore` covers `themes/**/*.{gif,png,jpg,jpeg,webp,mp4,webm}` and `themes/_user.*`). After adding files, `git status` must still be clean. Do not force-add them.
- Copyright: this repository is public. Images that show the real characters are derivative of copyrighted work. Keeping them git-ignored keeps them out of the repository; posting the `themes/` folder, screenshots or recordings of the app publicly would publish them. Generating something with an AI tool does not change that. Original art (a nameless hero in the theme colours) has no such problem.
- No text, logos, watermarks or UI in any image. No audio in any video.

## Order of work

1. Pilot (6 themes, one per generated style so the result is comparable): `kaminari`, `bakugo`, `iida`, `hagakure`, `asui`, `aoyama`. For each, make `bg.*` only, check it in the app (see "Checking a theme"), adjust the prompt, then continue.
2. `bg.*` for all 108. This alone gives about 90% of the look.
3. `claude.*` for all 108, then `thinking.*`, `done.*`, `error.*`.
4. Optional: `user.*` or `themes/_user.*`.

Batch by group (the table below is in app order), and stop after any batch if the result is not wanted.

## Prompt template

Fill the braces from the table row of the theme.

Background (`bg`):
```
Wide 16:9 background, manga / anime action style, dynamic composition with speed lines and halftone dots,
dominant colours {accent} and {secondary}, theme: {hero} ({label}), mood {mood}.
Subject matter kept abstract or as a nameless hero silhouette at the edge of the frame, centre left calm.
No text, no logo, no watermark, no interface elements.
```
For video add: `slow looping motion (drifting speed lines, pulsing glow), seamless loop, 8 seconds, no camera cut`.

Avatar (`claude`, `thinking`, `user`):
```
Square 256x256 avatar, centred emblem or bust of a nameless hero in {accent} and {secondary} on a flat dark background,
bold outline, comic style, face or emblem centred with a margin for a circular crop. No text.
```
`thinking`: same image with a small repeating motion (bob, glow pulse), 1 to 2 s loop.

Pop-ups (`done`, `error`):
```
Sticker-style burst on a transparent background, comic impact lettering shape WITHOUT readable text,
{accent} and {secondary}; done = triumphant burst, error = jagged red-tinted crack.
```

`{mood}`: hero themes bright and heroic, villain themes (`villain` yes) darker and menacing.

Encode videos (ffmpeg): `ffmpeg -i in.mp4 -an -vf "scale=1280:720,fps=24" -c:v libx264 -pix_fmt yuv420p -crf 26 -movflags +faststart themes/<key>/bg.mp4`. Check the loop seam by looping the file once.

## Checking a theme

1. Start the app (`start.bat`) and open it. The themes rotate once a minute, so force one: in the browser console run
   `const m=await import('/public/theme.js'),t=await (await fetch('/api/themes')).json(),st=Number(localStorage.rotateStart);let s=0;while(m.themeAt(t,st,st+s*6e4).key!=='deku')s++;Date.now=()=>st+s*6e4+1000;document.dispatchEvent(new Event('visibilitychange'))`
   (replace `deku` with the theme key; reload the page afterwards to go back to real time).
2. Reload the page first if the theme list was loaded before the files existed (the list is read on page load).
3. Look for: the background fills the screen and loops without a visible jump; avatars are not cropped badly by the circle; the title and message panels stay readable; no console errors.
4. `git status` shows nothing for the new files.

## The 108 themes (in app order)

`key`, hero, group, the two theme colours, the emoji used today, and whether it is a villain theme.

| key | hero | group | accent | secondary | emoji | villain |
|---|---|---|---|---|---|---|
| `aoyama` | Can't Stop Twinkling | Class 1-A | #ffd700 | #ffff00 | 💫 | no |
| `ashido` | Pinky | Class 1-A | #ff87ff | #ff5faf | 🧪 | no |
| `asui` | Froppy | Class 1-A | #00af00 | #5fff00 | 🐸 | no |
| `bakugo` | Dynamight | Class 1-A | #ff8700 | #ffaf00 | 💥 | no |
| `deku` | Deku | Class 1-A | #00ff00 | #00ffff | ✊ | no |
| `hagakure` | Invisible Girl | Class 1-A | #d7ffff | #afffff | 🫥 | no |
| `iida` | Ingenium | Class 1-A | #005fff | #0087ff | 🦿 | no |
| `jiro` | Earphone Jack | Class 1-A | #af87ff | #875fff | 🎧 | no |
| `kaminari` | Chargezuma | Class 1-A | #ffff00 | #ffd700 | ⚡ | no |
| `kirishima` | Red Riot | Class 1-A | #ff5f00 | #ff8700 | 🪨 | no |
| `koda` | Anima | Class 1-A | #005f00 | #5f875f | 🦉 | no |
| `mineta` | Grape Juice | Class 1-A | #af00ff | #8700ff | 🟣 | no |
| `ojiro` | Tailman | Class 1-A | #875f00 | #af875f | 🐒 | no |
| `sato` | Sugarman | Class 1-A | #d78700 | #ffaf00 | 🍬 | no |
| `sero` | Cellophane | Class 1-A | #d7af00 | #d7af00 | 📼 | no |
| `shinzo` | NightHide | Class 1-A | #8700ff | #5f5f87 | 🧠 | no |
| `shoji` | Tentacole | Class 1-A | #5f5fff | #5f5f87 | 🐙 | no |
| `todoroki` | Shoto | Class 1-A | #00d7ff | #00afff | ❄️ | no |
| `tokoyami` | Tsukuyomi | Class 1-A | #5f0087 | #8700d7 | 🌑 | no |
| `uraraka` | Uravity | Class 1-A | #ff87af | #87d7ff | 🪐 | no |
| `momo` | Creati | Class 1-A | #d70000 | #ffd7af | ✨ | no |
| `awase` | Welder | Class 1-B | #ffaf00 | #ffd700 | 🔧 | no |
| `bondo` | Plamo | Class 1-B | #ffd7d7 | #ffffd7 | 🧴 | no |
| `fukidashi` | Comicman | Class 1-B | #ffff00 | #ffffff | 💬 | no |
| `honenuki` | Mudman | Class 1-B | #875f00 | #af875f | 🟫 | no |
| `kaibara` | Spiral | Class 1-B | #d78700 | #ff8700 | 🌪️ | no |
| `kamakiri` | Jack Mantis | Class 1-B | #00af00 | #5fff00 | 🦗 | no |
| `kendo` | Battle Fist | Class 1-B | #d7875f | #ffaf5f | 👊 | no |
| `kodai` | Rule | Class 1-B | #87afff | #afd7ff | 📏 | no |
| `komori` | Shemage | Class 1-B | #ff87af | #ffd7af | 🍄 | no |
| `kuroiro` | Vantablack | Class 1-B | #303030 | #585858 | ⚫ | no |
| `monoma` | Phantom Thief | Class 1-B | #00ffff | #5fffff | 🪞 | no |
| `rin` | Dragon Shroud | Class 1-B | #005faf | #0087d7 | 🐉 | no |
| `shiozaki` | Vine | Class 1-B | #008700 | #5fff87 | 🌿 | no |
| `shishida` | Gevaudan | Class 1-B | #af5f00 | #875f00 | 🦁 | no |
| `shoda` | Mines | Class 1-B | #d75f00 | #ff5f00 | 💣 | no |
| `tetsutetsu` | Real Steel | Class 1-B | #b2b2b2 | #eeeeee | 🔩 | no |
| `tokage` | Lizardy | Class 1-B | #87ff00 | #afff00 | 🦎 | no |
| `tsuburaba` | Tsuburaba | Class 1-B | #d7ffff | #afffff | 🫧 | no |
| `tsunotori` | Rocketti | Class 1-B | #ffafff | #ffd7ff | 🦄 | no |
| `yanagi` | Emily | Class 1-B | #af87ff | #d7afff | 🔮 | no |
| `tamaki` | Suneater | Big 3 | #875faf | #5f5f87 | 🍽️ | no |
| `nejire` | Nejire-chan | Big 3 | #00afff | #00d7ff | 🌀 | no |
| `mirio` | Lemillion | Big 3 | #ffd700 | #ffff00 | 👻 | no |
| `banjo` | Banjo | One For All | #5f00af | #af00ff | 〰️ | no |
| `brucelee` | Bruce Lee | One For All | #ffaf00 | #ff8700 | 🥋 | no |
| `kudo` | Kudo | One For All | #5f87af | #8787af | ⚙️ | no |
| `yoichi` | Yoichi | One For All | #ffd7af | #ffffd7 | 🕊️ | no |
| `nana` | Nana Shimura | One For All | #af5f00 | #ffaf87 | 🪽 | no |
| `shinomori` | Shinomori | One For All | #5f0087 | #875f87 | 🥷 | no |
| `en` | En | One For All | #875f87 | #af87d7 | 💨 | no |
| `aizawa` | Eraser Head | U.A. Faculty | #767676 | #5f5f87 | 🧣 | no |
| `allmight` | All Might | U.A. Faculty | #0087ff | #0087ff | 💪 | no |
| `burnin` | Burnin | U.A. Faculty | #ff5f00 | #ff8700 | 🔥 | no |
| `cementoss` | Cementoss | U.A. Faculty | #bcbcbc | #949494 | 🧱 | no |
| `tiger` | Tiger | U.A. Faculty | #d75f00 | #d7af00 | 🐯 | no |
| `ectoplasm` | Ectoplasm | U.A. Faculty | #5fd7af | #00d7af | 👥 | no |
| `hounddog` | Hound Dog | U.A. Faculty | #af5f00 | #d78700 | 🐕 | no |
| `manual` | Manual | U.A. Faculty | #00afff | #5fafff | 💧 | no |
| `midnight` | Midnight | U.A. Faculty | #af00ff | #8700ff | 🌙 | no |
| `nezu` | Nezu | U.A. Faculty | #ffffd7 | #ffd7af | 🐭 | no |
| `powerloader` | Power Loader | U.A. Faculty | #ff5f00 | #ffaf00 | ⛏️ | no |
| `presentmic` | Present Mic | U.A. Faculty | #ffff00 | #ffd700 | 🎤 | no |
| `recoverygirl` | Recovery Girl | U.A. Faculty | #ffafaf | #ffd7d7 | 💊 | no |
| `selkie` | Selkie | U.A. Faculty | #5f87af | #afd7d7 | 🦭 | no |
| `ragdoll` | Ragdoll | U.A. Faculty | #ffafd7 | #ffd7d7 | 🔍 | no |
| `nighteye` | Sir Nighteye | U.A. Faculty | #005f00 | #008700 | 👁️ | no |
| `snipe` | Snipe | U.A. Faculty | #af5f00 | #d78700 | 🔫 | no |
| `mandalay` | Mandalay | U.A. Faculty | #d78700 | #875f00 | 🐆 | no |
| `thirteen` | Thirteen | U.A. Faculty | #262626 | #5f00ff | 🕳️ | no |
| `pixiebob` | Pixie-Bob | U.A. Faculty | #af8700 | #875f00 | 🪨 | no |
| `uwabami` | Uwabami | U.A. Faculty | #af5fff | #d7af00 | 🐍 | no |
| `vladking` | Vlad King | U.A. Faculty | #870000 | #af0000 | 🩸 | no |
| `bestjeanist` | Best Jeanist | Pro Heroes | #005faf | #5f87af | 🧵 | no |
| `edgeshot` | Edgeshot | Pro Heroes | #00005f | #005f87 | 🥷 | no |
| `endeavor` | Endeavor | Pro Heroes | #ff0000 | #ff5f00 | 🔥 | no |
| `fatgum` | Fat Gum | Pro Heroes | #ffd700 | #ff5f00 | 🍔 | no |
| `grantorino` | Gran Torino | Pro Heroes | #005f87 | #5f87af | 👴 | no |
| `gunhead` | Gunhead | Pro Heroes | #875f00 | #af5f00 | 🥊 | no |
| `hawks` | Hawks | Pro Heroes | #ff005f | #ffd700 | 🪶 | no |
| `kamuiwoods` | Kamui Woods | Pro Heroes | #875f00 | #008700 | 🌳 | no |
| `mirko` | Mirko | Pro Heroes | #ffffff | #ffafd7 | 🐰 | no |
| `mtlady` | Mt. Lady | Pro Heroes | #ffd700 | #ffff00 | 🗼 | no |
| `rocklock` | Rock Lock | Pro Heroes | #585858 | #8a8a8a | 🔒 | no |
| `ryukyu` | Ryukyu | Pro Heroes | #005faf | #00ffff | 🐲 | no |
| `starandstripe` | Star and Stripe | Pro Heroes | #ff0000 | #0000ff | 🇺🇸 | no |
| `dabi` | Dabi | Villains | #0087ff | #005fff | 🔥 | yes |
| `garaki` | Dr. Garaki | Villains | #5f875f | #005f00 | 🧪 | yes |
| `gentle` | Gentle Criminal | Villains | #00875f | #ffd787 | 🎩 | yes |
| `geten` | Geten | Villains | #afffff | #d7ffff | 🧊 | yes |
| `magne` | Magne | Villains | #870087 | #af00af | 🧲 | yes |
| `muscular` | Muscular | Villains | #ff5f87 | #870000 | 💪 | yes |
| `labrava` | La Brava | Villains | #ff5faf | #ffafaf | 💕 | yes |
| `ladynagant` | Lady Nagant | Villains | #ff5faf | #005f00 | 🎯 | yes |
| `moonfish` | Moonfish | Villains | #005f87 | #bcbcbc | 🦈 | yes |
| `mrcompress` | Mr. Compress | Villains | #af0000 | #ffffff | 🎪 | yes |
| `mustard` | Mustard | Villains | #d7af00 | #878700 | ☠️ | yes |
| `overhaul` | Overhaul | Villains | #d7af00 | #303030 | 🧤 | yes |
| `rappa` | Rappa | Villains | #af0000 | #5f0000 | 🥋 | yes |
| `redestro` | Re-Destro | Villains | #870000 | #af5f00 | 💰 | yes |
| `shigaraki` | Shigaraki | Villains | #5f5f87 | #8a8a8a | 🖐️ | yes |
| `allforone` | All For One | Villains | #5f0087 | #303030 | 👑 | yes |
| `kurogiri` | Kurogiri | Villains | #875f87 | #5f5f5f | 🌀 | yes |
| `skeptic` | Skeptic | Villains | #00d7d7 | #5fd7d7 | 🎮 | yes |
| `spinner` | Spinner | Villains | #870000 | #005f00 | 🦎 | yes |
| `stain` | Stain | Villains | #d70000 | #5f0000 | 🗡️ | yes |
| `toga` | Toga | Villains | #ffafd7 | #ff005f | 🩸 | yes |
| `twice` | Twice | Villains | #00ffff | #d7ffff | 🎭 | yes |
