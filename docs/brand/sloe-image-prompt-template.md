# Sloe — Canonical Image Generation Prompt Template

> **Status:** LOCKED brand artefact. Owned by `brand-manager`.
> **Engine:** FLUX 2 Pro (Black Forest Labs) via fal.ai. Model-swappable per the strategy doc, but
> these templates are the constant — the prompt does not change when the model does.
> **Authority:** This file is the single source of truth for every Sloe-brand generated image, at
> design-time (the fal/FLUX batch script) and at runtime (the recipe-import "generate an image"
> feature). It operationalises the imagery rules locked in
> [`docs/ux/redesign/_design-system.md` §11](../ux/redesign/_design-system.md) and the Sloe palette in
> [`docs/brand/sloe/sloe-brand.md`](sloe/sloe-brand.md). If §11 and this file ever disagree, §11 wins
> and this file must be corrected.
> **Supersedes:** the prompt fragment in
> [`docs/decisions/2026-05-11-hero-fallback-auto-gen.md`](../decisions/2026-05-11-hero-fallback-auto-gen.md)
> ("Overhead shot of {title}..."). That fragment predates the warm-coaching / Sloe direction and is no
> longer the prompt of record. The hero auto-gen feature, when built, uses Template A below.

---

## How to use this file

Three fill-in-the-blanks templates, one per imagery class:

| Template | Class | Subject | Surfaces |
|---|---|---|---|
| **A** | Finished dish / meal | a plated, cooked recipe | recipe card hero, recipe detail hero, plan meal rows, paywall hero, import success state, onboarding welcome hero, the runtime "generate an image" feature |
| **B** | Single ingredient | one food item or small group | shopping-list rows, verify-screen ingredient rows, log search icons, onboarding diet/allergen tiles, hydration icon |
| **C** | Object / cookware | one tangible kitchen object | empty-state glyphs (saucepan, Dutch oven), "Photo" affordance (camera), jars/bottles |

For each: substitute the `{CAPS_PLACEHOLDERS}`, append the shared **style anchor block**, and pass the
shared **negative prompt** in the `negative_prompt` field. Do not edit the anchor or negative lists per
call — they are what keeps every image one brand. The only per-image variation is the subject
description (and, for Template A, the recipe-derived ingredient list).

**FLUX 2 Pro call shape (fal.ai):** send the assembled positive string as `prompt`, the negative list as
`negative_prompt`, and the fixed generation params in §6. FLUX honours a separate negative prompt — use
it; do not fold "no X" phrases into the positive prompt (FLUX follows positive instructions literally and
a positive "no people" can paradoxically summon people).

---

## 1. Template A — Finished dish / meal

**Rule (locked, §11.2):** hyperreal editorial food photography in the register of `@thelittleplantation`
and `@_foodstories_`. Moody natural window light, contextual props (ceramic, linen, wood, stone), shallow
depth of field, warm earthy muted palette. Never flat stock, never overhead studio flash, never
watercolour, never cartoon, never 3D render.

**Inputs from the parsed recipe:**
- `{RECIPE_TITLE}` — the dish name, lightly cleaned (drop emoji, drop "EASY!!!", drop @handles).
- `{KEY_INGREDIENTS}` — 3-6 of the most visually defining ingredients, comma-separated, in plain words
  (e.g. "charred broccoli, lemon, almonds, chilli"). Pull from the parsed ingredient list; prefer the
  hero/visible components, drop pantry invisibles (salt, oil, water, baking powder).
- `{PLATING_NOUN}` — how it's served, inferred from the dish or defaulted: `bowl` (default for
  stews/grains/salads/pasta/soup), `plate` (mains, fish, roast), `wooden board` (bread, sharing, baked),
  `glass` (drinks/smoothies), `skillet` (one-pan bakes).

**Positive prompt:**

```
Hyperreal editorial food photography of {RECIPE_TITLE}, a finished plated dish featuring
{KEY_INGREDIENTS}, served in a matte ceramic {PLATING_NOUN}. Styled on a linen napkin over a
weathered wooden table, a few natural props nearby. Soft moody natural window light from the
side, gentle shadows, slightly under-exposed for an editorial mood. Shallow depth of field, the
dish sharp and the background softly blurred. Warm, muted, earthy colour palette — browns, creams,
sage greens, ochre. Artful, considered, unhurried composition. Magazine-quality food photography
in the style of @thelittleplantation and @_foodstories_.
```

Then append the **style anchor block** (§4) and pass the **negative prompt** (§5).

> **Realism honesty note:** Template A produces a *representative* hyperreal image of the kind of dish,
> not a forensic photograph of the user's exact cook. The product labels it as AI-generated (see the copy
> spec) precisely so the realism never reads as a claim. Keep ingredient fidelity high (it must look like
> *that* recipe) without implying it is a literal photo of the user's plate.

---

## 2. Template B — Single ingredient

**Rule (locked, §11.1):** stylised-photoreal single subject on pure white, soft studio-product daylight,
soft natural shadow below, 1:1. Matches the existing eggs/blueberries set exactly. Not watercolour, not
flat illustration, not 3D render. **Do not drift this style** — it is already established across the app
and the allergen/diet tiles.

**Input:**
- `{INGREDIENT}` — the single food item or small group, plain words (e.g. "three brown eggs", "a handful
  of blueberries", "a bunch of fresh basil").

**Positive prompt:**

```
Stylised-photoreal product photograph of {INGREDIENT}, a single subject isolated on a pure white
seamless background. Soft natural daylight, gentle soft shadow directly beneath the subject. Sharp
focus, high detail, true-to-life colour, clean and uncluttered. Hyperreal photographic style with
light studio-product lighting. No surface texture, no props, no background scenery.
```

Then append the **style anchor block** (§4, ingredient variant — see note) and pass the **negative
prompt** (§5).

> Template B overrides two anchors from §4: background is **pure white** (not wood/linen), and the mood is
> **clean daylight** (not moody under-exposure). Everything else in the anchor + negative list still
> applies. Aspect ratio for B is **1:1**.

---

## 3. Template C — Object / cookware

**Rule (locked, §11.0):** tangible kitchen objects MAY be images, in the *same* register as Template B —
warm, soft daylight, stylised-photoreal, single subject on white. This is the antidote to the off-brand
failure that was specifically the **cold glossy 3D chrome product-render** look. Warm and photographic,
never chrome, never glossy CGI.

**Input:**
- `{OBJECT}` — one tangible kitchen object, plain words with a warm material cue (e.g. "a cream enamel
  saucepan", "a rustic cast-iron Dutch oven", "an amber glass spice jar", "a simple film camera").

**Positive prompt:**

```
Stylised-photoreal product photograph of {OBJECT}, a single object isolated on a pure white seamless
background. Soft warm natural daylight, gentle soft shadow beneath. Matte, tactile, real-world
materials — enamel, cast iron, ceramic, wood, glass. Sharp focus, high detail, warm muted tones.
Hyperreal photographic style, clean and uncluttered, no props, no scenery.
```

Then append the **style anchor block** (§4, object variant — same overrides as B) and pass the
**negative prompt** (§5).

> Template C shares B's overrides: **pure white** background, **1:1**, clean-not-moody. The warmth comes
> from the material cue in `{OBJECT}` and the "warm muted tones" line — never from a coloured background.

---

## 3b. Template D — Lifestyle / in-context (PROPOSED — pending brand-manager review)

> **Status:** ADDITION proposed 2026-06-07, not yet ratified. Templates A/B/C above are LOCKED and
> unchanged. Template D is a **new imagery class** for social/marketing surfaces (not the in-app
> recipe/ingredient/object slots A/B/C serve). It reuses the shared style anchor (§4) and never-list
> (§5) verbatim, so it stays one brand; the only new thing is the **scene** (a real kitchen with the app
> resting in it) and the **social aspect ratios** (§6). Sign-off goes through `brand-manager` per §9
> before this is treated as locked.

**Class:** the app shown *in context* — a phone or iPad displaying Sloe, resting in a beautiful, real
kitchen scene. The register is the same `@thelittleplantation` / `@_foodstories_` / **@jadewilson.f**
editorial light and palette as Template A, but the **subject is the lifestyle moment**, not a plated dish.
This is the "aesthetic kitchen, calm use of the app" vibe — the visual cousin of Julienne's signup hero
(an iPhone on a sunlit marble counter, herbs in a jar, ceramic, linen, soft natural light, no people).
**@jadewilson.f** is the pinned interior/world reference for Template D's kitchen set, architecture, and
lifestyle props (see house-style §10b).

**Surfaces:** social posts (IG grid + portrait, TikTok stills), landing/marketing hero + banners, App
Store lifestyle frames. **Not** an in-app slot — A/B/C still own everything inside the product.

**Rule (derived from §11.2, extended to lifestyle):** moody-to-soft natural window light, a real kitchen
surface (honed marble or warm wood counter / island), a few *considered* props (herbs in a glass, a
ceramic mug, linen, olive oil, a wedge of parmesan, a wooden board), shallow depth of field, warm muted
earthy palette. The device is clean and modern, screen softly lit, **never** a cold tech-product render.
**No people, no hands** (same §5 guard — and the calm comes from the empty, considered scene).

**Lifestyle prop kit (Tier 1 only, locked 2026-06-07):** the expanded set of props sanctioned for
Template D lifestyle frames in the locked test kitchen. These enrich the *lifestyle* set (app resting in a
warm kitchen), **not** the per-dish plating prop list (§4 of the house-style stays "2-4 functional props,
garnish = the dish's own ingredients").

- Rush/rattan counter stools (with linen cushions + tie-bows)
- White linen empire/cone pendant shades on brass chains
- Gold-framed pastoral landscape oils or still-life floral oils (leaned against backsplash or hung over
  sideboards) — thin frames, moody/warm tones
- Ceramic urns with fresh stems (tulips, hydrangea, dried or fresh)
- A worn wooden dough bowl
- Glass storage canisters (clear, simple, functional)
- Beadboard or shiplap ceiling + classic millwork (architecture, not a prop — but sanctioned as a
  background detail in lifestyle frames)

Source: @jadewilson.f kitchen/pantry/dining reels (see house-style §10b and the world reference board).

**Inputs:**
- `{DEVICE}` — `an iPhone` (default) or `an iPad`, plain words.
- `{DEVICE_PLACEMENT}` — where it rests, e.g. "lying flat on the counter", "propped upright against a
  tiled backsplash", "leaning on a wooden board".
- `{SURFACE}` — the kitchen surface, e.g. "a sunlit honed-marble counter", "a warm oak kitchen island",
  "a weathered wooden worktop".
- `{PROPS}` — 2-4 considered props from the lifestyle prop kit above, comma-separated, e.g. "a glass jar
  of fresh herbs, a ceramic mug, a folded linen cloth". Keep it sparse — restraint is the brand.
- `{ON_SCREEN}` — what the phone shows, kept deliberately soft/suggested so the model doesn't invent
  fake UI text: default **"a calm warm-toned app interface with soft plum and cream tones, no legible
  text"**. (If compositing the real screenshot afterwards, the AI screen is a placeholder — see §3 of the
  social-set doc.)

**Positive prompt:**

```
Editorial lifestyle photograph of {DEVICE} {DEVICE_PLACEMENT} on {SURFACE} in a calm, beautiful home
kitchen. The phone screen softly shows {ON_SCREEN}. Nearby, a few considered props — {PROPS} — arranged
with restraint. Soft moody natural window light from the side, gentle shadows, slightly under-exposed for
an editorial mood. Shallow depth of field, the device sharp and the kitchen softly blurred behind. Warm,
muted, earthy colour palette — creams, oat, warm wood, sage green, soft plum, ochre. Unhurried, premium,
considered composition, an empty quiet scene with no people. Magazine-quality lifestyle photography in the
style of @thelittleplantation and @_foodstories_.
```

Then append the **style anchor block** (§4) and append the **never-list** as a trailing `Avoid: ...`
clause (§5) — because `fal-ai/flux-2-pro` has no separate `negative_prompt` field (see §6). Add to the
trailing avoid-clause, on top of §5: `cold glossy tech-product render, fake legible UI text on the
screen, app store screenshot mockup, floating phone, two phones`.

**Aspect ratios (social-first):**

| Ratio | `image_size` | Use |
|---|---|---|
| **4:5** | `{ width: 1080, height: 1350 }` | Social portrait (IG/TikTok feed) |
| **1:1** | `{ width: 1080, height: 1080 }` | IG grid square |
| **16:9** | `{ width: 1920, height: 1080 }` | Landing / marketing banner |

> Template D shares Template A's surface + mood + light — it does **not** take B/C's white-background
> override. The device is a clean modern phone/iPad; the scene does the warmth. Because the screen is the
> weakest point for AI (it invents UI), keep `{ON_SCREEN}` vague and prefer compositing the real
> screenshot in post for any frame where the screen is hero-prominent.

**Worked example (D — lifestyle hero, the Julienne-style shot):**

> Editorial lifestyle photograph of an iPhone lying flat on a sunlit honed-marble counter in a calm,
> beautiful home kitchen. The phone screen softly shows a calm warm-toned app interface with soft plum and
> cream tones, no legible text. Nearby, a few considered props — a glass jar of fresh herbs, a ceramic
> mug, a folded linen cloth — arranged with restraint. Soft moody natural window light from the side,
> gentle shadows, slightly under-exposed for an editorial mood. Shallow depth of field, the device sharp
> and the kitchen softly blurred behind. Warm, muted, earthy colour palette — creams, oat, warm wood,
> sage green, soft plum, ochre. Unhurried, premium, considered composition, an empty quiet scene with no
> people. Magazine-quality lifestyle photography in the style of @thelittleplantation and @_foodstories_.
> Sloe brand imagery. Warm, calm, editorial, premium, honest. Natural light only. Earthy muted palette.
> Real food, real materials, real kitchen. Considered restraint, never busy, never gimmicky. Photographic,
> not illustrated, not rendered. High detail, professional quality. Avoid: [§5 never-list] cold glossy
> tech-product render, fake legible UI text on the screen, app store screenshot mockup, floating phone,
> two phones.
> _aspect: 4:5 / 1:1 / 16:9 · negative appended as trailing Avoid (no negative_prompt field)_

---

## 3c. "Modern Clean" aesthetic variant — ADOPTED (Grace approved 2026-06-07)

> **Status:** **ADOPTED 2026-06-07 (Grace approved).** Modern Clean is the **active direction for
> marketing / social / landing / Discover imagery** — the surface/lighting/palette override applied to the
> locked A/B/C/D base templates on those surfaces. The base templates (A/B/C/D) and the shared anchor (§4)
> / never-list (§5) are **unchanged**; Modern Clean overrides only the **surface, lighting, and
> palette-weight** lines for the marketing/social/landing/Discover surfaces. **`brand-manager` still to
> formally ratify** (record the ratification in `docs/decisions/`); until then this entry is the operating
> direction Grace signed off, and it has already been applied to the live landing "Trending" set
> (`public/landing/trending-1..5.png`, regenerated on Nano Banana Pro on 2026-06-07; the prior FLUX set is
> archived under `public/landing/_backup-flux/`).
>
> Grace approved Nano Banana Pro's *quality* and asked to shift the imagery *aesthetic* away from the
> moody / rustic register (weathered dark wood, under-exposed, earthy shadow) toward **"editorial modern
> clean"** — bright, airy, marble/tile, modern — while keeping warm/calm/premium/food-hero/no-people/
> no-text. Grace's reference: a Julienne marketing shot — iPhone on honed **white marble**, a sage-green
> glazed **zellige tile** backsplash, fresh herbs in a clear glass jar, a clean speckled ceramic mug,
> linen, **bright natural daylight**. ("Not sure about the wooden table.")

**What it changes (vs the moody Template A/D register):** only the **surface**, **lighting**, and
**palette-weight** lines. Subject, composition discipline, restraint, the no-people / no-text / no-render
guards, and the "real food, real materials, photographic not illustrated" anchor are all **unchanged** —
this is a brightness/material shift, not a new brand.

| Axis | Current (moody / rustic — A & D as locked) | **Modern Clean (proposed)** |
|---|---|---|
| **Surface** | Weathered / dark wood, cream plaster, linen | Honed **white/grey marble** (Carrara/Calacatta), light stone, soft glazed **zellige / subway tile** (sage-green or warm-neutral), pale-washed light wood, light linen — modern, considered. **Not** weathered/rustic dark wood. |
| **Lighting** | Soft moody side-light, **slightly under-exposed** for editorial mood | **Bright, clean, airy natural daylight** — well-lit, gentle *soft* shadows. **Not** under-exposed, not heavy-moody. |
| **Palette weight** | Warm earthy — browns, ochre, deep sage, shadow | Warm-but-**LIGHT** — creams, soft whites, marble grey-greens; **warm ceramic / pale-wood accents** carry the warmth so it stays calm + premium, never clinical or cold. |
| **Props** | ceramic, linen, wood, stone | Fresh herbs in **clear glass**, clean **matte / speckled** ceramics, linen — same restraint. |
| **Keep (unchanged)** | editorial, premium, calm, shallow DoF, real food/materials; **no people, hands, faces, text, logos, watermarks** | identical — all of it holds. |

**Two-tone variant option (sanctioned 2026-06-07):** when generating frames in the locked test kitchen
(Tier 1), the island may optionally be rendered in **dark stained oak** instead of all-cream cabinetry,
with the same **white quartz top** and **unlacquered/aged brass hardware**. The cream Shaker perimeter
cabinets stay unchanged. This gives the social set visual variety without departing from the locked
kitchen DNA. See house-style §3.1b for the full spec. All other Modern Clean rules (lighting, palette,
grade, restraint) apply identically to the two-tone variant.

**Surface/lighting/palette override lines** — substitute these for the corresponding lines in Template A
(food) or Template D (lifestyle); leave the rest of each template's positive prompt as written:

```
Styled on bright honed white marble (or soft sage-green glazed zellige tile / pale light wood),
light linen nearby. Bright, clean, airy natural daylight, well-lit with gentle soft shadows.
Warm-but-light editorial palette — creams, soft whites, marble grey-greens, with warm ceramic and
pale-wood accents for warmth. Fresh, modern, considered — editorial modern clean, not moody or rustic.
```

Then append the **shared style anchor block** (§4) verbatim and the **never-list** (§5). On
`fal-ai/nano-banana-pro` there is **no `negative_prompt` field**, so the never-list is appended as a
trailing `Avoid: ...` clause (same handling as Template D). For Modern Clean, add to that avoid-clause, on
top of §5: `weathered rustic dark wood, under-exposed, heavy moody shadow, dim, dark, gloomy, cold
clinical lighting, washed-out flat lighting`.

**Worked example (Modern Clean — Template A food, the marble re-shoot):** Recipe "Warm Tahini Grain Bowl";
key ingredients chickpeas, roasted squash, tahini, parsley, lemon; plating bowl.

> Hyperreal editorial food photography of Warm Tahini Grain Bowl, a finished plated dish featuring
> chickpeas, roasted squash, tahini, parsley, lemon, served in a matte speckled ceramic bowl. Styled on
> bright honed white marble, a soft sage-green glazed zellige tile backsplash behind, light linen nearby.
> Bright, clean, airy natural daylight, well-lit with gentle soft shadows. Shallow depth of field, the
> dish sharp and the background softly blurred. Warm-but-light editorial palette — creams, soft whites,
> marble grey-greens, with warm ceramic and pale-wood accents for warmth. Fresh, modern, considered —
> editorial modern clean, not moody or rustic. Artful, unhurried composition. Magazine-quality food
> photography in the style of @thelittleplantation and @_foodstories_. Sloe brand imagery. Warm, calm,
> editorial, premium, honest. Natural light only. Real food, real materials, real kitchen. Considered
> restraint, never busy, never gimmicky. Photographic, not illustrated, not rendered. High detail,
> professional quality. Avoid: [§5 never-list] weathered rustic dark wood, under-exposed, heavy moody
> shadow, dim, dark, gloomy, cold clinical lighting, washed-out flat lighting.
> _engine: nano-banana-pro · resolution 2K · aspect 4:3 (food) / 4:5·1:1·16:9 (lifestyle) · negative appended as trailing Avoid_

> **Open question for sign-off (food shots) — RESOLVED 2026-06-07 (Grace approved):** finished-dish shots
> (Template A) on **marketing/social/landing/Discover** surfaces **do move to bright marble/stone** under
> Modern Clean — confirmed by the 2026-06-07 landing "Trending" re-shoot (all 5 dishes regenerated on Nano
> Banana Pro on honed white marble, bright airy daylight; live at `public/landing/trending-1..5.png`, prior
> FLUX set archived under `public/landing/_backup-flux/`). The in-app per-recipe runtime hero (Template A at
> generation time) is **out of scope** for this adoption and still uses Template A as locked until separately
> revisited. `brand-manager` to formally ratify the adoption in `docs/decisions/`. See also
> [`docs/brand/sloe-social-image-set-2026-06-07.md`](sloe-social-image-set-2026-06-07.md).

---

## 4. Shared style anchor block

Append verbatim to **every** positive prompt (A, B, and C). This is the brand fingerprint. The two
white-background classes (B, C) override the surface and mood lines as noted above; the rest holds for all
three.

```
Sloe brand imagery. Warm, calm, editorial, premium, honest. Natural light only. Earthy muted palette.
Real food, real materials, real kitchen. Considered restraint, never busy, never gimmicky. Photographic,
not illustrated, not rendered. High detail, professional quality.
```

**Style anchors at a glance (so a reviewer can score an output fast):**

| Anchor | Dish (A) | Ingredient (B) / Object (C) |
|---|---|---|
| **Lighting** | Soft moody natural window light, side-lit, slightly under-exposed | Soft natural daylight, even, clean (warm-leaning for C) |
| **Surface** | Linen + weathered wood + a few props | Pure white seamless, no props |
| **Lens / DoF** | Shallow DoF, subject sharp, background soft bokeh | Sharp throughout, single subject |
| **Palette** | Warm, muted, earthy — browns, creams, sage, ochre | True-to-life (B); warm muted tones (C) |
| **Register** | `@thelittleplantation` / `@_foodstories_` editorial | The existing eggs/blueberries stylised-photoreal set |
| **Aspect** | See §6 per surface | 1:1 |

> **On the IG references:** `@thelittleplantation` and `@_foodstories_` are *aesthetic targets only*.
> They steer light, palette, and composition. We never reproduce their actual photographs, and the
> negative list forbids watermarks/signatures so no real photographer's mark can appear.

---

## 5. Shared negative prompt ("never" list)

Pass as `negative_prompt` on **every** call (A, B, C). These encode §11.3 "what is never used" plus the
specific failure modes for AI food photography.

```
flat stock photography, white tablecloth overhead commercial style, watercolour, painterly, loose
illustration, cartoon, anime, clip art, vector art, flat design, 3D render, CGI, cold glossy chrome,
plastic-looking food, glossy product render, oversaturated, neon, HDR, harsh studio flash, hard
shadows, overhead flat lay (for plated dishes), busy cluttered composition, text, words, letters,
typography, logo, watermark, signature, brand label, packaging text, people, hands, faces, fingers,
cutlery in motion, deformed food, fused ingredients, extra limbs, melted shapes, uncanny, unappetising,
mouldy, raw when it should be cooked, low detail, blurry subject, jpeg artifacts, distorted proportions,
duplicated objects, frame, border, collage, split image, multiple panels
```

**Notes on the never-list:**
- `text, words, letters, typography, logo` — generated food images must carry **no on-image text**. The
  app supplies all labels (recipe title, AI-generated badge) in Fraunces/Inter as real UI, never baked
  into the pixels. This also keeps the AI-label honest (the badge is a UI element we control, not
  something the model might or might not render).
- `people, hands, faces, fingers` — Sloe food imagery is the food, not lifestyle/people-on-a-salad-bar
  stock. (Hands are also the #1 source of uncanny AI artefacts.)
- `deformed food, fused ingredients, extra limbs, melted shapes, uncanny, unappetising` — the explicit
  guard against the "AI food looks wrong" failure mode that erodes trust in a nutrition app.
- `3D render, CGI, cold glossy chrome, glossy product render` — the documented off-brand failure for
  objects/icons. Belt-and-braces with Template C's positive "matte, tactile" cue.

---

## 6. Fixed generation parameters

Constant across the brand. Per-surface, only `aspect_ratio` varies.

| Param | Value | Why |
|---|---|---|
| **Model** | `fal-ai/flux-2-pro` (FLUX 2 Pro) — runtime; `fal-ai/nano-banana-pro` (Nano Banana Pro) — marketing/hero | **Dual-engine split (2026-06-07 head-to-head, see strategy doc):** Nano Banana Pro = default for hero/marketing/social/Discover-feature/recipe-hero imagery (won on editorial quality — window light, depth, kitchen context; $0.15/img, low-volume); FLUX 2 Pro = default for runtime per-user recipe-gen (cost-critical, high-volume, cached; $0.01-0.04/img). **The prompt templates are model-swappable and do not change** — same assembled string drives either engine. Budget tier FLUX 2 Flex / GPT Image fallback may be swapped at the engine layer — prompt unchanged. **Engine caveat:** the fal `fal-ai/flux-2-pro` endpoint exposes only `prompt`, `image_size`, `seed`, `output_format`, `safety_tolerance` — **no separate `negative_prompt` field**. The §5 never-list is therefore appended to the positive prompt as a trailing `Avoid: ...` clause. If a future batch shows the model summoning negated nouns from the avoid-clause, move to an engine that honours a true negative prompt. (First recorded in `docs/decisions/2026-06-07-universal-food-imagery.md`.) |
| **`aspect_ratio` — dish (A)** | `4:3` hero, `1:1` square card, `16:9` paywall/landing strip | Recipe heroes are landscape-ish; the runtime import card hero is 4:3. Pick per surface, never stretch. |
| **`aspect_ratio` — ingredient (B) / object (C)** | `1:1` | Locked in §11.1. |
| **`aspect_ratio` — lifestyle (D, proposed)** | `4:5` social portrait, `1:1` IG grid, `16:9` landing/banner | Social-first formats; pass as an explicit `image_size: { width, height }` object (1080x1350 / 1080x1080 / 1920x1080). |
| **`num_images`** | `1` runtime; `1-4` design-time batch | Runtime is one-image, user-previews-then-approves. Cost guard. |
| **`output_format`** | `webp` (store), generate `png`/`jpeg` then transcode | Matches `recipe-${id}-hero.webp` storage convention. |
| **`seed`** | random runtime; **pin a seed** for design-time when you need a reproducible set | Pinned seed = a coherent batch (e.g. all six diet-card tiles in one light). |
| **`safety_tolerance`** | provider default (do not loosen) | Food is low-risk; no reason to relax safety. |
| **`guidance` / steps** | provider default for FLUX 2 Pro | The prompt carries the style; don't over-tune per call. |

**Runtime cost/cache rules (from the strategy doc — restated so the prompt owner doesn't undercut them):**
user-initiated only (never silent auto-gen for the runtime feature), **cache by recipe** (never regenerate
the same recipe), per-user rate-limit (reuse the Upstash limiter), Free monthly allowance + unlimited Pro.

---

## 7. Worked examples

**A — finished dish.** Recipe: "Crispy Gochujang Salmon Bowl". Key ingredients: salmon, rice, cucumber,
sesame, spring onion. Plating: bowl.

> Hyperreal editorial food photography of Crispy Gochujang Salmon Bowl, a finished plated dish featuring
> salmon, rice, cucumber, sesame, spring onion, served in a matte ceramic bowl. Styled on a linen napkin
> over a weathered wooden table, a few natural props nearby. Soft moody natural window light from the
> side, gentle shadows, slightly under-exposed for an editorial mood. Shallow depth of field, the dish
> sharp and the background softly blurred. Warm, muted, earthy colour palette — browns, creams, sage
> greens, ochre. Artful, considered, unhurried composition. Magazine-quality food photography in the
> style of @thelittleplantation and @_foodstories_. Sloe brand imagery. Warm, calm, editorial, premium,
> honest. Natural light only. Earthy muted palette. Real food, real materials, real kitchen. Considered
> restraint, never busy, never gimmicky. Photographic, not illustrated, not rendered. High detail,
> professional quality.
> _aspect: 4:3 · negative: §5_

**B — single ingredient.** "a small bunch of fresh coriander".

> Stylised-photoreal product photograph of a small bunch of fresh coriander, a single subject isolated on
> a pure white seamless background. Soft natural daylight, gentle soft shadow directly beneath the
> subject. Sharp focus, high detail, true-to-life colour, clean and uncluttered. Hyperreal photographic
> style with light studio-product lighting. No surface texture, no props, no background scenery. Sloe
> brand imagery. Warm, calm, editorial, premium, honest. Real food, real materials. Considered restraint,
> never busy, never gimmicky. Photographic, not illustrated, not rendered. High detail, professional
> quality.
> _aspect: 1:1 · negative: §5_

**C — object.** "a cream enamel saucepan".

> Stylised-photoreal product photograph of a cream enamel saucepan, a single object isolated on a pure
> white seamless background. Soft warm natural daylight, gentle soft shadow beneath. Matte, tactile,
> real-world materials — enamel, cast iron, ceramic, wood, glass. Sharp focus, high detail, warm muted
> tones. Hyperreal photographic style, clean and uncluttered, no props, no scenery. Sloe brand imagery.
> Warm, calm, editorial, premium, honest. Considered restraint, never busy, never gimmicky. Photographic,
> not illustrated, not rendered. High detail, professional quality.
> _aspect: 1:1 · negative: §5_

---

## 8. Reviewer checklist (gate a generated image before it ships / saves)

An image is on-brand only if **all** of these hold:

- [ ] Reads as a **photograph**, not an illustration / watercolour / 3D render.
- [ ] Dish (A): moody natural side-light, ceramic/linen/wood, shallow DoF — not a flat overhead stock shot.
- [ ] Ingredient (B) / object (C): clean white background, single subject, soft shadow, no props.
- [ ] Palette is warm, muted, earthy — **not** neon, oversaturated, or HDR.
- [ ] **No on-image text, logo, watermark, or signature.**
- [ ] **No people, hands, or faces.**
- [ ] Food looks **appetising and anatomically sane** — no fused/deformed/melted ingredients, nothing uncanny.
- [ ] For a dish: the visible ingredients **plausibly match the recipe** (it looks like *that* dish).
- [ ] Object (C): matte/tactile, **never** cold glossy chrome.
- [ ] At runtime: the image will be shown to the user to **preview and approve**, and rendered with the
      **AI-generated label** — it is never silently saved or passed off as a real photo of their cook.

If any box fails: regenerate (new seed) or fall back to the warm gradient/monogram placeholder (§11.4).
**A weak placeholder beats an off-brand or uncanny generation** — the fallback hierarchy exists for this.

---

## 9. Change control

This file is LOCKED. Any change to the templates, the anchor block, the negative list, or the params is a
brand decision: it goes through `brand-manager`, must stay consistent with `_design-system.md` §11, and
should be co-reviewed with `legal-reviewer` (AI-image honesty/attribution) when the runtime feature's
labelling is touched. Record material changes in `docs/decisions/`.
