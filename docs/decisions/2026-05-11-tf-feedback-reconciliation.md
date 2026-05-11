# 2026-05-11 — TestFlight feedback reconciliation + outstanding-items disposition

## Context

After the 10-PR ship day on 2026-05-10 (PRs #171 → #186 closing F-140 → F-156), the tracker (`docs/testflight-feedback/tracker.md`) still carried several stale `🔄` (in-flight) markers and a handful of items that were open without explicit deferral reasoning. Grace asked on 2026-05-11 to fully reconcile so every piece of TF feedback is either (a) shipped, (b) closed-by-design, or (c) explicitly deferred with reasoning. This doc captures the disposition for everything that does NOT fit (a) or (b).

## Status markers patched in `tracker.md`

Seven entries had stale `🔄 PR #N` markers despite their PRs being merged. Flipped to `✅ PR #N`:

- F-142 (PR #173) — household create rollback
- F-143 (PR #173) — RC tier-sync telemetry
- F-144 (PR #173) — persistence error mapping
- F-145 (PR #178 portion) — `getEffectiveTDEE` staleness check
- F-146 (PR #174) — week-view net-deficit math
- F-147 (PR #174) — Progress steps sync race
- F-149 (PR #179 portion) — web Settings retune backfill

No code change. Tracker truthfulness is the deliverable.

## Items fixed in this reconciliation wave (PRs to follow)

These three items had a clear next step in the previous tracker but weren't shipped:

1. **F-157 — weekly check-in floor-binds copy reframe.** Small copy-only PR against `src/lib/nutrition/weeklyCheckin.ts`. ~30 min.
2. **F-156 PR-3 — Cholesterol + Potassium read surface in custom-food sheet.** Render-only addition to the macro grid when the underlying row carries values; no schema change. ~1 hr.
3. **F-149 — proper Theme 3 schema fix (`goal_history` table).** The mobile + web retune backfill (PR #176 + PR #179) is the band-aid; the canonical fix is a `goal_history` table that stores effective-date-stamped goal/activity-level changes so past-day reads can answer "what was the goal that was in force on day D?" without a backfill heuristic. Multi-hour PR.

## Items explicitly deferred (open, but documented)

The five items below stay open in `tracker.md` but are NOT counted as blockers. Each has a named reason and a named unblock condition. They will not auto-close — they require either tester input or a UX call.

### F-132 — "Do we need weight graphs in 3 places?"

- **State:** Weight chart renders on Progress tab + `/weight-tracker` route + a third surface (Today's weight card, abbreviated).
- **Why deferred:** Consolidation is a UX decision, not a code fix. F-125 unified the *chart component*; the question is whether all three *surfaces* should keep their chart or share one.
- **Unblock condition:** UX call by Grace on whether the three surfaces collapse to one (and which) or stay separate with clear purpose for each.
- **Not a launch blocker:** Charts render correctly; redundancy is a polish concern, not a bug.

### F-137 — "Need multiplier on portion chip" (barcode result sheet)

- **State:** Barcode result sheet asks for grams; for count-based items (e.g. "4 chicken nuggets") the user has to do mental math.
- **Why deferred:** Needs UX design — where the multiplier lives in the sheet, how it interacts with the existing portion input, how it persists into the log row. Not a one-line fix.
- **Unblock condition:** Design proposal (use `ui-product-designer` agent) covering layout + interaction states + persistence shape.
- **Not a launch blocker:** Existing flow works for gram-aware users; count-multiplier is a paper-cut for one common case.

### F-* (no number) — "Imported MFP carbs way higher than actual" (`AJHZNp8NHTiFNk9TjQfdYBk`)

- **State:** Tester report that an imported recipe shows different carb total in Suppr vs MFP.
- **Why deferred:** No reproduction. Could be: (a) MFP using a different ingredient match in the row, (b) Suppr's verification re-matching to a different USDA row with different macros, (c) per-serving vs per-100g basis mismatch on import.
- **Unblock condition:** Tester provides the MFP export (or a screenshot of the MFP recipe + the Suppr recipe side-by-side) so we can diff which ingredient rows disagree and at which macro.
- **Not a launch blocker:** N=1 report, no pattern of macro corruption; F-150 closed the worst-case back-calc bug.

### F-* (no number) — "Library inconsistency: some recipes have images, some don't"

- **State:** Some imported / saved recipes have hero images, others fall through to the fallback render.
- **Why deferred:** Grace paused the hero-image work pending a strategy call on whether Suppr (a) auto-generates a fallback hero per recipe, (b) requires the user to provide one, or (c) leaves the no-image state as-is with a better empty visual. Three different products.
- **Unblock condition:** Strategy decision — see memory note "Hero images: 'Auto-generate fallback hero (Recommended)' (2026-05-10)". Implementation can begin once the rendering surface for the auto-generated hero is specified.
- **Not a launch blocker:** Recipes without images still render; inconsistency reads as "polish needed" not "broken".

### F-* (no number) — "Defaults to recipes that don't exist"

- **State:** Tester report on a surface that defaults to a recipe that "doesn't exist" — likely a stale reference in a recipe picker or library initialization after the 2026-05-10 Suppr-Kitchen recipe library replacement (commit `8653c23`).
- **Why deferred:** Vague surface reference; no specific callsite identified. The wholesale recipe-library replacement on 2026-05-10 may have orphaned stored recipe-id references on other surfaces.
- **Unblock condition:** Triage — reproduce on the next TF build with the new recipe library, screenshot the surface, identify the broken default-resolution path.
- **Not a launch blocker:** Migration `20260514100000_replace_recipes_with_suppr_kitchen.sql` plus PR #167's `meal_plan_meals.recipe_id` and `nutrition_entries.recipe_id` `ON DELETE SET NULL` FK cascades mean orphaned recipe references degrade gracefully (no crash, no broken UI — just a missing label).

## Items awaiting tester re-verify (no action required)

These are not open — they're closed code-side, waiting only for tester confirmation on the next TF build. They stay in `tracker.md` under their current `⏳`/`🟡` markers until verified.

- **F-114** — stuck-spinner family. Fixes in PRs #129/#133/#134 add finite-time settle to every loader on the critical path. Verify on build 45+.
- **F-108** — AI photo-log analysing. PR #131 + #139 ship error-code-mapped client copy + server abort. Verify when tester next hits the failure.

## Items closed by-design (no further action)

Confirmed via tracker review — each has explicit reasoning in the entry itself:

- **F-148** — weight chart 3M/6M/9M buttons (those buttons literally don't exist in the live build; closed 2026-05-10).
- **F-153** — plan-vs-macro alignment chips (shipped in build 12, tester report predates fix).

## Items deferred per a separate decision doc

These are not "open" — they're scoped multi-day workstreams with their own decision docs:

- **F-138 Phases 3–5** — `docs/decisions/2026-05-08-food-correction-verification-pipeline.md`. Phase 3 partially shipped 2026-05-10–11; Phase 4 admin queue shipped 2026-05-10 (PR #186); Phase 5 trust + vision auto-verify scoped, not started.

## Net open after this reconciliation

| Bucket | Count | Action |
|---|---|---|
| Shipping in this wave (PR-ready) | 3 | F-149 (schema), F-156 PR-3 (read surface), F-157 (copy) |
| Deferred + documented (this doc) | 5 | F-132, F-137, MFP carbs, hero images, defaults-to-recipes |
| Awaiting tester re-verify | 2 | F-114, F-108 |
| Scoped multi-day workstreams | 1 | F-138 P3–P5 |

Zero TF feedback items remain in fuzzy state.
