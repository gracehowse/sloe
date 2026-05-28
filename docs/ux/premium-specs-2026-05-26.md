# Premium redesign specs — Today / Recipes / Plan (2026-05-26)

Source-of-truth build specs from the parallel ui-product-designer pass, all held to [premium-design-language.md](./premium-design-language.md) and the approved Week-Digest reference (`docs/prototypes/2026-05-26-progress-digest-blend/index.html`). Each surface = HTML prototype → Grace red-line → flag-gated build (web+mobile, one commit, sim-validate). Feeds Premium P1–P4.

Prototypes: `docs/prototypes/2026-05-26-today-premium/` (built). Recipes + Plan prototypes to follow after the Today red-line validates the shared language.

---

## Today (P1/P2) — SHELVED (Grace, 2026-05-26: "I don't think today needs redesigning")

> **Not building this.** Today stays as-is. The audit below is kept for reference only — if any *small* targeted tweak is ever wanted (e.g. the macro tiles→strip), it'd be a one-off, not the full redesign. Do not re-open as a redesign without Grace asking.

### (reference only) `apps/mobile/app/(tabs)/index.tsx` + `components/today/*`; web `NutritionTracker.tsx` + `suppr/today-*`

**Audit:** below the hero ring it's 6–7 stacked bordered cards (macro tile grid, planned card, activity card with bordered sub-rows + burn-detail + weekly rollup, hydration card). The remaining-kcal number is shown 3× in 3 grammars (ring centre + Goal/Food/Bonus row + macro tiles). Activity card runs 3–4 signal colours. Orphan "Connect health"/"Track hydration?" text links between cards break rhythm. Bones are right (ring hero, single FAB, calm voice); finish is a dashboard, not premium.

**Redesign:** ONE filled hero card = ring (keep 3-state colour) + borderless macro strip (P/C/F/Fibre, thin tracks, over=amber) — kill the 2×2 tile grid + the duplicate Goal/Food/Bonus row. Meals card absorbs the Planned section (hairline sub-section). Activity card-soup → one borderless section: Burned/Food/Net(one signal colour)/Maintenance strip + a neutral weekly-pace row + workout rows; empty state = one tappable row not a paragraph. Hydration demoted to last conditional section. One filled "Complete day" footer. **Borrow:** Oura (one filled hero, rest borderless), Whoop (borderless metric strips). **Keep:** multi-ring depth (long-press), "what to eat next" chip, calm voice.

**Open calls:** retire macro "tiles vs bars" Settings toggle (→ strip only)?; move projected-kg weekly number off Today → Progress (daily-weigh-in anxiety)?; empty meal slots collapse to one "+Add" row vs disappear? **Capture caveat:** ground the before/after on a logged-day Maestro frame before build.

---

## Recipes / Discover (P3) — `apps/mobile/app/(tabs)/discover.tsx`, `library.tsx`, `recipe/[id].tsx`; web `DiscoverFeed.tsx`, `Library.tsx`, `RecipeDetail.tsx`; shared `src/lib/recipe/recipeDetailLayout.ts`

**Audit:** Discover feed reads as a settings list (6+ bordered boxes, no hero, weak form-label headers, a 4-colour `MacroIconRow` rainbow on every card). Recipe detail = 8 stacked boxes; the **"Fits your day" verdict — Suppr's differentiator — renders as a 13px footnote** while the calorie hero was deleted entirely (no focal number). Per-ingredient confidence dots use red/green (reads diet-culture).

**Redesign:**
- *Discover:* borderless search pill; promote **import to an editorial hero** ("Found a recipe on TikTok/Instagram? Paste the link" + one filled button) — it's the viral front door; replace the `Alert` clipboard prompt with an inline affordance. Editorial image-forward cards (title as weight + one quiet meta line `creator · 25 min · 480 kcal`), **no macro rainbow on browse cards**; optional single green "Fits your day" chip only when it fits (silence otherwise). Cuisine rails (converge web↔mobile per ENG-695) as compact image-overlay cards. Library link leaves the scroll → header text link.
- *Recipe detail:* collapse 8 boxes → ONE soft-fill **FIT HERO** = the verdict as a hero number on a target track (`480 kcal ● of 1,800 today` + "≈27% of your day · 42g protein") — the differentiator becomes the centrepiece. Macros → borderless strip (protein green-on-target only). Servings stepper / description / allergen → hairline rows, not cards (allergen copy stays verbatim, legal). Keep tabs for steps/full-nutrition. One filled "Add to today" footer.
- *Trust:* recolour ingredient confidence off red/green → ink (verified) / dim (estimated) / one calm amber (low-confidence); keep honest labels.

**Borrow:** Kitchen Stories (editorial browse). **Keep:** the fit verdict (promote it), honest trust posture (no fake "verified" chip), paste-a-link front door, calm voice. **Open calls:** import-hero vs for-you-hero on Discover?; fit chip show-when-fits vs detail-only?; detail title overlay vs below?; mobile cuisine rails (reverses 2026-05-22 flatten) — genuine fork.

---

## Plan (P3/P4) — `apps/mobile/app/(tabs)/planner.tsx`; web `MealPlanner.tsx`

**Audit:** **web is the box-soup reference case** — a 7-column grid of bordered day-cards each holding 4 bordered slot-tiles (~28 nested fills) + a filled summary card; structurally diverged from mobile (accidental parity drift, not a deviation). Mobile is mid-tier (list already flattened) but: the per-day macro-delta line is **4 signal colours × 7 days** (≈28 coloured tokens, reads as a diet-culture scorecard); the day's kcal hero is 12px (smaller than meal titles); "Generate" appears **3×** (summary card + ghost chip + empty card); "Log as planned" is buried 2 taps deep in the `⋯` sheet; 3 concurrent loading treatments.

**Redesign:** a week = vertical list of days; a day = quiet eyebrow (`TUE · TODAY`) + **hero kcal on an Oura target track** (one signal: neutral within ±10%, amber over — never red) + one neutral macro observation line (protein-on-target green only; kill the rainbow + the separate protein-gap warning). Meal rows: muted neutral slot caps (drop slot colour), title, kcal as a tabular right rail, hairline between rows only. **Surface `Log` on the TODAY section's planned rows** (fix the buried daily loop). Summary card → observation-only (5-of-7 week-tick mini-viz + one neutral diagnosis line, **no CTA**). One `Generate ▾` in a slim toolbar (kill the 2 duplicates). One loading treatment (3 skeleton day-sections). **Converge web onto mobile's flat list** (fixes the #1 box-soup + the parity drift in one move). **Borrow:** MacroFactor (target-relative track, one accent), Mealime (flat image-led week, one regenerate CTA). **Keep:** recipe thumbnails per row, per-day fit signal, household scope, calm voice.

**Open calls:** under-target track = neutral grey vs faint accent?; per-day hero kcal 22–24px (adds height ×7) vs calmer 15–16px?; today `Log` per-row vs one "log all planned"?; macro line pure observation vs keep an actionable nudge (→ brand-manager)?

---

## Cross-cutting decisions surfaced (route to product-lead)
- Retire the macro **tiles-vs-bars** toggle (Today) — consolidation.
- The **"Fits your day"** verdict should be a hero-on-track on recipe detail (currently a footnote) — biggest differentiator win.
- **Confidence colour scale** off red/green globally (ingredient lists, anywhere it grades) → ink/dim/amber.
- **Web→mobile layout convergence** for Plan (and Discover cuisine rails per ENG-695) — parity, not deviation.
- All builds **flag-gated**, web+mobile same commit, sim-validated, before/after captures (most surfaces have no captures yet — prototype + first sim run are the first pixels).
