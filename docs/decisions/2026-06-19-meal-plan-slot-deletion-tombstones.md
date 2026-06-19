# Meal-plan slot deletion — in-JSON tombstones + last-writer-wins (ENG-1194)

**Date:** 2026-06-19 · **Status: Resolved** · **Area:** Plan tab / cross-device sync

Closes the cross-device deletion gap left open by ENG-1130 (the slot-metadata
cloud sync). No schema migration — the fix enriches the JSON shape of the
existing `profiles.meal_plan_slots` column.

## Problem

ENG-1130 syncs named meal-plan slot metadata (`profiles.meal_plan_slots`, a
`jsonb` column) across devices. Commit `1bd29fa9` made
`mergeCloudMetadataIntoSlots` UNION local-only slots with the cloud registry so
an un-synced create wasn't wiped by a stale cloud read (that was the right call:
dropping a create is unrecoverable plan loss; the alternative is a recoverable
re-delete).

Side effect: with no per-slot timestamp, the merge could not tell a
**never-synced create** apart from a **slot deleted elsewhere**. A slot deleted
on device B was removed from both B's local state and the cloud registry — but
device A still held it locally and unconditionally re-pushed it on its next
write-back. The deletion never propagated; the deleted slot reappeared.

## Decision

Enrich the `meal_plan_slots` JSON shape (no DDL — it's already a JSON column):

1. **Per-slot `updated_at`** (ISO timestamp) on every registry entry, stamped on
   create / rename / delete.
2. **Soft-delete tombstones**: a deleted slot becomes an entry carrying
   `deleted_at` (+ `updated_at`), *retained* in the JSON rather than removed.

`mergeCloudMetadataIntoSlots` now applies **last-writer-wins per slot id**: for
every id seen locally and/or in the cloud, the side with the newer `updated_at`
wins. A tombstone is simply an entry whose latest write was a delete — if it's
the newer write it wins, the slot is suppressed from the live array, and the
tombstone is carried forward so the delete keeps propagating to peers that still
hold the slot. A create with no cloud counterpart at all is still preserved
(the original ENG-1130 fix), now distinguished by its timestamp.

The timestamps + tombstones live in a per-caller **sync ledger**
(`MealPlanSlotSyncLedger`), threaded alongside the live `MealPlanNamedSlot[]`
array — *not* on the UI type, which stays `{id, name, plan}`. The ledger is a
ref (web `AppDataContext`, mobile `use-meal-plan-slots`), never render state.

### Backward compatibility

The new fields are **optional**. A pre-ENG-1194 row in the wild (no `updated_at`,
no `deleted_at`) is treated as **epoch / oldest**, so any timestamped write
supersedes it and old data merges sensibly without crashing. An entirely
old-shape cloud blob merges exactly as before — every cloud slot live, locals
unioned.

### Tombstone retention

Tombstones are kept and pruned only past **`SLOT_TOMBSTONE_RETENTION_MS` = 90
days** (measured from `deleted_at`), at both serialize time
(`metadataFromSlots`) and merge time. 90 days comfortably exceeds how long a
device can plausibly stay offline and still need to learn about a delete, while
stopping the JSON blob from accreting dead entries forever. `now` is injected
into both functions so the window is deterministic in tests.

## Alternatives weighed

- **A new `meal_plan_slots` table with real rows + a `deleted_at` column.**
  Correct CRDT-ish posture, but it's a DDL migration + RLS + types regen for a
  small JSON registry that already exists and already syncs. The JSON column can
  carry the same semantics; the table is over-build for the current scale
  (N=1 tester, ≤8 slots/user). Rejected as disproportionate.
- **Keep UNION, add a separate "deleted ids" array.** Simpler than per-slot
  timestamps but can't resolve a delete-vs-rename race (no ordering), and a
  create after a delete with the same id would be ambiguous. Last-writer-wins
  per slot is the minimal model that resolves all three (create / rename /
  delete) races correctly. Chosen.
- **Hard-delete + trust events.** Brings back exactly the ENG-1130 data-loss
  risk for un-synced creates. Rejected.

## Files

- `src/lib/mealPlan/slotCloudSync.ts` — `MealPlanSlotMetaEntry` /
  `MealPlanSlotsMetadata` (now `updated_at` + `deleted_at`), `MealPlanSlotSyncLedger`,
  `SLOT_TOMBSTONE_RETENTION_MS`; `metadataFromSlots` (serialises tombstones,
  prunes), `parseMealPlanSlotsMetadata` (tolerant of legacy + tombstone shapes),
  `mergeCloudMetadataIntoSlots` (last-writer-wins, returns reconciled ledger).
- `src/context/AppDataContext.tsx` — web caller: ledger ref + stamp on
  create/rename/delete; reconcile on cloud merge; ledger into write-back.
- `apps/mobile/hooks/use-meal-plan-slots.ts` — mobile parity: identical ledger
  wiring.
- `tests/unit/mealPlanSlotCloudSync.test.ts` — deleted-elsewhere stays deleted;
  never-synced create preserved; concurrent rename last-writer-wins; old-shape
  no-timestamp tolerated; retention pruning; parse/serialise round-trips.

## Parity

Web and mobile share the pure helpers in `slotCloudSync.ts`; both callers wire
the ledger identically (ref + stamp + reconcile + write-back). No intentional
divergence. No feature flag — this is a sync bug fix with no visual surface (the
flag rule explicitly excludes bug fixes with no visual surface).
