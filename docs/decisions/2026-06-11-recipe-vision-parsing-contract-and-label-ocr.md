# Claude-vision parsing contract + nutrition-label OCR

**Date:** 2026-06-11
**Area:** Recipe import (the wedge) + custom foods
**Status:** Resolved
**Owner:** Grace

## Context

"Import anything → clean structured recipe" is the wedge feature. Before this
change, each AI recipe-extraction surface shipped its own loose JSON shape —
`{title, ingredients: string[], steps: string[]}` for image import, a different
shape for social captions — and carried **no per-ingredient parse confidence**.
The only confidence in the pipeline was the *downstream* nutrition-match
confidence from `verifyIngredients`, which answers a different question (how
sure are we of the matched food row, not how sure are we we parsed the line
right). A model that mis-read "2 tbsp" as "2 cups" surfaced no flag.

Separately, the nutrition-label OCR route (`/api/nutrition/scan-label`) existed
but was wired only into the barcode-not-found flow; the standalone custom-food
form had no fast-fill, and the route returned macros without a plausibility
check.

## Decision

### 1. Single structured recipe extraction contract

`src/lib/recipe-import/structuredRecipeSchema.ts` is the one schema + prompt +
parser shared by the image and caption extraction surfaces:

- Ingredients are split into `quantity` / `unit` / `name` / `prep` with a
  per-ingredient **extraction confidence** (0–1).
- `LOW_CONFIDENCE_THRESHOLD = 0.6`. Below it (or empty name) the ingredient is
  `flagged`. Flagged lines are surfaced in the import response
  (`flaggedIngredients: { name, raw, confidence }[]`) for the existing review/
  verify UI — **never silently guessed or dropped** (repo nutrition no-guessing
  rule).
- The prompt is explicit: *DO NOT GUESS* — an ambiguous quantity/unit becomes
  `null` with lowered confidence, not an invented number. Source attribution is
  read only when visibly present, never fabricated.
- `toIngredientLines()` reduces structured ingredients back to the flat
  `"200 g chicken breast, diced"` strings the existing `verifyIngredients`
  pipeline consumes, so downstream nutrition lookup is unchanged.
- The parser is defensive: unparseable JSON → `ok:false`; a malformed
  individual ingredient degrades to flagged-low (raw preserved), never throws.

Wired into `app/api/recipe-import/image/route.ts` and
`src/lib/recipe-import/extractSocialRecipe.ts` (consumed by the URL/social
branch of `/api/recipe-import`). No nutrition values are invented in this
module — it parses text structure only.

### 2. Nutrition-label OCR pre-fills the custom-food form

The "Scan label" entry now lives in the custom-food form on **both** platforms
(`apps/mobile/components/CreateCustomFoodSheet.tsx` + the web
`create-custom-food-dialog.tsx`). It snaps a nutrition-panel photo, posts to
`/api/nutrition/scan-label`, and **pre-fills** the per-100g macro fields. The
form stays the source of truth — the user confirms every value before saving.

### 3. Plausibility validation on both pipelines

`/api/nutrition/scan-label` now runs the resolved per-100g macros through the
shared Atwater gate (`checkMacroPlausibility`) before returning. A mis-read
(kcal disagreeing with macros, out-of-range, single-macro) sets
`implausible: true` + `plausibilityReason` and forces `confidence: "low"`. The
form surfaces a "double-check these numbers" warning. We **flag, never hard-
reject** — the user may be reading a genuinely unusual product (e.g. pure oil),
so they stay in control. The recipe-import structured contract flags uncertain
lines at parse time; the existing `verifyIngredients` plausibility checks still
run downstream on the matched macros.

## Why not hard-reject implausible scans?

Hard-rejecting an implausible OCR result would block legitimate edge foods
(pure fat ~884 kcal/100g, protein isolate ~90 g/100g) and frustrate the user on
the exact path where they're trying to enter a real product the database
doesn't have. The user is the source of truth for custom foods; the right move
is a visible "double-check" warning, not a wall. (Confidence: 8/10.)

## Analytics

New event `custom_food_label_scanned` — same name web + mobile. Payload:
`{ confidence, implausible, platform }`. Distinct from
`barcode_scan_label_succeeded` (the not-found-barcode path).

## Environment variables (action required)

The provider helper (`src/lib/server/aiProvider.ts`) prefers Anthropic Claude
and falls back to OpenAI. For **Claude-first** parsing/OCR (the intended
production path):

| Var | Where | Status | Notes |
|-----|-------|--------|-------|
| `ANTHROPIC_API_KEY` | Vercel (prod + preview) **and** local `.env.local` | **MISSING locally** | Without it the OpenAI fallback runs. Set to make Claude the active vendor. |
| `OPENAI_API_KEY` | Vercel + local | present locally | Fallback vendor; keep set until the Claude migration is fully baked. |

As of this change `ANTHROPIC_API_KEY` is **absent from `.env.local`**, so the
OpenAI fallback is active locally. The routes are vendor-neutral — no code
change is needed when the key is added; the helper switches to Claude
automatically.

## Tests

- `tests/unit/structuredRecipeSchema.test.ts` — eval-style fixture set (8 messy
  inputs + hardening) against a mocked/fixture model reply (no live API).
- `tests/unit/scanLabelPlausibility.test.ts` — route-level plausibility gate
  (mocked provider).
- `apps/mobile/tests/unit/customFoodScanLabel.test.tsx` — behavioural sheet
  test (render / plausible pre-fill / implausible warning / inline error).
- `apps/mobile/tests/unit/createCustomFoodFormParity.test.ts` — web↔mobile
  parity for the scan-label entry.

## Cross-platform parity

Web and mobile both ship the "Scan label" entry, the same `/api/nutrition/
scan-label` call, per-100g pre-fill, the "double-check" warning, and the
`custom_food_label_scanned` event. No intentional divergence.
