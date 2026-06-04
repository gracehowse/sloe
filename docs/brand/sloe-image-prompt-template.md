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
> ("Overhead shot of {title}…"). That fragment predates the warm-coaching / Sloe direction and is no
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
- `{KEY_INGREDIENTS}` — 3–6 of the most visually defining ingredients, comma-separated, in plain words
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
| **Model** | `fal-ai/flux-2-pro` (FLUX 2 Pro) | Locked default per strategy doc; price/quality winner for food. Budget tier FLUX 2 Flex / GPT Image fallback may be swapped at the engine layer — prompt unchanged. |
| **`aspect_ratio` — dish (A)** | `4:3` hero, `1:1` square card, `16:9` paywall/landing strip | Recipe heroes are landscape-ish; the runtime import card hero is 4:3. Pick per surface, never stretch. |
| **`aspect_ratio` — ingredient (B) / object (C)** | `1:1` | Locked in §11.1. |
| **`num_images`** | `1` runtime; `1–4` design-time batch | Runtime is one-image, user-previews-then-approves. Cost guard. |
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
