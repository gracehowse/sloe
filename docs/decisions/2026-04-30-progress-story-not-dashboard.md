# Progress is a story, not a dashboard — empty-state gate + Digest narrative lead

**Status:** Resolved — shipped 2026-04-30
**Authority:** D-2026-04-27-17 (binding direction) + customer-lens audit 2026-04-30 + product-lead audit 2026-04-30
**Owner:** executor
**Branch:** `claude/north-star-round-2`

## Summary

Two correctness gaps shipped after the Phase 4 / B3.1 Surface E refactor:

1. The engine-led `<ProgressHeadline>` rendered narrative copy even when `adaptiveTdee == null` and the user had < 3 days of logging. Narrative based on null is broken UX — week-1 users saw "We're still calibrating your maintenance" copy that referenced "your early estimate" against zero data.
2. The 2x2 stat-card grid (Avg Calories / Protein Hit / Streak / Trend) survived the refactor and still anchored the page visually. D-2026-04-27-17 calls for the tiles to be **demoted, not deleted** — they are still the entry to the per-metric drill-downs (`progress-metric` + `weight-tracker`).

## Decisions

### D1 — Empty-state gate before the engine line

`hasEnoughDataForStory(daysLogged: number): boolean` returns true when `daysLogged >= 3`. Below the floor we render `<ProgressStoryGate>` — a placeholder card that mirrors the live headline geometry but carries:

- aspirational headline ("Your story builds with your data" / "Almost there" on day 2)
- factual body ("Log a meal to start the count. 3 days to your first insight." / "2 more days to your first insight." / "One more logged day and your weekly story unlocks.")
- a small ring (24pt) showing 0/3, 1/3, 2/3, snaps closed at 3/3 just before the live headline takes over on the next render

Helper: `src/lib/nutrition/progressStoryGate.ts` (mobile re-export at `apps/mobile/lib/progressStoryGate.ts`).

### D2 — Demoted stat chips

The 4 tiles are kept (drill-down navigation requirement) and visually downgraded to a 2-column chip row below the new digest narrative card:

- transparent background (was `bg-card`), 1px border (kept), reduced padding (was `p-3` → `px-3 py-2`)
- numerals 13pt 600 (was 22pt 700), no per-tile colour-tinted backgrounds
- single line per chip ("PROTEIN HIT  4/7  days on target") with a `chevronRight` affordance
- `data-testid="progress-demoted-chip-{calories,protein,streak,trend}"` for analytics + tests

The four metrics still navigate to the same drill-down screens. Icons retained for scanability.

### D3 — `<DigestStoryCard>` is the narrative lead

A new always-visible weekly narrative card sits between the Phase 2 hero cards and the demoted chips. It renders 4–5 short sentences:

1. `This week (Apr 6 – Apr 12).`
2. `5 of 7 days logged.`
3. `You averaged 1,980 kcal vs 2,100 target — 120 under.` (suppressed when no calorie target)
4. `Hit your protein target on 4 of 5 days logged.` (with optional `Average 100g vs 150g target.` annotation when avg is < 80% of target)
5. `Tuesday was your closest day (2,105 kcal vs 2,100 target).` (uses the existing `selectClosestToTargetDay` from `src/lib/nutrition/weeklyRecap.ts`)

Empty state (`daysLogged === 0`) renders only a calm `Quiet week — log a meal to start your story.` line. No emoji, no exhortation.

Builder: `src/lib/nutrition/digestStory.ts`.
Components: `src/app/components/suppr/digest-story-card.tsx` (web) + `apps/mobile/components/progress/DigestStoryCard.tsx` (mobile).

### D4 — Existing `<Digest>` (Sunday-only recap) unchanged

The dismissible Sunday-evening `<Digest>` card with share + headline + 4-tile stat strip still renders Sat 18:00 → Tue under its existing `recapVisible` gate. It is a different surface (week-just-ended summary with share-out) and does not anchor Progress visually any more — the new `<DigestStoryCard>` is the always-visible lead.

## Reconsider on

- Test cohort feedback says the placeholder card feels patronising at day 1. Tighten copy or shorten the floor.
- `<DigestStoryCard>` repeats data the user already saw on Today. Roll up further — single-line variant.
- The data floor (3 days) catches adherent users who skip a day and feels punitive. Loosen to 2 only after telemetry shows it.

## Files

- `src/lib/nutrition/progressStoryGate.ts` (new)
- `src/lib/nutrition/digestStory.ts` (new)
- `apps/mobile/lib/progressStoryGate.ts` (mobile re-export)
- `apps/mobile/lib/digestStory.ts` (mobile re-export)
- `src/app/components/suppr/progress-story-gate.tsx` (new web component)
- `src/app/components/suppr/digest-story-card.tsx` (new web component)
- `apps/mobile/components/today/ProgressStoryGate.tsx` (new mobile component)
- `apps/mobile/components/progress/DigestStoryCard.tsx` (new mobile component)
- `apps/mobile/app/(tabs)/progress.tsx` (gating + chip demotion + lead-card insertion)
- `src/app/components/ProgressDashboard.tsx` (gating + chip demotion + lead-card insertion)
- `tests/unit/progressStoryGate.test.ts` (new — 10 tests)
- `tests/unit/digestStory.test.ts` (new — 12 tests)
- `tests/unit/progressStoryGateRender.test.tsx` (new — 5 tests)
- `apps/mobile/tests/unit/progressStoryGateMobile.test.tsx` (new — 4 tests)

## Cross-references

- Memory `project_progress_direction.md` — confirmed binding via D-2026-04-27-17.
- Memory `project_strategic_direction_2026-04-27.md` — D-2026-04-27-17 ratifies "Progress = story not dashboard".
- `docs/design/digest-primitive.md` — describes the dismissible Sunday `<Digest>` card; this commit does not touch it.
