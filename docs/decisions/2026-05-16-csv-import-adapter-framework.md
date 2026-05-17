# Decision — Pluggable CSV-import adapter framework

**Date:** 2026-05-16
**Author:** Grace (in conversation with Claude)
**Status:** Resolved
**Area:** Engineering
**Linear:** ENG-37

## What changed

The MyFitnessPal CSV importer is no longer a 300-line monolithic
parser. It's been refactored into a pluggable adapter framework
under `src/lib/imports/csv/` where:

- Generic CSV mechanics (line splitting, header canonicalisation,
  number coercion, locale-date parsing) live in one shared module.
- Each competitor format (MFP, Lose It, Cronometer, …) is a single
  ~50–80 line adapter file under `csv/adapters/<source>.ts`.
- The import route auto-detects the source format from the file's
  header row and dispatches to the right adapter — no `source`
  parameter, no separate URL per source.

Three adapters ship in this initial wave: **MyFitnessPal**,
**Lose It**, **Cronometer**. Adding a 4th CSV format is now a
~30-minute single-PR effort.

## Why

### The problem

Suppr's MFP-refugee posture (`project_competitor_set_and_mfp_exodus`)
says the highest-leverage growth move is capturing users defecting
from MyFitnessPal, Lose It, Cronometer, MacroFactor, Cal AI,
Paprika, Recime, and Honeydew. If a user can't bring their meal
history, they bounce within the first session.

The original `parseMfpCsv.ts` was hard-coded to MFP's export shape:
fixed header aliases, fixed date-format ladder, fixed meal-label
mapper. Extending it to a second format would have required either:

1. **Copy-paste a 300-line parser per competitor** (8 copies eventually;
   eight places to update when a behaviour rule changes).
2. **Polymorphic flags inside the single parser** (`if source === 'lose-it'
   then ...`) — a mess to read after the third source lands.
3. **A pluggable adapter pattern** where each new format is a small
   config + the generic parser handles the mechanics once.

Option 3 wins. It cleanly separates the parts that vary per format
(headers, date format, meal labels, detection) from the parts that
don't (CSV tokenisation, number coercion, warning shape).

### Why CSV specifically (not a JSON / multi-format framework)

MacroFactor exports JSON, not CSV. Cal AI exports image+JSON,
Paprika exports a binary `.rcb` recipe-bundle, Recime + Honeydew
use share-links. Building a polymorphic JSON+CSV+binary framework
upfront would be premature generalisation — the JSON adapter alone
needs a different shape (no header row to detect against; format
identification has to come from JSON schema).

This framework is intentionally **CSV-only**. JSON support is a
separate framework when the time comes (likely sharing
`csvPrimitives` for things like locale-date parsing and adapter
registry pattern, but with a different parsing layer).

## The shape

```
src/lib/imports/csv/
├── types.ts                     # CanonicalImportRow, CsvImportAdapter
├── csvPrimitives.ts             # normaliseInput, splitCsvLine, canonHeader,
│                                # parseNumberCell, parseIsoDate, parseLocaleDate
├── runCsvImport.ts              # parseCsvWithAdapter (generic parser)
├── parseCsvImport.ts            # top-level entry — auto-detect or explicit source
└── adapters/
    ├── registry.ts              # REGISTERED_ADAPTERS, detectAdapter, getAdapterBySource
    ├── mfp.ts                   # MyFitnessPal
    ├── loseIt.ts                # Lose It
    └── cronometer.ts            # Cronometer
```

### Adapter interface

```ts
interface CsvImportAdapter {
  readonly source: string;       // "mfp" | "lose-it" | "cronometer"
  readonly displayName: string;  // "MyFitnessPal" | "Lose It" | ...
  readonly headers: Partial<Record<CsvColumnKey, readonly string[]>>;
  readonly requiredColumns?: readonly CsvColumnKey[];  // default ["date", "name"]
  readonly parseDate?: (raw: string) => string;        // optional override
  readonly mapMeal?: (raw: string) => Slot | null;     // optional override
  readonly detect: (canonical: string[], raw: string[]) => boolean;
}
```

The framework handles tokenisation, header-to-column mapping,
warnings, and required-column gating. The adapter handles
source-specific knowledge.

## Mutual-exclusion invariant

Detectors MUST be mutually exclusive. Any file that matches more
than one adapter is a silent-data-misidentification bug. Current
discriminators:

| Adapter | Distinctive marker |
| --- | --- |
| MFP | `Date` + `Meal` + `Food`, NO `Quantity`, NO `Units` |
| Lose It | `Date` + `Type` + `Quantity` + `Units` |
| Cronometer | `Day` + `Group` + `Food Name` + `Amount` |

A test in `tests/unit/csvImportFramework.test.ts` locks the invariant
by asserting that minimal-header arrays for each source resolve to
the correct adapter.

## DB tagging

Each imported row's `source` field in `nutrition_entries` carries the
adapter's source identifier suffixed with `_import`:

- `mfp_import` (unchanged from pre-PR; existing rows untouched)
- `lose-it_import`
- `cronometer_import`

This means:
- Dedup index on `(source, source_id)` keeps cross-adapter row
  indexes from colliding even when row numbers overlap.
- Operator dashboards can split metrics per competitor.
- A future bug report can be traced to the exact adapter.

## URL stayed at /api/imports/mfp-csv

The route URL is `/api/imports/mfp-csv` despite serving all three
adapters. Two reasons:

1. **Backwards compat.** The existing UI clients
   (`MfpCsvImportCard.tsx` on web and mobile) POST to this path. A
   URL rename means a coordinated UI + route change in one PR.
2. **The URL is mostly an implementation detail.** Users go through
   the import card, not the URL. The card label can be updated to
   "Import from MyFitnessPal, Lose It, or Cronometer" without
   touching the URL.

Renaming to `/api/imports/csv` is a clean-up follow-up when (a) the
card is relabelled, and (b) we have a 4th adapter to make the rename
clearly worthwhile.

## How it shipped

Four-PR ladder over 2026-05-16:

| PR | What |
| --- | --- |
| [#278](https://github.com/gracehowse/Suppr/pull/278) | Framework + MFP refactor; legacy `parseMfpCsv` becomes a 90-line shim. 45 framework tests + 26 unchanged MFP tests. |
| [#280](https://github.com/gracehowse/Suppr/pull/280) | Lose It adapter. ~80 lines + 6 tests. Mutual-exclusion invariant locked. |
| [#282](https://github.com/gracehowse/Suppr/pull/282) | Cronometer adapter. ~85 lines + 7 tests. Mutual-exclusion now covers all 3. |
| [#283](https://github.com/gracehowse/Suppr/pull/283) | Route wired through `parseCsvImport` auto-detect. DB `source` encodes adapter. +3 multi-adapter integration tests. |

## Adding a new CSV adapter

The recipe (also captured in `auto-memory/reference_csv_import_adapter_framework.md`):

1. Drop a file under `src/lib/imports/csv/adapters/<source>.ts`
   exporting a `CsvImportAdapter` constant.
2. Import + push it into `REGISTERED_ADAPTERS` in `registry.ts`.
3. Add a `describe("parseCsvImport — <Source> adapter")` block in
   `tests/unit/csvImportFramework.test.ts` with a realistic fixture
   (3+ rows, exercise unit-suffix headers, locale dates if relevant,
   every slot value).
4. Add a row to the mutual-exclusion test confirming `detectAdapter`
   returns the right adapter for minimal headers.

That's the whole new-format ticket. The route picks the new
adapter up automatically via the registry; no route or UI changes
required.

## What's NOT in scope (separate decisions)

- **MacroFactor (JSON)** — separate framework. Will share patterns
  (registry, detection by content hash, canonical row shape) but
  parsing layer differs.
- **Cal AI (image-based)** — out of scope for this framework
  entirely. Needs OCR + LLM pipeline.
- **Paprika (binary `.rcb`)** — out of scope. Recipe-bundle binary,
  different concern from meal-history import.
- **Recime, Honeydew (share-links)** — out of scope. Different
  ingestion model.

## Related

- `auto-memory/reference_csv_import_adapter_framework.md` — recipe
  for future sessions adding a new adapter.
- `project_competitor_set_and_mfp_exodus` (auto-memory) — why
  capturing competitor refugees is the priority.
- `docs/decisions/2026-05-02-mfp-csv-import.md` — original
  decisions for the MFP route (pre-refactor); macros aren't
  re-derived, per-user 5/day rate limit, etc. All still apply
  post-refactor.
