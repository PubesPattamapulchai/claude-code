# Theme character image generation plan (for Codex)

Goal: every one of the 62 themes gets two pictures of the actual anime character, both made by Codex with the built-in image tool:

1. `claude.png`, a square head-and-shoulders **portrait**. The app uses it for the small chat avatars and the title logo.
2. `hero.png`, a large **hero** image with a transparent background. The app draws it big on the right side of its own generated manga background.

Everything after generation (cropping, resizing, converting, installing into theme folders, app code, tests, in-app checks) is done by Claude, not Codex. Codex only generates, saves into the staging folder and records the result in the manifest.

## Status at a glance (updated after the first 22 characters were installed)

| Group | Count | What to do |
|---|---|---|
| Finished and installed (portrait and hero both done) | 62 | Nothing. Do not regenerate. |
| Hero must be redone | 0 | None. `ashido` and `aoyama` were checked in the real app and accepted. |
| Not generated yet (no portrait, no hero) | 0 | The other 40 were generated, checked and installed. |

The 22 characters that already exist: `aoyama`, `ashido`, `asui`, `bakugo`, `deku`, `hagakure`, `iida`, `jiro`, `kaminari`, `kirishima`, `koda`, `mineta`, `momo`, `ojiro`, `sato`, `sero`, `shinzo`, `shoji`, `todoroki`, `tokoyami`, `uraraka`, `shigaraki`. Their portraits are all final. Their heroes are all final except the two in the redo list.

Total remaining work: none.

## Scope and ground rules

- Save every image under `themes/_generated/<key>/`. That staging tree has no `theme.json`, so the app never loads it.
  - `themes/_generated/<key>/claude.png`: the portrait.
  - `themes/_generated/<key>/hero.png`: the hero.
- **Never skip an entry that is not finished, and never redo an entry that is.** An entry is finished when its manifest status is `complete` and Claude has not marked it `redo`. Work only on entries whose status is `pending` or `redo`.
- Do not touch the 22 existing portraits (`claude.png`) or the 20 finished heroes. Do not rename, restyle or regenerate them.
- Do not crop, resize, convert, install or copy anything into the theme folders. Do not change app code or any `theme.json`.
- Do not generate anyone outside the work list and the redo list.
- Use the built-in image generation tool only. No paid service or API fallback.
- Record each image in [the batch manifest](theme-media-generation-batch.json) as soon as it is saved (prompt, path, checks, notes, status). Then continue with the next entry. Stop when the lists are empty.
- Media stays local and Git-ignored. Never force-add it.

### Suggested order

1. Redo list (2 heroes).
2. Batch A: `tamaki`, `nejire`, `mirio`, `banjo`, `brucelee`, `kudo`, `yoichi`, `nana`, `shinomori`, `en`.
3. Batch B: `aizawa`, `allmight`, `midnight`, `presentmic`, `bestjeanist`, `edgeshot`, `endeavor`, `fatgum`, `grantorino`, `hawks`, `kamuiwoods`, `mirko`, `mtlady`, `ryukyu`, `starandstripe`.
4. Batch C: `dabi`, `garaki`, `gentle`, `labrava`, `ladynagant`, `mrcompress`, `overhaul`, `redestro`, `allforone`, `kurogiri`, `skeptic`, `spinner`, `stain`, `toga`, `twice`.

For each character make the portrait first, then the hero, so the hero can use the portrait for face and colours. Claude processes finished images while Codex keeps working, so recording each one right away matters.

## What the finished set looks like (lessons from the first 22)

Codex produced good heroes when it followed these. Keep doing the same.

- A single character, three-quarter view, body on the right, head in the upper half, facing left, a dynamic pose, drawn from the waist up (or full body when that reads better).
- Real transparent alpha. The first 22 all came back with true transparency, so the flat-colour fallback has not been needed.
- Canvas size does not matter. Landscape (1536x1024), portrait (1024x1536) and other sizes all worked. Claude crops to the visible character, so spend the canvas on the character, not on empty space. Keep the longest side at 1024 px or more.
- Quirk effects stayed close to the body in the good results (Deku, Todoroki, Kaminari). Keep it that way.
- No scenery. The earlier rubble, towers, pillars and banners were all removed by regenerating from scratch, so regenerate rather than patching.

## Hero framing rules

- Character on the right of the canvas, head in the upper half, three-quarter view facing left. The body may run off the right and bottom edges.
- **The head must never touch or cross the top edge.** Measured test Claude runs: no opaque pixel in the top 3 pixel rows, and the first opaque row should be at least 8% down from the top (the good results had 8% to 22%; aim for 12% or more). Hair spikes, horns, ears, ponytails, hats, antennae and wings all count as part of the head.
- Keep the face and important details out of the lowest quarter. The chat input covers part of that area.
- A thin, clean light rim and a crisp dark outline on the whole silhouette (see "Colour and contrast").
- Quirk effects only on or within a hand's width of the body, semi-transparent at the outer edge. No large glow or aura around the figure. A glow that fades slowly into transparency turns into a visible haze over the background.
- The body should read as one piece. Do not leave floating fragments away from the body, except small quirk sparks.
- Age-appropriate, non-suggestive depiction for every character, whatever their costume. Pose and framing stay heroic and neutral.
- No weapons aimed at the viewer, no blood, no violence. Characters who carry weapons hold them low, sheathed or at rest.
- Characters who are giants or transform (Mt. Lady, Ryuko Tatsuma, All Might) are drawn at normal human size in their usual form.

## Colour and contrast (read this before every character)

The app paints a different generated background behind each hero, made from the theme's two colours (`accent`, `secondary`). Two kinds exist:

- **Dark-tinted** (52 themes: styles `checker-pop`, `comic-grid`, `diagonal-stripes`, `halftone-burst`, `speed-lines`). The base is a dark navy ink mixed with the theme colours, with translucent white shapes on top. Dark characters (black costume, navy, dark purple, black hair) can sink into it.
- **Bright** (10 themes: style `sunburst`). Alternating pastel rays made from the theme colours mixed with white. Pale characters (white, cream, blond, light pink, light blue) can disappear into it.

The table in each work list says which kind a character gets. Handle each character by these rules.

1. **Every hero gets a double edge.** A dark ink outline (about #14142a, 2 to 3 px at full size) on the outside, and a thin light rim just inside it. The outline protects pale characters on bright backgrounds. The rim protects dark characters on dark backgrounds.
2. **Dark character on a dark-tinted background** (black or navy costume, black hair, dark feathers, dark mist): make the rim strong and bright, in a colour that is clearly lighter than both the character and the background. White, pale lavender, pale cyan or pale gold all work. Add lighter mid-tone folds inside the costume so it does not read as one flat black shape.
3. **Pale character on a bright background** (white hair or clothes, blond hair, light pink, light blue, cream): make the outline dark and a little thicker (3 px), use a visible mid-tone cel shadow (not only white and light grey), and avoid large flat white areas.
4. **Character colour close to the theme colour** (red costume on a red theme, blue denim on a blue theme, yellow on a yellow theme, pink on a pink theme): keep the canonical colour but change the **shading and the details**. Use a clearly darker shade of the same hue for the shadows, add the character's canonical accent colour in belts, trim, gloves and hair so the figure breaks up, and keep the dark outline and light rim. Never recolour the costume to avoid the clash. Identity comes first.
5. **Quirk effects in the theme colour** (blue flames on a blue theme, red feathers on a red theme, yellow lightning on a yellow theme): give the effect a white or very pale hot core, keep its shape compact and sharply drawn, and keep the dark outline. A bright core always reads on a dark-tinted background. Keep it small.
6. **Never rely on the background to separate the figure.** Assume the hero is seen on the dark-tinted background and on the bright one. The double edge must make it readable on both.
7. Portraits (`claude.png`) are shown small, on the app's dark ink. Rim light and generous margins matter more than outline weight.

## Redo list

Empty. Every hero is accepted.

## The 20 finished heroes (do not redo)

Claude checked every finished hero for clipping, haze, scenery and colour clash. All of these are accepted. The notes record what Claude saw so nothing is repeated by mistake.

| Theme | Background kind | Result |
|---|---|---|
| `aoyama` | dark | Accepted. Navy cape with gold trim reads well. |
| `ashido` | dark | Accepted. Pink skin has a visible darker pink shadow. |
| `asui` | dark | Accepted. Pale gloves and goggles carry the figure. |
| `bakugo` | dark | Accepted. Black tank top has a light rim, sparks stay near the hands. |
| `deku` | dark | Accepted. Green lightning stays on the forearm. |
| `iida` | dark | Accepted. Blue speed effect is wider than a hand in places, but it stays readable. |
| `jiro` | dark | Accepted. Dark jacket has a rim. |
| `kaminari` | dark | Accepted. Lightning stays near the arms. |
| `koda` | bright | Accepted. |
| `mineta` | dark | Accepted. Yellow gloves and scarf break up the purple suit. |
| `momo` | dark | Accepted. |
| `ojiro` | dark | Accepted. White gi reads well on the dark background. |
| `sato` | dark | Accepted. |
| `sero` | dark | Accepted. |
| `shinzo` | bright | Accepted. |
| `shoji` | bright | Accepted. Four hands are clearly drawn and the extra arms overlap the body, which is fine for the app. |
| `todoroki` | dark | Accepted. Fire and ice stay in the hands. |
| `tokoyami` | dark | Accepted, but it is the darkest figure on a dark purple background, so Claude will check it in the app. |
| `uraraka` | dark | Accepted. |
| `shigaraki` | bright | Accepted. Dark jacket on a bright background. |

## Work list (40 characters, portrait and hero each)

Rules for this table:

- **Cues** are a starting hint only. The official anime design wins. Check each character against an official source (the anime's official character page, or the official character wiki) before drawing. Write the source URL in the manifest `notes`.
- Anything marked **(verify)** is something the author is not sure about. Do not copy it blindly. Confirm it first.
- If no reliable source exists for a minor character, use the most widely shown anime design and say so in the manifest `notes`.
- Draw the actual anime character, not a real person with a similar name.

### Big 3 and One For All (10)

| key | Character | Cues | App background | Colour handling |
|---|---|---|---|---|
| `tamaki` | Tamaki Amajiki, Suneater | Tall, slim, hunched. Long messy dark blue-black hair, pale hollow face, large eyes with dark rings, nervous expression. Costume per the official design (verify). | bright (sunburst) | Dark hair and dark costume read well on bright rays. Keep the dark outline and add a few lighter blue highlights in the hair so it is not a flat mass. |
| `nejire` | Nejire Hado | Very long wavy light-lavender or periwinkle hair, very large light-blue eyes, bright curious smile. Costume per the official design (verify). | bright (sunburst) | Pale blue hair on pale blue rays can disappear. Dark outline 3 px, deeper blue-violet shadow in the hair, a few darker strands. Do not recolour the hair. |
| `mirio` | Mirio Togata, Lemillion | Short upswept blond hair, blue eyes, wide confident grin, athletic build. Costume per the official design (verify). | bright (sunburst) | Blond hair on a yellow background is the problem. Use an orange-brown shadow tone in the hair, a dark outline 3 px, and make sure the costume has its dark and light parts clearly separated. |
| `banjo` | Banjo, a One For All holder | Identify the official design (verify). Draw the character in a ready stance. | dark (checker-pop) | Purple theme. Avoid dark purple clothing blending in: strong light rim and a lighter highlight colour from the canon costume. |
| `brucelee` | Bruce Lee (the martial-artist One For All holder shown as `Bruce Lee` in the app) | Identify the official design and name (verify). Martial-arts stance. Do not draw the real-world actor. | bright (sunburst) | Orange and yellow theme. If the costume is yellow or orange, add darker brown-orange shading and keep the outline and rim. |
| `kudo` | Kudo, a One For All holder | Identify the official design (verify). | dark (speed-lines) | Grey-blue theme. Light rim on any dark armour or clothing. |
| `yoichi` | Yoichi Shigaraki, the first One For All holder | Identify the official design (verify). Young, gentle; period clothing. | dark (diagonal-stripes) | Pale cream theme tinted dark. Pale clothing reads well. Check dark hair has a rim. |
| `nana` | Nana Shimura | Identify the official design (verify). Determined expression, heroic stance. | dark (checker-pop) | Brown theme. Light rim on dark hair and dark costume parts. |
| `shinomori` | Hikage Shinomori | Ninja look, mask over the lower face (verify). | dark (checker-pop) | Dark ninja clothes on a dark purple background: bright lavender-white rim, lighter folds in the cloth, visible eyes and hands. |
| `en` | En, a One For All holder | Identify the official design (verify). Do not assume a gender before checking. | dark (speed-lines) | Purple theme. Strong rim on dark clothing, clear face. |

### U.A. faculty (4)

| key | Character | Cues | App background | Colour handling |
|---|---|---|---|---|
| `aizawa` | Shota Aizawa, Eraser Head | Shoulder-length messy black hair, stubble, dark rings under the eyes, yellow-tinted goggles worn up on the forehead or around the neck, long pale grey capture scarf wrapped around the neck, black costume with a utility belt. | dark (speed-lines) | Black costume on a dark grey background: bright rim and lighter folds. The scarf is grey and so is the theme, so draw it lighter (off-white) with clear mid-grey folds. |
| `allmight` | Toshinori Yagi, All Might (muscle form) | Huge V-shaped build, two long upswept blond bangs, blue eyes, huge grin, classic hero costume as on the official page (verify the colours). | dark (checker-pop) | Blue costume on a blue theme. Keep the canonical blue but use a darker blue shadow, show the white and red-gold parts of the costume, and add a white rim. Fist or open-hand pose. |
| `midnight` | Nemuri Kayama, Midnight | Long wavy dark hair with a violet tint, confident smile, her hero costume per the official design (verify). Elegant, non-suggestive pose. | dark (checker-pop) | Purple costume and hair on a purple theme: add pale pink-white highlights in the hair and a light rim. |
| `presentmic` | Hizashi Yamada, Present Mic | Tall, upswept blond hair, large tinted sunglasses, big audio-themed headgear or collar, black costume with audio details (verify). | dark (halftone-burst) | Yellow hair on a yellow theme tinted dark: fine. Give the black costume a bright rim and lighter folds. Sound effects stay within a hand's width. |

### Pro heroes (11)

| key | Character | Cues | App background | Colour handling |
|---|---|---|---|---|
| `bestjeanist` | Tsunagu Hakamata, Best Jeanist | Long swept blond hair, calm confident face, costume made of blue denim (verify). | dark (comic-grid) | Blue denim on a blue theme. Use lighter washed-denim highlights, canonical orange stitching, a darker navy shadow, white rim. |
| `edgeshot` | Shinya Kamihara, Edgeshot | Slim ninja with a mask over the lower face, dark costume (verify). | dark (diagonal-stripes) | The theme is nearly black. Strongest rim of the set: silver-white, along the whole body, with lighter fold highlights in the cloth. Show the hands and the eyes. |
| `endeavor` | Enji Todoroki, Endeavor | Huge muscular man, hair and beard made of flames, burn scar around one eye, stern scowl, dark costume with flames (verify). | dark (checker-pop) | Orange and red flames on a red theme. Give the flames a white-yellow core and a dark outline. Keep the flames short and attached to the head, shoulders and hands. |
| `fatgum` | Taishiro Toyomitsu, Fat Gum | Very large round man with a friendly round face and big cheerful grin, hero costume (verify). | dark (checker-pop) | Gold and orange theme. Add darker orange shadows and a clear outline. |
| `grantorino` | Sorahiko Torino, Gran Torino | Small elderly man with a moustache, hero costume (verify). | dark (diagonal-stripes) | Teal-blue theme. Light rim on dark costume parts, keep a clear face. |
| `hawks` | Keigo Takami, Hawks | Short swept-up blond hair, sharp golden eyes (verify), large red feather wings, hero costume (verify). | dark (checker-pop) | Red wings on a red-pink theme. Dark outline on every feather group, orange and gold highlights on the feather tips, a light rim. Keep the wings compact and attached, no huge spread. |
| `kamuiwoods` | Shinji Nishiya, Kamui Woods | Wooden hero: body and head made of wood, leaf-like details (verify). | dark (diagonal-stripes) | Brown wood on a brown theme. Use pale yellow-tan highlights on the wood grain, bright green leaf details, a strong light rim. |
| `mirko` | Rumi Usagiyama, Mirko | Long white hair, tall white rabbit ears, tan skin, red eyes, athletic build. Heroic, non-suggestive framing. | dark (checker-pop) | The theme colour is white, so the background is a mid-grey tint. White hair and ears will not stand out unless you add shading: add clear blue-grey cel shadows and a dark outline 3 px. |
| `mtlady` | Yu Takeyama, Mt. Lady | Normal human size, her hero costume per the official design (verify). | dark (speed-lines) | Yellow theme. Dark outline, and avoid pale yellow merging with yellow rays. |
| `ryukyu` | Ryuko Tatsuma, Ryukyu | Human form at normal size, dragon-themed costume (verify). | dark (diagonal-stripes) | Blue theme. Light rim on dark parts, lighter scale highlights. |
| `starandstripe` | Cathleen Bate, Star and Stripe | Blond hair, red, white and blue star-and-stripe costume (verify), confident stance. | dark (halftone-burst) | Red and blue costume on a red and blue theme. Use white stars and stripes, gold trim, a dark outline and a white rim. |

### Villains (15)

| key | Character | Cues | App background | Colour handling |
|---|---|---|---|---|
| `dabi` | Touya Todoroki, Dabi | Black spiky hair, blue eyes, burn-scarred skin with staple marks along the jaw and neck, dark coat, blue flames. | dark (comic-grid) | Blue flames on a blue theme. White-blue hot core, dark outline, flames compact and attached to hands. Black hair and coat get a strong rim. |
| `garaki` | Kyudai Garaki, Dr. Garaki | Elderly, hunched, white hair, white lab coat (verify). | dark (speed-lines) | White coat is fine on the dark green. Add mid-tone folds so it is not flat. |
| `gentle` | Gentle Criminal | Tall slim man with a top hat and a mask, long coat (verify). | dark (diagonal-stripes) | Dark green theme. Rim on the dark coat and hat. |
| `labrava` | Manami Aiba, La Brava | Young woman, cheerful (verify design). | bright (sunburst) | Pink on a pink bright background. Dark outline 3 px, darker pink shadows, a canonical accent colour in the clothes. |
| `ladynagant` | Kaina Tsutsumi, Lady Nagant | Verify design. Any weapon is held low and never aimed at the viewer. | dark (speed-lines) | Pink and green theme. Strong rim on dark clothes. |
| `mrcompress` | Atsuhiro Sako, Mr. Compress | Theatrical magician look: top hat, mask, bow tie (verify). | dark (speed-lines) | Dark red theme. Black suit needs a bright rim and lighter folds. White gloves help. |
| `overhaul` | Kai Chisaki, Overhaul | Beak-style plague-doctor mask, black clothes, gloves (verify). | dark (comic-grid) | Black clothes on a dark charcoal background: bright rim, lighter folds, show the mask clearly. |
| `redestro` | Rikiya Yotsubashi, Re-Destro | Verify design. | dark (comic-grid) | Dark red and brown theme. Light rim, lighter highlight colour from the canon costume. |
| `allforone` | All For One | Tall imposing man in a dark suit and a dark face mask (verify). | dark (halftone-burst) | Darkest figure of the set on a dark purple background. Strong pale-lavender rim along the whole body, lighter folds, clearly drawn mask. |
| `kurogiri` | Kurogiri | Body of black mist, glowing yellow eyes, metal collar and bow-tie parts (verify). | dark (comic-grid) | Black mist on a dark background. Pale-lavender rim along the mist edge, lighter wisps, bright yellow eyes. Mist stays attached to the body, no wide cloud, and no mist background. |
| `skeptic` | Skeptic Salvation | Verify design. | dark (diagonal-stripes) | Cyan theme. Light rim on dark parts. |
| `spinner` | Shuichi Iguchi, Spinner | Lizard-themed mask and gear (verify). | dark (diagonal-stripes) | Dark red and green theme. Light rim, lighter highlights. |
| `stain` | Stain, the Hero Killer | Long wild dark hair, red scarf, many blades. Show blades sheathed or held low. No blood, no aggression toward the viewer. | bright (sunburst) | Red scarf and clothing on bright red rays. Dark outline 3 px, a darker crimson for the scarf shadows, show the black clothes and straps clearly. |
| `toga` | Himiko Toga | Messy blond twin buns, yellow slit-pupil eyes, small canine tooth, sailor-style school uniform with cardigan. Cheerful smile. No blood and no knives. | dark (speed-lines) | Pink theme. The navy uniform needs a bright rim. |
| `twice` | Jin Bubaigawara, Twice | Verify design. | dark (checker-pop) | Cyan theme. Dark outline, pale parts get mid-tone shadows. |

For the exact background style of each theme, see the 62-theme table at the end of this file.

## Hero prompt

Read identity and theme colours from `themes/<key>/theme.json` and from the work list above. Check ambiguous identities against the official character catalogue. Use the actual anime character. Use the portrait (`themes/_generated/<key>/claude.png`) as the reference for face and colours. For a redo, you may also look at the existing `themes/_generated/<key>/hero.png`, but regenerate from scratch.

```
One large isolated colour anime illustration of the actual My Hero Academia character {character}, three-quarter
view from the waist up (or full body when it reads better), a dynamic confident pose facing toward the left of
the frame, body on the right side of the canvas with the head in the upper half.
Faithful canonical face, hair, skin, mask and costume: {character_details}. Consistent crisp linework and
restrained cel shading, the same style as the existing finished heroes. Theme accents {accent} and {secondary},
retaining the character's real colours. {colour_handling}
A dark ink outline (about 2 to 3 px) around the whole silhouette, with a thin clean light rim just inside it,
so the figure reads on both dark and bright backgrounds.
The body may run off the right and bottom edges. Leave clear empty headroom above the head, at least 12% of the
image height. Hair, horns, ears, hats, antennae and wings stay fully inside the canvas.
Quirk effects only on or within a hand's width of the body, semi-transparent at their outer edge, never a wide glow.
ABSOLUTELY NO background: no sky, city, building, tower, floor, ground, rubble, water, plants, banner, frame,
border, vignette, floor shadow, gradient or scene. True transparent alpha background, not a drawn checkerboard.
No added text, logos, watermark, UI or collage. Age-appropriate, non-suggestive character illustration.
```

If the tool cannot return real transparency, generate the same picture on one perfectly flat colour that appears nowhere in the character (`#ff00ff` magenta, or `#00ff00` for a magenta-heavy character), with no gradient, shadow or glow on the background. Save it as `hero-flat.png` and note it in the manifest. Claude will key it out. (This was not needed for the first 22.)

## Portrait prompt

Used for every character in the work list. The 22 existing portraits are final and are not regenerated.

```
One square isolated head-and-shoulders colour anime portrait of the actual My Hero Academia character {character}.
Faithful canonical face, hair, skin, mask and costume: {character_details}. New pose, consistent crisp
linework and restrained cel shading across the series. Theme accents {accent} and {secondary}, retaining
the character's actual colours. {colour_handling} Respect nonhuman heads and covered or invisible faces.
Centre identifying features with generous margins for a circular crop; readable at 40 px.
Subtle rim light separates dark features from a dark UI. True transparent alpha background, not a
drawn checkerboard, opaque scene or circular badge. No added text, logos, watermark, UI or collage.
Age-appropriate, non-suggestive character illustration.
```

Size: at least 1024 x 1024 (the existing ones are 1254 x 1254).

## Self-check before recording an image

1. The file opens and has a real alpha channel (transparent corners).
2. The whole head is inside the canvas with empty space above it. For a hero, at least 12% empty headroom, and nothing opaque in the top 3 pixel rows.
3. No scenery, no floor, no ground shadow, no frame, no text, no collage.
4. No broad glow or haze. Quirk effects stay within a hand's width of the body.
5. Identity matches the official design (face, hair, costume, accessories). Colours match the canon.
6. The double edge (dark outline plus light rim) is visible, and the figure still reads when you imagine it on a dark and on a bright background.
7. The figure is not a flat black or flat white mass. There are mid-tone folds and shadows.

If a check fails, fix it with one retry at most. If it still fails, save the best result, set the status to `needs_review` and describe the problem in `notes`. Do not loop.

## Manifest fields

For each entry in [the batch manifest](theme-media-generation-batch.json):

- `status`: `pending` (not started), `redo` (regenerate), `complete`, or `needs_review` (saved but a self-check failed). Codex changes `pending` or `redo` to `complete` or `needs_review` after saving.
- `assets`: which pictures this entry needs: `["claude", "hero"]` or `["hero"]`.
- `portrait`: `{ "destination", "prompt", "status", "notes" }` for the portrait.
- `hero`: `{ "destination", "prompt", "status", "checks", "notes" }` for the hero.
- `notes`: source URL used for identity, plus anything unusual.
- Keep the existing `destination`, `prompt`, `checks` and `notes` on entries that were finished before this update. Do not delete them.

Claude fills `claude_review` after it processes an image (`accepted` or `redo` with a reason).

## Portrait generation-stage checks (existing)

1. Confirm each requested theme has a staged `claude.png`.
2. Check file signatures, decoding, dimensions and actual alpha transparency. Record any exceptions.
3. Visually check character identity and consistent style; retain raw originals for later sizing and crop adjustments.
4. Confirm staged media is Git-ignored and nothing was installed into active theme folders.

## Prior pilot record

The original pilot used 12 generation attempts for six backgrounds and six portraits. See [pilot results](theme-media-pilot-results.md) and [pilot prompt set](theme-media-pilot-prompts.json) for that historical record. Its background-image requirement has been superseded by the current scope.

## The 62 themes (in app order)

`key`, hero, group, the two theme colours, the emoji used today, whether it is a villain theme, the generated background style (and whether it is dark-tinted or bright), and the state of the portrait and the hero.

| key | hero | group | accent | secondary | emoji | villain | background | portrait | hero image |
|---|---|---|---|---|---|---|---|---|---|
| `aoyama` | Can't Stop Twinkling | Class 1-A | #ffd700 | #ffff00 | 💫 | no | checker-pop (dark) | done | done |
| `ashido` | Pinky | Class 1-A | #ff87ff | #ff5faf | 🧪 | no | checker-pop (dark) | done | done |
| `asui` | Froppy | Class 1-A | #00af00 | #5fff00 | 🐸 | no | comic-grid (dark) | done | done |
| `bakugo` | Dynamight | Class 1-A | #ff8700 | #ffaf00 | 💥 | no | diagonal-stripes (dark) | done | done |
| `deku` | Deku | Class 1-A | #00ff00 | #00ffff | ✊ | no | diagonal-stripes (dark) | done | done |
| `hagakure` | Invisible Girl | Class 1-A | #d7ffff | #afffff | 🫥 | no | comic-grid (dark) | done | redo |
| `iida` | Ingenium | Class 1-A | #005fff | #0087ff | 🦿 | no | diagonal-stripes (dark) | done | done |
| `jiro` | Earphone Jack | Class 1-A | #af87ff | #875fff | 🎧 | no | halftone-burst (dark) | done | done |
| `kaminari` | Chargezuma | Class 1-A | #ffff00 | #ffd700 | ⚡ | no | comic-grid (dark) | done | done |
| `kirishima` | Red Riot | Class 1-A | #ff5f00 | #ff8700 | 🪨 | no | comic-grid (dark) | done | redo |
| `koda` | Anima | Class 1-A | #005f00 | #5f875f | 🦉 | no | sunburst (bright) | done | done |
| `mineta` | Grape Juice | Class 1-A | #af00ff | #8700ff | 🟣 | no | comic-grid (dark) | done | done |
| `ojiro` | Tailman | Class 1-A | #875f00 | #af875f | 🐒 | no | diagonal-stripes (dark) | done | done |
| `sato` | Sugarman | Class 1-A | #d78700 | #ffaf00 | 🍬 | no | comic-grid (dark) | done | done |
| `sero` | Cellophane | Class 1-A | #d7af00 | #d7af00 | 📼 | no | diagonal-stripes (dark) | done | done |
| `shinzo` | NightHide | Class 1-A | #8700ff | #5f5f87 | 🧠 | no | sunburst (bright) | done | done |
| `shoji` | Tentacole | Class 1-A | #5f5fff | #5f5f87 | 🐙 | no | sunburst (bright) | done | done |
| `todoroki` | Shoto | Class 1-A | #00d7ff | #00afff | ❄️ | no | checker-pop (dark) | done | done |
| `tokoyami` | Tsukuyomi | Class 1-A | #5f0087 | #8700d7 | 🌑 | no | diagonal-stripes (dark) | done | done |
| `uraraka` | Uravity | Class 1-A | #ff87af | #87d7ff | 🪐 | no | diagonal-stripes (dark) | done | done |
| `momo` | Creati | Class 1-A | #d70000 | #ffd7af | ✨ | no | comic-grid (dark) | done | done |
| `tamaki` | Suneater | Big 3 | #875faf | #5f5f87 | 🍽️ | no | sunburst (bright) | todo | todo |
| `nejire` | Nejire-chan | Big 3 | #00afff | #00d7ff | 🌀 | no | sunburst (bright) | todo | todo |
| `mirio` | Lemillion | Big 3 | #ffd700 | #ffff00 | 👻 | no | sunburst (bright) | todo | todo |
| `banjo` | Banjo | One For All | #5f00af | #af00ff | 〰️ | no | checker-pop (dark) | todo | todo |
| `brucelee` | Bruce Lee | One For All | #ffaf00 | #ff8700 | 🥋 | no | sunburst (bright) | todo | todo |
| `kudo` | Kudo | One For All | #5f87af | #8787af | ⚙️ | no | speed-lines (dark) | todo | todo |
| `yoichi` | Yoichi | One For All | #ffd7af | #ffffd7 | 🕊️ | no | diagonal-stripes (dark) | todo | todo |
| `nana` | Nana Shimura | One For All | #af5f00 | #ffaf87 | 🪽 | no | checker-pop (dark) | todo | todo |
| `shinomori` | Shinomori | One For All | #5f0087 | #875f87 | 🥷 | no | checker-pop (dark) | todo | todo |
| `en` | En | One For All | #875f87 | #af87d7 | 💨 | no | speed-lines (dark) | todo | todo |
| `aizawa` | Eraser Head | U.A. Faculty | #767676 | #5f5f87 | 🧣 | no | speed-lines (dark) | todo | todo |
| `allmight` | All Might | U.A. Faculty | #0087ff | #0087ff | 💪 | no | checker-pop (dark) | todo | todo |
| `midnight` | Midnight | U.A. Faculty | #af00ff | #8700ff | 🌙 | no | checker-pop (dark) | todo | todo |
| `presentmic` | Present Mic | U.A. Faculty | #ffff00 | #ffd700 | 🎤 | no | halftone-burst (dark) | todo | todo |
| `bestjeanist` | Best Jeanist | Pro Heroes | #005faf | #5f87af | 🧵 | no | comic-grid (dark) | todo | todo |
| `edgeshot` | Edgeshot | Pro Heroes | #00005f | #005f87 | 🥷 | no | diagonal-stripes (dark) | todo | todo |
| `endeavor` | Endeavor | Pro Heroes | #ff0000 | #ff5f00 | 🔥 | no | checker-pop (dark) | todo | todo |
| `fatgum` | Fat Gum | Pro Heroes | #ffd700 | #ff5f00 | 🍔 | no | checker-pop (dark) | todo | todo |
| `grantorino` | Gran Torino | Pro Heroes | #005f87 | #5f87af | 👴 | no | diagonal-stripes (dark) | todo | todo |
| `hawks` | Hawks | Pro Heroes | #ff005f | #ffd700 | 🪶 | no | checker-pop (dark) | todo | todo |
| `kamuiwoods` | Kamui Woods | Pro Heroes | #875f00 | #008700 | 🌳 | no | diagonal-stripes (dark) | todo | todo |
| `mirko` | Mirko | Pro Heroes | #ffffff | #ffafd7 | 🐰 | no | checker-pop (dark) | todo | todo |
| `mtlady` | Mt. Lady | Pro Heroes | #ffd700 | #ffff00 | 🗼 | no | speed-lines (dark) | todo | todo |
| `ryukyu` | Ryukyu | Pro Heroes | #005faf | #00ffff | 🐲 | no | diagonal-stripes (dark) | todo | todo |
| `starandstripe` | Star and Stripe | Pro Heroes | #ff0000 | #0000ff | 🇺🇸 | no | halftone-burst (dark) | todo | todo |
| `dabi` | Dabi | Villains | #0087ff | #005fff | 🔥 | yes | comic-grid (dark) | todo | todo |
| `garaki` | Dr. Garaki | Villains | #5f875f | #005f00 | 🧪 | yes | speed-lines (dark) | todo | todo |
| `gentle` | Gentle Criminal | Villains | #00875f | #ffd787 | 🎩 | yes | diagonal-stripes (dark) | todo | todo |
| `labrava` | La Brava | Villains | #ff5faf | #ffafaf | 💕 | yes | sunburst (bright) | todo | todo |
| `ladynagant` | Lady Nagant | Villains | #ff5faf | #005f00 | 🎯 | yes | speed-lines (dark) | todo | todo |
| `mrcompress` | Mr. Compress | Villains | #af0000 | #ffffff | 🎪 | yes | speed-lines (dark) | todo | todo |
| `overhaul` | Overhaul | Villains | #d7af00 | #303030 | 🧤 | yes | comic-grid (dark) | todo | todo |
| `redestro` | Re-Destro | Villains | #870000 | #af5f00 | 💰 | yes | comic-grid (dark) | todo | todo |
| `shigaraki` | Shigaraki | Villains | #5f5f87 | #8a8a8a | 🖐️ | yes | sunburst (bright) | done | done |
| `allforone` | All For One | Villains | #5f0087 | #303030 | 👑 | yes | halftone-burst (dark) | todo | todo |
| `kurogiri` | Kurogiri | Villains | #875f87 | #5f5f5f | 🌀 | yes | comic-grid (dark) | todo | todo |
| `skeptic` | Skeptic | Villains | #00d7d7 | #5fd7d7 | 🎮 | yes | diagonal-stripes (dark) | todo | todo |
| `spinner` | Spinner | Villains | #870000 | #005f00 | 🦎 | yes | diagonal-stripes (dark) | todo | todo |
| `stain` | Stain | Villains | #d70000 | #5f0000 | 🗡️ | yes | sunburst (bright) | todo | todo |
| `toga` | Toga | Villains | #ffafd7 | #ff005f | 🩸 | yes | speed-lines (dark) | todo | todo |
| `twice` | Twice | Villains | #00ffff | #d7ffff | 🎭 | yes | checker-pop (dark) | todo | todo |
