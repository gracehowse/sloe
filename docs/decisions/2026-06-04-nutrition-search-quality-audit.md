# 2026-06-04 — Nutrition search quality audit

## Status

**P1 ranking fix shipped** (branded chain boost + golden regressions). **Web golden battery re-run 2026-06-05** — see `docs/testing/nutrition-search-golden-audit-2026-06-04.md`. **Deep dive:** [`docs/audits/2026-06-05-nutrition-debug-deep-dive/findings.md`](../audits/2026-06-05-nutrition-debug-deep-dive/findings.md). **iOS UI pass still pending (ENG-877).**

### Provider health (local dev, 2026-06-05 — updated after deep dive)

| Provider | Env | Live hits |
|----------|-----|-----------|
| FatSecret | `FATSECRET_CLIENT_SECRET` **set** (`FATSECRET_CONSUMER_SECRET` alias unused) | 10 hits/query |
| USDA | key set | 6–10 hits/query |
| Edamam | keys set | 10 hits early queries; **429 rate-limit** on later queries in same run |

**P1 findings (FS restored):** Multi-word branded queries improved (`starbucks latte`, `chipotle bowl`). **`Big Mac`** still ranks USDA verified #1 over FatSecret branded #2 (single-token product query — `brandedChainQueryBoost` needs brand token in query). **UK grocery** (`tesco chicken`, `sainsbury's hummus`) — no retailer SKU in top 1.

## Problem

Search not at MFP/Cronometer parity on branded queries, relevance, portion sanity, and confidence signalling.

## Architecture

`FoodSearchPanel (web + mobile) → USDA / FatSecret / Edamam / OFF / custom → foodSearchRanking.ts → Best matches / More results`

## Audit rubric (1–5)

| Dimension | 5 = ship | 1 = broken |
|-----------|----------|------------|
| Relevance | Top result is the food user meant | Wrong food or fragment |
| Branded coverage | Chains/grocery in top 3 | USDA-only generic |
| Macro trust | Verified tier on authoritative rows | Estimated on branded FS/USDA |
| Portion UX | Natural default serving + g option | Absurd g/kcal mismatch |
| Speed | First paint < 1.5s LTE | Spinner / empty loop |
| Parity | Mobile = web top 3 | Divergent merge/rank |

## Golden query battery

| Category | Queries | Benchmark |
|----------|---------|-----------|
| Branded chain | Big Mac, Starbucks latte, Chipotle bowl | Branded in top 3, sane kcal |
| Generic | salmon, banana, brown rice | Raw/cooked generic in top 3 |
| UK grocery | Tesco chicken, Sainsbury's hummus | FS/OFF branded hit |
| Portion | Top result per query | No 1 g = 2 kcal class bugs |

Record: top 5 (name, source, kcal, portion, tier), TTFB, empty rate — **spreadsheet pending Claude device pass**.

## What shipped (Cursor, 2026-06-04)

| Priority | Fix | Files |
|----------|-----|-------|
| P1 | `brandedChainQueryBoost` + `genericBrandQueryPenalty` + branded score floor | [`foodSearchRanking.ts`](../../src/lib/nutrition/foodSearchRanking.ts) |
| P1 | Golden regressions: starbucks latte, chipotle bowl, tesco chicken, sainsbury's hummus | [`foodSearchRankingGolden.test.ts`](../../tests/unit/foodSearchRankingGolden.test.ts) |
| P1 | Branded boost unit tests | [`foodSearchRanking.test.ts`](../../tests/unit/foodSearchRanking.test.ts) |
| — | Provider integration smoke (skips without env keys) | [`foodSearchProviderIntegration.test.ts`](../../tests/unit/foodSearchProviderIntegration.test.ts) |

**Unit status:** 62/62 ranking tests green (2026-06-04).

## Backlog (not yet shipped)

| Priority | Item | Notes |
|----------|------|-------|
| P0 | Empty / 0 kcal on common foods | Requires live provider battery — none found in golden unit set |
| P1 | Live FS/USDA/Edamam hit counts vs merged UI | Run `foodSearchProviderIntegration.test.ts` with keys + `SUPPR_TEST_API_BASE` |
| P2 | Default-on `redesign_search_results` | See [`2026-05-31-search-results-ui-redesign-mobile.md`](2026-05-31-search-results-ui-redesign-mobile.md) |
| P2 | UK locale bias tuning | `foodSearchLocale.ts` |
| P2 | `search_no_results` funnel analytics | Empty-state / barcode fallback |

## Provider health checklist

- FatSecret Premier keys in env ([`fatsecretSearchRoute.test.ts`](../../tests/unit/fatsecretSearchRoute.test.ts) pins route)
- USDA FDC key
- Edamam app id/key
- Mobile `supprApiUrl` points at API host in dev build

## Benchmark references

MFP (branded depth + speed), Cronometer (generic accuracy). MacroFactor search is secondary.
