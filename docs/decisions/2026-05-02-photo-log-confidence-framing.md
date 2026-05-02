# Photo-log midpoint with confidence meter (Cal AI convert framing)

**Date:** 2026-05-02
**Area:** Product / Nutrition / UX
**Status:** Resolved
**Owners:** product-engineer (impl), ui-product-designer (spec), customer-lens (raised P1 caveat), nutrition-engine (follow-up: real variance bands)

## Context

The 2026-04 customer-lens audit comparing Suppr to Cal AI flagged a P1
caveat against the photo-log review surface:

> Suppr's "Low confidence — please verify" warning + dual amber pill
> reads as the app distrusting its own answer. Cal AI shows a single
> confident kcal number with no caveat, and that one-screen
> definitiveness drives a measurably higher conversion rate. Don't
> match Cal AI's dishonesty, but don't keep the current "are we
> sure?" framing either.

The current surface (pre-2026-05-02) ships:

- A 6px coloured dot + uppercase "Low / Med / High" pill,
- a separate "AI estimate" badge,
- the inline paragraph "Low confidence — please verify portion and
  macros before logging" on every low-confidence row,
- a dual save button labelled "Log all" or "Log anyway".

That stack is honest but hostile to a Cal-AI-coming-from-Instagram
user; the four hits of caveat in 200px of vertical space read as
disclaimer wallpaper rather than information.

## Decision

**Adopt the "midpoint with confidence meter" framing on both the
mobile sheet (`apps/mobile/components/PhotoLogSheet.tsx`) and the web
dialog (`src/app/components/suppr/photo-log-dialog.tsx`).**

Per `docs/ux/specs/...` (the design spec delivered by
`ui-product-designer` 2026-05-02):

1. **Plate hero card**: the midpoint kcal value (`~870 kcal`) is the
   28pt headline. A 4-segment confidence meter sits to the right.
   Underneath the subline ("plate total · N items") sits a tappable
   range caption ("Range 766–974 · medium confidence") that expands
   all items.
2. **Per-item card**: collapsed by default — name, midpoint, meter,
   chevron, kebab. Row 2 is the range caption + an "AI estimate"
   chip. Expanded reveals the macro inputs and a "Verify with
   database" CTA.
3. **4-segment meter**: high → 4/4 success, medium → 2/4 warning,
   low → 1/4 destructive, verified → 4/4 success + check glyph.
   Single visual primitive across the whole surface.
4. **Tri-state save copy**: `Log verified` (all verified, success
   tint), `Log meal` (mixed, with subcaption "K of N verified"), or
   `Log estimate` (none verified). The previous "Log anyway" /
   "Log all" branching is retired.

## Why this still meets the honesty bar

We are NOT adopting Cal AI's pattern. The honesty posture is preserved:

- The midpoint is presented with a leading `~` glyph — never as a
  precise number.
- The range caption (`Range 766–974`) is rendered by default
  underneath the midpoint, before any user interaction. Confidence is
  visible without a tap.
- The 4-segment meter is filled to the actual confidence tier; we
  don't fake a 4/4 to make the screen feel better.
- The chip stays "AI estimate" until the user verifies — verification
  is a deliberate user action, not auto-applied or hand-waved.
- Edits to macros explicitly clear the verified flag (an edited row
  is labelled "AI estimate" again, never silently re-verified).
- Low-confidence items still get a destructive-coloured meter and a
  destructive-tinted card border. Visual hierarchy still discourages
  blind logging of a 1/4 row.

What we DROPPED is the wallpaper:

- The inline "Low confidence — please verify portion and macros
  before logging" paragraph (its colour signal is now in the meter +
  card border, freeing the horizontal space for the headline number).
- The Low / Med / High text pill (replaced by the meter).
- The double-disclaim "AI estimate" + dot + pill stack on every row.

## Tri-state save copy — exact strings

Pinned by `tests/unit/photoLogSaveCopy.test.ts` and the mobile
shape test:

| State                      | primary           | subcaption           |
| -------------------------- | ----------------- | -------------------- |
| All items verified         | `Log verified`    | _(none)_             |
| Some verified, some not    | `Log meal`        | `K of N verified`    |
| None verified              | `Log estimate`    | _(none)_             |
| Empty list (defensive)     | `Log estimate`    | _(none)_             |

Drift here breaks the convert-Cal-AI funnel measurement plan in
PostHog — the registry test and the helper test both fail loudly if
any string changes.

## Range bands — placeholder

`rangeFor` derives the `{ low, high }` band from the per-item
confidence tier:

- high (≥0.75) → ±5%
- medium (0.5–0.75) → ±12%
- low (<0.5) → ±20%

**This is a placeholder**, used because the photo-log API currently
returns only a point estimate per item. The shared shape includes
`caloriesLow` / `caloriesHigh` optional fields that the helper will
use verbatim if both bracket the midpoint.

**Follow-up: `nutrition-engine`** to ship real per-item variance
metrics on `/api/nutrition/photo-log` so the band reflects the
underlying mass ± density ± USDA-vs-OFF tolerance, not a flat
percentage. When that lands, drop the placeholder branch in
`rangeFor` and update `tests/unit/aiLogging.test.ts`.

## Verification path

The web dialog and the mobile sheet both call
`POST /api/nutrition/verify-recipe` with a single-ingredient payload
(`ingredients: [{ name, amount: grams ?? "100", unit: "g" }]`). The
existing recipe-line verifier (USDA → OFF → Edamam → FatSecret →
local estimation) does the work — we don't add a new endpoint. A
`confidence < 0.5` result is treated as "no high-confidence match"
and surfaces the destructive caption "No high-confidence match in
our database — keep the AI estimate or edit manually."

## Analytics

Three new events fired from both platforms:

- `ai_photo_log_verify_tapped` — payload
  `{ confidenceBefore: "low" | "medium" | "high", itemIndex }`. Fires
  on the user tap, before the network call, so we capture intent
  regardless of network outcome.
- `ai_photo_log_verify_succeeded` — payload `{ itemIndex }`.
- `ai_photo_log_verify_failed` — payload
  `{ itemIndex, reason: "no_match" | "offline" | "server_error" }`.

Existing `ai_photo_log_started` / `ai_photo_log_committed` /
`ai_photo_log_paywalled` events are unchanged and continue to fire.

## Tests

- `tests/unit/aiLogging.test.ts` — pins `midpoint`, `rangeFor`,
  `aggregateRange`, `plateConfidence`, `photoLogSaveCopy`.
- `tests/unit/photoLogConfidenceMeter.test.tsx` — render-level meter
  fill + colour assertions.
- `tests/unit/photoLogPlateHero.test.tsx` — hero card midpoint /
  subline / range caption + tap-to-expand.
- `tests/unit/photoLogSaveCopy.test.ts` — exact tri-state copy.
- `tests/unit/photoLogVerifyFlow.test.tsx` — verify happy path,
  no-match path, offline path, edit-after-verify clears flag.
- `tests/unit/analyticsEvents.test.ts` — pins the three new
  `ai_photo_log_verify_*` events.
- `apps/mobile/tests/unit/photoLogConfidenceFraming.test.ts` —
  source-level structural contract on the mobile sheet.

## Web ↔ mobile parity

Identical layout hierarchy and copy on both platforms. Sizing differs
intentionally:

| Element                  | Web              | Mobile           |
| ------------------------ | ---------------- | ---------------- |
| Confidence meter         | 16 × 40 px       | 12 × 28 px       |
| Item card expand         | CSS grid auto-rows transition | `LayoutAnimation.easeInEaseOut` |
| Plate hero meter slot    | 56 px right-aligned | flexbox right edge |

All copy strings, analytics events, save-button states, badge
variants, and verification call paths are identical. No sync-enforcer
carve-out needed — this is intentional pixel-density-driven sizing.

## What we are NOT doing

- NOT adopting Cal AI's single-number-no-disclosure pattern.
- NOT removing the `AI estimate` chip until the user verifies.
- NOT introducing new hex outside `Accent.success` / `warning` /
  `destructive` (the four-segment fill colours all map to existing
  semantic tokens).
- NOT auto-verifying on user macro edits.
- NOT silencing the low-confidence path — destructive-coloured meter
  + card border still discourages blind logging of a 1/4 row.

## Sources

- Design spec: delivered by `ui-product-designer` 2026-05-02
  (referenced in PR description).
- Customer-lens P1 caveat: 2026-04 audit (raised against the legacy
  PhotoLog review surface).
