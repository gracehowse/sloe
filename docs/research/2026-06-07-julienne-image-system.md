# Julienne's recipe-image system — reverse-engineered, and how Sloe leads from here

> **Date:** 2026-06-07 · **Area:** Imagery / competitive · **Status:** Research (informs the
> universal-food-imagery decision and the locked Sloe prompt template)
> **Owner:** brand-manager (imagery) + product-lead (competitive)
> **Source material:** three independent research passes — (1) bundle/changelog technical
> reverse-engineering, (2) forensic read of all 7 App Store screenshots + the website og-image,
> (3) coverage/triggers/monetisation/sentiment benchmark vs Sloe's prior Julienne analysis.
> **Benchmarks against:** [`docs/brand/sloe-image-prompt-template.md`](../brand/sloe-image-prompt-template.md)
> (Template A/B/C, FLUX 2 Pro) · [`docs/decisions/2026-06-07-universal-food-imagery.md`](../decisions/2026-06-07-universal-food-imagery.md)
> · [`docs/decisions/2026-06-03-image-generation-strategy.md`](../decisions/2026-06-03-image-generation-strategy.md).

## TL;DR

Julienne (Afternoon Labs, iOS-only, 4.83★ from ~24 ratings) auto-generates a recipe image for every
recipe with **Google's Gemini 3 Pro Image** ("Nano Banana Pro"), falling back to **Imagen 4 Ultra** on
quota. Generation is **free, silent, automatic, and unlabelled** — there is no "generate" CTA, no AI
badge, no preview/approve. Their visual signature is a **ruthlessly consistent overhead, single-round-
artisan-plate-on-warm-cream** look that makes a grid of unrelated dishes read as one curated catalogue.
Users don't comment on the images at all (neither praise nor complaint); their loud complaints are
**data-loss and crashes**, not image quality.

Sloe's locked system is deliberately *different on every axis that matters*: a **moody side-lit editorial
register** (not flat overhead), a **separate explicit "Generate an image" CTA with preview/approve and a
visible AI label** (not silent), and **FLUX 2 Pro** (not Google). The strategic move is **not to copy
Julienne's plate-on-cream look** — it's to match (and exceed) Julienne's *coverage* (every row imaged, via
the universal-ingredient plan) while keeping a distinct, warmer signature and a more honest provenance
posture.

---

## 1. The image pipeline / engine

### 1.1 What's confirmed (from the shipped web bundle, primary source)

The withjulienne.com web bundle (`assets/index-f24fde0f.js`) leaks the exact model names, service
classes, and Cloud Function endpoints as literal strings, so the core stack is **confirmed from source**,
not inferred.

| Fact | Detail | Confidence | Source |
|---|---|---|---|
| **Primary generator = Google Gemini 3 Pro Image** | `GeminiImageService`/`…V2`; `getCurrentModel()` returns `'gemini-3-pro-image-preview'` ("Nano Banana Pro"); calls Firebase Cloud Function `generateRecipeImageGemini3`. Log: `[Gemini] Calling Firebase function: {function:'generateRecipeImageGemini3', model:'gemini-3-pro-image-preview'}` | **High** | bundle strings |
| **Fallback = Imagen 4 Ultra** | On quota: `"Gemini 3 quota exceeded, falling back to Imagen 4.0 Ultra"`, sets `model='imagen-4.0-ultra'`, logs `"Successfully generated image with Imagen 4.0 fallback"` | **High** | bundle strings |
| **No third-party diffusion in the consumer path** | No Replicate / fal / SDXL / FLUX strings exist anywhere. Whole consumer image path is **Google** (Vertex/Gemini API) | **High** | bundle (absence) |
| **Backend = Firebase/GCP** | Project `julienne-3555a`, `us-central1` Cloud Functions (`generateRecipeImageGemini(3)`, `generateRecipeInsight`, `generateOgImage`, …). Auth via `securetoken.google.com` + Apple Sign-In; Stripe billing; Cloudflare Turnstile + reCAPTCHA Enterprise | **High** | bundle strings |
| **OpenAI used only for audio** | The sole `api.openai.com` call is `/v1/audio/transcriptions` (Whisper, for video/voice recipe import). ProductHunt's "Built with OpenAI" is true for **text/LLM extraction**, not images | **High** | bundle; ProductHunt |
| **Generated on-demand at import/create, then persisted** | Triggered by `onGenerateImage`/`onGenerateAIImage`/`RecipeUploadImageService.generateAndSetRecipeImage`; progress `"Generating AI image for '<recipe>'… This may take 30-60s"`; output stored in Firebase Storage against the recipe id — **one persisted asset per recipe**, not regenerated per view | **High** | bundle; changelog v1.3.13 |
| **Text-to-image by default; optional img2img for tagged categories** | Client sends `{id, name, tags, first ~5 ingredients}` + optional `thumbnail_url`. A `referenceImage:{data,mimeType}` is attached **only** when a tag matches a curated `_REFERENCE_TAGS`/`TAG_PRIORITY` set (`hasReference`/`matchedTag`; skip reason `'no-reference'`) — a curated subset is style-anchored to a reference for house-style consistency | **High** | bundle strings |
| **Cost-managed** | A user/operator toggle `dashboardUseGeminiImageOnGenerate` ("Gemini images" on/off, skip reason `'toggle-off'`) + the Gemini→Imagen quota fallback indicate active rate/cost control. Gemini 3 Pro Image GA ≈ **$0.134/image**; generate-once-and-cache keeps unit economics viable | **Med** | bundle (toggle/fallback); public pricing |

### 1.2 Midjourney is a red herring — it's their *marketing* studio, not the app pipeline

The bundle also contains a `MidjourneyService` (Cloud Run `submitmidjourneyprompt`/`…result`/`get…result`)
behind an operator Dashboard for `ig-recipes` / "Educational Visuals" / "Historical Visuals". It generates
a **prompt string the operator copies to clipboard** (`"🎨 AI prompt copied to clipboard! Ready to paste
into Midjourney"`) with suffixes `--v 7.0 --ar 4:5` / `--ar 1:1`, plus a manual result-submission path.
This is an **internal Instagram content studio**, semi-manual, **distinct from the consumer per-recipe
generator** (which is Gemini/Imagen, fully automated). Easy to mistake one for the other; they are
separate systems.

### 1.3 What's inferred (not in the client bundle)

- **The exact consumer prompt template** lives server-side in `generateRecipeImageGemini3` — only
  `{name, tags, top ~5 ingredients, optional reference}` are passed up. Best inference (by analogy to the
  visible Midjourney templates): an *"appetizing professional food photograph of {recipe}, {ingredients},
  natural light, styled"* shape. **Not confirmed.**
- **Day-to-day Gemini-vs-Imagen share** — the branch is visible, the hit-rate is not.
- **Whether the Pro "curated library" images are batch-pre-generated** (possibly via the Midjourney studio)
  vs the same Gemini consumer path.

### 1.4 Provenance / labelling

- **No visible AI label in-app.** The only "AI" wording is creation-time UI (`🎨 Generate AI Image`,
  `Generating AI image for "<x>"…`). No badge, watermark, caption, or provenance text on the rendered
  recipe image. Finished images are presented as ordinary recipe photos.
- **But machine-detectable.** Gemini/Imagen output carries an **invisible SynthID watermark** at the
  model level by default — so the images *are* detectable as AI even though Julienne adds no human-visible
  label. (Open: whether Julienne strips/retains SynthID or any C2PA metadata through the Firebase Storage
  round-trip.)

**Makers:** Regy Perlera (co-founder/designer, also Staff Designer at Airbnb; ex-Snap/Nike/StockX/Amazon/
Square) + Komran Ghahremani (software engineer). Company: Afternoon Labs, Inc. The `bmcmahen/julienne`
GitHub repo is a **2019 name collision** (unrelated React/Firebase sample), not this app.

---

## 2. The visual style + inferred prompts, per imagery type

All style findings below are forensic reads of Julienne's **own curated showcase** (7 App Store
screenshots + the website og-image), so they may idealise the in-app reality — real social-media imports
won't match the cream-plate template, so the live app likely shows a **mix**: pristine generated/curated
catalogue images + messier user-imported thumbnails.

### 2.1 Recipe / dish images — the signature

**The locked variables (this is the whole fingerprint):**

| Variable | Julienne's lock |
|---|---|
| **Camera** | True top-down / directly overhead |
| **Container** | **One** round plate or shallow bowl — never square, never multiple |
| **Plate material** | Artisan/stoneware, often speckled reactive glaze |
| **Plate colour** | **Deliberately rotated** — terracotta-coral, dusty rose, sage grey-green, warm tan/camel, cream-white, slate. This variety against the uniform background is half the brand signature |
| **Background** | Uniform warm cream/off-white (~`#F0EBE2`), identical everywhere |
| **Light** | Soft, flat, even, daylight-temperature — no harsh highlight, no spotlight, no mood |
| **Shadow** | Single soft short contact shadow grounding the plate |
| **Crop** | Centered, loose, plate fully in-frame, generous negative space |
| **Never** | No cutlery, no napkin, no hands, no second plate, no props inside the frame, no busy/dark/wooden backdrop, not angled |

The smoking gun is App Store screenshot 6 ("Over 1,000 trending recipes"): ~35 unrelated dishes, **every
one** overhead-on-one-round-plate-on-cream with the same soft shadow. The same treatment recurs in the
recipe-detail hero and the feed cards (confirmed across 4 of 7 screenshots). The food and the plate colour
vary; the *system* never does. This uniformity is "expensive with real shoots, trivial with a fixed prompt
template" — consistent with the confirmed AI pipeline in §1.

**Inferred Julienne dish prompt** (their look, *for reference / contrast — not Sloe's*):

> Overhead top-down food photograph of {DISH}, on a single round artisan stoneware {terracotta | dusty
> rose | sage | cream | slate | camel} plate with a subtly speckled reactive glaze, centered on a plain
> warm cream off-white (#F0EBE2) seamless background, soft even diffused natural daylight, gentle short
> contact shadow under the plate, light fresh-herb garnish, generous negative space, editorial cookbook
> aesthetic, photorealistic, 1:1.
> _Negative: no cutlery, no napkin, no hands, no second plate, no square plate, no dark/wooden background,
> no harsh light/hard shadow, no steam, no text/watermark, not angled._

### 2.2 Ingredient images — yes, they have them, in two styles

Per-ingredient imagery is **pervasive, not incidental** — it appears in two places:

1. **Onboarding allergy picker** (shot 9): each allergen is a single isolated hero ingredient on **pure
   white** in a rounded card — shrimp, peanut cluster, toast slice, fried egg, milk bottle, beans.
   Near-top-down with a slight tilt to reveal form, soft contact shadow, lots of padding,
   premium-product-render quality.
2. **Shopping list + recipe-detail thumbnails** (shots 8/5/2): smaller rounded-square photos — ground
   beef, garlic cloves, halved orange, whole rotisserie chicken — top-down on a **light, faintly-textured
   white** surface, soft shadow, tighter crop. Same "single ingredient, isolated, soft shadow" DNA at
   thumbnail scale, slightly less stylised.

(Open: whether the ingredient thumbnails are a finite pre-rendered library or generated on demand —
matters for how an equivalent system scales.)

### 2.3 Decorative / object imagery — raw-ingredient props, marketing only

- The decorative layer is **loose raw produce scattered around device mockups, in marketing surrounds
  only** — the og-image floats two iPhones on cream flanked by fresh asparagus + dry fusilli; App Store
  shot 2 places cut red onions behind the phone. These props share the recipe-photo lighting (soft
  daylight, cream ground) so the composition stays coherent.
- **No photographic cookware anywhere** — no utensils, Dutch ovens, frying pans, or staged kitchen
  scenes. The only cookware (a quick-action pot, a shopping bag) appears as **small flat illustrated/3D
  icons**, not photography.

### 2.4 Aspect ratios observed

- Recipe detail hero ≈ landscape banner (~16:9). Recipe grid/feed cards = **square (1:1)**. Ingredient
  allergy tiles = square-ish rounded cards. Ingredient thumbnails = small rounded **squares (1:1)**.
- Safe generation targets: **1:1 master** for dishes and ingredients (crops to any card) + optional 16:9
  for the detail hero.

---

## 3. Coverage, placeholder, triggers, free-vs-paid, sentiment

### 3.1 Coverage + the "no more default images" claim

- **Confirmed feature**, verbatim App Store release note: *"Recipe image generation! No more default
  images for your recipes."* Mechanically: on import/save, if a recipe has no source photo, Julienne calls
  the Gemini function to synthesize one rather than showing a generic placeholder.
- **Timing ≈ late Dec 2025**, soft on exact version. One fetch attributed it to **v1.3.13 (12/29/2025)**;
  a re-check of that version's notes surfaced only "pork dietary preference + longer video limit + bug
  fixes" and could not re-confirm the image line sits in 1.3.13 specifically. The feature unambiguously
  exists and is recent; the precise version binding is **unverified**. (App first released Apr 2025; latest
  seen ~v1.3.21/1.3.22.)

### 3.2 Triggers — the biggest open gap

- **Not publicly documented.** No source states on-save vs on-view vs on-import, instant vs queued.
- **Best inference: automatic + silent.** The framing "No more default images for *your* recipes" (every
  recipe gets one, no CTA mentioned anywhere) strongly implies auto-generation with no user step — the
  **opposite** of Sloe's planned user-initiated CTA-with-preview. Confidence **low**; resolving it needs
  hands-on capture of a live import.

### 3.3 Placeholder / fallback

- The task's "grey circle" placeholder could **not be corroborated** in any indexed source — treat it as
  Grace's first-hand observation, not a sourced fact. What *is* confirmed: a default/placeholder system
  existed before image-gen ("No more default images" presupposes prior defaults), and image-gen now
  backfills it. Whether the residual gen-pending/gen-failed state is a grey circle is plausible but
  unverified.

### 3.4 Free vs paid — image-gen is **FREE**, not Pro-gated

- **Confirmed.** Julienne Pro unlocks only: **cloud sync, full curated recipe library, recipe sharing,
  ad-free**. Image generation is in **none** of the four Pro bullets — it's standard functionality on the
  ad-subsidised free tier. This confirms the 2026-06-03 competitive correction and refutes the earlier
  "Pro-gated" assumption (DishGen gates it; **Julienne does not**).
- **Pro pricing:** ~$3.99/mo, ~$19.99–29.99/yr, **$59.99 lifetime**. The lifetime tier is itself a
  competitive signal — a one-time-purchase escape hatch a subscription-only product can't mirror 1:1.

### 3.5 User sentiment — the images are *silent*

- Across App Store reviews (4.8★, ~24 ratings), AppAdvice, ProductHunt, MWM, and the fulcra.design
  comparison: **zero** reviews mention the AI images — no "they look the same", no uncanny/wrong-dish, no
  "fake photos". Searches for an uncanny-food controversy returned only general academic literature,
  nothing Julienne-specific.
- **Interpretation:** generated images are accepted as **ambient/unremarkable** — users neither rave nor
  revolt. Silent auto-gen has **not** triggered visible backlash. (Caveat: N≈24 is thin; richer signal
  likely lives on TikTok/IG where the audience is and web search under-indexes.)
- **The loud complaints are data-loss + crashes**, not images. Verbatim: *"App frequently crashes when
  uploading recipes and when it crashes it doesn't save the recipes previously uploaded"* (1★, 07/2025);
  *"every time I try to edit or customize a recipe, my changes don't save"* (12/2025). Independent
  reviewers praise the UI ("absolutely gorgeous") but flag thin depth (chat "needs work", meal planning
  "none", scaling "only 1.0 increments"). **Durability — not image quality — is Julienne's exposed flank,
  and Sloe's wedge** (goals/health layer + retention).

---

## 4. Comparison — Julienne vs Sloe's locked system

### 4.1 Engine + pipeline

| Dimension | Julienne | Sloe (locked) |
|---|---|---|
| **Primary model** | Gemini 3 Pro Image ("Nano Banana Pro") | **FLUX 2 Pro** (Black Forest Labs) via fal.ai |
| **Fallback** | Imagen 4 Ultra (on quota) | FLUX 2 Flex (budget) / GPT Image (tricky plates) — same prompt |
| **Per-image cost** | ~$0.134 (Gemini GA) | **~$0.01–0.04** (≈3–13× cheaper) |
| **Backend** | Firebase/GCP Cloud Functions | Supabase edge function + Supabase Storage |
| **Negative prompt** | Server-side, opaque | Explicit shared never-list (§5) — *but* fal's `flux-2-pro` exposes **no separate `negative_prompt` field**; Sloe currently appends it as a trailing `Avoid:…` clause (engine caveat, universal-imagery doc §note) |
| **Cache** | One persisted asset per recipe id | Cache by **normalised hash of (ingredient list + dish name)** — bypass-resistant; popular Reels self-fund via cache hits |
| **img2img** | Reference-image for tag-matched categories | Text-to-image only (legal guard: never seed from a scraped photo) |

### 4.2 Style / signature

| Axis | Julienne | Sloe (Template A) |
|---|---|---|
| **Register** | Catalogue/cookbook-clean | **Editorial/moody** (`@thelittleplantation`, `@_foodstories_`) |
| **Camera** | True overhead, flat | **Side-lit**, shallow DoF, background bokeh — overhead flat-lay is on the **negative list** |
| **Light** | Flat even daylight | Soft moody window light, slightly under-exposed |
| **Surface** | One round plate on uniform cream | Matte ceramic + **linen + weathered wood + a few props** |
| **Palette** | Warm cream bg + rotated plate colours | Warm muted earthy — browns, creams, sage, ochre |
| **Net effect** | Clinical-consistent, "curated grid" | Warm, considered, "love food + have goals" |

The two dish looks are **deliberately opposite**: Julienne's strength is *grid consistency via sterile
uniformity*; Sloe's is *editorial warmth via props + side-light*. Sloe should **not** converge on the
overhead-plate look (see §5).

### 4.3 Ingredient + object imagery

| Type | Julienne | Sloe (Template B / C) |
|---|---|---|
| **Ingredient** | Isolated single subject — pure white (onboarding) / faint-texture white (thumbs), soft shadow, 1:1 | **Template B**: stylised-photoreal single subject on **pure white**, soft daylight, soft shadow, 1:1 — **essentially the same DNA** (matches existing eggs/blueberries set) |
| **Object / cookware** | None as photography — flat illustrated icons only; raw-produce props in marketing only | **Template C**: cookware **as warm photographic stills** on white (enamel/cast-iron/ceramic) — explicitly *not* cold glossy 3D chrome. **A deliberate differentiator** — Sloe images cookware where Julienne icon-izes it |

Ingredient style is a near-match (and Sloe already shipped it). Object/cookware is where Sloe diverges by
choice — a warm photographic object layer Julienne doesn't have.

### 4.4 Coverage, triggers, provenance, monetisation

| Dimension | Julienne | Sloe (locked/planned) |
|---|---|---|
| **Coverage** | Every recipe imaged (auto). Ingredient imagery in onboarding + shopping list | **Aiming higher**: universal-imagery plan (§ doc) raises **every Today meal row** to imagery — recipes (Template A) **and** single foods (pre-generated Template-B canonical set), clean fallback for the long tail |
| **Trigger** | Silent, automatic (inferred) | **User-initiated "Generate an image" CTA** + **preview/approve** — never silent auto-gen at runtime |
| **AI label** | None visible (invisible SynthID only) | **Persistent visible AI label** + provenance column + C2PA/IPTC metadata + first-time disclosure + removable→revert-to-gradient (legal must-haves) |
| **Free vs paid** | Free, ad-subsidised, uncapped | **Free for everyone, no visible cap**; hidden 25/day abuse guard only; Pro does **not** gate gen. Pro = saves/plans/community + (open) **image *control*** (regenerate/restyle/bulk) |
| **Fallback hierarchy** | Backfills a prior placeholder | Warm gradient/monogram slab — *"a weak placeholder beats an off-brand or uncanny generation"* |

### 4.5 Where Julienne is ahead, even, and behind

- **Ahead of Sloe (today):** *shipped + live at scale* — universal auto-coverage is real in their app
  right now; Sloe's universal-imagery plan is still proposed (awaiting Grace's A/B/C pick). Frictionless
  silent auto-gen (no CTA) means **zero user effort** for full coverage.
- **Even:** ingredient-image DNA (isolated-on-white); both lean on a fixed-template pipeline for
  grid consistency.
- **Behind Sloe (by Sloe's design):** provenance honesty (Julienne ships **no visible AI label** — a real
  EU AI Act Art. 50 exposure as that phases through 2026); per-image cost (~$0.134 vs ~$0.01–0.04);
  durability/retention (their actual reviewed flank); a warm object/cookware photographic layer; the
  goals/health wedge that makes images *retention* rather than just *aesthetic*.

---

## 5. Recommendations — how Sloe leads the category

### 5.1 Keep a DISTINCT signature — do NOT adopt the overhead-round-plate look

Julienne's consistency comes from **sterility** (flat overhead, one plate, uniform cream). Copying it
would (a) erase Sloe's warm-coaching differentiator, (b) make the apps look interchangeable, and (c) throw
away the editorial register Sloe already locked. **Template A's moody side-lit editorial look is the
correct, defended choice — hold it.** Two concrete guards:

- The negative list already bans `overhead flat lay (for plated dishes)` — **keep it**; it's literally the
  anti-Julienne clause.
- Where Julienne gets consistency from a sterile template, Sloe gets it from the **locked anchor block +
  single model + pinned design-time seed** (§4/§6 of the template). Lean on the seed for batches so the
  warm look stays coherent without going flat.

### 5.2 Match — then beat — Julienne's coverage with universal ingredient imagery

Julienne's real competitive pressure isn't its *look*, it's that **every recipe is imaged**, free,
automatically. The
[universal-food-imagery plan](../decisions/2026-06-07-universal-food-imagery.md) (Option C) is the right
answer and should ship:

- **Pre-generate the Tier-1 ~50 canonical single foods** (Template B, static brand assets, cache by
  normalised food key) → the Today meal list reads as universally imaged in practice (logging frequency is
  power-law). Cost is **~$0.50–$2.00 total, forever** — trivial.
- This **exceeds** Julienne: they image *recipes*; Sloe images recipes **and** the single foods people log
  most (coffee, apple, eggs) that today fall back to a bare `Utensils` icon. The half-finished mixed-row
  rhythm in `TodayMealsFigmaLayout.tsx` is the exact gap this closes.

### 5.3 Keep the honest provenance posture — it's a moat, not a tax

Julienne ships **no visible AI label** and carries an undisclosed SynthID watermark. Sloe's visible
AI-label + provenance column + C2PA/IPTC + removability is **more honest and more EU-AI-Act-ready** — keep
it. It is a *differentiator* ("Made by Sloe — an illustration of the dish, not a photo of your cook"), not
a cost. Pair it with the existing "decouple image from nutrition" guard so a representative image never
reads as a macro claim.

### 5.4 Free-gen is the correct competitive floor — don't re-cap it

Julienne proves the floor: **every recipe looks finished, free, automatically, with no backlash at N≈24.**
Sloe's reversed call (free gen, hidden 25/day abuse guard only, Pro does not gate gen) is well-supported —
capping gen while Julienne gives it free would tax Sloe's lead viral hook. **Move the Pro trigger off
generation onto image *control*** (regenerate / restyle / pick-the-look / bulk) — a clean, uncontested
differentiator since Julienne advertises **no control surface at all** (no regenerate/restyle). This is the
"thread-the-needle" already flagged in the strategy doc's open question, and this research confirms it's
the right resolution.

### 5.5 Prompt / pipeline improvements worth adopting from Julienne

1. **Adopt their reference-image (img2img) idea for *house-style consistency only* — carefully.** Julienne
   attaches a curated reference for tag-matched categories to keep a consistent look. Sloe could pin a
   **brand reference image per plating-noun** (bowl / plate / board) at *design-time batch* to tighten
   consistency — **but never seed from a user's scraped photo** (the locked legal guard: text-to-image
   only at runtime). Keep img2img strictly to internal brand-reference anchoring, never user content.
2. **Adopt their generate-once-and-persist economics** (Sloe already does via cache-by-recipe) — and note
   Julienne validates that **cache + persist** is what makes universal coverage affordable even at
   $0.134/image. At Sloe's ~$0.01–0.04 the headroom is far larger.
3. **Resolve the negative-prompt engine caveat.** Sloe's never-list is currently a trailing `Avoid:…` in
   the positive prompt because `fal-ai/flux-2-pro` exposes no `negative_prompt` field. Julienne's
   server-side template sidesteps this by being model-native. If a future Sloe batch shows negated nouns
   leaking, **switch to an engine that honours a true negative prompt** (or move the never-list to the
   budget fallback model) — already flagged in the universal-imagery doc; this research reinforces it as a
   real risk worth a tracked follow-up.
4. **Consider a separate "marketing studio" path like Julienne's Midjourney workflow.** Their consumer
   pipeline and their IG-content pipeline are *deliberately separate systems*. Sloe's growth plan
   (TikTok/IG) will want batch marketing visuals; keeping that on a separate operator path (and possibly a
   different model tuned for social aspect ratios) — rather than overloading the runtime consumer pipeline
   — is a sound pattern to borrow.

### 5.6 Don't borrow their structural choices

- **Don't go silent/auto at runtime** — Sloe's CTA-with-preview is the honest, brand-right path and the
  legal must-have. (Silent auto-gen is fine for the *pre-generated canonical ingredient set*, which is
  brand-owned design-time assets, not user content — that distinction holds.)
- **Don't icon-ize cookware** — Sloe's warm photographic object layer (Template C) is a differentiator;
  keep cookware as warm stills, not flat icons.
- **Don't chase the lifetime-purchase tier** — it's an ad-subsidised model Sloe can't mirror; compete on
  retention (the goals/health wedge) and image *control*, not on a one-time price.

---

## 6. Open questions / what's still unverified

1. **Exact server-side Gemini prompt template** (controls Julienne's styling) — not in the client bundle;
   needs the function source or a live network capture.
2. **Julienne's trigger mechanics** (on-import / on-save / on-view, instant / queued) and the
   **placeholder/fallback** ("grey circle") — need hands-on capture of a live import (and an airplane-mode
   / failed import to force the fallback).
3. **Whether Julienne embeds any AI label/metadata** (SynthID strip/retain, C2PA survival) — worth a fresh
   check given EU AI Act Art. 50 phasing through 2026.
4. **Is free gen truly uncapped** for Julienne, or a hidden rate limit? Only inferable by heavy import
   testing.
5. **Sloe's fal `negative_prompt` caveat** — monitor for negated-noun leakage in future batches; escalate
   to an engine swap if it recurs.
6. **iOS-native Julienne path** — this research is grounded in the web bundle; the iOS binary wasn't
   decompiled (both almost certainly call the same Firebase functions).
7. **Richer Julienne sentiment** on TikTok/IG (where its audience lives) — web search under-indexes;
   N≈24 App Store reviews is a thin base for "do users notice the images".

---

## Sources

- **Julienne web bundle** (primary, decompiled strings): `withjulienne.com/assets/index-f24fde0f.js`
- **App Store** listing + changelog + reviews: `apps.apple.com/us/app/julienne-a-smarter-cookbook/id6451086935`
  (screenshots pulled from mzstatic PurpleSource211/221 iPhone_6.5 assets); website og-image `withjulienne.com`
- **Model identity/pricing:** `ai.google.dev/gemini-api/docs/models/gemini-3-pro-image-preview`,
  `blog.google/…/gemini-3-pro-image-developers/`, `deepmind.google/models/gemini-image/pro/` (SynthID),
  `openrouter.ai/google/gemini-3-pro-image-preview` (pricing)
- **Makers:** `producthunt.com/products/julienne-2`, `perlera.co`, `linkedin.com/in/komran/`;
  collision repo `github.com/bmcmahen/julienne`
- **Independent review:** `fulcra.design/Notes/Grocery-and-recipe-app-comparison-and-review`; `mwm.ai/apps/julienne-a-smarter-cookbook`
- **Sloe internal:** [`docs/brand/sloe-image-prompt-template.md`](../brand/sloe-image-prompt-template.md),
  [`docs/decisions/2026-06-07-universal-food-imagery.md`](../decisions/2026-06-07-universal-food-imagery.md),
  [`docs/decisions/2026-06-03-image-generation-strategy.md`](../decisions/2026-06-03-image-generation-strategy.md)
