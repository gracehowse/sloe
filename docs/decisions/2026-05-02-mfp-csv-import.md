# MyFitnessPal CSV bulk import

**Date:** 2026-05-02
**Status:** Resolved
**Area:** Onboarding / data bridges
**Owner:** Grace
**Authority:** Customer-lens P1 (MFP-refugee history-bridge gap),
implemented as part of the data-bridges onboarding step (see PR #28
for the step shell).

## Problem

MyFitnessPal users coming to Suppr arrive with months or years of
food-log history in the form of an MFP CSV export. Without an
importer they face a binary choice: re-log every meal one by one
(unrealistic for non-trivial history) or abandon their history
(loses streak, weekly trends, day-of-week patterns).

Customer-lens flagged this as the highest-friction gap for three
overlapping personas:

- **MFP refugee** — actively migrating, expects parity with their
  prior tracker
- **MacroFactor user** — exports from MF are CSV-shaped and the
  same parser shape works
- **Paprika user** — recipe-side rather than log-side, but same
  "bring my old data" mental model

The gap was rated P1 (not blocking ship, but blocking conversion of
new sign-ups whose first instinct on Today is "where's my history?").

## Decision

Ship a single-file CSV importer for MyFitnessPal exports. Out of
scope for this PR: Lose It, Cronometer, Paprika (different export
shapes — covered in follow-ups; see `## Out of scope`).

### Behaviour

1. **Onboarding card**, 5th in the data-bridges step (alongside
   manual targets / Apple Health / Notifications / Recipe URL).
   File picker accepts `.csv` only.
   - Web: native `<input type="file" accept=".csv">`.
   - Mobile: `expo-document-picker` (added as a dependency at
     `~14.0.7` for SDK 54).
2. **POST `/api/imports/mfp-csv`** — multipart/form-data with the
   CSV under field `file`.
   - Auth required (Supabase JWT bearer; existing
     `getUserIdFromRequest`).
   - Rate limit: **5 imports / day / user**. Bulk imports are
     downstream-heavy; the cap is well above any legitimate user
     ceiling but defends against abuse and accidental retry storms.
   - Cap: **1000 rows / request**. Above the cap we accept the
     first 1000 and report `truncated: true`; the UI tells the
     user to upload the rest in a second pass.
   - Cap: **5 MB / file**. Above this returns 413
     `file_too_large`.
3. **Persistence** — each row → one `nutrition_entries` row with:
   - `source = "mfp_import"`
   - `source_id = "<userId>:<date>:<rowIndex>"`
   - macros = CSV macros verbatim (calories rounded to int)
   - `name` = canonical slot ("breakfast" / "lunch" / "dinner" /
     "snack")
   - `recipe_title` = the MFP food line, unmodified
4. **Idempotency** — uses the existing
   `nutrition_entries_source_dedup` unique index on
   `(user_id, source, source_id)` (added 2026-04-21 in
   `20260421200050_nutrition_entries_source_dedup.sql`). A
   re-uploaded CSV does not duplicate rows; the route uses
   `upsert(..., { onConflict: "user_id,source,source_id",
   ignoreDuplicates: true })`.

### Why we DON'T do per-row food matching synchronously

The original spec proposed enriching each row by best-effort
matching against USDA / Open Food Facts / FatSecret with a 0.7
confidence threshold. We deferred this for two reasons:

1. **Performance**: per-row enrichment for a 1000-row import would
   take ~17 minutes at typical food-search latencies — well past
   Vercel's `maxDuration` (50s on this plan tier). Even chunked,
   the import would surface as a 5–10 minute job, which is the
   wrong UX for an onboarding card.
2. **Trust**: the CSV macros are MFP's user-confirmed totals — the
   user already resolved any matching ambiguity inside MFP. A weak
   fuzzy match overriding a correct user value is a regression of
   data trust, which CLAUDE.md explicitly forbids ("if matching is
   uncertain, do not guess").

If we later add a background enrichment pass (e.g. a queued job
that walks unmatched rows post-import), the threshold should be
≥ 0.7 (`MFP_MATCH_CONFIDENCE_THRESHOLD` in the route). Anything
softer risks silently overriding correct values; anything stricter
matches almost nothing in practice.

### Privacy

- File contents are processed in-memory only — no temp storage.
- Inserted rows are owned by the user via standard
  `nutrition_entries` RLS (`auth.uid() = user_id`).
- The route uses the service-role client for the batched insert
  (existing pattern from `app/api/household/route.ts` and
  `app/api/push/weekly-recap/route.ts`); `userId` is verified
  from the JWT before the service-role insert runs.

## Validation

Tests pin the contracts the route relies on:

- `tests/unit/mfpCsvParse.test.ts` — 26 cases covering BOM, CRLF,
  case variation, header aliases, quoted commas, escaped quotes,
  blank lines, missing-cell → null, missing-required-column gating,
  date format normalisation, and meal-slot mapping.
- `tests/integration/mfpCsvImportRoute.test.ts` — 11 cases
  covering 401 (unauth), 429 (rate limit), 400 (missing file), 413
  (oversize), 422 (no usable rows / no calories), 503 (service
  role missing), 200 (happy path with sample), 500 (db error),
  upsert onConflict shape, and unmatched counting.

## Out of scope (follow-ups)

| Format | Why deferred | Owner |
|--------|--------------|-------|
| Lose It! CSV | Different column names ("Date", "Name", "Type", "Calories", "Fat (g)", etc.) — same parser shape with a header-alias extension. | Future PR |
| Cronometer CSV | Has rich micronutrient columns we'd want to preserve to `nutrition_micros`; needs schema work first. | Future PR |
| Paprika CSV | Recipe-side, not log-side — a different surface (recipe importer, not history importer). | Future PR |
| Background enrichment | Async re-match against USDA/OFF/FatSecret with ≥ 0.7 confidence. | Future PR; constants already exposed. |

## Files

- `src/lib/imports/mfpCsv.ts` — parser
- `app/api/imports/mfp-csv/route.ts` — POST endpoint
- `src/app/components/onboarding/steps/data-bridges.tsx` — web card
- `apps/mobile/components/onboarding/steps/data-bridges.tsx` — mobile card
- `src/lib/analytics/events.ts` — `mfp_csv_import_{started,completed,failed}`
- `tests/unit/mfpCsvParse.test.ts`
- `tests/integration/mfpCsvImportRoute.test.ts`

## Notion mirror

Add a row to the Decisions log DB linking back to this file. The
roadmap row "Onboarding data bridges" should reference this PR as
the merge source for the MFP card.
