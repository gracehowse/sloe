# Image generation strategy — design-time + runtime (2026-06-03)

**Status:** Proposed — specialist reviews IN (2026-06-03): legal, monetisation, brand **all APPROVE-with-changes** (see §Specialist sign-offs). Pending Grace's call on the open product questions + implementing the required changes (esp. the legal premise correction, already applied below).
**Owner:** Grace
**Context:** We've been generating Sloe imagery (ingredients, allergens, food) via **Stitch** for the redesign — good results, but two needs have emerged: (1) a repeatable way to generate brand imagery *as we go* at design-time, and (2) a **runtime product feature** — let a user generate a recipe image on import when their own recipe has no photo, or when an Instagram/TikTok import's photo is poor. Julienne (Afternoon Labs) ships exactly this ("recipe image generation so you no longer have default images"), so it's table stakes for the import/viral hook.

---

## 2026-06-07 head-to-head + dual-engine decision

**What changed:** ran a like-for-like head-to-head between **FLUX 2 Pro** (`fal-ai/flux-2-pro`) and **Nano Banana Pro** (`fal-ai/nano-banana-pro`, Google's SOTA image model) on the *same* locked Sloe prompts — the 8 Template-D social/lifestyle scenes (`docs/brand/sloe-social-image-set-2026-06-07.md`) and the 5 landing "Trending" Template-A dishes (Warm Tahini Grain Bowl, Three Cheese Fusilli, Chicken Kale Salad, Blueberry Baked Oats, Crispy Gnocchi Traybake). Nano outputs at 2K live in `screenshots/social-set/nano/` and `public/landing/nano/` (FLUX originals kept side-by-side for comparison; nothing live overwritten — Grace picks).

**Result — Nano Banana Pro won on editorial quality.** Across both sets it produced more convincing **window light**, real **depth** (foreground-to-background falloff, not a flat backdrop), and genuine **kitchen context** (dressers, shelves, copper pans, sage cabinetry) — the `@thelittleplantation`/`@_foodstories_` register the templates aim for. It also **fixed the two worst FLUX misses** on the trending set: FLUX's `trending-5` rendered raw oats in a wooden scoop instead of a Crispy Gnocchi Traybake (wrong dish entirely) and `trending-4` came out as a banned overhead flat-lay — Nano returns a correct side-lit gnocchi skillet and an editorial baked-oats dish. Ingredient fidelity to the recipe was higher on every dish, and no baked-in logo/watermark appeared (FLUX had previously stamped a "SUPPR" mark into a trending frame). One minor Nano watch-item: the iPad lifestyle frame (`c`) invents faint app-UI text on the screen — keep `{ON_SCREEN}` vague or composite the real screenshot for any screen-prominent frame, same guard as before.

**Cost:** Nano Banana Pro is **$0.15/image** on fal; FLUX 2 Pro is **$0.01–0.04/image** (4–10× cheaper). At low marketing volumes that's noise (~$2 for this whole 13-image batch); at per-user runtime scale it is not.

**Decision — dual-engine split (prompt templates unchanged, model-swappable):**

- **Nano Banana Pro = default for hero / marketing / social / Discover-feature / recipe-hero imagery** — the quality-critical, low-volume surfaces where editorial polish is the whole point and the per-image cost is irrelevant.
- **FLUX 2 Pro = default for runtime per-user recipe-gen** — the cost-critical, high-volume, cache-by-recipe path (§Layer 2). The 4–10× price gap dominates at viral scale, and the runtime path is already guarded by cache + abuse-cap; FLUX's quality is more than good enough for a user's own imported recipe behind the "Sloe image" label.

The **locked prompt templates (A/B/C/D) do not change** — they are model-swappable by design (`sloe-image-prompt-template.md` §6 already states the prompt is the constant). The same assembled prompt string drives either engine; only the fal `endpoint_id` and a couple of param names differ (Nano takes `resolution: "2K"` + `aspect_ratio`; both lack a separate `negative_prompt`, so the trailing `Avoid: …` clause stays). Re-run the head-to-head if either model ships a major revision.

---

## Principle: one engine for both layers
Use a **single image engine + one locked Sloe prompt template** for design-time and runtime, so everything looks like one brand and we maintain one integration ("prefer one tool over two"). _Amended 2026-06-07 (see above): still **one integration** (fal.ai) and **one prompt template set**, but a **dual-engine split by surface** — Nano Banana Pro for quality-critical marketing/hero imagery, FLUX 2 Pro for cost-critical runtime per-user gen. Brand consistency holds because the prompt is the constant, not the model._

## Recommended engine: fal.ai (unified API) → FLUX 2 Pro (default food model)
- **fal.ai** is a unified API hosting FLUX, GPT Image, and others under one integration with token-based pricing. One integration, model-swappable, and it lets us call OpenAI's GPT Image **without a direct OpenAI key** (our worktree env can't hold one — see memory). Replicate is the equivalent alternative.
- **FLUX 2 Pro** (Black Forest Labs) is the 2026 price/quality winner for **food photography** — photoreal, ~**$0.03/image** (BFL direct) / ~$0.008–0.055 via aggregators. Matches the Sloe DS imagery style (hyperreal editorial food photography: moody natural light, ceramic bowls, linen, shallow DoF).
  - **Budget tier:** FLUX 2 Flex (~$0.01) for high-volume runtime if cost climbs.
  - **A/B option:** GPT Image 1.5 / GPT Image 2 (~$0.04, best at complex prompt-following + any on-image text) kept as a fal-hosted fallback for tricky plated dishes.

## Layer 1 — Design-time (now)
- Keep **Stitch** for quick interactive exploration, but add a thin **fal/FLUX generator script** (`docs/prototypes/.../_genimg.mjs`) driven by the canonical Sloe prompt template, for batch "as we go" generation without Stitch's manual/timeout friction.
- Single prompt template = brand-consistent ingredient/food/object imagery on demand.

## Layer 2 — Runtime feature (the Julienne-parity capability)
**Implementation update (ENG-863, 2026-06-19):** the runtime path is now user-tapped
behind `recipe_runtime_image_generation_v1` on web + mobile. Gradient/placeholder
heroes show **"Generate an image"** to the author, generation returns a preview that
must be approved before `recipes.image_url` is persisted, AI heroes write provenance
(`image_source='ai_generated'`, model, generated timestamp), render a persistent
**"Sloe image"** badge + nutrition-decouple caption, and can be removed back to the
deterministic gradient. Stored fal outputs embed XMP/IPTC-style provenance metadata
at upload time. The shipped cache remains per recipe row; shared content-hash cache
is still a separate monetisation/cost decision (ENG-865), not part of this slice.

**Triggers (user-initiated, never silent/auto):**
1. User imports **their own** recipe with **no image** → "Generate an image" CTA.
2. Any import that lands on the **gradient placeholder** — the common case, because Suppr deliberately does NOT store Instagram/TikTok/YouTube/publisher images (IP decision: migration `20260427100000` + `BLOCKED_IMAGE_HOSTS` guard) → "Generate an image" fills the gap.
3. (Rare) a low-quality image we *are* permitted to keep → "Generate a cleaner image".

> **CORRECTION (legal review 2026-06-03):** an earlier draft said "keep the original creator image + offer the generated one as an alternative." That premise was **wrong** — Suppr does not store creator images, by existing IP policy, so building it literally would re-introduce the §106/CDPA reproduction the team removed. The generated image replaces the **gradient placeholder**, never a creator photo (this is *better* for IP — we show our own asset). Textual creator **credit** (handle/source) stays. The generator is **text-to-image from the parsed title + ingredients ONLY** — never img2img from a scraped photo (that would be a derivative reproduction).

**Low-quality detection (cheap heuristics first):** resolution below a threshold, tiny file size, wrong/extreme aspect ratio, or no image at all. Defer ML blur-detection until we have real import samples to tune against.

**Flow:** CTA → Supabase **edge function** builds a prompt from the parsed recipe **title + key ingredients** using the locked Sloe template → fal/FLUX → store the result in our storage (Supabase Storage) → **cache by recipe** (never regenerate the same recipe) → user previews + approves before it's saved to their cookbook.

**Style:** the locked Sloe prompt template ⇒ every generated image is on-brand and consistent. Brand-manager owns the template (the DS imagery rules already exist).

## Cost & guardrails
- ~**$0.01–0.04/image**. Kept bounded by: user-initiated (not auto), cache-by-recipe, per-user rate-limit (reuse the Upstash limiter), and a **free-tier cap** with unlimited on Pro.
- At viral scale this is the difference between trivial and runaway spend — the cap + cache are non-negotiable.

## Monetisation (monetisation-architect: REVISED 2026-06-03 → image-gen is FREE for all, 9/10)
- **Image generation = FREE for everyone, no user-visible cap** (REVERSED from the earlier 3/mo after the Julienne correction). Only a **hidden 25/day per-user abuse guard** (Upstash), not communicated. **Pro does NOT gate generation** — it isn't a Pro differentiator.
- **Why:** cost is trivial at scale — even 100k Free users ≈ **$525/mo** (worst-case heavy/no-cache ≈ $2,500), <4–5% of Pro revenue; **cache-by-recipe means popular Reels pay for themselves** (viral content concentrates → high cache-hit). Capping gen while Julienne gives it free would tax the lead viral hook.
- **Cache-by-recipe is free for everyone, never counts.** **Cache key = normalised hash of (ingredient list + dish name)**, not raw title, so crafted-title cache-bypass abuse is bounded. Enforce cache check + auth + `image_gen_started` log *before* the fal call.
- **Upgrade trigger moves OFF generation** → cookbook-building intent: after a user's 2nd gen in a session, a **soft** (not hard) prompt for Pro's unlimited saves + community publishing. Real conversion drivers stay: unlimited saves, multi-day plans, community publishing, AI photo/voice logging caps.
- **Paywall (for the real Pro triggers) = bottom sheet** (never full-screen), £7.99/mo · £59.99/yr "Save 37%", renewal disclosure visible, trust chips, easy "Not now". No countdown/dark patterns. **Downgrade keeps generated images.**
- `pricingTiers.ts`: do NOT list gen as a counted Free/Pro resource — surface it as an *import-flow feature on both tiers*. Drop `FREE_IMAGE_GEN_MONTHLY/DAILY` constants → keep only `IMAGE_GEN_ABUSE_GUARD_DAILY=25` for all. Keep `image_gen_paywalled` as a dead/null event (commented) for future optionality.
- **OPEN — Pro-gen-for-polish vs free-gen (Grace 2026-06-03).** Grace observed Julienne keeps the IG still on imported recipes (we *block* it → gradient) while every Discover recipe has an AI image, so she proposes **gating gen as a Pro "make your library look like the catalog" polish.** This tensions with the free-gen call above (free import must look great to feed the viral hook). Likely thread-the-needle: **base image FREE** (every imported recipe looks polished — competitive; "looks like the others" applies to everyone) + **Pro = image CONTROL** (regenerate / restyle / pick-the-look / bulk), OR honour Pro-gen-for-polish *only if* the free placeholder is genuinely premium (else free import trails Julienne's real-still). → reconcile with monetisation-architect using Grace's exact framing before build.
- **⚠️ Competitive correction (2026-06-03):** Julienne's image-gen is actually **FREE** (ad-subsidised; Pro gates cloud sync / curated library / sharing / ad-free at $3.99/mo · $19.99/yr · ~$59.99 lifetime) — NOT Pro-gated as first assumed. We're subscription-only (no ad subsidy), so we can't copy 1:1, but **the 3/mo free cap deserves a second look** vs Julienne's *unlimited free* import images: options = eat the (cheap, cached) gen cost on Free for a competitive import, make the gradient placeholder genuinely premium so capped-Free still looks great, or gate sync/sharing instead. Re-engage monetisation-architect with this corrected picture. (DishGen *does* gate it; Julienne does not.)
- **Recime's import defence is different** (relevant to our import posture, not the gate): personal-use + user-as-actor ("you're making a personal copy, like pasting into Notes; we don't use bots"). Julienne = disclaimer+attribution+link-back. Two recognised models.

## Legal / trust (legal-reviewer: APPROVE-WITH-REQUIRED-CHANGES, 8/10 — important for a nutrition app)
Non-negotiables before ship (full list in §Specialist sign-offs):
- **Persistent on-image "AI-generated" label** wherever the image renders (card, detail, share) — not just at preview (EU AI Act Art. 50 begins biting 2026 + App Review expects it). Plus **C2PA/IPTC metadata** embedded in the file.
- **New image-provenance column** (`image_source` = user_upload | ai_generated | imported, + model + generated_at) — none exists today; honesty/removal/audit are unbuildable without it.
- **Decouple image from nutrition** — caption "illustrative, generated from title + ingredients; nutrition is estimated separately and may not match"; never sit the image next to the macro readout without that caption; prompt must not assert portion/quantity.
- **Generator is text-to-image only** (parsed title + ingredients) — never feed a scraped creator photo as a seed.
- **User can remove the generated image** → revert to gradient.
- **fal.ai = new subprocessor** → DPA + no-training confirmation + privacy-policy + Notion Vendors row.
- Don't call these "photos" anywhere in copy.
- **Competitive note (Grace 2026-06-03): Julienne does NOT label its AI images.** That's a risk *they* carry (EU AI Act Art. 50 transparency phases in through 2026 + App Review increasingly expects gen-AI disclosure) — NOT a safe precedent to copy. Our stance holds: a **subtle on-brand "Sloe image" badge** (honest + clean, not a heavy "AI-GENERATED" stamp) + C2PA/IPTC metadata. Especially important for us as a *nutrition* app (image-misrepresents-dish risk). Final form = legal's call; default is keep it.

## Alternatives considered
- **(A) fal.ai + FLUX 2 Pro — RECOMMENDED.** Unified, best food price/quality, no OpenAI key needed, model-swappable.
- **(B) Google Imagen 4 direct** (Stitch already uses Google; Fast tier $0.02). Cheap, but a separate integration from the unified layer and Stitch's batch flow is manual.
- **(C) GPT Image direct from OpenAI.** Best prompt-following, but needs a direct OpenAI key our env can't hold, and pricier.

## Top failure modes + mitigations
1. **Generated image misrepresents the dish** (wrong ingredients / nothing like it) → trust + legal hit. *Mitigate:* prompt from parsed ingredients, AI-label, user previews/approves before save.
2. **Cost blowout at viral scale.** *Mitigate:* user-initiated + cache-by-recipe + Pro-gate + per-user rate-limit.
3. **Style drift / off-brand output.** *Mitigate:* one locked prompt template + single model + brand-manager sign-off.

## Confidence: 7/10
High on the model choice + feature shape; lower on the exact low-quality thresholds (need real import samples to tune) and on Julienne's exact vendor (undisclosed — we match the capability, not their stack).

## Specialist sign-offs (2026-06-03)

**Legal — APPROVE-with-required-changes (8/10).** Caught the creator-image premise error (corrected above). Must-haves: (1) fix the premise [done]; (2) `image_source` provenance column; (3) persistent on-image AI label everywhere + (4) C2PA/IPTC metadata; (5) decouple image from nutrition (caption + never adjacent to macros bare + no portion in prompt); (6) explicit first-time disclosure; (7) user can remove → revert to gradient; (8) text-to-image only, never seed from a scraped photo; (9) fal.ai DPA/no-training/privacy-policy/Vendors. Open for formal counsel (block GA, not the spike): EU AI Act Art. 50 exact label form, C2PA vs IPTC, fal/FLUX commercial license (esp. for marketing/App-Store use).

**Monetisation — APPROVE (8/10).** Packaging folded into §Monetisation above. Open questions for **product-lead**: (a) monthly-reset vs lifetime Free cap (rec: monthly); (b) does **regenerate** consume a credit (rec: yes); (c) scope to the **user's own library only**, not community recipes (rec: yes). Suggested constants `FREE_IMAGE_GEN_MONTHLY_LIMIT=3` / `_DAILY_LIMIT=1`, events `image_gen_started/completed/paywalled/cache_hit`.

**Brand — ON-BRAND, conditional (8/10).** Wrote the canonical prompt template → **`docs/brand/sloe-image-prompt-template.md`** (3 templates: dish / ingredient / object + shared style anchors + a separate negative prompt that hard-bans text/logo/watermark/3D-chrome + params + worked examples + a reviewer checklist). Naming: CTA **"Generate an image"** (never "Generate with AI"); badge **"Sloe image"** (legal to confirm whether the literal word "AI" must appear); preview honesty line "Made by Sloe — an illustration of the dish, not a photo of your cook." **Render-validation pending:** per SEE-don't-orchestrate, brand sign-off isn't final until ~10 real FLUX 2 Pro outputs are eyeballed against the checklist — that's the spike's first step.

## Open / next
- Apply the required changes (provenance column, AI label, captions, removability) when the feature is built; route the 3 product-lead questions; legal to confirm label wording + fal.ai DPA.
- Spike: wire a fal/FLUX call behind an edge function + the Sloe template; **render ~10 real outputs** (no-image imports + own-recipe) and eyeball vs the brand checklist before trusting it.
- New vendor: add **fal.ai** to Notion Vendors + privacy policy before it's in the runtime path.
- Sequence: **post-Today** feature (rides the import/viral hook), not a launch-day blocker — slot after the Today re-skin unless prioritised up.
- Notion Decisions row + (on ship) the runtime Linear issue: pending commit/approval.

## Sources
- Julienne / Afternoon Labs: <https://withjulienne.com/>, <https://apps.apple.com/us/app/julienne-a-smarter-cookbook/id6451086935>
- Model pricing/quality (June 2026): <https://www.buildmvpfast.com/api-costs/ai-image>, <https://bfl.ai/pricing>, <https://fal.ai/flux>, <https://www.digitalapplied.com/blog/ai-image-generation-api-pricing-comparison-2026>
