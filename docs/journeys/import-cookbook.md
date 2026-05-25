# User Journey: Import a Cookbook (PDF)

**Audience:** Product / Design / Engineering

## Overview

User digitises a physical cookbook (e.g. *The Fast 800*) into Suppr Library as many tagged recipes, then builds their week manually in Plan or via [Plan Import](import-recipe.md) later.

**v1 scope:** Mobile Library entry → one searchable PDF → batch review → save to Library with `source_name = Imported · {book name}`. No auto week grid.

## Entry points

1. **Library** → **+ Create** → **Import cookbook (PDF)**
2. Direct route: `/cookbook-import`

## Flow

### Step 1: Choose PDF

- User names the book (default from filename).
- Picks a PDF (20 MB cap; same extractor as Plan Import).
- **Pro required** for parse (same gate as photo recipe import).

### Step 2: Extract + parse

```
POST /api/cookbook-import/extract  → extractPdfText
POST /api/cookbook-import/parse    → chunked recipes-only LLM + verifyIngredients per recipe
```

Progress copy: "Reading PDF…" → "Found N recipes (batch M/K)…"

Scanned PDFs with no text layer return `pdf_text_too_short` — user should export a **searchable PDF** from their scanner app (v2: vision per page).

### Step 3: Review (paginated)

- ~10 recipes per page; tap to **exclude** bad rows.
- Nutrition mode: **Match & verify** vs **Author as published** (same semantics as [Plan Import](../planning/plan-import-linear-program.md)).

### Step 4: Save to Library

- Client calls `commitCookbookImport` — library-only; **no** plan template.
- Free tier: stops at 10 total saves with partial-save copy + paywall CTA.
- Success: filter chip `Imported · {book name}` on Library; CTA to Plan tab.

## After import

- Slot recipes into Plan manually, or
- Paste a week schedule into **Plan Import** once recipes exist (schedule-only linking is v2).

## API limits

| Route | Limit |
|-------|-------|
| `POST /api/cookbook-import/extract` | 10 / user / day |
| `POST /api/cookbook-import/parse` | 3 / user / day (Pro only) |

Kill switch: shared `kill_plan_import` flag.

## Related

- [Plan Import program](../planning/plan-import-linear-program.md) — weekly plan + recipes pipeline
- [Import a recipe](import-recipe.md) — single URL / photo import

## Trust

Private user-owned scans only — same posture as cookbook page photo import. No creator marketplace publishing.
