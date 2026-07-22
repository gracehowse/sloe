# Today v4 — hero / Today-page prototype

**Status: PROPOSAL (ENG-1658).** `docs/ux/redesign/v3/Sloe-App.html` remains the
canonical prototype until Grace ratifies this page. On ratification, this
supersedes the v3 **Today frame only** — every other v3 screen stays canonical.

Commissioned by Grace, 2026-07-21 ("I need a brand new prototype for the
hero / today page") after the ENG-1653 cluster-hero sim review: too much air
between sections, a dead macros toggle, the fresh-day BONUS suppression, and
"all the macro variants should be visible in this view … this section of the
page needs reimagining" (ENG-1656).

## Open it

`Today-Hero.html` is self-contained (tokens verbatim from `Sloe-App.html`).
Interactions need a real page context — serve it rather than `file://`:

```bash
cd docs/ux/redesign/v4-today && python3 -m http.server 8098
# → http://localhost:8098/Today-Hero.html
```

Controls: day-state switcher (Fresh morning / Mid-day / Evening · over),
light/dark, and the dial (or the hint under it) flips Remaining ⇆ Consumed.

## The one composition (rev 3 — "the editorial ledger")

rev 3 commission (Grace, 2026-07-21): "I don't know if I like the days; the
purple overage is a bit aggressive. completely reimagine the page. forget
what you already know. look at it with pure critical eyes."

Cold-eyes findings that drove the reset: the date was stated four times
across ~200pt of pre-content chrome; the permanent week strip is
time-travel navigation taxing every open (its solid plum pill was the
heaviest ink block on the canvas — plum doing brand + selection + accent +
macro duty); the centered dial + centered stacks is the category-default
composition, while Sloe's ownable asset (July-5 identity verdict) is the
serif voice — spent on a greeting.

rev 3 inverts the hierarchy — **the number IS the typography**:

1. **One masthead row** (wordmark · bell · avatar) + **one quiet day-line**
   (`‹ TUESDAY 21 JULY ——— 📅` — chevron pages back, calendar for far
   dates). The only date statement on the page. No strip, no filled pill.
2. **Type-led hero, left-aligned on one rail**: state overline (dot +
   UNDER/OVER BUDGET / A FRESH PLATE) → **76px Newsreader numeral** + unit
   (tap flips Remaining ⇆ Consumed) → the ring reduced to a **4px hairline
   gauge** with a goal notch (amber only past the notch) → one narrative
   line (Oura: the number never speaks for itself) → inline
   Goal · Eaten · Bonus ledger (bonus always renders) → three thin macro
   rows (values right-aligned, 3px tracks).
3. **Plum rationed** to wordmark, FAB, links, and small marks — state
   colour (sage/amber) carries meaning; ink carries hierarchy.
4. **No log pill** (supersedes ENG-1372 law 2 — Grace: people know where
   to log; the FAB is the affordance).

then **Eat next** with real embedded photography (hides when over budget —
the narrative carries the landing copy), Quick add, Today's meals.

## Already shipped from this direction

ENG-1653 / PR #1026 (flag `today_hero_cluster_v3`): the tight cluster rhythm,
Coach de-orphaning, north-star under the hero, dial-view switch, bonus-at-0.
The macro band, guide-line consolidation, and Eat-next card treatment are the
remaining slices (absorbing ENG-1656) — ticketed after ratification.

## Open questions for ratification

1. **Retiring the jewel dial from Today** — the boldest call in rev 3: the
   dial (ENG-1225's signature instrument) leaves this screen for a hairline
   gauge; the dial identity would live on Progress/onboarding. Needs an
   explicit yes.
2. Retiring the permanent week strip (day-nav = chevron + calendar + swipe).
3. Narrative absorbing the deficit line + ENG-1293 Coach chip.
4. The macro rows replacing the standalone macro section.
5. Eat-next hiding when over budget.
