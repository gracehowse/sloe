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

## The one composition (no variants — D-2026-04-27-03)

wordmark → greeting (+8) → week strip (+20) → **hero** (+4):

1. jewel dial — tap = Remaining ⇆ Consumed (ENG-1653's dial-view switch)
2. status line (Under / Over budget · A fresh plate)
3. fresh-day log pill — the screen's one filled CTA
4. GOAL / EATEN / BONUS — bonus **always** renders (0 on empty)
5. **macro band** — all three macros with values + micro-tracks, IN the hero;
   tap → macro detail (the standalone macro section below is **retired**)
6. **one guide-line** — a single always-present coach entry that absorbs the
   deficit line AND the ENG-1293 Coach chip
7. view hint (`Remaining · tap to switch`)

then **Eat next** recipe card (+24; hides when over budget — the guide-line
carries the landing copy), Quick add, Today's meals.

## Already shipped from this direction

ENG-1653 / PR #1026 (flag `today_hero_cluster_v3`): the tight cluster rhythm,
Coach de-orphaning, north-star under the hero, dial-view switch, bonus-at-0.
The macro band, guide-line consolidation, and Eat-next card treatment are the
remaining slices (absorbing ENG-1656) — ticketed after ratification.

## Open questions for ratification

1. Guide-line absorbing the Coach chip (ENG-1293 entry preserved, restyled).
2. Macro band **replacing** the macro section vs coexisting with it.
3. Eat-next hiding when over budget.
