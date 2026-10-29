# Theme character image generation plan (for Codex)

Goal: collect a transparent portrait of the actual anime character for every one of the 62 themes. Use the character both as an avatar replacing theme symbols and as a large character overlaid at the side of the app's original colour-based generated background.

## Current approved scope

This section supersedes the earlier background-generation pilot. The user approved the character artwork, then explicitly requested the original app-generated backgrounds and generation-only work before installation.

- Generate only one square, transparent character portrait per theme. Preserve canonical anime identity, costume, nonhuman features and masks.
- Generation is stopped by the user. Reuse completed portraits and generate only characters the user selects next; do not resume the full catalogue automatically. Class 1-B has been removed from the app and image collection.
- Save originals as `themes/_generated/<key>/claude.png`. This staging tree has no `theme.json`, so the app does not load these files as active theme media.
- Do not generate new background images, animation or video. Keep the app's existing generated patterns and per-theme colours.
- The background must still show the large character, as in the approved pilot composition. Combine the existing generated background with the transparent character as separate layers; do not remove the large character. The same high-resolution character image can supply the avatar and background character layer.
- New portraits are to be installed later, as explicitly requested. Do not copy them into active theme folders during this generation stage.
- Previously generated backgrounds are retained under `themes/_generated/_background-archive/<key>/`. The six pilot `bg.webp` files were moved there so active pilot themes use the original generated backgrounds again.
- Active pilot avatars remain in place. Leave user avatars, functional UI icons, app code and `theme.json` unchanged.
- Use the built-in image generation tool and existing tools only. No new paid service or API fallback was requested.
- Media remains local and Git-ignored; never force-add it.
- Save each successful output into the workspace immediately and record its prompt, destination and completion status in [the batch manifest](theme-media-generation-batch.json). Resume from completed files rather than regenerating them.

## Portrait prompt

Read character identity and theme colours from `themes/<key>/theme.json`. Check ambiguous identities against the official anime character catalogue. Use the actual anime character, not an anonymous hero or a real-world person with the same name.

```
One square isolated head-and-shoulders colour anime portrait of the actual My Hero Academia character {character}.
Faithful canonical face, hair, skin, mask and costume: {character_details}. New pose, consistent crisp
linework and restrained cel shading across the series. Theme accents {accent} and {secondary}, retaining
the character's actual colours. Respect nonhuman heads and covered or invisible faces.
Centre identifying features with generous margins for a circular crop; readable at 40 px.
Subtle rim light separates dark features from a dark UI. True transparent alpha background, not a
drawn checkerboard, opaque scene or circular badge. No added text, logos, watermark, UI or collage.
Age-appropriate nonsexual character illustration.
```

## Generation-stage checks

1. Confirm each requested theme has a staged `claude.png`, including the six reused pilot originals.
2. Check file signatures, decoding, dimensions and actual alpha transparency. Record any exceptions.
3. Visually check character identity and consistent style; retain raw originals for later sizing and crop adjustments.
4. Confirm staged media is Git-ignored and no new portraits were installed into active theme folders.
5. Deliver the staged collection and completion manifest. Installation and in-app checks are later work.

## Prior pilot record

The original pilot used 12 generation attempts for six backgrounds and six portraits. See [pilot results](theme-media-pilot-results.md) and [pilot prompt set](theme-media-pilot-prompts.json) for that historical record. Its background-image requirement has been superseded by the current scope.


## The 62 themes (in app order)

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
| `midnight` | Midnight | U.A. Faculty | #af00ff | #8700ff | 🌙 | no |
| `presentmic` | Present Mic | U.A. Faculty | #ffff00 | #ffd700 | 🎤 | no |
| `bestjeanist` | Best Jeanist | Pro Heroes | #005faf | #5f87af | 🧵 | no |
| `edgeshot` | Edgeshot | Pro Heroes | #00005f | #005f87 | 🥷 | no |
| `endeavor` | Endeavor | Pro Heroes | #ff0000 | #ff5f00 | 🔥 | no |
| `fatgum` | Fat Gum | Pro Heroes | #ffd700 | #ff5f00 | 🍔 | no |
| `grantorino` | Gran Torino | Pro Heroes | #005f87 | #5f87af | 👴 | no |
| `hawks` | Hawks | Pro Heroes | #ff005f | #ffd700 | 🪶 | no |
| `kamuiwoods` | Kamui Woods | Pro Heroes | #875f00 | #008700 | 🌳 | no |
| `mirko` | Mirko | Pro Heroes | #ffffff | #ffafd7 | 🐰 | no |
| `mtlady` | Mt. Lady | Pro Heroes | #ffd700 | #ffff00 | 🗼 | no |
| `ryukyu` | Ryukyu | Pro Heroes | #005faf | #00ffff | 🐲 | no |
| `starandstripe` | Star and Stripe | Pro Heroes | #ff0000 | #0000ff | 🇺🇸 | no |
| `dabi` | Dabi | Villains | #0087ff | #005fff | 🔥 | yes |
| `garaki` | Dr. Garaki | Villains | #5f875f | #005f00 | 🧪 | yes |
| `gentle` | Gentle Criminal | Villains | #00875f | #ffd787 | 🎩 | yes |
| `labrava` | La Brava | Villains | #ff5faf | #ffafaf | 💕 | yes |
| `ladynagant` | Lady Nagant | Villains | #ff5faf | #005f00 | 🎯 | yes |
| `mrcompress` | Mr. Compress | Villains | #af0000 | #ffffff | 🎪 | yes |
| `overhaul` | Overhaul | Villains | #d7af00 | #303030 | 🧤 | yes |
| `redestro` | Re-Destro | Villains | #870000 | #af5f00 | 💰 | yes |
| `shigaraki` | Shigaraki | Villains | #5f5f87 | #8a8a8a | 🖐️ | yes |
| `allforone` | All For One | Villains | #5f0087 | #303030 | 👑 | yes |
| `kurogiri` | Kurogiri | Villains | #875f87 | #5f5f5f | 🌀 | yes |
| `skeptic` | Skeptic | Villains | #00d7d7 | #5fd7d7 | 🎮 | yes |
| `spinner` | Spinner | Villains | #870000 | #005f00 | 🦎 | yes |
| `stain` | Stain | Villains | #d70000 | #5f0000 | 🗡️ | yes |
| `toga` | Toga | Villains | #ffafd7 | #ff005f | 🩸 | yes |
| `twice` | Twice | Villains | #00ffff | #d7ffff | 🎭 | yes |
