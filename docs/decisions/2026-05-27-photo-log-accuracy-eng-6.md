# 2026-05-27 — Photo-log accuracy improvements (ENG-6)

## Status
In progress. Prompt improved; benchmark harness built. Empirical gate pending Grace running 20-meal weighed benchmark.

## Target
Suppr photo-log must match or exceed Cal AI per-meal calorie and macro accuracy on a 20-meal weighed benchmark set.

Acceptance criteria: ≥75% of meals within ±20% of actual calories at the midpoint estimate.

## What changed

### SYSTEM_PROMPT in `app/api/nutrition/photo-log/route.ts`

Three weaknesses addressed:

1. **Calibration anchors were too narrow** — original prompt was tuned almost entirely on Mediterranean snack plates (pita, hummus, tzatziki, charcuterie). Added anchors for all major everyday meal categories:
   - Proteins: chicken breast, salmon, cod, ground beef, prawns, tofu, lentils/chickpeas
   - Carbs: white/brown rice, pasta, noodles, white/wholemeal bread, pita, potato, sweet potato
   - Fats: olive/vegetable oil, butter, cheddar, hummus, peanut butter

2. **Macros were optional when they should be required** — the original prompt said "Return null when you can't reasonably estimate." For foods with a clear macro profile (any protein → estimate protein; any grain → estimate carbs; etc.) nulls hurt accuracy without providing useful uncertainty signal. Rewrote macro rules to require estimation for clear-profile foods.

3. **Hidden calories were unaddressed** — cooking oil (stir-fry, sauté), salad dressing, and cooking sauces are the most common accuracy killers in photo-log apps. Added explicit guidance and `notes` caveats so at minimum users are informed.

### Benchmark harness: `scripts/benchmark-photo-log.mjs`
- Accepts a photo directory + ground-truth CSV
- Posts each photo to `/api/nutrition/photo-log`, extracts midpoint estimates
- Reports per-meal accuracy, MAPE, pass rate at ±20% kcal threshold
- Writes full JSON report to `docs/testflight-feedback/photo-log-benchmark-DATE.json`
- Exits 0 (pass) / 1 (fail) for CI integration

### Analytics: `photo_log_api_completed`
Added server-side telemetry event (matches voice-log pattern) with `totalElapsedMs`, `itemCount`, `confidenceTier`, and user `tier`. Fires on success; errors captured by Sentry. Enables production accuracy monitoring and prompt regression detection.

## How to run the benchmark

1. Create 20 photos of meals that cover the target food categories (see template)
2. Weigh every component separately; look up macros in USDA/Cronometer
3. Fill in `docs/testflight-feedback/photo-log-benchmark/ground-truth-template.csv`
4. Start the dev server: `npm run dev`
5. Run: `node scripts/benchmark-photo-log.mjs --photos docs/testflight-feedback/photo-log-benchmark/photos --ground-truth docs/testflight-feedback/photo-log-benchmark/ground-truth-template.csv`

If ≥75% of meals pass ±20% kcal threshold → mark ENG-6 Done.

## Why not extend the prompt to cover micronutrients

Intentionally excluded per `docs/decisions/2026-05-08-ai-photo-log-micronutrient-gap.md`. Vision models hallucinate micronutrient values; macro accuracy is the ENG-6 gate; micros come from the USDA/OFF/FatSecret matcher path.

## Files changed
- `app/api/nutrition/photo-log/route.ts` — SYSTEM_PROMPT expanded, telemetry added
- `src/lib/analytics/events.ts` — `photo_log_api_completed` event added
- `scripts/benchmark-photo-log.mjs` — benchmark harness (new)
- `docs/testflight-feedback/photo-log-benchmark/ground-truth-template.csv` — template (new)
