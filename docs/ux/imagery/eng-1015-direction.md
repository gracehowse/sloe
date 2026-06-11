# ENG-1015 — Fallback food-imagery art system (direction + first samples)

2026-06-10 · groundwork only — no app code touched. Status: **PROPOSED,
needs Grace's calibration sign-off before batch generation** (see §7
"Open calibration tension"). Samples live at
`apps/mobile/assets/imagery/fallbacks/samples/`.

## Why

The design-director review named the grey utensil glyph — the fallback on
every Log/Library/recipe row without a user photo — the single biggest
premium gap. The 2026-06-10 fresh-eyes challenge ranks ENG-1015 imagery as
"the single biggest unlock" (priority #2 after the ground/material
inversion), and the §1 inversion gives the art its stage: **white gallery
cards on a cream `#FBF8F3` ground**. The decided direction is
painterly/watercolour meal illustration — NOT stock photography (a photo
fallback would lie about the user's actual food; an illustration honestly
reads as "category artwork"), NOT flat geometric icons (the current gap).

## 1. Style spec

- **Medium:** soft watercolour-gouache with believable depth and light —
  painterly realism, visible pigment granulation and paper texture *inside
  the painted subject only*. Never flat vector, never cartoon, never
  children's-book. Register: premium cookbook plate illustration.
- **Palette constraints (tied to `apps/mobile/constants/theme.ts`):**
  - Ground (generation only, stripped before ship): flat warm cream, target
    the oat token `#FBF8F3` (`Colors.light.background`).
  - Subject: muted natural ingredient colours; warm undertones pulled toward
    **sage `#5E7C5A`** (`Accent.success`) and **clay `#C8794E`**
    (`Accent.carbs`); no saturated primaries, no neon.
  - Shadow: ONE soft contact shadow under the dish, tinted toward the plum
    ink family (`#3B2A4D` / `#221B26`) at low opacity — this is the Sloe
    signature in the art (matches `Elevation.cardSoft`'s plum-tinted lift).
  - Avoid dominant reds near `Accent.destructive` `#B04434` — red owns the
    over-budget semantic in-product.
- **Composition rules:** single dish, centred, generous margins — subject
  occupies ~55–65% of frame width (tall vessels: cap at ~65% of frame
  HEIGHT — see smoothie drift, §6); one consistent slightly-elevated
  three-quarter angle; soft diffused daylight from the **upper left**; no
  table, no props, no cutlery (unless the dish demands it), no text, no
  people, no hands, no borders, no vignette. No ambient steam/effects
  (the ramen sample grew steam — ban it in the scaffold going forward;
  inconsistent ambient effects are a drift vector).
- **Background:** production assets ship **transparent** (background-removed
  PNG). Measured fact: the model renders "cream" at ~`#F7F1E6` — internally
  consistent across all six samples (±2 RGB) but visibly warmer than the
  `#FBF8F3` token, so a baked-in background would read as a warm square on
  white cards. Generate on flat cream (the model holds it flat and clean),
  then strip (fal `birefnet` / `rembg`, or Preview/`vips` locally) so the
  card supplies the ground in both light and dark mode.
- **Consistent light:** upper-left diffuse, always. Any asset lit from
  elsewhere is a reject regardless of how good it looks alone.

## 2. Asset taxonomy

**24 meal-category fallbacks** (deterministically selected per row, §5):

| # | id | covers |
|---|----|--------|
| 1 | `breakfast-bowl` | yoghurt/porridge/granola/acai bowls |
| 2 | `eggs` | fried/scrambled/boiled/omelette/shakshuka |
| 3 | `pancakes-waffles` | pancakes, waffles, french toast, crepes |
| 4 | `toast-sandwich` | toast, sandwiches, bagels, burritos-as-wrap |
| 5 | `smoothie` | smoothies, shakes, juices |
| 6 | `baked-goods` | muffins, banana bread, scones, croissants |
| 7 | `salad` | leaf + grain salads, slaws |
| 8 | `soup` | soups, broths, stews-as-soup, chowder |
| 9 | `pasta` | pasta, lasagne, gnocchi, mac & cheese |
| 10 | `ramen-noodles` | ramen, pho, udon, noodle bowls |
| 11 | `rice-bowl` | rice bowls, poke, bibimbap, risotto, paella |
| 12 | `stir-fry` | stir-fries, fried rice, teriyaki pans |
| 13 | `curry` | curries, dal, tagine, korma |
| 14 | `fish` | fish fillets, salmon, white fish, shellfish |
| 15 | `chicken` | roast/grilled chicken, wings, schnitzel |
| 16 | `red-meat` | beef, steak, lamb, pork, meatballs |
| 17 | `burger` | burgers, patties, sliders |
| 18 | `pizza` | pizza, flatbreads, calzone |
| 19 | `tacos-wraps` | tacos, fajitas, quesadillas, gyros |
| 20 | `vegetables-sides` | roast veg, greens, mash, fries-as-side |
| 21 | `legumes-grains` | beans, lentils, chickpeas, quinoa, couscous |
| 22 | `dessert` | cakes, brownies, ice cream, puddings |
| 23 | `fruit` | fruit plates, fruit salad, single fruit snacks |
| 24 | `drink` | coffee, tea, cocoa, non-smoothie drinks |

**4 slot glyphs** (`slot-breakfast`, `slot-lunch`, `slot-dinner`,
`slot-snack`) — same painted register, simpler single-object subjects
(e.g. a soft-boiled egg in a cup / a lunch bowl / an evening plate / a
small handful of almonds), each carrying a whisper of its `SlotColors`
hue (amber `#C9892C` / sage `#5E7C5A` / damson `#6A4B7A` / teal
`#4A7878`) in the shadow or an accent — never as a tint wash.

## 3. Sizing, format, location

- **Master:** 1024×1024 PNG, transparent, archived outside the bundle
  (generation output; keep originals for re-crops).
- **Shipped:** 512×512 PNG transparent ≈ 3× a ~170 pt render — covers the
  64 pt row thumbnail (needs 192 px @3x) and the larger gallery-card slot
  with headroom. One size ships; RN scales down well from 512.
- **Naming:** `fallback-<category-id>.png` (kebab-case ids from §2),
  `slot-<slot>.png` for glyphs. Samples (pre-ratification) keep plain
  descriptive names under `samples/`.
- **Mobile home:** `apps/mobile/assets/imagery/fallbacks/` (created in this
  change). **Web mirror (parity, non-negotiable):** the same files under
  `public/imagery/fallbacks/` when implementation lands — one generation
  pipeline, two copies, same hashes.
- Budget note: 24 + 4 assets at ~150–300 KB each ≈ 5–7 MB raw; run through
  `oxipng`/`pngquant` before bundling (target ≤ 2.5 MB total). If bundle
  pressure bites, WebP at ~60% the size is the fallback format on both
  platforms.

## 4. Generation scaffold (LOCKED for batch runs — reuse verbatim)

Model: **`fal-ai/nano-banana-pro`** · `resolution: "1K"` ·
`aspect_ratio: "1:1"` · `output_format: "png"` · `seed: 1015` (fixed).

`system_prompt` (the style lock — identical for every asset):

> You are generating ONE asset in a fixed 24-piece illustration set for a
> premium iOS recipe app. Every asset must match the locked house style
> EXACTLY: soft watercolour-gouache food illustration with believable depth
> and light (painterly realism — not flat vector, not cartoon, not
> children's-book), a single dish centred with generous margins, seen from
> one consistent slightly-elevated three-quarter angle, soft diffused
> daylight from the upper left, one soft shadow beneath the subject tinted
> toward muted plum, muted natural ingredient colours with subtle
> sage-green and warm clay undertones, gentle pigment granulation and paper
> texture INSIDE the painted subject only. Background: completely flat,
> untextured warm cream #FBF8F3, edge to edge — no vignette, no border, no
> table, no props, no text, no people, no hands, no watermark. Calm and
> appetising: premium cookbook plate-illustration register.

`prompt` (per asset): one sentence, *subject only* — e.g. "A steaming bowl
of ramen: wide ceramic bowl of noodles in golden broth, two soft-boiled egg
halves, sliced spring onion, a sheet of nori leaning on the rim."

Amendments for the next batch (learned from these six, fold into the
system prompt): add "no steam, no rising vapour"; add "the dish occupies no
more than two-thirds of the frame in either dimension" (tall-vessel guard).
Post-process: background-strip → 512×512 → `oxipng`.

## 5. How rows pick a fallback (design — implementation is ENG-1015 proper)

Deterministic, never random per render, identical on web + mobile:

1. **Classify by title keywords.** Normalise the recipe/log title
   (lowercase, strip diacritics + punctuation). Walk an ORDERED shared
   keyword→category table (e.g. `ramen|pho|udon|noodle → ramen-noodles`
   before `soup`; `smoothie|shake → smoothie` before `drink`). First match
   wins. The table lives in shared code (one source, web + mobile import
   it) so the same title maps to the same art everywhere.
2. **Slot-aware default.** No keyword hit → fall back by meal slot:
   breakfast → `breakfast-bowl`, lunch → `salad`, dinner → `rice-bowl`,
   snack → `fruit`.
3. **No slot either** (library items): stable hash of the normalised title
   (FNV-1a) modulo a small curated subset of broadly-plausible categories
   (`rice-bowl`, `pasta`, `salad`, `vegetables-sides`) — stable across
   sessions and devices because it derives only from the title.

Slot glyphs (`slot-*`) stay the art for slot HEADERS/empty slots, not for
recipe rows. If nutrition-matching later exposes a canonical ingredient or
cuisine signal, it can upgrade step 1 — the contract (title in →
category id out, deterministic) doesn't change.

## 6. Samples + per-sample verdict (six generated 2026-06-10, seed 1015)

All six: `apps/mobile/assets/imagery/fallbacks/samples/` — 512×512 PNG,
cream background still baked in (samples predate the strip step).

| file | verdict | notes |
|------|---------|-------|
| `ramen-bowl.png` | **HOLDS** | Anchor of the set: angle, ceramic, plum shadow, granulation all on-spec. One flaw: it grew steam wisps no other asset has — ban steam in the scaffold. |
| `berry-breakfast-bowl.png` | **HOLDS** | Closest sibling to the ramen — same bowl family, same light, same shadow. The set's consistency proof. |
| `roast-chicken.png` | **HOLDS (minor drift)** | Slightly warmer/more saturated golden register and finer linework detail than the bowls; reads ~half a notch more "illustrated". Acceptable; watch saturation creep on golden/roasted foods in batch. |
| `green-salad.png` | **HOLDS** | Sage-forward palette lands exactly on the token brief; angle + shadow match. |
| `pasta-tomato.png` | **HOLDS** | Same bowl/angle/shadow; tomato red stays muted-rustic, safely clear of the destructive-red semantic. |
| `berry-smoothie.png` | **DRIFTS (most)** | Tall vessel forced a near-eye-level angle and the subject fills ~80% of frame height vs ~60% for bowls; glass is rendered tighter/more linear. On-brand plum colour, but composition scale breaks the rhythm in a grid. Regenerate with the tall-vessel guard line. |

Background check (measured): all six corners sit within ±2 RGB of
`#F7F1E6` — excellent internal consistency, but warmer than the `#FBF8F3`
token. Confirms the ship-transparent rule in §1.

## 7. Honest self-critique + risks + recommended path

**Open calibration tension (needs Grace's call before batch).** The
2026-06-02 warm-coaching board records Grace's calibration as "stylised
photoreal, NOT loose watercolour" for ingredient singles, and hyperreal
editorial photography for finished meals. The ENG-1015 decision (post
fresh-eyes, 2026-06-10) is painterly/watercolour for the FALLBACK tier.
These can coexist as a three-tier system — (a) user/recipe photos when
they exist, (b) hyperreal generated heroes for flagship recipe content,
(c) painterly fallbacks that honestly signal "category art, not your
food" — but these six samples sit closer to classic watercolour than to
Julienne's gouache-photoreal. If Grace's 2026-06-02 calibration still
holds, the dial moves one notch toward realism (denser pigment, tighter
edges, more dimensional light) via one scaffold line — re-prove with 3
test assets before the batch of 24. Do not generate 24 before this call.

**Batch-generation risks at 24+ assets (prompt-only):**

- *Composition drift on non-bowl subjects* — proven by the smoothie. Tall
  glasses, flat pizzas, handheld tacos all fight the three-quarter-bowl
  prior. Mitigation: per-shape guard lines + generate 3 candidates per
  category, human-pick one.
- *Saturation/treatment creep* — proven mildly by the chicken. Golden and
  red foods pull the model warmer and more detailed. Mitigation: review
  assets side-by-side in a contact sheet, not one-by-one.
- *Ambient-effect inconsistency* — steam appeared once in six. At 24+,
  uncontrolled extras (garnish scatter, sauce drips, props) WILL appear.
  Mitigation: explicit bans in the scaffold; reject on sight.
- *Ceramic identity wandering* — six assets stayed in one stoneware family
  by luck as much as prompt; 24 may not. Strongest fix is style-reference
  conditioning (below), not more prompt adjectives.
- *Model drift over time* — a hosted model can change under the same
  endpoint id; regenerating asset #25 in six months may not match. Archive
  masters; regenerate the whole set, not single assets, after any model
  change.
- *Licensing* — AI-generated assets shipped in a paid product: confirm
  Google/Gemini (Nano Banana Pro) output-usage terms via `legal-reviewer`
  before the production batch (flagged in the warm-coaching board too).

**Recommended path (one recommendation):** **prompt-scaffold +
style-reference conditioning, human-curated; LoRA only if the set
outgrows it.** Concretely: lock the scaffold (§4, with the two
amendments), get Grace's calibration call, then generate every new asset
via `fal-ai/nano-banana-pro/edit` passing 2–3 APPROVED samples (ramen +
berry-bowl as anchors) as style-reference inputs — multi-image
conditioning is the cheap LoRA-equivalent and directly attacks the
ceramic/angle/treatment drift that prompts alone can't pin. Three
candidates per category, contact-sheet review, pick one. Cost: ~£3–6 for
the full 28-asset set including rejects. A trained FLUX LoRA is the
stronger lock and stays the scale path if the vocabulary grows past ~40
assets or needs ongoing additions (training needs ~20 approved images —
which this curated set conveniently becomes). Commissioning an
illustrator is the premium ceiling but loses regenerate-on-demand and
costs weeks; not justified for a fallback tier pre-launch.

---

*Generated with fal-ai `nano-banana-pro` (seed 1015, 1K, 1:1). Masters +
samples from this run: see `samples/`. Implementation (selection hook,
row/card wiring, web mirror) is ENG-1015 proper — tracked in Linear, not
deferred silently.*
