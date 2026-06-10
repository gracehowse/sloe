# Warm-coaching aesthetic direction (cross-category reference board)

> **Moodboard:** a rendered visual moodboard for this direction lives at
> `docs/prototypes/suppr-moodboard.html` — view via the `prototypes` launch server
> (`http://localhost:4599/suppr-moodboard.html`). Covers north-star vibe, palette (hex),
> type pairing, the painterly-illustration system, the "calm warm coach" voice, components,
> the cross-category reference steal-list, and the per-surface dial.


> **Status: EXPLORING (not ratified, no production change).** Captured 2026-06-02 from
> Mobbin iOS reference pulls (paid plan). Grace assembled this by reacting to real
> competitor + adjacent-category screens. It is a reference board for a future
> Today / Recipes / Progress / onboarding warmth pass — not a work item yet.

## POSITIONING (why this whole direction exists)

Grace 2026-06-02: **"I love cooking but I also have fitness goals" → "using this app means I can
fit the foods I love into my plan/targets."** Suppr owns the gap between diet apps (kill food joy)
and recipe apps (ignore goals). It reframes the macro tracker from *restriction* → *permission*.
The aesthetic marriage below is this thesis rendered: Julienne = the love of cooking, Lifesum =
the goals. See memory `project_suppr_positioning`. Taglines (draft, for brand-manager): "Cook what
you love. Hit your goals anyway." / "The cookbook that fits your macros."

## APPROVED CANONICAL COMPONENTS (Grace 2026-06-02 — lock these, unify everything to them)

The full Sloe app view got "THIS IS PERFECT". Stitch drifts per-screen (different serifs, different
bottom bars) — so these specific elements are LOCKED as the single source of truth; every screen
must conform:
- **Top bar:** centred serif **"Sloe"** wordmark, hamburger (line icon) left, profile/avatar right.
  (Grace: "my favourite top-of-screen branding".)
- **Tab bar:** **Today · Plan · [＋ centre FAB] · Recipes · Progress** — line icons, clay active label.
  (This is the canonical 5-slot bar from the approved Today screen. Note: "Ask" needs a home — header
  or Today entry, NOT a 5th tab. Earlier Discover/Recipes/Add/Ask/Settings bars are superseded.)
- **Recipes icon:** crossed **fork-and-spoon** line icon (Grace's pick).
- **Today hero:** multi-ring (plum outer + clay/gold macro sub-rings), "Remaining/Consumed" toggle,
  "Under budget" sage pill, Goal/Eaten/Bonus row, serif coach line. Approved.
- **Log-a-meal sheet:** approved as-is ("gorgeous, perfect") — search+scan, Scan/Voice(PRO)/Photo/
  Quick-add as LINE icons, Recent/Favourites/My-recipes, food rows with warm thumbs, daily-progress footer.
- **Type:** ONE display serif (Fraunces/Newsreader — pick ONE and lock) + Inter body. Stitch mixed
  serifs across screens — unacceptable in the real build.

**UNIFICATION MANDATE:** the prototypes must be rebuilt from ONE shared component kit / token set so
fonts, colours, top bar, tab bar and icons are identical across every screen (Stitch's per-screen
drift is the thing to eliminate). Tool path TBD (Figma vs unified code kit) — see decision below.

## BRAND: Sloe (candidate rebrand, 2026-06-02) — now the colour source of truth

The warm palette below is now expressed through the **Sloe** brand (full tokens:
`docs/brand/sloe/brand.md`). Sloe is **additive, not a clash**:
- **In-product functional palette unchanged**: Clay `#C8794E` = warm CTA/Pro/encouragement,
  Sage `#5E7C5A` = success/under, Amber `#C9892C` = macros over (not ring), Honey `#D6A24A` =
  best-day star, Destructive `#C0533F` = ring-over-budget ONLY. Calorie-ring rule preserved.
- **New brand-identity layer**: Sloe plum `#3B2A4D` (wordmark/ink/mark), Damson `#6A4B7A` (active),
  **Frost `#C9C2D6` = the ownable accent**, brand gradient Damson→Sloe→Frost (marketing/paywall/
  empty ring).
- **Ground — RESOLVED (split by surface):** APP UI = pure white `#FFFFFF` (white-base call holds
  in-product); MARKETING (App Store shots, landing, promo, social) = Oat `#FBF8F3` warm canvas with
  painterly produce botanicals framing the device (the Julienne App-Store treatment). The marketing
  botanicals reuse the painterly ingredient illustration system. No more cream-in-app.
- Name/TM: "Sloe" reads clean in-category on first search (no nutrition/recipe app found) but
  "sloe gin" is common — formal TM clearance required before commit. Domains: eatsloe.com, sloe.life.

## UNIFIED SUPPR VIBE — "an editorial cookbook that coaches you warmly" (2026-06-02)

Grace's framing: "marry Lifesum and Julienne for vibe." They are NOT the same vibe, so the
marriage is made of explicit calls, not a blend:

- **Julienne = the bones**: serif-display editorial type, restraint + whitespace, painterly
  illustration system, calm white/cream canvas, single warm accent, gallery layout. (Refined,
  premium, slightly cool.)
- **Lifesum = the soul**: coaching/encouraging voice, emotional feedback moments, warmer colour
  temperature, nurturing personality. (Human, warm, slightly soft.)

**Conflict resolutions (the actual decisions):**
1. **Illustration → Julienne's painterly realism** (not Lifesum's loose watercolour pastel) —
   more premium + credible for nutrition, less childish; warm the palette a touch. ONE style,
   locked (see art-direction lock).
2. **Typography → serif display + sans body** — cookbook/recipe screens lean serif; data-dense
   tracker screens need sans body for legibility.
3. **Colour → Julienne base: whites + blacks, chic + modern**, with warmth from *splashes of
   colour* (terracotta accent + muted sage), soft warm-grey cards, NOT a cream wash. Amber
   reserved for over-budget. NO Lifesum colour-hero AND **no cream canvas** — Grace correction
   2026-06-02: "avoid the paper colour; Julienne stays warm and chic and modern with whites and
   blacks and splashes of colour." (Supersedes the earlier "warm cream bg" Lifesum pillar — take
   Lifesum's warmth via VOICE + colour, not via a cream background.)
4. **Voice → "calm warm coach"** — resolves the earlier calm-voice-vs-encouraging-coach tension
   into a single personality.

**Ratio shifts by surface (one system, dialled differently):**
- Recipes / Cookbook → lean **Julienne** (editorial cookbook, serif-forward, painterly).
- Today / Progress → lean **Lifesum** warmth (coaching, emotional feedback) rendered inside
  Julienne's restrained shell.

Still EXPLORING. Next step to make it real: have `brand-manager` formalise this into a vibe/
voice spec, then prove the art-direction lock with a small generated test set on a Suppr mock.

## The through-line

Across three different apps Grace independently rewarded the **same axis**: *warm, human,
encouraging feedback over cold numbers* — but kept it **credible** (rejected the
childish/loud executions). The synthesised point of view:

> **Warm editorial skin** (Lifesum) · **soft curved framing** (Headspace) ·
> **intent-first onboarding** (Headspace) · **data-grounded coaching + narrative scores +
> star-days + customisable tiles** (Fitbit) — credible and warm, not cartoonish, and
> **no loud colour-as-emotion hero** (Suppr's calm-hero call stays).

---

## Adopt-candidates by source

### Lifesum — the warm editorial skin
1. **Editorial serif wordmark + warmer typographic tone.** Magazine-masthead feel vs the
   flat-sans competitors (MFP / MacroFactor / Cal AI). Highest-leverage, lowest-risk lever.
2. **Watercolour / painterly illustration.** Food + tracker art, relatable units
   ("1.5 donuts"). Costs an illustration asset set.
3. **Warm cream background + emotional coaching voice.** Off-white canvas, soft cards,
   "Day rating" / "Perfect!" framing.

### Headspace — the warm framing + activation
4. **Sun-arc / curved-horizon framing.** Soft white curve over a warm tone (sunrise motif).
   Warm *without* a loud colour block — compatible with the calm-hero decision.
5. **Intent-first onboarding.** Open on motivation/emotion ("what do you want to achieve?")
   before numbers. Activation lever.

### Julienne — the warm editorial cookbook (LEAD reference for Recipes surface)
Julienne (by Afternoon Labs) is the closest real-world expression of this whole direction,
applied to a *cookbook*. Grace flagged both its web recipe page and its mobile experience as
"gorgeous" / "love this soft vibe". Treat it as the **primary reference for the Recipes /
Cookbook / recipe-detail surfaces** specifically (Lifesum/Headspace/Fitbit lead Today /
Progress / onboarding).

Aesthetic (same DNA as Lifesum, applied to recipes):
- Serif masthead + serif recipe titles + serif numbered cooking steps (big grey "01 / 02").
- Cream/white canvas, single warm orange accent, peach "Pro" pill, round food thumbnails,
  generous whitespace.
- **Per-ingredient generated images** on the recipe-detail page (single item on neutral
  stone/linen, soft daylight), with an **initials fallback** ("GY" for Greek Yoghurt) before
  an image exists. Confirmed AI image generation (App Store lists "recipe image generation").
  See the "Generated ingredient imagery" opportunity note below.

Interaction patterns worth borrowing (mobile):
- **Card-stack swipe with peek + glow**: faded serial numbers behind each card, active card
  lifted with a soft halo, next card peeking — flick through the day's recipes. *Discovery
  surface only — low density.*
- **Horizontal month scroller** (serif, inactive months greyed) as a time-navigation device
  for browsing past recipes.
- **Date-headed feed** (05.20 / 05.19) with horizontally-scrolling recipe cards per day.
- **Scannable list** for the library/Cookbook tab (thumb + serif title + cook time + ⋮) —
  the deliberate counterpart to the swipe-stack.

> **Density lesson (important):** Julienne uses TWO layouts on purpose — swipe-stack for
> *Discover* (serendipitous, one-at-a-time) and a plain scannable list for *Cookbook* (find
> what you know). For Suppr: apply the aesthetic everywhere, but reserve the swipe-stack for a
> discovery/"what to cook" surface. Do NOT hide the Recipes library or the viral-import
> landing behind a one-at-a-time swipe — that would hurt the viral-hook surface
> (Recipes = viral hook landing per the launch initiative).

### Fitbit — the credible coaching layer
6. **Positive coaching microcopy.** "Amazing!", "You did it!", "You can beat this!" —
   encouragement grounded in real data. Reinforces Lifesum pillar #3.
7. **Narrative score interpretation.** Turn a number into a sentence/story ("Good readiness —
   you've been more active lately… don't overdo it"). Matches Suppr Progress =
   "story not dashboard".
8. **Best-day star markers.** Star/highlight on top days. Matches Suppr "closest to target".
9. **Editable card-stack Today.** User adds/reorders metric tiles. NB: this is a **feature**,
   not pure aesthetic — scope separately if pursued.

---

## Explicitly NOT taking

- **Lifesum colour-as-emotion hero** — big curved coloured block changing by state. Conflicts
  with Suppr's ratified calm-no-loud-hero call (`project_today_screen_direction_apr2026`).
- **Headspace character mascots** (blob/monster illustrations) — too playful; risks
  undercutting nutrition credibility.
- **Headspace radical one-illustration-one-CTA minimalism** — too sparse for a tracker's
  information density.

## Composition notes / open tensions

- The wrappers differ (serif-editorial vs character-playful vs clean-data). We take ONE skin
  (Lifesum editorial) and borrow *patterns* from the others — never three skins at once, or
  the brand splits.
- Headspace's display type is **sans**; Lifesum's wordmark is **serif**. A future type pass
  must decide the serif/sans split (likely serif display + sans body).
- **Voice reconciliation required:** "calm voice" (existing) vs "encouraging coach" (this
  board). Route through `brand-manager` + `copy-reviewer` before any copy ships so the brand
  voice stays singular. See `feedback_conformity_trap` — preserve Suppr differentiators
  (multi-ring calorie+macros, "what to eat next" chip, paywall trust chips).
- **Fitbit validates** an existing Suppr differentiator: the multi-ring + sub-stat-tile
  dashboard. Don't treat that as something to borrow — we already have it; Fitbit confirms it.

## Painterly illustration SYSTEM (Grace: "I LOVE these almost painted icons")

The painterly illustration is not a set of one-off icons — Julienne defines **one** painted
style and reuses it across every food/UI moment. Grace specifically loves this. Confirmed
surfaces:
- **Per-ingredient images** (recipe detail grid)
- **Choice tiles** (onboarding allergy grid: shellfish / peanuts / gluten / eggs)
- **Empty states** (Shopping List: canvas tote of veg)
- **Loading states** ("Adding recipe…": green enamel pot on a gas flame)

Style signature: *single subject, painterly realism (gouache-like depth, NOT flat vector),
soft daylight shadow, white/cream ground.* This single consistent language across states is
the main reason the app reads premium + warm rather than merely decorated.

**Implication:** treat this as a design-system primitive, not per-screen art. Define the
painterly style ONCE and render ingredients, choice tiles, empty states, and loading states
all from it. Same generation pipeline as the ingredient imagery below.

**Style calibration (Grace 2026-06-02):** the target is **stylised photoreal**, NOT loose
watercolour. Like Julienne's empty-state (worn saucepan), loading (enamel pot), and allergy tiles
(shrimp / peanuts / toast / fried egg): real texture + light, single subject, clean white ground,
soft shadow, with a subtle painterly/editorial finish. Stitch's first pass (soft watercolour
blueberries) was **one notch too painted/loose** — dial realism UP toward "editorial product
photography with a painterly finish," still artful, never flat stock. Calibration verdict: "very
good and artsy, slightly more realistic, more like Julienne."

**Two-tier imagery rule (Grace 2026-06-02, refined):**
- **Ingredient single-subjects** (eggs, blueberries, oats, etc.) → KEEP the current stylised-photoreal-on-clean-white style exactly. Grace: "the images of eggs and blueberries etc are perfect, do not change."
- **Meals / finished dishes** → go further: **hyperrealistic editorial food photography**, artful but hyperreal, in the register of Instagram **`_foodstories_`** (underscores both sides) and **`thelittleplantation`** (no underscores) — natural/moody light, ceramic bowls, linen, wooden boards, props, shallow depth of field. Never flat stock, never loose watercolour. (Exact handles — do not drop/move the underscores.)
  - **CANONICAL MEAL-IMAGE PROMPT (Grace 2026-06-02, the approved fusilli hero — "whatever prompt was used for this is great"):** *"Hyper-realistic, moody editorial food photography of {DISH} in a rustic ceramic bowl on a wrinkled linen cloth. Soft natural side lighting, deep shadows, premium cookbook aesthetic. High resolution, professional food styling."* For a hero with text overlay, append *", warm earthy tones (#C8794E accents), clean white background area for text overlay."* Reuse for every meal/dish image (swap {DISH}). LOCKED.

**Icons & object imagery (Grace 2026-06-02, refined).** The off-brand failure was the COLD GLOSSY
3D CHROME render look (metallic studio product renders), NOT the use of images. Two cases:
- **Tangible OBJECTS** (cookware — saucepan, Dutch oven, pan; a camera for "Photo"; jars/bottles)
  → MAY be images, rendered in the SAME style as ingredient single-subjects: warm, soft daylight,
  stylised-photoreal, single subject on clean white. Reference: Julienne's enamel-pot loading state
  + saucepan empty-state (Grace loved these). Same generation pipeline as ingredients.
  **VIBE CALIBRATION (Grace 2026-06-02):** must be WARM + CHARACTERFUL + slightly painterly — the
  exact Julienne register (green enamel cast-iron Dutch oven on a flame; a lived-in worn saucepan).
  NOT cold/sterile/generic studio product renders. Stitch's first Sloe pass made them too clean/cold.
- **Abstract controls / nav** (link, paste, share, bookmark, chevron, +, search, Cook/Plan/Remix/Ask,
  tab bar) → clean LINE icons (lucide-react-native), monochrome ink + clay active, flat ~1.75–2px stroke.
- **BANNED:** cold/glossy 3D chrome product-render icons (the Stitch auto-generated camera/chain-link/
  text-align renders) — reject; they read cold and generic and fight the warm-editorial identity.

**Hard prerequisite — art-direction lock.** Illustration-as-UI dies on inconsistency: any
drift in lighting/crop/saturation across assets and the premium feel collapses. So before any
of this ships, lock: (a) a fixed style spec — ONE prompt template OR one commissioned
illustrator brief — and (b) a fallback (Julienne's initials chip). The art is downstream of
the lock. Route the spec through `brand-manager` + `ui-product-designer`.

## Opportunity note — generated ingredient imagery (Julienne-style)

The per-ingredient image system is the single highest-leverage move to *land* this aesthetic
on the Recipes surface, and it's unusually buildable for Suppr:
- Suppr already has a **canonical ingredient layer** (nutrition-matching engine parses +
  normalises ingredients). That canonical ID is exactly the key to hash images against.
- Ingredients are a **finite shared vocabulary** (~a few thousand), so it's generate-once,
  cache-forever, reuse across every recipe — bounded cost, not per-recipe.
- Graceful degradation via an **initials fallback** (Julienne's "GY" pattern) before/if an
  image is missing.
- Open questions to scope if pursued: model choice (hosted GPT Image / Imagen vs self-hosted
  diffusion), per-image cost at volume, caching/storage, and **image licensing / usage rights**
  (route through `legal-reviewer`). Still EXPLORING — not on the roadmap yet.

## Scope decision (2026-06-02)

Grace: **"Just exploring for now."** No production surface changes. When a warmth pass is
greenlit, build static HTML prototypes (web + mobile, iPhone frame) BEFORE production code
per the G3.5 gate (`feedback_html_prototypes_before_coding`), and validate rendered pixels.

---

## Mobbin source screens (iOS)

### Lifesum
- Serif wordmark / home: https://mobbin.com/screens/70ff18ac-d173-4781-8695-c0594f2d6799
- Watercolour trackers + trophy: https://mobbin.com/screens/624dcc27-aef5-47a0-bdc8-7d6d475ce5aa
- Relatable units ("1.5 Donuts"): https://mobbin.com/screens/d5dfe5ad-4417-4cb1-9ceb-34017995a061
- Cream-bg plan-ready: https://mobbin.com/screens/22d54a2f-a6db-46bd-b9b0-80ba411fae70
- "Day rating" emotional feedback: https://mobbin.com/screens/60b8d8e9-2eca-48ce-afa9-744206f1f0d3

### Headspace
- Sun-arc / curved horizon (welcome): https://mobbin.com/screens/d5d90f35-dfc3-4987-b276-4813b15179fa
- Sun-arc "Headspace your day": https://mobbin.com/screens/e0d9e060-616e-41cb-aa31-befbcd365100
- Intent-first onboarding ("What's on your mind?"): https://mobbin.com/screens/d3f5a9dc-1937-4ea3-976f-cf5393d6f613
- Research-backed trust framing: https://mobbin.com/screens/b4432f22-048e-4783-9a76-9f594817202f

### Fitbit
- Multi-ring + stat tiles Today: https://mobbin.com/screens/259f02ab-5b96-45c5-86cd-987af2fbbf96
- Coaching microcopy "Amazing! Overachiever!": https://mobbin.com/screens/7e81d21f-aa0e-415a-ad22-c9f323e84f94
- Narrative readiness score: https://mobbin.com/screens/be003824-8ee0-4822-b442-71d4c873bd7e
- Best-day star markers (weekly list): https://mobbin.com/screens/215b64a6-ee43-4944-9845-d32c791e8520
- Editable card-stack Today ("EDIT"): https://mobbin.com/screens/49e2e21d-21bf-4a9d-95fc-4b4db90cf5c4

Pulled via Mobbin MCP `mcp__mobbin__search_screens` (iOS). Re-run queries to refresh.
