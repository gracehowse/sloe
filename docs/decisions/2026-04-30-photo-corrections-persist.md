# Photo-log corrections persist into the user's food bank

**Date:** 2026-04-30
**Status:** Resolved
**Area:** AI logging / personal food bank
**Round:** User-sentiment audit, round 4

## Problem

User-sentiment research surfaced two competitive signals:

- **Cal AI's failure pattern** — users repeatedly complain that "Fix this"
  on the food-recognition flow only updates the title, not the macros, and
  corrections never train the model. Every photo of the same dish goes back
  through the AI from scratch.
- **MacroFactor's emerging lead** — the macro-tracker leader is positioning
  on "the app learns from you", which is exactly the loop Cal AI fails at.

Suppr's photo-log review path already lets users edit the macros before
committing (`AiLogReviewItem` shared with voice). But the corrections were
discarded after the meal logged — the next photo of the same item went
back through the AI cold. The user was teaching the system to no avail.

## Decision

When the user commits a photo-log review with corrections, write the
corrected (name, macros) into the user's `user_custom_foods` table with
`source: "photo_correction"`. This is the same table that backs the
"Create Custom Food" form on both platforms; the schema already RLS-scopes
per user and dedupes case-insensitively on `(user_id, lower(name))`.

A future server-side change to `/api/nutrition/photo-log` will look up
this bank before re-asking the AI. That hookup is staged separately so
the persistence can ship and bake without changing the recognition path.

### Detection rule

Only persist when the user *meaningfully* edited the AI's output. A
"meaningful" change = name diff (case-insensitive trimmed) OR a macro
delta beyond rounding noise (>2 kcal / >0.5 g). Accept-as-is doesn't
pollute the bank — every photo log otherwise grows the bank by N rows.
See `isMeaningfulPhotoCorrection` in `src/lib/nutrition/aiLogging.ts`.

### Manual carve-out

If the user already has a `manual` row with the same name (their hand-
curated "Granola"), the photo correction does NOT overwrite it. Manual
rows return early with no write. The user's curated entry stays canonical.

### One-time confirmation

The first time *any* correction successfully persists on a device, the
user sees a single platform-native confirmation:
*"Got it — we'll remember this for next time."*
- Mobile: `ToastAndroid` on Android, `Alert.alert` on iOS (matching the
  existing `cook.tsx` `showToast` pattern).
- Web: `sonner` `toast.success`.

The flag is per-device (`AsyncStorage` on mobile, `localStorage` on web)
because we're teaching the human, not the user-id.

## Files changed

### Schema
- `supabase/migrations/20260506100000_user_custom_foods_source.sql`
  — adds `source text not null default 'manual'` with a check constraint
  + index on `(user_id, source)`.

### Shared library
- `src/lib/nutrition/customFoods.ts` — adds `CustomFoodSource` type and
  optional `source` field on `CustomFood`.
- `src/lib/nutrition/customFoodsClient.ts` — new
  `upsertCustomFoodFromPhotoCorrection(supabase, userId, name, macros)`
  helper. Reads existing row, branches insert vs update vs skip-manual.
- `src/lib/nutrition/aiLogging.ts` — new `isMeaningfulPhotoCorrection`
  pure helper.
- `src/lib/nutrition/photoCorrectionPersist.ts` (new) — orchestrates the
  detection → upsert → analytics-emit loop. Imported by both platforms.
- `src/lib/analytics/events.ts` — new
  `photo_log_correction_persisted` event.

### Surfaces
- `apps/mobile/components/PhotoLogSheet.tsx` — captures originals on
  review entry; calls `persistPhotoCorrections` on commit
  (fire-and-forget); shows the one-time toast via `AsyncStorage` flag.
- `src/app/components/suppr/photo-log-dialog.tsx` — same wiring on web
  with `localStorage` flag and `sonner` toast.

### Types
- `src/lib/supabase/database.types.ts` and
  `apps/mobile/lib/database.types.ts` — manually augmented to include the
  new `source` column on `user_custom_foods`.

### Tests
- `tests/unit/photoCorrectionPersist.test.ts` (new) — 10 tests covering
  round-trip, idempotency, manual carve-out, detection thresholds,
  fail-closed.
- `tests/unit/customFoodsClient.test.ts` — 7 new tests for
  `upsertCustomFoodFromPhotoCorrection`.
- `tests/unit/aiLogging.test.ts` — 8 new tests for
  `isMeaningfulPhotoCorrection`.
- `apps/mobile/tests/unit/photoLogCorrectionPersistWiring.test.ts` (new)
  — pins the structural wiring on mobile.
- `tests/unit/photoLogDialogCorrectionPersist.test.ts` (new) — pins the
  same wiring on web.

## Parity

Web and mobile read from the same shared `photoCorrectionPersist.ts`
helper. Both surfaces:
1. Snapshot AI's original items on review-stage entry.
2. Call `persistPhotoCorrections` at commit time, fire-and-forget.
3. Use a per-device storage flag to gate the one-time confirmation.
4. Render a platform-native toast on first persistence.

The two structural wiring tests
(`photoLogCorrectionPersistWiring.test.ts` and
`photoLogDialogCorrectionPersist.test.ts`) make drift visible.

## Risks / follow-ups

- **The lookup loop is not yet wired.** This change persists corrections
  but does not yet read them at next-photo-log time. The server-side
  hookup to `/api/nutrition/photo-log` (look up `searchCustomFoods` for
  a `source: "photo_correction"` match before running `verifyIngredients`)
  is the obvious next step. Without it, the bank grows but the AI
  doesn't yet "remember" — only the user's bank does.
- **The synthetic `base_grams = 100` anchor** is a schema accommodation,
  not a real per-100g basis. The read-path documentation must be clear
  that photo-correction macros are used directly, not scaled. Code
  review to confirm.
