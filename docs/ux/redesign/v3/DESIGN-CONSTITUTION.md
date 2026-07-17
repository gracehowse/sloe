# The Sloe Design Constitution — v1 (2026-07-17)

**The thesis (Grace, 2026-07-17):** Sloe is the fusion of three things — a rigorous
fitness tracker (MacroFactor/MFP class), recipe capture from Instagram/TikTok/web into
one place (ReciMe/Julienne class), and **the bridge**: the app already knows your
calorie and macro targets, so your saved recipes slot into your plan *without
thinking* — "eat what you love." Non-negotiable beneath it: industry-leading calorie
and macro calculation for imported recipes, worn visibly (confidence, provenance,
editability), never just claimed. The look is luxury-editorial; the usability is
fitness-tracker familiar. Every rule below serves that fusion.

Premium isn't a material; it's **radical repetition of a small rulebook**. Oura and
Julienne read expensive because every screen obeys the same few laws. This document is
that rulebook for Sloe. A screen ships when it has **zero violations** — not when it
"looks nice."

Status: authored by Fable for Grace's ratification. The prototype's **Elevated** mode
(Tweaks → Premium pass) implements it; Current remains the pre-constitution baseline
for comparison. On ratification this becomes the conformance target for ENG-1247 and
the write-time bar for all UI code.

---

## Rule 0 — Two grammars, one voice

Every element belongs to exactly one grammar. Never blend them on one element.

- **Editorial** (the Julienne lineage) — food surfaces: full-bleed photography, serif
  display, warm ground, chrome recedes. Where appetite lives.
- **Instrument** (the Oura lineage) — data surfaces: gradient-lit arcs, glow, tabular
  numerals, semantic colour. Where trust lives.
- **Chrome** is neutral: ink, plum, muted. Chrome never borrows either grammar's
  decoration.

## Rule 1 — One page template

Every tab screen is composed top-to-bottom as:

```
eyebrow overline  ·  serif title 33px  ·  [right-slot control]
HERO ZONE — the screen's ONE big thing
OVERLINE SECTION LABEL (11px caps, tracked, grey) (+ right-slot)  →  content
…repeat sections…
```

**Label grammar (Grace's ruling, 2026-07-17): structural labels are the quiet
tracked-caps overline — the "NET ENERGY" register — everywhere.** Serif never
labels structure; it is reserved for page titles, hero numerals, content nouns
(dish names, day names) and verdict sentences. Serif-as-section-head read harsh
and inconsistent; the overline system is the calm spine of every screen.

- **One hero per screen.** Today = the ring. Plan = the day verdict. Progress = the
  weight trajectory. Cook = tonight's pick. The hero is the only element allowed
  display-scale type or the tinted ground.
- Display type exists nowhere else. If two things look "biggest," the screen is wrong.

## Rule 2 — One card grammar (ENG-1497, unchanged)

Page-ground cards: white, hairline, radius 24, flat. **At most one tinted hero card
per screen** (`--hero-tint`). Nested cards: flat, borderless. Sheets/overlays float.
**Sections are titled by the overline label outside the card.** In-card overlines
label only *internal* groups (e.g. the instrument label inside a hero, a confidence
readout) — never the card's identity.

## Rule 3 — One control kit

- **Icon button:** 40px circle, muted fill, ink glyph. There is no white-square,
  bordered, or shadowed variant. Anywhere.
- **Chip:** full-radius pill, muted fill, 13px/600, 9×14 padding; selected = plum
  fill, white text. All chips — quick-add, filters, status — are this chip.
- **Icons are Lucide geometry** (the ratified P0 direction) at 1.75px stroke,
  one optical size per slot — no hand-drawn or modified paths. Malformed chrome
  icons read cheap faster than any other element.
- **Segmented control:** one spec, used for exclusive 2–5-way switches only.
- **Rail:** one tile size (64px circle) + 12px label. Creators and cuisines share it.
- Buttons: one filled CTA per screen (conversion surfaces excepted) · secondary =
  tonal · tertiary = ghost text. Unchanged from the CTA ruling.

## Rule 4 — Colour governance (the discipline that reads as luxury)

Colour **means** something or it doesn't appear.

| Hue | May appear as | Never as |
|---|---|---|
| Ink + plum family | All chrome, text, controls, links | — |
| Sage / amber | Day-state semantics only (under/over, on/off-track); amber's survival as the over-state is pending Grace's orange ruling | decoration, icons-for-flavour |
| ~~Clay~~ | **RETIRED (Grace, 2026-07-17)** — monetisation wears plum/frost | anywhere; clay-on-plum was the tell |
| Macro hues | Inside macro visualisations only | section accents, icon tints |
| Destructive red | Destructive actions/errors only | over-budget (that's amber) |

One screen should read near-monochrome plum-ink until the *data* speaks.

## Rule 5 — The numeric instrument scale

Serif, tabular. **Hero numeral 44–46** (one per screen) · **section numeral 28** ·
row numeral 15–17 · caption 11–12. **Story tier (recap scenes ONLY, ratified with
Rule 8's ≥8:1 law): display numeral 84 · statement 40 — one per scene.** No other
numeric sizes exist.

## Rule 6 — Ground & depth

Light: warm oat ground (`#fbfaf6` family), white cards, plum hairlines; **glow is
reserved for the instrument** (data arcs, never chrome). Dark: Nocturne. One light
source; no mixed elevation on a surface.

## Rule 7 — Photography or nothing

Food is photographed (full-bleed hero or 4:3 tile, consistent warm grade) or rendered
as the plum-duotone texture system. **Letter monograms never represent food.** People
may use serif initials only with the frost-ring treatment, as a stated placeholder
until real photography lands.

## Rule 8 — The loop is the layout

The app exists to run one loop: **where do I stand → what do I eat next → log it →
the week is handled → did it work.** Each screen's hero (Rule 1) IS its loop moment,
and each moment obeys a researched composition law (Mobbin refs in the census):

| Moment | Screen · hero | Composition law (Mobbin-verified) |
|---|---|---|
| Where do I stand | Today · the ring | One numeral, state-coloured; tap flips remaining↔eaten (MacroFactor reframe; the category convention is remaining-led — [Lifesum's diary hero](https://mobbin.com/screens/ee72c05c-3ec9-4373-86e8-3548b579dd73)) |
| What do I eat next | Today · decision module | Editorial photo + serif name, target chips as the numerals, ONE verdict line, ONE action ("Log this"); tap opens the recipe. The range convention exists ([Lifesum: "Add lunch · Recommended 461–615 kcal"](https://mobbin.com/screens/ee72c05c-3ec9-4373-86e8-3548b579dd73)) but nobody renders it editorially — our lane. Its "Day rating" smiley card is the judgment register we ban |
| Log it | FAB · log hub | Recents = one-tap re-log (Lose It); post-log reward = the watched element completes + one honesty line — never confetti (MacroFactor state-flip, Cal AI verdict) |
| Week is handled | Plan · day verdict hero | Calm verdict sentence + **one-tap fix** that re-derives downstream (open lane — none of Mealime/eMeals render the verdict; we do) |
| Did it work | Progress · trajectory hero | Smoothed line + raw dots + goal line **co-visible** ([Withings' dots-on-line grammar](https://mobbin.com/screens/dd9eb17c-bee7-4559-a530-31c0fd240231)) + labelled goal band + dotted projection ([Noom's weight graph](https://mobbin.com/screens/dc3979bd-856a-44a5-b52a-3e2061f4a69f)) + rate with the period control ([MacroFactor's average/difference + W–Y pills](https://mobbin.com/screens/e4730836-8f0f-421a-bf91-1585fc7d8f4d)); projection stays hedged — [Noom's "we predict you'll reach your goal" promise](https://mobbin.com/screens/a617cbce-d0e0-4f6f-a2e1-3c74a6065931) is the anti-pattern our "estimate, not a promise" counters |

**Delivered 2026-07-17 — the recap story** (§5 Full recap / Share in Elevated): seven
full-bleed scenes on Sloe Deep following the researched 7-scene law — *arrival →
headline win (the cooked-from-your-cookbook stat, photo-backed) → the rhythm (week
strip, baselined "vs your usual", honest amber day) → the quiet win → identity
(adjective, not badge) → the honest note → forward carry + share*. One stat per
scene at ≥8:1 numeral:label; per-scene quiet "Share scene" (Strava grammar); no
percentiles, no confetti; scene reveals 380ms house-ease with 70/140ms stagger
(NN/g + Emil Kowalski ranges); privacy line: shared scenes carry numbers, never
goals. The close renders a **bounded white summary-card artifact** (dates overline,
2×2 stat grid, wordmark) — verified against the Mobbin library: every leader shares
a designed card, not the raw screen ([Duolingo YIR ends on a summary card +
share](https://mobbin.com/flows/8571a01f-da27-4bd6-a43b-e6b59ebadcd6); [Beli's
recap: dots-top story of card artifacts](https://mobbin.com/flows/6520099e-59a7-44a2-8336-a80d9feb47ce);
[Strava month-in-sport: pick your card style, then share](https://mobbin.com/flows/38aaf14f-cd60-4348-bc6c-4caddcb33ac8)).
Secondary written refs: Manual's Strava YIS storyboard, Duolingo YIR
behind-the-scenes, Gentler Streak weekly recap coverage, Whoop WPA baselining.

## Rule 9 — Motion is confirmation

Count-ups and arc-draws on mount; a spring on every commit; the gold win-moment on
goal days. Nothing moves decoratively. Honour `prefers-reduced-motion`.

## Rule 10 — Every recipe knows your day (the bridge)

The differentiator is not tracking and not capture — it's that they meet without the
user thinking. So fit is **ambient**, everywhere a recipe appears:

- **Every recipe surface wears a calm fit verdict** derived from live targets — the
  sage "✓ Fits your day / ✓ Fits Thursday dinner" tag on cookbook cards, Discover
  shelves, and the decision module. **Absence is neutral, never a judgment** — no
  red, no "doesn't fit," no shame states (the Calm-mode ethos applies to fit).
- **The plan shows its provenance** — "From your cookbook" on plan cards. The week
  is visibly made of food you chose to save, not app-issued meals.
- **Capture ends in a trust card** — every import resolves to per-serving macros +
  "Weighed from N ingredients · confidence" + the fit tag + one action. The
  industry-leading calculation is *shown* (provenance, confidence, tap-to-correct),
  because in nutrition, trust that isn't visible doesn't exist. Mobbin-verified as
  open lane: the best import reviews stop at ingredient confirmation —
  [MFP quotes the source text under each match](https://mobbin.com/screens/8b313dbe-0360-45ae-8219-6f260f49d83b),
  [Cherrypick's "edit any that look wrong → This looks correct"](https://mobbin.com/screens/6c4b1066-ebe7-49b2-afa1-b8838ab32660),
  [SideChef's per-ingredient check-off](https://mobbin.com/screens/e7894e84-781b-4c59-b779-8fbd575094e3) —
  **none surface per-serving macros + confidence + plan-fit at the capture moment.**
- Fit language is one calm register everywhere: "Fits" — never scores, grades, or
  percentages on food itself.

---

## Violation census — what Elevated v2 fixed (2026-07-17)

| Violation (Current) | Rule | Fix in Elevated |
|---|---|---|
| Tab titles at 4 sizes (Wednesday 33 / others 26) | 1 | All tab titles 33px serif |
| Plan/Cook header buttons = white squares w/ border+shadow; Today = muted circles | 3 | One 40px muted circle everywhere |
| Progress sections titled by in-card overlines; Today/Cook by serif heads | 2 | Serif section-heads on Progress §2–§5 (hero keeps its instrument label) |
| prog-chip ≠ chip metrics | 3 | One chip spec |
| Creator rail 66px / cuisine rail 58px | 3 | One 64px rail tile |
| Streak flame in clay (clay = Pro) | 4 | Plum-active flame |
| Progress hero numeral 40 vs ring 46 | 5 | Hero numerals 44 |
| Energy numeral 32 (off-scale) | 5 | Section numeral 28 |
| Cuisine letter monograms | 7 | Duotone texture tiles |
| Pure-white clinical ground | 6 | Warm oat ground |

**Delivered 2026-07-17 (tranche 2):** the recap story (Rule 8, above) · web shell
de-templated — first shipped as an ink Sloe-Deep sidebar, **rejected by Grace and
replaced with the light refined shell** (warm canvas sidebar, hairline separation,
muted nav states, plum Log food as THE filled — Linear's dimmed-same-family
grammar), web cards to constitution grammar (radius 24, hairline, no shadow — was
radius-22 + shadow) · motion demos live in the story
scenes (380ms house-ease, 70/140ms stagger, reduced-motion honoured) · trajectory
raw dots + goal line co-visible (Withings), decision-module one-CTA law, Plan
one-tap fix (open-lane), ambient fit + provenance + import trust card (Rule 10).

**Adversarial panel round (2026-07-17, 19 findings → 16 confirmed → all fixed):**
a cross-script crash in the web modal registry (RecapStory now window-exported);
the recap now serves a numbers-light Calm variant (no ranges/weight for
body-neutral users); the import trust line no longer claims "high confidence"
beside "quick check needed" (now "2 to confirm below", sage reserved for
verified); "Fits Thursday dinner" → "Fits a dinner this week"; the protein target
chip dropped its macro tint (Rule 4); web page-header primaries demote to outline
so the ink sidebar owns the one filled CTA (Rule 3); story close button to the
40px spec; Current's goal-label position restored (an ungated change had leaked);
post-log toast de-certaintied; Rule 5 amended with the story numeral tier.

**Grace review round (2026-07-17, from her screenshots):** structural labels
unified to the overline grammar (serif section-heads read harsh — Rule 1 amended);
clay/orange retired outright (the clay Upgrade on the ink sidebar was the
breaking case); the ink sidebar reverted to the light refined shell; chrome icons
replaced with true Lucide geometry (the fork was two-pronged with a stray stem —
"malformed and cheap" was accurate); section rhythm normalised to 28/10.

Still open for the next tranche: full spacing audit against the 4px grid (Grace:
"still massive spacing issues" — the 28/10 label rhythm is a first cut, not the
audit), decorative-colour sweep of sheets/pushed screens,
onboarding steps against Rule 1, mobile-web breakpoint against the ink shell, live
count-up numerals in story scenes, a real fit-derivation note for the demo
threshold on shelf cards.
