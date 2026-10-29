# Theme character image generation plan (for Codex)

Goal: Codex generates one large, transparent, background-free **hero** image of the actual anime character for each character in the work list below. That is the only job. Everything after generation (cropping, resizing, converting, installing, app code, tests) is done by Claude, not Codex.

## Scope

- Generate `hero.png` for each of the 22 characters in the work list, even where an earlier version exists. Save each as `themes/_generated/<key>/hero.png`. This staging tree has no `theme.json`, so the app does not load it.
- **No background of any kind.** No sky, city, room, floor, wall, tower, rubble, banner, water or plants. The app draws its own manga background behind the hero.
- Do not touch the existing `claude.png` portraits (chat avatars and logo). Do not regenerate or rename them.
- Do not crop, resize, convert, install or copy anything into theme folders. Do not change app code or `theme.json`. Do not generate any character outside the work list.
- Use the built-in image generation tool only. No paid service or API fallback.
- Record each result (prompt, file path, status) in [the batch manifest](theme-media-generation-batch.json) as soon as it is saved, then stop when the list is done. Skip entries already marked complete.

### Work list (22)

`aoyama`, `ashido`, `asui`, `bakugo`, `deku`, `hagakure`, `iida`, `jiro`, `kaminari`, `kirishima`, `koda`, `mineta`, `momo`, `ojiro`, `sato`, `sero`, `shinzo`, `shoji`, `todoroki`, `tokoyami`, `uraraka`, `shigaraki`.

## Framing rules

- Character on the right side of the canvas, head in the upper half, three-quarter view facing left, dynamic pose. The body may run off the right and bottom edges.
- Clear empty headroom above the head (at least 8% of the image height). The head, hair and horns must not touch the top edge.
- Keep the face and important detail out of the lowest quarter of the picture.
- A thin, clean light rim along the whole silhouette and a crisp outline, so dark clothing, hair and feathers stay readable on both dark and bright backgrounds.
- Quirk effects (lightning, fire, ice, sparks) only on or within a hand's width of the body, semi-transparent at the outer edge. No large glow around the figure.

## Fixes for characters that went wrong before

An earlier version cut each character out of a landscape scene with an automatic remover. These need extra care:

| Theme | Problem | Required fix |
|---|---|---|
| `bakugo` | Dark costume and explosions merged with the scene. Almost nothing survived. | Light rim and crisp outline around the whole body. Small sparks close to the hands only. |
| `tokoyami` | Black feathers and cloak vanished against a dark scene. | Purple-white rim light on the beak, feathers and cloak edges. Dark Shadow aura thin and attached to the body. |
| `shigaraki` | Only the head and a hand survived. The dark jacket was lost. | Full head, hand-on-face pose, shoulders and dark jacket with a lighter rim. No ruins or debris. |
| `kaminari` | A factory tower stayed attached. | Character and lightning only. No tower, pipe or railing. |
| `kirishima` | Rubble stayed attached. | Character only. No rock, debris or ground. |
| `momo` | A tower strip stayed behind her. | Character and her creation items only. |
| `aoyama` | A dark banner glyph stayed beside the head. | Character, cape and sparkles near the body only. No banner or pillar. |
| `hagakure` | Gloves and boots came out as three tiny separate pieces. | Floating gloves and boots arranged as one large readable group. A faint translucent outline of the invisible body is allowed to tie them together. |
| `ojiro`, `sato`, `sero`, `shinzo`, `shoji`, `uraraka` | No reference scene exists. | Create a scene-style pose like the others. |

## Hero prompt

Read identity and theme colours from `themes/<key>/theme.json`. Check ambiguous identities against the official anime character catalogue. Use the actual anime character, not an anonymous hero or a real-world person with the same name. Where it exists, use `themes/_generated/_background-archive/<key>/bg.png` as a reference for pose and costume only (never its scenery), and the existing `themes/_generated/<key>/claude.png` for face and colours.

```
One large isolated colour anime illustration of the actual My Hero Academia character {character}, three-quarter
view from the waist up (or full body where the scene reference shows it), a dynamic confident pose facing toward
the left of the frame, body on the right side of the canvas with the head in the upper half.
Faithful canonical face, hair, skin, mask and costume: {character_details}. Consistent crisp linework and restrained
cel shading, the same style as the existing portraits. Theme accents {accent} and {secondary}, retaining the
character's real colours. {theme_specific_fix}
A thin, clean light rim along the outer edge of the whole silhouette. The body may run off the right and bottom
edges. Leave clear headroom (at least 8% of the image height) above the head.
Quirk effects only on or within a hand's width of the body, semi-transparent at their outer edge.
ABSOLUTELY NO background: no sky, city, building, tower, floor, ground, rubble, water, plants, banner, frame, border,
vignette, floor shadow, gradient or scene. True transparent alpha background, not a drawn checkerboard.
No added text, logos, watermark, UI or collage. Age-appropriate nonsexual character illustration.
```

If the tool cannot return real transparency, generate the same picture on one perfectly flat colour that appears nowhere in the character (`#ff00ff` magenta, or `#00ff00` for a magenta-heavy character), with no gradient, shadow or glow on the background. Save it as `hero-flat.png` and note it in the manifest. Claude will key it out.

## Quick self-check before recording

Each saved file opens, has a transparent (or flat single-colour) background, shows the whole head with headroom, and contains no scenery. Note anything that fails in the manifest instead of retrying more than once.

## Portrait prompt (existing, unchanged)

Used only for the square avatar portraits that already exist. Do not run it again unless the user asks for a specific character.

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

## Portrait generation-stage checks (existing)

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
