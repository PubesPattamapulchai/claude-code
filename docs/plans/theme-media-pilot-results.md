# Theme media pilot results

Historical record: the user approved the character artwork and subsequently requested the original colour-based generated backgrounds. The six active pilot backgrounds have been archived, and ongoing work generates and stages transparent portraits only. See [the current plan](theme-media-generation.md).

Status: generated and installed; technical checks passed. User visual review is pending.
The remaining 102 themes and separate expressions, animation or video have not started.

## Delivered assets

- Six pilot themes: `deku`, `bakugo`, `todoroki`, `hagakure`, `tokoyami`, `shigaraki`.
- Exactly 12 built-in image generation attempts: 12 successful outputs, no regeneration or paid API fallback.
- Each theme has `bg.webp` plus `claude.png`, `thinking.png`, `done.png` and `error.png`: 30 installed media files.
- Each background is a 1280x720 still WebP. Each portrait is a 384x384 PNG with real alpha transparency and circular-crop margins.
- The same portrait bytes are used for all four character slots in each theme. All portrait files are under 1 MB.
- Installed media totals 3,821,810 bytes (3.64 MiB), excluding QA screenshots.
- All installed media and QA PNGs are Git-ignored. No app code or `theme.json` changed.

The exact 12 prompts, reference pages, installed paths and postprocessing are recorded in [the prompt set](theme-media-pilot-prompts.json). The built-in tool was used throughout; original generated outputs remain at its default save location, and final assets are installed in this workspace.

## Local visual review

![Six-theme overview](../../themes/_pilot/overview.png)

| Theme | Installed media folder | In-app desktop preview |
|---|---|---|
| Deku | `themes/deku/` | [Preview](../../themes/_pilot/deku-preview.png) |
| Bakugo | `themes/bakugo/` | [Preview](../../themes/_pilot/bakugo-preview.png) |
| Todoroki | `themes/todoroki/` | [Preview](../../themes/_pilot/todoroki-preview.png) |
| Hagakure | `themes/hagakure/` | [Preview](../../themes/_pilot/hagakure-preview.png) |
| Tokoyami | `themes/tokoyami/` | [Preview](../../themes/_pilot/tokoyami-preview.png) |
| Shigaraki | `themes/shigaraki/` | [Preview](../../themes/_pilot/shigaraki-preview.png) |

[Narrow-window preview](../../themes/_pilot/shigaraki-narrow-preview.png).

Review attention: Tokoyami has dark feathers and clothing, so judge portrait readability at small sizes. Hagakure deliberately uses floating gloves and, in the background, boots to represent her invisible hero form. All backgrounds place the main subject toward the right; narrow-window cropping can remove much of that subject, as agreed.

## Validation performed

- Confirmed all 108 theme definitions are still discovered; only the six pilot themes received media.
- Decoded every background and portrait, checked dimensions and portrait alpha (transparent corners and visible pixels), and verified the shared portrait files have identical SHA-256 hashes within each theme.
- Verified the app discovers all five slots for every pilot theme, and `git check-ignore` accepts every installed file.
- In the real app, checked every pilot background, title portrait, existing assistant message portraits, thinking portrait, completion popup and error popup. All image decodes succeeded. The user's avatar stayed unchanged.
- Checked all six themes in desktop layout and at a measured 420x800 CSS viewport. Narrow chat avatars measured 40 px, desktop chat avatars approximately 52 px and title portraits approximately 46 px. No horizontal page overflow was found.
- Triggered the app's existing `visibilitychange` rotation handler to move to Bakugo; existing assistant rows and the thinking row updated to Bakugo's image files.
- Captured local in-app screenshots for all six themes. Browser capture padding was cropped for previews and the overview; app content was not redesigned.
- No browser console warnings or errors were recorded by the tab log inspection. No code changes required a unit-test run.
- QA used sample DOM messages and a separate local server with an empty session home; no model conversation was submitted. Temporary clock overrides, sample messages and viewport changes were cleared after verification.

## Review gate

Review the screenshots or reload the normal app to load the new media list. The app still rotates through all 108 themes; the other 102 keep their existing generated art and emoji fallbacks.
Stop here for the user's visual review. The generation cap is fully used: 12/12. Further generation, corrections that need generation, bulk expansion and separate expressions need the next agreed scope.
