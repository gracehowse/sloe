# 2026-06-04 — Apple Health MFP meal import audit

## Status

**Diagnostics shipped.** Device matrix HS-01–HS-09 **pending** Grace re-test on physical iPhone with live MFP → Health data (tunnel Metro working 2026-06-05). **Deep dive (2026-06-05):** code paths for dedup/tombstones/probe reviewed — no new code gaps; matrix execution still blocked on device lane. See [`docs/audits/2026-06-05-nutrition-debug-deep-dive/findings.md`](../audits/2026-06-05-nutrition-debug-deep-dive/findings.md) F-03.

## Reported symptom

Food logged in **MyFitnessPal** appears in **Apple Health**, but does not show on Suppr Today after sync.

## Architecture

`MFP → HealthKit (EnergyConsumed) → syncNutritionFromHealth → nutrition_entries (source=apple_health) → loadJournal (35d)`

Key files:

- [`apps/mobile/lib/healthSync.ts`](../../apps/mobile/lib/healthSync.ts) — import pipeline, `probeNutritionImport`
- [`apps/mobile/lib/nutritionImportSummary.ts`](../../apps/mobile/lib/nutritionImportSummary.ts) — user-facing import outcomes
- [`apps/mobile/app/health-sync.tsx`](../../apps/mobile/app/health-sync.tsx) — Sync Now + **Check meal import**

## Root-cause hypothesis tree (ordered)

1. **Import toggle off** (`health_import_nutrition !== "true"`) or **dietary permissions** not granted (Stage 2 init).
2. **Silent empty returns** — outer catch / zero-import with no explanation (addressed).
3. **MFP sample shape** — day-total only vs per-item energy; missing correlation metadata (fallback title still imports).
4. **Dedup / tombstones** — `health_sample_id` or `deletedHealthSamples` suppress re-import.
5. **Own-app filter** — MFP bundle misclassified as Suppr (unlikely; verify via dev labels screen).
6. **Environment** — Expo Go / simulator without real HK data.
7. **Throttle / refresh** — 5 min nutrition throttle; user didn't wait for `loadJournal`.

## What shipped (Cursor, 2026-06-04)

| Gap | Fix |
|-----|-----|
| Ambiguous zero imports | `NutritionImportResult` + `formatNutritionImportSummary()` — no samples vs deduped vs insert failed |
| No read probe | `probeNutritionImport(lookbackDays)` + **Check meal import** button on Health Sync |
| Insert errors invisible | `insertFailed` surfaced in sync summary + error banner |
| Test coverage | [`nutritionImportDiagnostics.test.ts`](../../apps/mobile/tests/unit/nutritionImportDiagnostics.test.ts) |

## Device verification (Claude)

Run matrix in [`docs/testing/health-sync-functionality-matrix.md`](../testing/health-sync-functionality-matrix.md).

**Suggested flow:** Check meal import → Sync Now → Today journal → repeat sync (dedup) → delete meal (tombstone).

## Out of scope

- MFP CSV import (`src/lib/imports/csv/adapters/mfp.ts`) — separate history bridge.
- Web HealthKit — browsers cannot read Apple Health.

## Follow-ups (if device repro fails)

- PostHog `health_nutrition_import_completed` with `{ imported, skippedOwn, externalEnergyCount, insertFailed }`
- Group minute+bundle MFP aggregates into single journal line when correlation metadata empty
