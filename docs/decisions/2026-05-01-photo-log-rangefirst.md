# 2026-05-01 — Photo-log re-architected to range-first itemized breakdown

## Status

Resolved.

## Problem

The previous photo-log pipeline (`/api/nutrition/photo-log`) ran a
two-step model + verifier flow:

1. GPT-4o vision identifies foods + portions.
2. Each identified item is fed through `verifyIngredients` (USDA → Open
   Food Facts → Edamam → FatSecret → estimation fallback).
3. The route returns single-number macros and a single confidence tier.

This was brittle in production. The route blanket-failed (502
`verify_failed` or 422 `no_food_detected`) the moment any single item
couldn't be matched against an external food database — which is most
of the time on a real plate, because the matchers are tuned for clean
recipe ingredient strings ("100g chicken breast"), not vision output
("salami", "olives", "half egg"). The mobile sheet then showed a generic
"Couldn't analyse this food" alert and the user got nothing, even when
the model had correctly identified 8 of 10 items.

The lossy single-number output also misrepresented vision uncertainty.
A piece of pita bread could plausibly be 120-150 kcal; pinning it to "135
kcal" reads as more authoritative than the system has any right to be.

## Bar

Grace pinned the explicit target output (a charcuterie / mezze plate):

```
Bread + dips
  • Pita: ~120–150 kcal
  • Hummus: ~80 kcal
  • Tzatziki: ~50 kcal
  • Tapenade: ~80 kcal

Protein + fats
  • Cheese (~40–50g): ~160–200 kcal
  • Salami: ~120–150 kcal
  • Half egg: ~35 kcal

Extras
  • Olives: ~40 kcal
  • Greek salad (with feta + some oil): ~80–120 kcal

👉 Updated plate: ~750–900 kcal

Add wine:
  • +120–150 kcal

👉 Total meal: ~870–1,050 kcal
```

The brief: grouped by macro role, per-item kcal RANGES (not point
estimates), portion hints in plain language ("~40-50g"), an opt-in
add-on callout, and a final total range. ChatGPT-grade output, in the
app, without the user having to copy a photo into ChatGPT.

## Decision

Replace the two-step pipeline with a single GPT-4o vision call that
returns a structured itemized breakdown. The route never blanket-fails
on partial matches — if the model returns ANY items, the route returns
`ok: true` with whatever it has. The optional per-item "Verify with
database" affordance lives client-side and POSTs the single ingredient
back to `/api/nutrition/verify-recipe` to swap that one row to a
database-matched single-number row.

### New response shape

```ts
type PhotoLogRangedResponse = {
  ok: true;
  items: PhotoLogItemRanged[];   // grouped client-side by .category
  addons?: PhotoLogAddon[];       // suggested add-ons (drinks, sides)
  totalKcal: { low: number; high: number };
  totalKcalWithAddons?: { low: number; high: number };
  notes?: string;
  modelVersion: string;
};

type PhotoLogItemRanged = {
  id: string;
  name: string;
  quantityHint?: string;          // "~40-50g", "1 piece"
  calories: { low: number; high: number };
  protein?: { low: number; high: number } | null;
  carbs?: { low: number; high: number } | null;
  fat?: { low: number; high: number } | null;
  confidence: "high" | "medium" | "low";
  category: string;               // "Bread + dips", "Protein + fats", ...
  source: "ai";
};

type PhotoLogAddon = {
  id: string;
  name: string;
  hint?: string;
  calories: { low: number; high: number };
};
```

### Prompt strategy

Single GPT-4o call (`gpt-4o`, temperature 0.3, JSON object response
format, 2500 max tokens). The system prompt:

- Instructs grouping by macro role with the prototype set ("Bread + dips",
  "Protein + fats", "Extras", "Drinks", "Sweets") OR a custom label when
  one fits better ("Pasta + sauce", "Rice + curry").
- Demands kcal ranges (not point estimates). Tight range = high
  confidence (~within 15% of midpoint); wide range = low.
- Requests verbal portion hints in plain language.
- Allows macro ranges as optional / nullable per item.
- Requests add-on suggestions for things NOT in the photo that commonly
  go with what IS visible (a glass of wine with charcuterie, a bun with
  a burger, butter for bread).
- Includes calibration examples (pita 120-150, hummus 70-100, etc.) so
  ranges don't drift to "50-500" garbage.

### Failure handling

| Condition                                 | Behaviour                                     |
|-------------------------------------------|-----------------------------------------------|
| Model returns malformed JSON              | 502 `model_unparseable` ("try a different angle") |
| Model returns valid shape but `items: []` | 422 `no_food_detected`                        |
| Model returns SOME items                  | **Always** 200 `ok: true` — never blanket-fail |
| Model returns no `items` array at all     | 502 `model_unparseable` (schema regression)   |

The "model returns SOME items" path is the central anti-regression
invariant. Pre-2026-05-01 this triggered `verify_failed` (502) the
moment any one item failed the database match — which is the bug that
made the feature feel broken.

### Client-side affordances

- **Per-item "Verify with database"** — opt-in action. Calls
  `/api/nutrition/verify-recipe` for the single ingredient and swaps
  that row's source from `"ai"` to `"USDA" | "OFF" | "FatSecret"` with
  the verified single-number macros. Range goes away on that row;
  source label updates.
- **Add-on chips** — taps move the addon into the items list (treated
  as a new item in the model's `Drinks` group by default) and update
  the plate total.
- **Save to today** — projects each ranged item to the existing
  `AiLoggedItem` shape via `rangedItemToLogged`. Calories collapse to
  the range MIDPOINT for the `meal_logs.calories` column; the full
  range is preserved on `AiLoggedItem.range` so future analytics can
  reflect uncertainty.

### Trust copy

Old: "AI estimates. Photo is sent to our servers and processed by
OpenAI. Low-confidence items will be flagged for verification."

New: "AI estimates with ranges. Tap any item after to verify against
our food database. Low-confidence items are flagged."

Honest about the new shape: ranges + optional verification + low-
confidence flagging. Never promises "verified" or "accurate" when the
item ships as `source: "ai"`.

## Cross-platform parity

- **Web**: `src/app/components/suppr/photo-log-dialog.tsx` renders the
  grouped breakdown.
- **Mobile**: `apps/mobile/components/PhotoLogSheet.tsx` renders the
  same grouped breakdown.
- Identical response shape, identical group order, identical en-dash
  range format ("~120–150 kcal"), identical add-on chip pattern,
  identical "Save to today" CTA copy.
- Differences: sonner toast on web vs `AsyncStorage + ToastAndroid +
  Alert.alert` on mobile (existing platform-native pattern, mirrored
  from voice-log). Camera entry differs (file input vs expo-image-
  picker). All other UX is byte-for-byte equivalent.

## Migration

- Existing `meal_logs` rows persisted under the old single-number
  shape are unaffected — `AiLoggedItem.range` is optional. Reading
  them works as before.
- The `verifyIngredients` pipeline is retained; it's just no longer
  the primary path of `/api/nutrition/photo-log`. It remains the
  per-item "Verify with database" path.
- Analytics events: existing `ai_photo_log_started` /
  `_committed` / `_paywalled` / `photo_log_correction_persisted` are
  unchanged. Two new events: `ai_photo_log_addon_added` and
  `ai_photo_log_item_verified` (defined in `src/lib/analytics/events.ts`).

## Files

- `src/lib/nutrition/photoLogRanges.ts` — new shared module (types,
  parser, helpers).
- `app/api/nutrition/photo-log/route.ts` — rewritten to single-call
  range-first.
- `src/lib/nutrition/aiLogging.ts` — `AiLoggedItem` extended with
  optional `range`, `category`, `quantityHint` fields (additive).
- `src/app/components/suppr/photo-log-dialog.tsx` — web dialog
  rewritten.
- `apps/mobile/components/PhotoLogSheet.tsx` — mobile sheet rewritten.
- `src/lib/analytics/events.ts` — two new events.
- `tests/unit/photoLogParseRanges.test.ts` — parser unit tests (28
  cases covering tolerance, fixture parity with Grace's screenshot,
  range-tightness confidence derivation).
- `tests/integration/photoLogRoute.test.ts` — route integration tests
  rewritten to pin the new shape and the never-blanket-fail invariant.
- `tests/unit/photoLogDialogGrouping.test.tsx` — web render test
  exercising grouped breakdown, range format, addon flow, plate total.
- `apps/mobile/tests/unit/photoLogSheetGrouping.test.ts` — mobile
  structural test mirroring the same wiring (jsdom can't render RN).
- `docs/decisions/2026-05-01-photo-log-rangefirst.md` — this file.
- `apps/mobile/CHANGELOG.md` — entry under 2026-05-01.

## Open follow-ups

- **Per-item "Verify with database" UI**: the `ai_photo_log_item_verified`
  event is wired and the `/api/nutrition/verify-recipe` endpoint
  accepts the single-ingredient payload, but the inline 3-dot menu
  ("Edit portion", "Verify with database", "Remove") is currently
  scoped to "Remove" only. Inline portion edit + per-item verify is the
  next iteration; tracking under follow-up Pxx.
- **Calibration tightening**: if the model produces too-wide ranges in
  the wild (e.g. 50-500 kcal for a piece of pita), tighten the prompt's
  CALIBRATION EXAMPLES section. Iterate on real outputs after Grace
  ships TestFlight Build 42.
