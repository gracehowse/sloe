# The Sloe Design Constitution — v1 (2026-07-17)

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
serif section-head 18px (+ optional right-slot)  →  content
…repeat sections…
```

- **One hero per screen.** Today = the ring. Plan = the day verdict. Progress = the
  weight trajectory. Cook = tonight's pick. The hero is the only element allowed
  display-scale type or the tinted ground.
- Display type exists nowhere else. If two things look "biggest," the screen is wrong.

## Rule 2 — One card grammar (ENG-1497, unchanged)

Page-ground cards: white, hairline, radius 24, flat. **At most one tinted hero card
per screen** (`--hero-tint`). Nested cards: flat, borderless. Sheets/overlays float.
**Sections are titled by the serif section-head outside the card.** In-card overlines
label only *internal* groups (e.g. the instrument label inside a hero, a confidence
readout) — never the card's identity.

## Rule 3 — One control kit

- **Icon button:** 40px circle, muted fill, ink glyph. There is no white-square,
  bordered, or shadowed variant. Anywhere.
- **Chip:** full-radius pill, muted fill, 13px/600, 9×14 padding; selected = plum
  fill, white text. All chips — quick-add, filters, status — are this chip.
- **Segmented control:** one spec, used for exclusive 2–5-way switches only.
- **Rail:** one tile size (64px circle) + 12px label. Creators and cuisines share it.
- Buttons: one filled CTA per screen (conversion surfaces excepted) · secondary =
  tonal · tertiary = ghost text. Unchanged from the CTA ruling.

## Rule 4 — Colour governance (the discipline that reads as luxury)

Colour **means** something or it doesn't appear.

| Hue | May appear as | Never as |
|---|---|---|
| Ink + plum family | All chrome, text, controls, links | — |
| Sage / amber | Day-state semantics only (under/over, on/off-track) | decoration, icons-for-flavour |
| Clay | Pro / monetisation only | streaks, encouragement, misc accents |
| Macro hues | Inside macro visualisations only | section accents, icon tints |
| Destructive red | Destructive actions/errors only | over-budget (that's amber) |

One screen should read near-monochrome plum-ink until the *data* speaks.

## Rule 5 — The numeric instrument scale

Serif, tabular. **Hero numeral 44–46** (one per screen) · **section numeral 28** ·
row numeral 15–17 · caption 11–12. No other numeric sizes exist.

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

| Moment | Screen · hero | Composition law |
|---|---|---|
| Where do I stand | Today · the ring | One numeral, state-coloured; tap flips remaining↔eaten (MacroFactor reframe) |
| What do I eat next | Today · decision module | Editorial photo + serif name, target chips as the numerals, ONE verdict line, ONE action ("Log this"); tap opens the recipe. Never three prompts (Copilot/Flighty: one number leads, one action clears) |
| Log it | FAB · log hub | Recents = one-tap re-log (Lose It); post-log reward = the watched element completes + one honesty line — never confetti (MacroFactor state-flip, Cal AI verdict) |
| Week is handled | Plan · day verdict hero | Calm verdict sentence + **one-tap fix** that re-derives downstream (open lane — none of Mealime/eMeals render the verdict; we do) |
| Did it work | Progress · trajectory hero | Smoothed line + raw dots + goal line **co-visible** (Withings' hard lesson) + rate + hedged projection; coaching only on drift |

Next tranche of this rule: the weekly recap as full-bleed single-stat story scenes,
descriptively framed, ending on an identity beat, each scene saveable
(Gentler Streak / Duolingo / Strava grammar) — the §5 Share action's real payload.

## Rule 9 — Motion is confirmation

Count-ups and arc-draws on mount; a spring on every commit; the gold win-moment on
goal days. Nothing moves decoratively. Honour `prefers-reduced-motion`.

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

Remaining, tracked for the next tranche: web dashboard de-templating (sidebar ink
treatment, hero numerals), motion demos in-prototype, full decorative-colour sweep of
sheets/pushed screens, onboarding steps against Rule 1.
