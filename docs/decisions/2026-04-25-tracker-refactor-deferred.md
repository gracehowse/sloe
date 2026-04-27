# Decision log: mobile Tracker monolith refactor — deferred to v1.1 (P2-19, 2026-04-25)

**Date:** 2026-04-25
**Status:** Resolved — deferred to v1.1 with structured plan
**Trigger:** P2-19 in [Opus 4.7 codebase review](./2026-04-25-opus47-codebase-review.md). `apps/mobile/app/(tabs)/index.tsx` is ~3700 lines and holds `byDay`, `selectedDate`, `profileTargets`, copy/duplicate logic, eat-again, slot grouping, plan-meal log, journal hydration, and the full Today UI in one component.

---

## Decision

**Deferred to v1.1.** Pre-launch is the wrong time for the single most consequential refactor in the backlog. The Tracker tab is the most-trafficked screen in the app; it's been hand-tuned across ten+ batches; and there's no correctness gap that the refactor closes — only architectural debt that becomes a v1.1 ceiling.

The structured plan for the v1.1 PR:

### Phase 1 — Extract pure helpers (low risk)
- Move `cloneMealWithoutId`, `sanitizeCopyTargets`, `computeEatAgainForSlot` to `apps/mobile/lib/trackerHelpers.ts`. These are already pure functions colocated by accident.
- No behaviour change; tests can pin the helpers in isolation.

### Phase 2 — `TrackerContext` for shared state (medium risk)
- New `apps/mobile/context/TrackerContext.tsx` exposes `byDay`, `selectedDate`, `setSelectedDate`, `profileTargets`, `loadJournal`, `addLoggedMeal`, `insertClonedRowsIntoDay`, `logPlannedMealWithPortion`. Mirrors the web `useNutritionJournalState` shape so future cross-platform helpers can target one signature.
- Wrap the (tabs) layout with `TrackerProvider`. Components consume via `useTracker()`.
- The Tracker tab itself becomes a leaf that reads context + renders. ~500 lines of UI; ~2900 lines move out.

### Phase 3 — Split the leaf (low risk after Phase 2)
- `TrackerHeader` (date strip + offline banner)
- `TrackerSummaryRing` (kcal ring + macros bar)
- `TrackerSlotList` (the meal-by-slot accordion + eat-again)
- `TrackerLoggingActions` (quick-add row + voice/photo log buttons)
- Each leaf sees a slice of the context.

### Phase 4 — Tests (concurrent with Phases 2 + 3)
- Pin context invariants: optimistic insert + rollback on error, copy-meal idempotency, daily target snapshot.
- Snapshot test for the leaf renders so a pixel-level regression is caught.

### Risk profile

- **Phase 1** is safe to ship anytime — no UX surface change.
- **Phase 2** is the load-bearing change. Risk: the context API and the existing `useState` shape don't match cleanly; a missed `useEffect` dependency causes a stale-state bug on the most-used screen. Requires a dedicated TestFlight cohort and at least one full week of dogfooding before main.
- **Phase 3** is mechanical once Phase 2 lands.

Estimated effort: ~3–4 days of focused work + 1 week TestFlight bake-in. Not a launch-window deliverable.

## Rationale

The Tracker is the single screen users hit every day. Every other refactor in the backlog can be reverted by fixing one file; a Tracker refactor regression hits everyone immediately. The only safe sequencing is "land it after launch under controlled rollout."

The audit's other concern — "stale-state hazard after tab switches; no shared journal cache" — is real but not currently a launch-blocking bug. Tab switches force-refetch via `useFocusEffect`; the cost is one Supabase round-trip per tab change, which is fast enough that no user has reported it. The refactor turns the Tracker from "works fine, hard to extend" into "works fine, easy to extend." That's a v1.1-class win, not a launch-window one.

## Alternatives considered

- **Do the refactor now.** Rejected. Highest-risk change in the backlog; pre-launch sequencing is wrong.
- **Do Phase 1 (helper extraction) only.** Considered. Genuinely safe, but adds a stub change that gets stranded if Phases 2+ don't follow within the same release. Better to land all four phases in one focused v1.1 PR.
- **Tactical patches: just memoize the byDay slices currently causing tab-switch latency.** Rejected. Doesn't address the architectural issue; ships another layer of complexity on top of the existing monolith.

## Implementation

No code change today. The plan above is the v1.1 deliverable.

## Platforms affected

- **Mobile:** none today; v1.1 will see a refactored Tracker with a context layer.
- **Web / Supabase:** none.

## Related artefacts

- [Opus 4.7 codebase review §3.6](../audits/2026-04-25-opus47-codebase-review.md) (P2-19)
- Web equivalent (already context-based): [`src/context/AppDataContext.tsx`](../../src/context/AppDataContext.tsx) — model for the mobile context shape.
- Sister item in the post-launch backlog: P2-20 (verifyRecipe.ts decomposition), P2-28 (full meal-plan algo dedup), P2-29 (persistent offline queue).

## Revisit when

- v1.1 cycle opens. Phase 1 + Phase 2 + Phase 3 + Phase 4 in one focused PR.
- A regression in `apps/mobile/app/(tabs)/index.tsx` makes the next bug-fix harder than it should be — that's the trigger to bring the refactor forward.
