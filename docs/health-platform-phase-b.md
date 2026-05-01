# Phase B: Activity / Apple Health — platform decision (web-first)

Pure browser apps **cannot** read Apple Health (HealthKit). Phase B in [`product-roadmap.md`](product-roadmap.md) requires a deliberate platform choice before engineering invests in sync.

## How Apple Health behaves (architecture, not marketing)

Treat HealthKit as a **central, permissioned datastore**—not a **real-time sync engine** between apps.

1. **Apps write**  
   A logger (e.g. MacroFactor) records a meal internally, maps it to HealthKit types (**dietary energy**, **protein**, **carbs**, **fat**, etc.), and **writes samples**. Delivery may be **immediate** or **batched in the background** (common).

2. **The Health app stores**  
   Each sample has **timestamp**, **values**, and **source bundle / app**. Health **does not** reconcile meals or run your product logic—it **persists** and **enforces read/write authorization**.

3. **Other apps read**  
   A consumer app (e.g. Lose It) **queries** for nutrition (and energy) samples, often **since last fetch** or for a **date range**, when the app **opens** or on **periodic background refresh**. Updates are **not continuous**; expect **eventual consistency** and occasional **duplicate or lag** if multiple writers exist.

**Product implication:** UI that shows an Apple Health badge on imported days and **line-item source** is honest; “synced” means **last successful read**, not a live pipe from the other app. Multi-app ecosystems (MacroFactor → Health → our app) only line up **after** the writer has flushed samples and the reader has queried.

## Decision (current)

**Ship web-first with manual activity burn** (already reflected in Profile + Nutrition copy): users enter an optional **activity burn (kcal)** to raise net calories when “adjust for activity” is enabled. No HealthKit dependency.

## Options for real Health data (pick when prioritizing Phase B)

| Option | Pros | Cons |
| --- | --- | --- |
| **iOS shell (Capacitor / Expo)** | Full HealthKit read after user consent | Separate build, review, and release process |
| **Shortcuts / manual export** | No app store for v0 | Friction; not a scalable default |
| **Partner APIs** (Strava, etc.) | Works cross-platform over time | OAuth, legal, uneven coverage |

## Next engineering steps (after choosing)

1. Document the **net calorie rule** in product copy (e.g. fraction of active energy added back).
2. If iOS shell: spike read permissions + one **active energy** field into the same `profiles` or journal model the web app already uses.
3. Keep **manual burn** as fallback for Android and web-only users.

This doc should be updated when the team commits to Capacitor/Expo vs staying web-only for the next 6–12 months.

## Nutrition import — correlation strategy (post-fix 2026-04-18)

The dietary import pulls per-permission-key sample arrays (`EnergyConsumed`,
`Protein`, `Carbohydrates`, `FatTotal`, all the micros, etc.) and groups them
into per-food rows for `nutrition_entries`. Until 2026-04-18 (TestFlight build
7, ASC `AJHZNp8NHTiFNk9TjQfdYBk`) the grouping key was
`effectiveMinute|bundleId`, which collapsed every food in an MFP-style daily
bulk sync (all foods written with the same wall-clock instant) into one
inflated entry.

The grouping key now prefers the parent **HKCorrelation UUID**:

1. `getFoodCorrelationSamples` returns parent rows (one per logged food) with
   `quantitySampleIds` listing the child energy + macro UUIDs. We build a
   `qid → parentId` map and bucket samples by `corr|<parentId>|<bundle>`.
2. If a sample isn't in the parent map but carries
   `metadata.HKCorrelationUUID` (or one of `HKMetadataKeyCorrelationUUID`,
   `HKFoodCorrelationUUID`, `correlationUUID`, `CorrelationUUID`), bucket by
   that.
3. Only fall back to `effectiveMinute|bundleId` for legacy writers with no
   correlation information at all — preserves behaviour for any pre-existing
   imports that lacked correlation data.

The legacy fallback survives because some non-correlated writers exist (very
old apps, some Shortcuts-based pipelines). Per-correlation grouping is
strictly additive: each parent UUID resolves to its own child UUIDs, so
multi-ingredient meals (e.g. one stir-fry HKCorrelation with two carb
children) still sum into one entry, while two separate MFP foods at the same
instant resolve to two entries.

`[healthSync] bulk-sync detected: …` is logged once per sync when ≥2 distinct
correlation UUIDs share a single minute|bundle bucket — useful in TestFlight
logs to confirm the new grouping is doing real work, otherwise quiet. The
pure helpers live in `apps/mobile/lib/healthSyncCorrelation.ts` (no RN
imports, so they're tested directly under mobile vitest in
`apps/mobile/tests/unit/healthSyncCorrelation.test.ts`).

## Per-meal nutrition writes (audit/2026-04-30 — competitive parity)

MyFitnessPal and Cal AI write meals to Apple Health **as the user logs
them**, so by the time the user opens the iOS Health app the day's
nutrition is already there. Suppr previously only wrote at end-of-day
("Complete Day" CTA), so an Apple-loyal user opening Health would see
zero Suppr nutrition until they remembered to tap Complete Day. The
audit flagged this as a HIGH-leverage / S-effort gap.

Implementation lives in
[`apps/mobile/lib/healthKitMealWriter.ts`](../apps/mobile/lib/healthKitMealWriter.ts):

- Reads the existing AsyncStorage flag `health_export_nutrition` (set
  by Settings → Health Sync → "Share meals to Health"). On first
  successful HK connect the flag is now seeded to "true" by default,
  matching the import posture.
- Per meal: writes a single `saveFoodSample` (energy + protein + carbs
  + fat + fibre) — same shape as the daily batch path
  (`exportDayToHealth`), so consumers see a unified record set.
- Idempotent on `mealId`: a per-device `Set<mealId>` plus AsyncStorage-
  backed `health_export_written_ids` (capped at 5k LRU) ensures
  re-render / debounced upsert / copy-meal cycles don't double-count.
- Skips low-confidence rows: any meal whose `source` matches
  `ai-estimate` / `low-confidence` is excluded (CLAUDE.md
  non-negotiable).
- Fire-and-forget: every call is `void`-ed so HK latency / errors
  cannot block the actual log persist.
- First-launch back-fill is suppressed via `primeWrittenMealIds`,
  which is called at journal hydrate to mark every existing
  `nutrition_entries.id` as already-written. Only meals logged AFTER
  this feature shipped are written to HealthKit.

Wired into:
- `apps/mobile/app/(tabs)/barcode.tsx` (scanner-tab handleLog +
  handleManualLog)
- `apps/mobile/app/(tabs)/index.tsx` (debounced byDay sync; cloned-row
  copy/duplicate insert; meal-plan log)
- `apps/mobile/app/recipe/[id].tsx` (Add to today journal)

The legacy `exportDayToHealth` path remains for the manual "Complete
Day" sweep — the dedupe set ensures it's a no-op for meals already
written per-log.

### Barcode portion memory (audit/2026-04-30 — competitive parity)

When the same barcode is logged repeatedly, the portion picker now
defaults to the user's previously-chosen grams instead of the OFF
reference serving. Implementation in
[`apps/mobile/lib/barcodePortionMemory.ts`](../apps/mobile/lib/barcodePortionMemory.ts):

- AsyncStorage-keyed by barcode (per device) with a 90-day TTL.
- On scan, the picker pre-fills the remembered grams (snapped to the
  closest serving option when presets exist) and renders a hint
  "You usually log {n} g — using that".
- On commit the new portion overwrites the prior memory.
- v1 scope: per-device, single-tester (TestFlight). Server-side
  `user_food_preferences` is a follow-up — call sites are stable so
  the storage backing can swap without changing readers.

Wired into both barcode entry points: the standalone scanner tab
(`apps/mobile/app/(tabs)/barcode.tsx`) and the LogSheet barcode
modal (`apps/mobile/components/BarcodeScannerModal.tsx`).

## Backlog items

- **Alcohol ↔ Apple Health round-trip (Batch 2.5 follow-up).** Suppr's "Alcohol" row in the hydration & stimulants card tracks grams of ethanol, mirroring the UK CMO weekly-limit model. Apple HealthKit does not expose a dietary alcohol mass type; the only alcohol surface is `HKQuantityTypeIdentifierNumberOfAlcoholicBeverages` (a count, not a mass). That identifier sits outside the dietary `saveFoodSample` path used by our existing meal export, so we cannot round-trip grams idempotently without:
  1. A mapping layer (grams → drinks count) using the preset "single drink ≈ 14 g ethanol" rule — acceptable for export but lossy for import.
  2. A separate HealthKit permission + native read for the count type, then reverse-mapping to grams using conservative assumptions.
  Deferred until we add a full Health Connect (Android) / HealthKit (iOS) dietary mapping pass. Current behaviour: alcohol is Suppr-only; caffeine is exported as `Suppr caffeine` food samples and imported on the existing nutrition-import throttle with idempotent `max(existing, imported)` merging.
