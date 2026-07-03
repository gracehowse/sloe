# OFF staleness corpus — ENG-1326

**Date:** 2026-07-03  
**Ticket:** ENG-1326 (split from ENG-1305)  
**Decision:** Option B — corpus-derived thresholds before shipping the penalty curve.

## Context

ENG-1305 wired `last_modified_t` through OFF adapters and shipped a **guessed** 3-year binary demotion (−0.08). Grace rejected guessed thresholds on 2026-07-02: derive the curve from data first.

## Corpus (2026-07-03)

Script: `npm run analyze:off-staleness-corpus` → `docs/testing/off-staleness-corpus-2026-07-03.json`

| Stat | Value |
|------|------:|
| Queries sampled | 30 (ingredient + UK branded) |
| Unique OFF hits | 80 |
| Production OFF rows in Supabase | 0 (at analysis time) |
| Missing `last_modified_t` | 0 |

**Age percentiles (days):** P50 38 · P75 94 · P90 111 · P95 112 · P99 301 · max 335

## Shipped curve

Linear confidence downgrade only — **never blocks** a match:

- **0 penalty** when age ≤ P75 (**94 days**)
- **Ramp** from 0 → **0.08** between P75 and P95 (**94–124 days**)
- **0.08 cap** at/above P95 (**124 days**)
- **Missing timestamp** → 0 penalty (can't assert freshness)

Constants live in `src/lib/openFoodFacts/offStaleness.ts` (`offStalenessConfidencePenalty`). Wired in `verifyIngredients.ts` OFF search path and `fetchProductByBarcode.ts` `staleData` flag.

## Re-calibration

Re-run the corpus script after meaningful OFF traffic accumulates in production (`recipe_ingredients.source = 'OFF'` / `barcode_mappings`). Update constants + parity test when the report date changes.

## Alternatives rejected

- **Guessed 3-year binary (ENG-1305 interim)** — not data-backed; too lenient on neglected crowd rows that still surface in search.
- **Hard reject stale OFF** — worse than a weak match; demotion-only is the product posture.
