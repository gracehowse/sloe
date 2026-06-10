# Sloe — Food-Photo House Style

> **What this is:** the rulebook for shooting (and generating) food in the **Sloe test kitchen** — our
> single locked set: a real marble galley with cream Shaker cabinets, brass hardware, copper pots, a
> side window, and herbs in a glass jar (the reference plate is
> [`docs/brand/sloe-test-kitchen-reference.png`](./sloe-test-kitchen-reference.png)). One kitchen, one
> light, one grade carry across hundreds of dishes — the way NYT Cooking and Food52 stay recognisable
> across many cooks and many shooters.
>
> **Status:** house-style spec, owned by `brand-manager`. It **operationalises** — and never contradicts —
> the locked prompt templates in
> [`docs/brand/sloe-image-prompt-template.md`](./sloe-image-prompt-template.md) (Template A finished-dish +
> the **Modern Clean §3c** surface/light/palette override, Grace approved 2026-06-07) and the Sloe palette
> in [`docs/brand/sloe/sloe-brand.md`](./sloe/sloe-brand.md). If this file and the prompt template ever
> disagree, **the prompt template wins** and this file must be corrected.
>
> **Why these references:** the rules below triangulate three in-house test-kitchen photography systems —
> **NYT Cooking**, **Food52**, and **Mob Kitchen** — chosen because each runs a continuous recipe pipeline
> with a tiny shooter roster, so each look is a *repeatable system*, not a one-off art direction. That is
> exactly the problem Sloe has: many recipes, many cooks, many imports, and one brand that must hold.
> Sources are cited in §10. The headline cross-cutting lesson, stated once: **consistency comes from a
> centralised kitchen + one light language + one prop/surface kit + one grade — not from a PDF applied by
> scattered shooters.** This doc is the kitchen-on-paper that makes that possible for a recipe app.

---

## 0. The two-tier rule (read this first)

Sloe food imagery splits into exactly two tiers. They share the **same light, palette, restraint, and
grade** — they differ only in how locked the *set* is.

| Tier | Surface | The set | Engine register | Authority |
|---|---|---|---|---|
| **Tier 1 — Locked kitchen (marketing)** | Social (IG/TikTok), landing/marketing hero + banners, App Store frames, the Discover/Trending set | The **one** Sloe test kitchen — the marble galley in the reference image, reproduced **shot-to-shot** via the reference image + a **pinned seed** so every marketing frame reads as the *same room*. | Nano Banana Pro (`fal-ai/nano-banana-pro`), 2K, **Modern Clean** §3c | This doc §3.1 + prompt template §3c + §6 |
| **Tier 2 — House style (runtime)** | The in-app per-recipe hero generated at import time (Template A), recipe cards, plan rows | A **varied-but-consistent** Sloe-style kitchen — not the identical room (every recipe in the same room would read as a content farm), but the same surfaces, light, props, palette, and grade so they all feel like *one cookbook*. | FLUX 2 Pro (`fal-ai/flux-2-pro`), cost-critical, cached | This doc §3.2 + prompt template Template A (as locked) |

**The reason for the split.** A locked, reproducible kitchen is a marketing *asset* — a recognisable room
makes the brand feel real, premium, and consistent across a feed (this is the NYT/Food52 "one studio"
move). But forcing every one of thousands of user-imported recipes into the *identical* room would (a)
read as fake/farmed, (b) blow the runtime cost/cache budget on reference-image conditioning, and (c) fight
the honesty posture (the per-recipe hero is a *representative* image, not a claim it was cooked in our
kitchen). So: **lock the room for the handful of marketing frames; hold the house style — same DNA, varied
room — for the high-volume runtime stream.** Same fingerprint, two pressures.

Everything in §1–§7 below applies to **both** tiers unless a line is explicitly marked *(Tier 1 only)* or
*(Tier 2 only)*.

---

## 1. CAMERA — eye-level / three-quarter, NEVER overhead

**Rule:** every Sloe food shot is **eye-level (0°) or a low three-quarter (~30–45°)**. **Overhead /
flat-lay (90°) is banned** for finished dishes. This is the deliberate Sloe stance and the anti-cliché
move.

**Why this is the rule, not a preference.** Overhead is the single most overused recipe-app angle —
Mob Kitchen's house default, now a generic convention, and the look Julienne and every flat-lay grid lean
on. NYT and Food52 both run a *two-angle* system (overhead for flat/multi-element spreads; three-quarter
~45° for height/sauce/layers) — but Sloe deliberately drops the overhead half of that system. Reason: the
three-quarter / eye-level frame is the one that reads height, sauce sheen, steam, melt, and the glossy cut
interior — i.e. the **appetite cues** a "love food *and* have goals" brand lives on — and it is the angle a
flat-lay physically cannot show. Picking the non-overhead subset is how Sloe gets the "pull-up-a-chair,
this is dinner" warmth instead of the clinical top-down macro-tracker grid.

**Concrete prompt-ready rules:**

- **Default to low three-quarter (~30–45°)** — the "how you see food sitting at the table" view. Use for
  almost everything: bowls, plates, skillets, braises, stews, grain bowls, pasta, traybakes still in the
  pan, anything with sauce/height/layers.
- **Use straight-on eye-level (0°)** only for genuinely *tall* builds where the side profile is the story:
  stacked bakes, burgers, layer cakes, a poured drink/smoothie, a bread cross-section.
- **Get closer.** Crop tight on the most interesting section; rotate the dish so the frame lands on the
  glossiest, most textured bite (the one transferable Mob habit — keep the close angled crop, drop Mob's
  hard light and loud backdrops; see §2, §5).
- **Never** overhead / top-down / flat-lay for a plated dish. The negative list in the prompt template
  already encodes `overhead flat lay (for plated dishes)` — this doc is the why.
- **Prompt phrasing:** "shot at a low three-quarter angle, roughly 35 degrees, at table height" or
  "straight-on eye-level" — and the §5 prompt-template never-list carries the overhead guard.

> **Carve-out:** Template B (single ingredient) and Template C (object/cookware) are *product* shots on
> white, not kitchen scenes — the angle rules here govern **finished dishes (Template A) and lifestyle
> (Template D)** only. B/C stay as locked in the prompt template.

---

## 2. LIGHTING — warm natural window light, soft, balanced (modern-clean, not heavy-moody)

**Rule:** one broad, **soft, directional, warm natural window light** from the **side** of the frame.
Bright and airy enough to read modern-clean; soft enough that shadows sculpt but never crush. This is the
**NYT / Food52 daylight register**, tuned to the Modern Clean direction (§3c) — *not* the heavy
under-exposed moody register, and emphatically *not* Mob's hard direct sun.

**Why.** Soft directional daylight is the strongest single carrier of a recognisable look — it is the most
consistent variable across the entire NYT and Food52 catalogues, and the one rule that does most of the
consistency work across a many-cook library. The Sloe kitchen reference shot is already lit this way: a
big side window rakes across the marble, herbs and copper catch a soft highlight, shadows fall gently. We
hold that exactly.

**Concrete prompt-ready rules:**

- **One broad source, from the side** (the test kitchen's window, camera-left or -right). Side- or
  slightly back-light so liquids, glazes and sauces pick up a soft glossy highlight and texture rakes.
- **Soft, not flat.** Diffused (the window itself, or a window-mimicking source through silk) so shadow
  fall-off is gentle but still present — the food is *sculpted*, never lit flat and shadowless.
- **Bright + airy, well-exposed** (the Modern Clean shift, §3c): protect highlight detail on glossy food,
  keep the scene light and fresh. **Do not** under-expose for "mood," do not crush shadows to black.
- **Warm white balance** — daylight leaning gently warm so cream cabinets read cream and marble reads
  warm-grey, never blue-clinical and never green (the mixed-light failure, see avoid-list).
- **No on-camera / harsh flash, no hard razor shadows, no blown highlights.** Mob's signature hard-sun +
  sharp-shadow look is explicitly *out* — it reads loud and energetic and fights Sloe's calm-coaching
  voice. We borrow Mob's *angle*, never its light.
- **Prompt phrasing:** "bright, clean, airy natural daylight from a side window, well-lit with gentle soft
  shadows, warm white balance, highlights protected" — i.e. the Modern Clean §3c lighting override.

---

## 3. SURFACE / SET — the locked test kitchen (Tier 1) vs the house-style kitchen (Tier 2)

The Sloe test kitchen is a **real marble galley**: honed white/grey marble counter, **cream Shaker
cabinets**, **unlacquered/aged warm brass** (soft sheen, never bright-chrome-shiny) cup-pull and knob
hardware, copper pots on the range, a stoneware crock of wooden utensils, herbs in a clear glass jar, a
side window with soft daylight, pale wood floor. That is the room. The reference frame is
[`sloe-test-kitchen-reference.png`](./sloe-test-kitchen-reference.png).

**Hardware spec (locked 2026-06-07):** all brass across the kitchen is **unlacquered/aged warm brass** with
a soft, lived-in sheen and slight natural patina. It reads warm and characterful, never mirror-gold and
never cold chrome. This maps to the brand's warm **Honey `#D6A24A`** / **Clay `#C8794E`** accent register,
never to cool plum/Frost. Source reference: **@jadewilson.f** kitchen reels (see §10b).

**Architecture cues (Tier 1, locked 2026-06-07):** the locked test kitchen includes these architectural
details that carry across marketing frames:
- **Plaster arched range niche + plaster range hood** — soft, hand-troweled, no hard geometric edges.
  Reads warm and European, never industrial.
- **White apron-front / fireclay farmhouse sink** — the visible sink in the kitchen is a traditional
  apron-front (fireclay or similar), not a modern undermount.
- **Copper pots on a brass wall-rail** beside the range — the rail is aged brass (matching the hardware
  spec above), the pots are warm copper. This pairing appears repeatedly in the reference source and is a
  strong Sloe signature.

**Matte-black accent rule (locked 2026-06-07):** one restrained **matte-black architectural accent** is
permitted in Tier-1 kitchen and lifestyle frames as a graphic anchor — a lighting fixture (linear
chandelier, pendant), a window mullion, or a thin metal shelf bracket. **Never** a black surface, cabinet,
countertop, or backdrop. The black reads *considered and graphic* against the all-cream field, the same way
**Ink `#221B26`** works as a sparing anchor on the Oat ground in the UI. Limit: one accent element per
frame; if in doubt, leave it out.

### 3.1 Tier 1 (marketing) — reproduce the *same room*, shot-to-shot

For social / landing / App Store / Discover, every frame must read as the **same recognisable kitchen** —
this is the brand asset. Hold it with two levers:

- **Condition on the reference image.** Pass `sloe-test-kitchen-reference.png` as the visual reference
  (image-to-image / reference-conditioning on Nano Banana Pro) so the marble, cream Shaker cabinets, aged
  brass hardware, copper, and window light carry across.
- **Pin a seed per scene** (the social set already pins seeds — `70010`–`70080` lifestyle, `71010`–`71030`
  food; see [`sloe-social-image-set-2026-06-07.md`](./sloe-social-image-set-2026-06-07.md)). A pinned seed
  + the reference image = a coherent set that all reads as one room.
- **Vary only the foreground** (the dish, the 2–4 props, the camera angle within §1) — never the room.
- **Surfaces:** honed white/grey marble (the counter), with the cream cabinets / aged brass / copper as the
  recognisable backdrop. Modern Clean (§3c), not weathered rustic dark wood.

### 3.1b Tier 1 — Two-tone variant (sanctioned 2026-06-07)

An **approved variant** of the locked test kitchen for marketing-frame variety. This is **not** a
replacement for the all-cream room — it is a second option that shares the same DNA and gives the social
feed and marketing surfaces visual range without splitting the recognisable set.

**What changes from §3.1:**
- The **island** is rendered in **dark stained oak** (a warm, deep mid-tone wood, not black, not
  grey-wash) with a **white quartz top** and the same **unlacquered/aged brass** hardware as the
  perimeter.
- The island houses a **white apron-front / fireclay sink** (matching the architecture cue above).

**What stays the same:**
- **Cream Shaker perimeter cabinets** — unchanged. The two-tone is cream-perimeter + dark-oak-island, not
  the reverse.
- **Honed white/grey marble or white quartz counters** on all surfaces.
- **Unlacquered/aged brass hardware** everywhere — cup-pulls, knobs, faucet, pot-filler.
- **Copper pots, herbs in glass, linen, pale wood floor** — the same prop/surface/light DNA.
- **Light, palette, grade, camera angle** — all unchanged from §1, §2, §5, §6.

**When to use:** the two-tone variant gives marketing frames a warmer, slightly richer mid-ground anchor
without departing from the locked kitchen's identity. It reads as the same home, just showing the island
side. Use it when the social set needs variety or when the darker island provides a better mid-tone
contrast anchor behind a light-coloured dish. The all-cream room (§3.1) remains the default.

**Palette alignment:** the dark oak island maps tonally toward the brand's warm-wood accents and sits
comfortably near **Ink `#221B26`** in weight without being as dark. It is a warm mid-contrast element, not
a dark-mode surface.

### 3.2 Tier 2 (runtime) — the *house style*, varied but consistent

For the per-recipe in-app hero (Template A at import time), do **not** force the identical room. Instead
hold the **same DNA** so every dish reads as one cookbook:

- **Surface family:** honed white/grey marble or light stone, with **pale light wood** and **light linen**
  as the warm accents; optional soft sage-green glazed **zellige tile** behind (the Modern Clean kit).
  Matte finishes only — matte specifically to kill hot reflections under the side light (Food52's reason).
- **Quiet, tonal, recessive backgrounds** — the set never competes with the dish; the food carries the
  colour (NYT doctrine; see §5).
- **Plates / vessels:** simple — clean matte or speckled ceramic in muted earth/cream tones, or a stark
  light bowl/plate. No loud patterns, no glossy hot-spot surfaces, no saturated primary-colour card
  backdrops (Mob's loud cobalt/mustard cards are explicitly *out* — they fight the cream/sage palette).
- The room *varies* shot to shot (different bit of marble, different prop scatter) but the **light, palette,
  prop kit, and grade are frozen** — that is what makes a thousand auto-generated heroes feel like one
  brand rather than a stock-photo jumble.

> **The fixed kit (both tiers):** honed white/grey marble · pale light wood · light linen · soft sage-green
> zellige tile · clean matte/speckled ceramic · unlacquered/aged brass + copper (Tier 1 room) · herbs in
> clear glass. A small fixed kit is precisely how Food52 makes dozens of contributors feel like one
> cookbook — encode it, don't improvise it.

---

## 4. PROPS & STYLING — restraint is doctrine

**Rule:** the dish and the light do the work; props are **functional and few**, and **garnish is the
dish's own ingredients** — never decorative parsley-for-parsley's-sake.

**Why.** Restraint is the explicit doctrine at NYT ("the less you put on the plate... the easier it is to
take a good picture") and Food52 ("the simplest moments make the best images. No tricks needed"). It also
*is* the Sloe brand — calm, considered, unhurried, never busy or gimmicky (the shared style anchor already
says "considered restraint, never busy, never gimmicky").

**Concrete prompt-ready rules:**

- **2–4 props maximum**, all functional: a folded linen cloth, one utensil or spoon, a wedge of the
  ingredient (halved lemon, herb sprig, a scatter of seeds/crumbs), herbs in a clear glass jar, a small
  ceramic dish of flaky salt, a pour of the sauce. Each prop must earn its place by telling the recipe's
  story or keying the palette.
- **Garnish = the recipe's own ingredients.** Char, herbs, citrus, sesame, chilli — whatever is actually
  *in* the dish. Never a generic garnish.
- **A little honest imperfection is on-brand** — a few crumbs, a drip, a torn herb, the vessel still in
  shot. Food52's "approachable little mess" reads as *achievable home cooking*, which is exactly the warm,
  permission-not-restriction posture (it is the opposite of a sterile macro-tracker plate). Keep it
  *considered*, never actually messy.
- **No people, no hands, no faces.** (Sloe-specific override of the otherwise-tempting NYT "hands in
  frame" move — hands are the #1 source of uncanny AI artefacts, and the §5 never-list forbids them. The
  calm comes from the empty, considered scene, the way Julienne's lifestyle shots do.)
- **No clutter, no fussy over-styling, no staged perfection.** Lean on **negative space** so each frame
  stays graphic and scannable (it is a phone-feed card and an app hero — it must read at a glance).

---

## 5. COLOUR GRADE & PALETTE — one warm, true-to-appetite grade, everywhere

**Rule:** **one** cohesive grade across the whole library — warm, bright, true-to-appetite. The **food
carries the saturation; the set stays neutral.** No per-image grade experiments.

**Why.** A single cohesive grade is treated as a brand asset at NYT ("make food look as good as it
tastes," one treatment, not per-image experimentation), and per-image grading is the fastest way to kill a
recognisable house look. Food52 bakes warm saturation in-camera with disciplined daylight white balance so
a tomato reads tomato-red. Sloe holds one grade so user-imported and house images converge.

**Concrete prompt-ready rules:**

- **Warm-but-light editorial grade** (Modern Clean §3c): creams, soft whites, marble grey-greens as the
  ground; **warm ceramic and pale-wood accents carry the warmth** so it stays premium and calm, never
  clinical or cold.
- **Food is the colour hero.** The dish holds the most saturation in frame; the marble/linen/cabinet
  backdrop stays muted and tonal so it recedes.
- **True-to-appetite, never amplified.** Faithful food colour (a tomato reads tomato-red), protected
  highlights, moderate contrast with open — not crushed — shadows. **Not** candy-saturated, **not** HDR,
  **not** neon (Mob's punchy colour-pop is dialled *down* to Sloe's warmer, softer register).
- **Palette tie-in (Sloe brand):** the set lives on the **Oat `#FBF8F3`** warm-cream ground language;
  warmth in the food + the **Clay `#C8794E` / Honey `#D6A24A`** photography warmth carries the appetite.
  Critically — **the cool Sloe brand accents (plum / damson / Frost lilac) never land on the plate or the
  food.** Cool berry tones are appetite-suppressing on food; they do chrome/CTA/UI work only. The *photo*
  stays warm; the *app skin around it* can be plum. (This is the same structural rule the secondary-colour
  decision relies on — see [`2026-06-07-secondary-colour-exploration.md`](./2026-06-07-secondary-colour-exploration.md) §4.)
- **No on-image text, logo, watermark, or signature** (per the prompt template never-list) — the app
  supplies every label in Fraunces/Inter as real UI.

---

## 6. COMPOSITION / CROP — food fills frame, rule-of-thirds, confident crop

**Rule:** clean, confident, **food-fills-frame** composition with intentional negative space; hero large
and central or on a rule-of-thirds anchor; **shallow depth of field** with selective focus on the key
bite.

**Why.** NYT and Food52 both compose food-forward with the hero large, tight-to-medium crops that read
texture (flaky crust, glossy braise, melting cheese), and shallow DoF that lands the eye on the food, not
the props. Food52 pushes the subject off-centre into the thirds and embraces an aggressive crop so the
hero spills past the edge.

**Concrete prompt-ready rules:**

- **Hero fills the frame.** Tight-to-medium crop so texture reads — sauce sheen, char, steam, melt, the
  glossy cut interior. "Get closer" (the Mob crop habit, kept).
- **Rule-of-thirds, not dead-centre.** Place the hero on a thirds anchor; let supporting ingredients/props
  lead the eye in from the edges. A confident crop that lets the dish spill past one edge beats a fully
  contained, symmetrical, centred plate.
- **Shallow depth of field** — dish sharp, background (the marble/cabinets/window) softly blurred. Drive
  selective focus to the key bite; let the rest fall soft. This is in the locked Template A already
  ("shallow depth of field, the dish sharp and the background softly blurred").
- **Intentional negative space** — the frame breathes; the set never upstages the dish. For 16:9 marketing
  banners, bias the hero to one side and leave clean negative space for a headline overlay.
- **Use depth cues** on three-quarter frames: the bowl rim, a wisp of steam, a trailing spoon, a prop in
  soft foreground.
- **Aspect ratios** per surface — see the prompt template §6 (4:3 recipe hero, 1:1 card, 16:9
  paywall/landing/banner; social 4:5 / 1:1 / 16:9). Pick per surface, never stretch.

---

## 7. THE TEST-KITCHEN CONSISTENCY METHOD — how one kitchen carries across many dishes

This is the heart of the system and the reason the references were chosen. NYT Cooking ships ~75 recipes a
month (up to ~100 at holidays) and Food52 a continuous pipeline — both stay instantly recognisable across
hundreds of dishes and several shooters. **Neither does it with a written angle rulebook handed to
scattered freelancers. Both do it with a centralised studio:** one room, one lighting kit, one prop +
surface library, one photo editor / art director, one grade — with only a *small, fixed set of knobs*
allowed to move.

**For Sloe — a recipe app with many cooks and many imports — the analogue is:**

1. **One kitchen, encoded.** The locked test kitchen (the reference image) is our "one studio." Tier 1
   reproduces it shot-to-shot (reference image + pinned seed); Tier 2 holds its DNA (same surfaces, light,
   props, grade) even as the exact room varies. *(Food52's "shared surface/prop kit + tiny shooter
   roster"; NYT's "one room, one lighting kit, one prop library.")*

2. **One light language, frozen.** Soft warm directional window light, bright-and-airy, gentle shadows
   (§2) — never mixed light, never hard flash. This single rule carries most of the recognisability across
   a crowdsourced library (Food52's cardinal rule: kill every artificial source; one clean daylight key).

3. **One prop + surface kit, fixed** (§3 box) — a small inventory, so thousands of recipes feel like one
   cookbook.

4. **One grade, applied everywhere** (§5) — the warm-but-light Modern Clean treatment, never per-image
   experiments. *(NYT's "one cohesive edit treatment is a brand asset.")*

5. **Only two knobs move** — the exact discipline that gives NYT variety without drift:
   - **ANGLE** — eye-level vs low three-quarter (§1), matched to the dish's most legible feature. *(But
     never overhead — Sloe drops that half of the NYT/Food52 two-angle system on purpose.)*
   - **MOOD** — bright (default) vs a *touch* warmer for rich/wintery dishes. Stays within the Modern
     Clean register — we never swing to the heavy under-exposed moody set on marketing surfaces.

   Everything else — light, surfaces, props, palette, grade, crop discipline, restraint — is held
   constant.

6. **A normalising post-process for imports (the recipe-app-specific lesson).** NYT's consistency comes
   from a centralised studio, not a PDF — but a recipe app takes images from *many* sources (house gen +
   user imports). The analogue is a **tight image spec + an auto-normalising pass**: auto white-balance to
   warm daylight, bias toward a tonal/recessive background, apply the single Sloe grade/LUT, and snap to
   the angle-and-crop presets — applied to **every** recipe image regardless of source, so user-imported
   and house images converge on one recognisable test-kitchen look. (For generated images this is baked
   into the prompt; for genuinely user-uploaded photos, a grade/crop normalisation pass is the on-brand
   path — track as a follow-up if/when user photo upload ships; it is not yet built.)

7. **One reviewer gate.** Every frame is scored against the prompt template's §8 reviewer checklist before
   it ships or saves — the human/agent "photo editor" role that NYT and Food52 centralise. **Read the
   actual pixels** (per the project's "SEE, don't just orchestrate" rule); never pass a frame from its
   prompt or filename alone.

---

## 8. Ready-to-use prompt block — food in the Sloe test kitchen

Two blocks: **Tier 1** (locked marketing kitchen) and **Tier 2** (runtime house style). Both assemble on
top of the **Template A** positive prompt + **Modern Clean §3c** override + the **shared style anchor (§4)**
+ the **never-list (§5 as a trailing `Avoid:` clause)** in
[`sloe-image-prompt-template.md`](./sloe-image-prompt-template.md). Fill the `{CAPS}` placeholders the same
way Template A defines them (`{RECIPE_TITLE}`, `{KEY_INGREDIENTS}`, `{PLATING_NOUN}`).

### 8.1 Tier 1 — locked marketing kitchen (reference image + pinned seed)

> _Engine: `fal-ai/nano-banana-pro`, 2K. **Pass `sloe-test-kitchen-reference.png` as the reference image**
> and **pin a seed** (e.g. `71010`+) so the room is reproducible. Never overhead._

```
Hyperreal editorial food photography of {RECIPE_TITLE}, a finished plated dish featuring
{KEY_INGREDIENTS}, served in a matte speckled ceramic {PLATING_NOUN}. Shot at a low three-quarter
angle, roughly 35 degrees, at table height — never overhead. Set in the Sloe test kitchen: honed
white-grey marble counter, cream Shaker cabinets and aged brass hardware behind, copper pots and herbs in a
clear glass jar softly out of focus. A few considered props nearby — folded light linen, a halved
lemon, a sprig of the dish's own herbs. Bright, clean, airy natural daylight from the side window,
well-lit with gentle soft shadows, warm white balance, highlights protected. Shallow depth of field,
the dish sharp on a rule-of-thirds anchor and the kitchen softly blurred behind. Warm-but-light
editorial palette — creams, soft whites, marble grey-greens, with warm ceramic and pale-wood accents
for warmth; the food carries the colour. Fresh, modern, considered — editorial modern clean, not moody
or rustic. Artful, unhurried, food-fills-frame composition with intentional negative space.
Magazine-quality food photography in the style of @thelittleplantation and @_foodstories_.
Sloe brand imagery. Warm, calm, editorial, premium, honest. Natural light only. Real food, real
materials, real kitchen. Considered restraint, never busy, never gimmicky. Photographic, not
illustrated, not rendered. High detail, professional quality. Avoid: [§5 never-list] overhead flat lay,
top-down, weathered rustic dark wood, under-exposed, heavy moody shadow, dim, dark, gloomy, cold
clinical lighting, washed-out flat lighting, hard direct sun, razor sharp shadows, saturated primary
backdrop, people, hands, faces, on-screen or on-image text.
```

### 8.2 Tier 2 — runtime house style (varied room, no reference image)

> _Engine: `fal-ai/flux-2-pro`, cost-critical, cached by recipe, random seed. Same DNA, room free to vary.
> Never overhead._

```
Hyperreal editorial food photography of {RECIPE_TITLE}, a finished plated dish featuring
{KEY_INGREDIENTS}, served in a matte speckled ceramic {PLATING_NOUN}. Shot at a low three-quarter
angle, roughly 35 degrees, at table height — never overhead. Styled on bright honed white marble (or
pale light wood / soft sage-green glazed zellige tile), light linen nearby, a few considered props —
the dish's own herbs, a halved lemon. Bright, clean, airy natural daylight from the side, well-lit with
gentle soft shadows, warm white balance, highlights protected. Shallow depth of field, the dish sharp
on a rule-of-thirds anchor and the background softly blurred. Warm-but-light editorial palette — creams,
soft whites, marble grey-greens, with warm ceramic and pale-wood accents for warmth; the food carries
the colour. Fresh, modern, considered — editorial modern clean, not moody or rustic. Artful, unhurried,
food-fills-frame composition with intentional negative space. Magazine-quality food photography in the
style of @thelittleplantation and @_foodstories_. Sloe brand imagery. Warm, calm, editorial, premium,
honest. Natural light only. Real food, real materials, real kitchen. Considered restraint, never busy,
never gimmicky. Photographic, not illustrated, not rendered. High detail, professional quality. Avoid:
[§5 never-list] overhead flat lay, top-down, weathered rustic dark wood, under-exposed, heavy moody
shadow, dim, dark, gloomy, cold clinical lighting, washed-out flat lighting, hard direct sun, razor
sharp shadows, saturated primary backdrop, people, hands, faces, on-screen or on-image text.
```

> **Lifestyle (app-in-kitchen) frames** use **Template D** (prompt template §3b) + the same Modern Clean
> override + the locked-kitchen reference image (Tier 1) — same kitchen, the device resting in it. See
> [`sloe-social-image-set-2026-06-07.md`](./sloe-social-image-set-2026-06-07.md) for the worked set.

---

## 9. Reviewer checklist (food-photo specific)

Score every frame against the prompt template's **§8 reviewer checklist** first, then these house-style
adds:

- [ ] **Angle is eye-level or low three-quarter — NEVER overhead / flat-lay.**
- [ ] Light is **soft warm side daylight, bright-and-airy** — not under-exposed-moody, not hard-flash, not
      Mob-hard-sun.
- [ ] Surface is the **marble/light-stone/pale-wood/linen** kit; matte, tonal, recessive — no glossy
      hot-spots, no loud/saturated/patterned backdrops.
- [ ] **(Tier 1)** reads as the **same locked test kitchen** as the reference image (marble, cream Shaker,
      aged brass, copper, window). If using the two-tone variant (§3.1b), the dark-oak island reads as a
      warm mid-tone, not black, and perimeter stays cream.
- [ ] Brass reads **unlacquered/aged** with a soft warm sheen — never bright polished mirror-gold, never
      chrome.
- [ ] If a matte-black accent is present, it is **one** restrained architectural element (fixture/mullion)
      — never a surface or backdrop.
- [ ] Props <=4, all functional; **garnish is the dish's own ingredients**; honest-not-fussy; **no people /
      hands / faces**.
- [ ] Grade is the **one warm-but-light** treatment; **food carries the saturation**, set is neutral;
      true-to-appetite, not HDR/neon; **cool plum/Frost accents nowhere on the food**.
- [ ] Composition food-fills-frame, rule-of-thirds, shallow DoF on the key bite, intentional negative
      space — not dead-centre, not fully contained.
- [ ] **No on-image text / logo / watermark.**
- [ ] Reads as a **photograph** — not illustration / 3D / watercolour.

Any fail -> regenerate (new seed, or re-condition on the reference image for Tier 1) or fall back to the
warm gradient/monogram placeholder. **A weak placeholder beats an off-brand or uncanny frame.**

---

## 10. Sources

**The three test-kitchen systems this house style is built on:**

- **NYT Cooking** — two-angle system, soft directional daylight, matte tonal surfaces, prop restraint,
  one cohesive grade, centralised in-house studio (~75 recipes/mo). Triangulated from photographer/team
  statements (cooking.nytimes.com is bot-blocked to fetch):
  - Andrew Scrivani (NYT food photographer) — natural light, "the less you put on the plate," stark white
    plates, hands as styling tools, 50mm f/11-f/16 selective focus:
    `https://www.creativelive.com/blog/food-photography-tips-beginners` ·
    `https://www.andiemitchell.com/nytimes-photographer-andrew-scrivani-shares-tips-for-food-photography/`
  - Christopher Testani (NYT Magazine food) — north-facing window, overcast diffuse light, black duvetyne
    + V-flat negative fill, soft-silver bounce, mixing natural+artificial to mimic window light:
    `https://rangefinderonline.com/news-features/tips-techniques/how-christopher-testani-crafts-light-for-mouth-watering-food-photos-2/`
  - In-house studio / volume / consistency workflow:
    `https://www.editorandpublisher.com/stories/the-new-york-times-hires-new-photo-editor-for-cooking,257450` ·
    `https://www.spokesman.com/stories/2025/mar/18/new-york-times-cooking-app-finds-right-ingredients/`
  - Journalistic "real moments, not over-styled" brand posture:
    `https://www.adamlowedesign.com/the-new-york-times-cooking`

- **Food52** — natural daylight + black-foam-core negative fill ("strong dark shadows, bright saturated
  colours"), no mixed light, matte marble/wood/linen surfaces, two-angle workhorse, mood-board +
  shot-list + production-spreadsheet + print-and-pin review as the consistency system, tiny shooter
  roster (James Ransom, Bobbi Lin, Mark Weinberg):
  - `https://food52.com/blog/17516-what-actually-goes-on-at-a-food52-photoshoot`
  - `https://food52.com/blog/14330-behind-the-scenes-at-a-food52-photoshoot-and-how-to-get-a-piece-of-it-in-your-own-home`
  - `https://food52.com/story/10516-james-ransom-s-5-essential-photography-tips`
  - `https://blog.photoshelter.com/2014/07/instagram-food-photo-tips-food52s-james-ransom/`
  - `https://food52.com/story/2761-food-photography-101`

- **Mob / Mob Kitchen** (the non-overhead, angled subset only) — tight 45° / eye-level close-up,
  "get closer + rotate to the best section," one clean colour block behind the food, a codified 5-rule
  formula for many-shooter consistency. **Adopted:** the angle/crop discipline and the formula idea.
  **Rejected:** Mob's overhead default, its hard direct-sun + sharp shadows, and its saturated
  primary-colour card backdrops — all fight Sloe's calm warm palette:
  - `https://www.mob.co.uk/life/how-to-take-the-perfect-food-photo`
  - `https://www.redbrick.me/the-best-of-culinary-instagram-mob-kitchen/`
  - `https://cookbookreview.blog/2019/07/31/mob-kitchen-by-ben-lebus/`
  - `https://www.instagram.com/mobkitchenuk`

**Industry corroboration (angle taxonomy, soft directional/side-back light):**
`https://www.ice.edu/blog/food-photography-angles-and-composition` ·
`https://monicastevenson.com/food-photography-in-2026-how-styling-and-lighting-shape-the-perfect-shot/`

### 10b. Named reference handles

**Food photography:** `@_foodstories_` / `@thelittleplantation` — the aesthetic targets for dish light,
palette, and composition (§1-§6). These steer the Template A / Tier 1-2 register.

**Interior / world (kitchen set + lifestyle props):** **@jadewilson.f** — the pinned interior reference for
the Sloe test kitchen set, architecture cues, hardware finish, and Template D lifestyle frames. Two
consecutive same-creator reference drops from Grace (2026-06-07) confirmed convergence with the locked
spec. The kitchen reels from @jadewilson.f are the source for: the unlacquered/aged brass hardware spec,
the cream-perimeter + dark-oak-island two-tone variant (§3.1b), the architecture cues (plaster arched
niche/hood, apron-front sink, copper-on-brass-rail), the matte-black accent rule, and the expanded
lifestyle prop kit in Template D.

**Sloe internal anchors (these win on any conflict):**
- Prompt templates (Template A locked; Modern Clean §3c adopted; §6 engines/params):
  [`docs/brand/sloe-image-prompt-template.md`](./sloe-image-prompt-template.md)
- Locked test-kitchen reference image:
  [`docs/brand/sloe-test-kitchen-reference.png`](./sloe-test-kitchen-reference.png)
- Social/lifestyle worked set + pinned seeds:
  [`docs/brand/sloe-social-image-set-2026-06-07.md`](./sloe-social-image-set-2026-06-07.md)
- Palette: [`docs/brand/sloe/sloe-brand.md`](./sloe/sloe-brand.md)
- Secondary-colour decision (cool accents never on food):
  [`docs/brand/2026-06-07-secondary-colour-exploration.md`](./2026-06-07-secondary-colour-exploration.md)
- World / interior reference board:
  [`docs/brand/sloe-world-reference-board.md`](./sloe-world-reference-board.md)

---

## 11. Change control

This is a brand artefact owned by `brand-manager`. Any change to the angle stance, the light register, the
locked-kitchen definition, the prop/grade/composition rules, or the two-tier split is a brand decision: it
must stay consistent with [`sloe-image-prompt-template.md`](./sloe-image-prompt-template.md) (which wins on
conflict) and `_design-system.md` §11, and material changes are recorded in `docs/decisions/`.
