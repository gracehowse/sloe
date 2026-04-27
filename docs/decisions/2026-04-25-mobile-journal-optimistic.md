# Decision log: optimistic mobile journal writes (P1-12, 2026-04-25)

**Date:** 2026-04-25
**Status:** Resolved (P1 portion); persistent offline queue → P2-29
**Trigger:** P1 #12 in [Opus 4.7 codebase review](./2026-04-25-opus47-codebase-review.md). Audit said "no optimistic mobile journal writes; web `AppDataContext` does optimistic updates with rollback, mobile blocks on Supabase round-trips."

---

## Decision

The audit was partially wrong. Mobile already had optimistic + rollback for the **copy/duplicate** path (`insertClonedRowsIntoDay` in `apps/mobile/app/(tabs)/index.tsx:2517`). What was missing was the same pattern on the **planner-meal log** path (`logPlannedMealWithPortion` at line 2742) — that path waited for the Supabase insert before adding the meal to `byDay`, then re-fetched the whole journal via `loadJournal()`. P1-12 closes that gap.

The other two `nutrition_entries.insert` sites on mobile — barcode log (`apps/mobile/app/(tabs)/barcode.tsx:142, 188`) and recipe-detail log (`apps/mobile/app/recipe/[id].tsx:908`) — write from off-screen relative to the tracker. The user navigates back to the tracker after these inserts; the tracker re-fetches via `useFocusEffect`. Optimistic byDay updates can't help those paths because the tracker isn't mounted at log time. These inserts were not changed.

**Persistent offline queue** (the part of the audit that called for "writes survive app close, reconciliation on reconnect") is genuinely missing but is **not** a launch blocker. It's a v1.1 feature with non-trivial regression surface (AsyncStorage queue, NetInfo subscription, replay loop, conflict resolution, UI for pending-vs-synced) — tracked as new **P2-29**. The existing offline banner (`apps/mobile/app/(tabs)/index.tsx:2866`) tells the user "you're offline, changes sync when you reconnect" — but that's currently a soft promise, not a real guarantee. P2-29 closes the loop properly.

## Rationale

The core user-perceived latency on a journal log is the round-trip from "tap log" to "see meal in tracker." Optimistic update closes that loop in zero ms; the server insert happens in the background. On error, the meal disappears from the journal with an alert. That's the same shape as the web `useNutritionJournalState.addLoggedMeals`, and now the same shape across the in-tracker copy/duplicate, edit, and planner-meal-log paths on mobile.

Why not also build the persistent queue today: regression surface is meaningful. The replay loop has to handle cases like "user logged offline, came back online, the same `entry_id` is now on the server because they ran the app on another device" — which means real conflict resolution. The web `useNutritionJournalState` doesn't handle this either; both platforms rely on per-row idempotent IDs to avoid double-inserts on retry. The "real" offline queue is a coordinated web + mobile feature; building it under the launch deadline is the wrong sequencing.

## Alternatives considered

- **Build the full offline queue now.** Rejected. ~2-3 days of focused work, real regression surface; v1.1 fit, not P1.
- **Make all four `nutrition_entries.insert` sites optimistic.** Rejected. Barcode + recipe-detail paths are off-screen at log time; the tracker can't paint a meal that hasn't been told about yet because the tracker tab isn't mounted. Fixing this needs the persistent queue (so byDay loads from a persisted-then-replayed source), which is P2-29.
- **Replace `loadJournal()` after success with a no-op.** Considered. Kept the call as a reconciliation pass — covers any server-computed fields and surfaces `created_at` timestamps the optimistic insert doesn't know. The cost is one read; the benefit is a guaranteed-correct local cache after the optimistic write completes.

## Implementation

`apps/mobile/app/(tabs)/index.tsx` `logPlannedMealWithPortion` (~line 2742):

1. After the coercion guard (P0-3, unchanged), construct `optimisticMeal: JournalMeal` from the pm + mult + microsRes data.
2. `setByDay((prev) => ({ ...prev, [dk]: [...(prev[dk] ?? []), optimisticMeal] }))` — meal appears in the journal immediately.
3. Run the Supabase insert.
4. On error: filter the optimistic entry back out of byDay, surface `Alert.alert("Log failed", error.message)`. State returns to pre-tap.
5. On success: keep the optimistic state, run `loadJournal()` as a background reconciliation, snapshot today's target.

Type cast `as JournalMeal` matches the existing `apps/mobile/lib/nutritionJournal.ts` shape — id, name, recipeTitle, time, kcal/P/C/F (one-decimal), optional fiberG, waterMl, micros, portionMultiplier, source. Mobile `tsc --noEmit` clean.

## Platforms affected

- **Mobile:** in-tracker planner-meal log now feels instant. Failure mode (server error, RLS rejection, malformed body) rolls back transparently.
- **Web:** unchanged. `useNutritionJournalState` already does this pattern.
- **Supabase:** unchanged. Idempotent on `entry_id` PK so a hypothetical retry under the future P2-29 queue doesn't double-insert.

## Verification

- Mobile `tsc --noEmit` clean.
- The existing copy/duplicate path test pattern in `tests/unit/copyMealDialog.test.tsx` covers the optimistic-then-rollback shape; the planner-meal-log shape is the same plus a coercion-guard pre-check.
- TestFlight smoke: tap a planned meal → meal appears in tracker before the network round-trip; pull airplane mode and tap → meal appears, then disappears after the request fails with a clear alert.

## Related artefacts

- [Opus 4.7 codebase review §3.5](../audits/2026-04-25-opus47-codebase-review.md#35-no-optimistic-update-on-mobile-journal-writes)
- Existing optimistic pattern: `apps/mobile/app/(tabs)/index.tsx::insertClonedRowsIntoDay` (~line 2517)
- Web equivalent: `src/context/appData/useNutritionJournalState.ts::addLoggedMeals` (~line 252)
- Follow-up: **P2-29 — persistent offline write queue** (new task)

## Revisit when

- TestFlight cohort report failure modes — e.g. "I logged a meal in the lift, lost signal, app crashed, and lost the meal." That's the P2-29 trigger.
- Web `useNutritionJournalState` adds a persistent queue — at that point P2-29 should ship in lockstep so platforms stay in sync.
- A new `nutrition_entries.insert` site lands on mobile from inside the tracker tab — apply the same optimistic-then-rollback pattern.
