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

## The one composition (rev 2 — Mobbin-benchmarked)

Rebuilt per Grace ("we can do better — use mobbin for inspo; the big log
dinner button needs removing, people know where to log") against the Mobbin
pulls in `docs/ux/reviews/2026-07-05-ui-critique-mobbin-benchmark.md` §Today.

wordmark → greeting (+8) → week strip (+20) → **hero** (+4), reading
**verdict → interpretation → ledger**:

1. jewel dial on a state-keyed **ambient wash** (sage under / amber over /
   frost empty — the Lifesum grammar: mood, not a spreadsheet cell)
2. verdict line + view hint (`Remaining · tap to switch`, MacroFactor's
   reframe — tap the dial or the hint)
3. **narrative guide-line directly under the verdict** (the Oura grammar:
   the number never speaks for itself) — ONE always-present coach entry
   absorbing the deficit line and the ENG-1293 Coach chip; fades in after
   the dial sweep
4. **the board** — one aligned 3-column ledger: GOAL / EATEN / BONUS
   (bonus always renders, 0 on empty) over thin macro tracks at
   deliberately lower weight (MacroFactor); tap a macro → detail. The
   standalone macro section below the hero is **retired**
5. **no log pill** — Cal AI's filled-pill-in-the-ring pattern rejected;
   the FAB is the log affordance (supersedes ENG-1372 law 2 and the
   July-5 review's "invitation inside the hero" rule — Grace, 2026-07-21)

then **Eat next** recipe card with real embedded photography (+24; hides
when over budget — the guide-line carries the landing copy), Quick add,
Today's meals.

## Already shipped from this direction

ENG-1653 / PR #1026 (flag `today_hero_cluster_v3`): the tight cluster rhythm,
Coach de-orphaning, north-star under the hero, dial-view switch, bonus-at-0.
The macro band, guide-line consolidation, and Eat-next card treatment are the
remaining slices (absorbing ENG-1656) — ticketed after ratification.

## Open questions for ratification

1. Guide-line absorbing the Coach chip (ENG-1293 entry preserved, restyled).
2. The board **replacing** the standalone macro section vs coexisting.
3. Eat-next hiding when over budget.
4. The ambient hero wash (a deliberate departure from the flat ENG-1571
   dial-material ruling — wash sits BEHIND the dial on the page ground,
   the dial itself stays flat; needs an explicit OK).
