# Decision log: persistent offline write queue — deferred to v1.1 (P2-29, 2026-04-25)

**Date:** 2026-04-25
**Status:** Resolved — deferred to v1.1 with structured plan
**Trigger:** P2-29 (created during P1-12 work). P1-12 made the in-tracker planner-meal log optimistic, but a real persistent queue (writes survive app close, reconciliation on reconnect, retry with backoff, conflict resolution against server-side rows) is a coordinated web + mobile feature.

---

## Decision

**Deferred to v1.1 with a structured plan.**

The interim state is correct: P1-12 made `logPlannedMealWithPortion` optimistic with rollback. The user sees their meal in the journal instantly; on a server error the meal disappears with an alert. What's missing is the persistence guarantee — if the user logs offline, force-quits, or loses connectivity mid-write, the local optimistic insert exists in memory only.

Today's offline banner says "you're offline, changes sync when you reconnect" — a soft promise. A proper queue makes the promise real.

### Target shape (v1.1)

1. **AsyncStorage-backed pending queue.** Key: `pm:journal:queue:v1`. Value: array of `{ entryId, dayKey, payload, attempts, lastAttemptAt, lastError? }`.
2. **NetInfo subscription** in `apps/mobile/context/auth.tsx` (or a sibling provider) detects reconnect.
3. **Replay loop:** on reconnect, iterate the queue, attempt each insert with exponential backoff (1s, 2s, 4s, 8s, give up after 5 attempts). Idempotency comes from the existing `entry_id` PK — duplicate-key 23505 = already on server, dequeue.
4. **UI badge** in the offline banner: "3 changes pending — syncing..." → "3 changes synced ✓" → "1 change failed (tap to retry)".
5. **Web equivalent.** `useNutritionJournalState` already has optimistic writes but no persistence; add a localStorage queue with the same shape so a forced refresh during offline doesn't lose pending writes.
6. **Apply to all journal-write paths**, not just the planner-meal log. Barcode, recipe-detail, food-search, manual edit — all run through the queue helper.

### Sequence

1. **Extract a shared `queueJournalWrite` helper** in `src/lib/nutrition/journalWriteQueue.ts` (pure, platform-agnostic). Web + mobile both consume.
2. **Wire mobile** via AsyncStorage and NetInfo.
3. **Wire web** via localStorage and `navigator.onLine` + `online`/`offline` events.
4. **Surface the badge** in the existing offline banner.
5. **Migrate every `nutrition_entries.insert` call site** (5 known per the P0-3 inventory test) to `queueJournalWrite`.
6. **Test:** unit tests for the queue helper, integration test for the replay loop with a mocked Supabase client + flaky network simulation.

Estimated effort: 2–3 days plus a week of TestFlight bake-in (offline scenarios are hard to QA exhaustively).

### Risk profile

- **Lost writes:** the worst failure mode is a user logs a meal, force-quits during write, comes back, and the meal isn't there. The queue has to persist before the optimistic UI update commits — sequencing matters.
- **Conflict on reconnect:** if the user logged the same meal on another device while offline, the second write hits 23505 and dequeues cleanly. No special handling.
- **Queue size:** pathological case is "user offline for a week, logs 200 meals". Cap the queue at 500 entries; surface a warning if it fills.

## Rationale

P1-12's optimistic + rollback closes 80% of the user-perceived latency gap (meals appear instantly). The remaining 20% — survive force-quit, survive flaky network, survive timezone-stale weekly recap — is the queue's job.

Why not now: the queue is real complexity. Persistent state across app lifecycles, conflict resolution, retry budget, UI badge, queue-cap behaviour, web-side integration. Each is a small thing; together it's 2–3 days of focused work plus testing. That's v1.1-class.

The launch-window risk of NOT having the queue is bounded:
- TestFlight cohort is small; users rarely lose connectivity mid-tap.
- The rollback alert tells the user the meal didn't save; they can retry.
- The offline banner already sets the expectation.

## Alternatives considered

- **Do the queue now.** Rejected per risk-profile + sequencing.
- **Queue without UI badge / web equivalent.** Considered. Mobile-only queue without the badge fixes the main failure mode; partial roll-out has been done elsewhere (e.g. P2-26 net-carbs foundation). Risk: half-shipping confuses users on the badge front. Better as one focused PR.
- **Use a third-party library (e.g. PowerSync, Watermelon).** Rejected for v1.1. The data shape is small (one table, one write path family); integrating a sync library adds infrastructure for marginal benefit.

## Implementation

No code change today. v1.1 deliverable.

## Related artefacts

- [P1-12 — optimistic mobile journal writes](./2026-04-25-mobile-journal-optimistic.md) — the foundation this queue extends.
- [`tests/unit/nutritionEntriesGuardInventory.test.ts`](../../tests/unit/nutritionEntriesGuardInventory.test.ts) — already inventories the 5 insert sites the queue will wrap.
- Sister deferrals: P2-19 (Tracker), P2-20 (verifyRecipe), P2-28 (planner algo).

## Revisit when

- v1.1 cycle opens.
- A TestFlight tester reports "I logged a meal in the lift, lost signal, app crashed, and lost the meal" — that's the trigger to bring the queue forward.
- Web `useNutritionJournalState` adds a persistence helper independently — coordinate so the shapes match.
