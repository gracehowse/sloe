# Sloe — Social-media lifestyle image set (2026-06-07)

> **What this is:** a set of 8 calm, editorial "app-in-a-beautiful-kitchen" lifestyle images for social
> (Instagram, TikTok) — with a possible secondary use on the landing/marketing site. The brief (Grace):
> *"aesthetic kitchens, displaying use of the app in a calm way"* — the visual register of Julienne's
> signup hero (an iPhone on a sunlit marble counter, herbs in a jar, ceramic, linen, soft natural light,
> no people).
> **Status:** assets generated and eyeballed against the §8 reviewer checklist. The new **Template D**
> they use is a *proposed addition* to the locked prompt template, pending `brand-manager` sign-off.
> **Engine:** FLUX 2 Pro (`fal-ai/flux-2-pro`) via fal.ai. ~9 generations, <$1.

---

## 1. The set

All files live in [`screenshots/social-set/`](../../screenshots/social-set/). PNG, generated at
1072–1920px on the long edge (FLUX 2 Pro returns slightly under the requested size). Naming is
`<letter>-<scene>-<aspect>.png`.

| File | Scene | Format | Suggested use |
|---|---|---|---|
| `a-hero-iphone-marble-4x5.png` | **Hero** — iPhone flat on a sunlit honed-marble counter, herbs in a glass jar, ceramic mug, folded linen. The Julienne-style shot. | 4:5 portrait | The lead social post; signup/landing hero candidate. |
| `b-iphone-backsplash-herbs-4x5.png` | iPhone propped upright against a cream zellige backsplash on warm wood; basil + rosemary in a jar, sea salt in a ceramic dish. | 4:5 portrait | IG/TikTok feed; "in your kitchen" carousel slide. |
| `c-ipad-dutch-oven-16x9.png` | iPad on a warm oak island beside a cast-iron Dutch oven; halved lemon + thyme on a board, olive oil behind. | 16:9 landscape | Landing banner; wide hero with text overlay on the right. |
| `d-iphone-chopping-board-1x1.png` | iPhone beside a wooden board of fresh ingredients — cherry tomatoes, avocado, coriander, parmesan. | 1:1 square | IG grid tile; "log what you cook" post. |
| `e-morning-coffee-oats-4x5.png` | Cozy morning — iPhone on a wooden breakfast table, steaming coffee mug, oats-and-berries bowl, golden side light. | 4:5 portrait | Morning-routine / retention post; story. |
| `f-iphone-linen-finished-dish-4x5.png` | iPhone on folded linen on marble, a finished tahini grain bowl just behind. | 4:5 portrait | "What to eat next" / finished-meal post. |
| `g-iphone-cookbooks-windowsill-1x1.png` | iPhone propped on a stack of cookbooks at a green windowsill; potted herb, ceramic jug of wooden utensils. | 1:1 square | IG grid tile; the **composited** variant below is the stronger pick. |
| `g-iphone-cookbooks-windowsill-1x1-composite.png` | **Same scene as `g`, with the real Sloe Today screen composited onto the phone** (see §3). | 1:1 square | The most "authentic" tile — shows the actual app. Prefer over the un-composited `g` where you want a recognisable product shot. |
| `h-iphone-island-parmesan-banner-16x9.png` | iPhone on a wooden island; sage, olive oil, parmesan wedge, linen runner. Phone left-of-centre, negative space right. | 16:9 landscape | Marketing banner with headline text in the right-hand negative space. |

**Aspect coverage:** 4:5 ×4 (a, b, e, f) · 1:1 ×3 (d, g, g-composite) · 16:9 ×2 (c, h). Covers IG portrait
+ grid + TikTok still + landing/banner.

---

## 2. Template D summary (the prompt these use)

Full spec: **§3b of [`sloe-image-prompt-template.md`](sloe-image-prompt-template.md)** (added 2026-06-07,
marked *proposed — pending brand-manager review*; templates A/B/C remain LOCKED and unchanged).

Template D is a new **lifestyle / in-context** imagery class — the app shown resting in a real, beautiful
kitchen, in the same `@thelittleplantation` / `@_foodstories_` editorial light and warm-muted-earthy
palette as Template A, but with the **lifestyle moment** (not a plated dish) as the subject. It is a
social/marketing class only — the in-app recipe/ingredient/object slots stay owned by Templates A/B/C.

Shape of a Template-D prompt:

```
Editorial lifestyle photograph of {DEVICE} {DEVICE_PLACEMENT} on {SURFACE} in a calm, beautiful home
kitchen. The phone screen softly shows {ON_SCREEN}. Nearby, a few considered props — {PROPS} — arranged
with restraint. Soft moody natural window light from the side, gentle shadows, slightly under-exposed for
an editorial mood. Shallow depth of field, the device sharp and the kitchen softly blurred behind. Warm,
muted, earthy colour palette — creams, oat, warm wood, sage green, soft plum, ochre. Unhurried, premium,
considered composition, an empty quiet scene with no people. Magazine-quality lifestyle photography in the
style of @thelittleplantation and @_foodstories_.
```

…then the **shared style anchor block** (§4) verbatim, then the **never-list** (§5) appended as a
trailing `Avoid: …` clause (FLUX 2 Pro on fal has no `negative_prompt` field — see §3 below), with the
D-specific extras: `cold glossy tech-product render, fake legible UI text on the screen, app store
screenshot mockup, floating phone, two phones`.

Key guard rails baked in: **no people / hands / faces** (the calm comes from the empty considered scene),
**no legible on-screen text** (keep `{ON_SCREEN}` vague so the model doesn't invent fake UI — composite the
real screenshot in post if the screen is hero-prominent), and **a clean modern device, never a cold
tech-product render**.

---

## 3. Compositing — what was done

The AI imagines the on-screen UI as soft abstract plum/cream/ochre blocks (deliberately vague, per
`{ON_SCREEN}` — this keeps the never-list's "no legible text" intact and avoids fake UI). For authenticity
on frames where the screen reads clearly, the real Sloe Today screenshot
([`public/landing/mock-today.png`](../../public/landing/mock-today.png)) can be perspective-composited
onto the phone glass.

**Done for one frame:** `g-iphone-cookbooks-windowsill-1x1-composite.png`. The phone in scene `g` is propped
near-frontal, so a 4-point homography warp maps the screenshot onto the glass cleanly — "Morning, Grace",
the 1,420-kcal multi-ring dial, GOAL/EATEN/BONUS row and macro tiles all read, and the Sloe plum/cream/sage
palette matches the warm scene. A faint sliver of the original AI screen remains at the very bottom edge of
the glass; minor and below the phone's fold.

**Not done (suggested UI kept) for the rest.** The hero `a` and most other frames have the phone at a steep
oblique angle or with a small screen — a composite there overhangs the bezel and looks pasted. Per the brief
(*"don't force it; a warm suggested UI is fine for social"*), those keep the AI's soft on-brand UI, which
already reads as warm plum/cream Sloe tones and never shows fake text.

**Method (no new deps):** `sharp` (already installed) for raw pixel I/O; a hand-rolled homography solve +
inverse bilinear warp in plain Node. The throwaway script lived at `/tmp/composite-screen.mjs` — it is not
committed (no code change in this task). To re-composite another frame: crop the frame to find the four
screen-glass corners `[TL, TR, BR, BL]` in pixels, then run the same warp (homography from the destination
quad to the screenshot rectangle, ~0.92 screen opacity so a touch of ambient reads through).

---

## 4. Quality note (honest)

- **8/8 pass the §8 reviewer checklist core gates:** photographic (not illustration/3D/watercolour), moody
  natural side-light, ceramic/linen/wood/marble surfaces, shallow DoF, warm muted earthy palette,
  **no people/hands/faces**, **no legible on-screen text**, appetising and anatomically sane.
- **The hero (`a`) is the standout** — it nails the Julienne reference (marble, herbs-in-a-jar, mug, linen,
  soft window light) and its suggested UI even reads as Sloe plum/cream.
- **Two minor prop-text artefacts**, noted not fixed (they don't break the "no on-image text" rule, which is
  about on-*screen* / logo text): in `g` a cookbook spine reads gibberish ("MATS DILN"); in `h` the olive-oil
  bottle has a soft illegible label. Both read as natural blurred kitchen props. Regenerate with a tighter
  prop list if a perfectly clean frame is wanted.
- **`g`/`h` screens are slightly more "app-like"** (faint pill/icon shapes, a running-figure glyph in `h`)
  than the calmer abstract blocks in `a`/`b`/`e` — still no legible text. For the cleanest abstract-screen
  look, `a`, `b`, `e`, `f` are the safest.
- **Composite caveat:** the `g` composite is convincing but has a faint original-UI sliver at the bottom edge;
  acceptable for social, tighten the bottom quad corner if used as a primary product shot.

---

## 4b. "Modern Clean" re-shoot (PROPOSED — 2026-06-07, pending brand-manager + Grace sign-off)

> **Why:** Grace approved Nano Banana Pro's *quality* but asked to shift the imagery *aesthetic* away from
> the moody / rustic register (weathered dark wood, under-exposed, earthy shadow) toward **"editorial
> modern clean"** — bright, airy, marble/tile, modern — keeping warm/calm/premium/food-hero/no-people/
> no-text. Reference: a Julienne shot (iPhone on honed white marble, sage zellige tile backsplash, herbs
> in a clear glass jar, speckled ceramic mug, linen, bright daylight). Spec: the new
> **"Modern Clean" variant** in [§3c of the prompt template](sloe-image-prompt-template.md) (templates
> A/B/C/D unchanged). **Local-only, not committed; no live asset overwritten.**

> **Engine:** `fal-ai/nano-banana-pro` (Nano Banana Pro), `resolution: 2K`, same seeds `70010`–`70080`
> (lifestyle) and `71010`–`71030` (food). No `negative_prompt` field → never-list appended as a trailing
> `Avoid: …` clause, plus the Modern-Clean extras (`weathered rustic dark wood, under-exposed, heavy
> moody shadow, dim, dark, gloomy, cold clinical lighting, washed-out flat lighting`).

**Where:**
- Lifestyle/social (8): [`screenshots/social-set/modern-clean/`](../../screenshots/social-set/modern-clean/) — same 8 scenes (a–h), re-set on marble / sage zellige tile / pale light wood with bright airy daylight.
- Food Template-A (3): [`screenshots/imagery-proto/modern-clean/`](../../screenshots/imagery-proto/modern-clean/) — `crispy-gochujang-salmon-bowl.png`, `warm-tahini-grain-bowl.png`, `baked-frittata-skillet.png`, on honed marble / light stone with bright clean light.

**Verified (every image Read against §8):**
- **11/11 read editorial modern clean** — bright, airy, marble/grey-stone surfaces + sage-green glazed
  zellige tile, fresh herbs in clear glass, clean speckled ceramics, linen; **warm + calm + premium**
  held (warm ceramic / pale-wood accents carry the warmth so nothing reads clinical or cold).
- **No people / hands / faces, no logos / watermarks, no legible on-screen text** in any frame. The
  cookbook spines in `g` are clean this time (no gibberish), an improvement on the moody set.
- **Standouts:** hero `a` (textbook Julienne — white marble, sage zellige, herbs-in-glass, speckled mug,
  linen, bright window light) and `f` (calmest abstract screen). The baked **frittata** is the strongest
  food frame.
- **Screens:** `a`, `d`, `e`, `f`, `g`, `h` keep soft abstract plum/cream blocks (no text); `b`, `c` are
  a touch more app-like (tile/pill shapes) but still text-free. Composite the real Today screenshot in
  post for any frame where the screen is hero-prominent (same method as §3).

**Food call (the test this batch was for — honest):** the **dishes look better on marble/light stone than
on the weathered wood.** Against the dark baseline (e.g. `imagery-proto/chicken-frittata.png`,
under-exposed on dark planks), the marble re-shoots are brighter and the food colour pops far harder —
golden egg / red pepper / green herb on the frittata, the gochujang glaze sheen on the salmon, the squash
+ chickpea + lemon on the tahini bowl all read more vividly and more premium on the light surface.
Recommendation: **move Template-A food to the Modern Clean surface too**, not just the lifestyle set —
subject to brand-manager + Grace sign-off. (The one thing wood still did better was a cosy, "homemade"
warmth; the marble version trades a little of that for a cleaner, more editorial, more modern feel — which
is exactly the direction asked for.)

---

## 5. How to regenerate / extend

1. **Engine:** `fal-ai/flux-2-pro` via the fal MCP (`run_model`) — or any FLUX 2 Pro caller. The fal endpoint
   exposes only `prompt`, `image_size`, `seed`, `output_format`, `safety_tolerance` — **no `negative_prompt`**
   — so the never-list is appended to the prompt as a trailing `Avoid: …` clause.
2. **Prompt:** fill Template D (§3b of the prompt template), append the §4 anchor + §5 avoid-clause.
3. **`image_size`:** pass an explicit object — `{ width: 1080, height: 1350 }` (4:5), `{ 1080, 1080 }` (1:1),
   `{ 1920, 1080 }` (16:9). FLUX returns a touch under the request; fine for social.
4. **`seed`:** the set used `70010`–`70080` (one per scene) for reproducibility. Reuse a seed to iterate a
   scene; change it for a fresh take.
5. **Review:** Read every output against the §8 checklist before shipping. Regenerate (new seed) on any fail.
   A weak warm-gradient placeholder beats an off-brand or uncanny frame.
6. **Composite (optional):** see §3 — only worth it on near-frontal-screen frames.

---

## 6. Links

- Prompt template (Templates A/B/C locked; **D added, proposed**):
  [`docs/brand/sloe-image-prompt-template.md`](sloe-image-prompt-template.md)
- Imagery engine / cost strategy:
  [`docs/decisions/2026-06-03-image-generation-strategy.md`](../decisions/2026-06-03-image-generation-strategy.md)
- Related decision (universal in-app food imagery, same engine):
  [`docs/decisions/2026-06-07-universal-food-imagery.md`](../decisions/2026-06-07-universal-food-imagery.md)
- Sloe palette: [`docs/brand/sloe/sloe-brand.md`](sloe/sloe-brand.md)
- Real screenshot used for the composite: [`public/landing/mock-today.png`](../../public/landing/mock-today.png)
- Generated assets: [`screenshots/social-set/`](../../screenshots/social-set/)
