# Trust posture sweep — D-2026-04-27-16

**Status:** Phase 4 / B3.X (B2.4 in the strategic-direction batch
labelling) — shipped 2026-04-27.
**Authority:** D-2026-04-27-16 (trust posture is consistent on every
macro-bearing row).
**Spec:** `docs/specs/2026-04-27-production-design-spec.md` §1.6.

## What it is

One language for "where this number came from", everywhere a number
appears.

- `<TrustChip>` lives on detail surfaces (recipe hero, ingredient row
  if estimated, voice/photo review).
- `<SourceDot>` lives on rows (today meals, ingredient list, search
  results inside the LogSheet).
- `<ConfidenceChip>` is the neutral metadata pill for adaptive TDEE
  (Surface E hero) — NOT a warning state.

## Phase 3 vs Phase 4 — what shipped when

| Surface                                | Phase 3 | Phase 4 |
| -------------------------------------- | ------- | ------- |
| Today meal row → SourceDot 6pt         | ✅      |         |
| LogSheet search result → SourceDot     | ✅      |         |
| LogSheet voice/photo review → TrustChip| ✅      |         |
| Adaptive TDEE display → ConfidenceChip |         | ✅ (Surface E hero) |
| Recipe detail hero → TrustChip         |         | ✅      |
| Recipe ingredient row → SourceDot 6pt  |         | ✅      |
| Recipe ingredient row → "Verify →" inline when estimated |         | ✅ (web) |
| Recipe card (Library) → TrustChip      |         | ✅      |
| Recipe card (Discover) → TrustChip     |         | ✅      |

## Component map

- **Helper (shared):** `src/lib/nutrition/recipeTrust.ts` —
  `mapToTrustVariant`, `aggregateRecipeTrust`, `recipeLevelTrust`.
  Mobile re-export at `apps/mobile/lib/recipeTrust.ts`.
- **Helper (shared, Phase 3):** `src/lib/nutrition/sourceMap.ts` —
  `mapMealSourceToDot` for the row-level dot. Untouched in Phase 4.
- **Web primitives:** `src/app/components/ui/{trust-chip,source-dot,confidence-chip}.tsx`.
- **Mobile primitives:** `apps/mobile/components/ui/{TrustChip,SourceDot,ConfidenceChip}.tsx`.

## Variant decision matrix (`mapToTrustVariant`)

| Source claim     | `isVerified` | TrustChip variant   |
| ---------------- | ------------ | ------------------- |
| `USDA`           | true         | `usda`              |
| `OFF` / `FatSecret` | true      | `off-adjusted`      |
| AI / photo / voice | any        | `estimated`         |
| `Manual` (claimed) | true       | `manual`            |
| `Manual` (claimed) | false      | `manual`            |
| any              | false        | `estimated`         |
| null / empty     | true         | `manual`            |
| null / empty     | false        | `estimated`         |

Recipe-level aggregation (`aggregateRecipeTrust`) takes the worst
ingredient — any AI / unverified / no-source row demotes the recipe
chip to `estimated`. This is deliberate: nutrition apps live or die
on whether users believe the numbers.

## Cross-platform parity

- Same chip variants, same copy ("USDA verified" / "OFF · adjusted"
  / "Estimated · verify" / "Manual" / "Gluten-free · high
  confidence" / "Gluten contamination risk · review").
- Same SourceDot colour pipeline (USDA green / OFF blue / FatSecret
  orange / Manual grey / AI magenta + Sparkles).
- Same per-ingredient SourceDot at 6pt.
- Web has the inline "Verify →" text-button on unverified ingredient
  rows; mobile uses the existing tap-to-verify modal flow on the
  ingredient row itself (no inline Verify text yet — flagged as a
  small mobile parity gap to close in a follow-up).

## Tests

- `tests/unit/trustPostureSweepPhase3.test.tsx` — Phase 3 source pins
  (today meals, LogSheet, primitives).
- `tests/unit/trustPostureSweepPhase4.test.tsx` — Phase 4 source pins
  (recipe detail hero + ingredients, Library, Discover, desktop
  modal mode for LogSheet).
- `apps/mobile/tests/unit/trustPostureSweepPhase4.test.tsx` — mobile
  mirror.

## Known follow-ups

- Mobile recipe detail: add the inline "Verify →" text-button on
  estimated ingredient rows to match web. Currently mobile relies on
  the row-tap explainer popup.
- Voice / photo review row inside LogSheet: the Phase 3 wiring shows
  `estimated` until confirmed. Phase 4 scope didn't extend this; no
  change needed in Phase 4.
