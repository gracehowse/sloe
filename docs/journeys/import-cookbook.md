# User Journey: Import a Cookbook (PDF)

**Audience:** Product / Design / Engineering

## Overview

User digitises a physical cookbook (e.g. *The Fast 800*) into Suppr Library as many tagged recipes, then builds their week manually in Plan or via [Plan Import](../planning/plan-import-linear-program.md) later.

**v1 scope:** Mobile Library entry → one searchable PDF → batch review → save to Library with `source_name = Imported · {book name}`. No auto week grid.

## Loop

This is the **cookbook leg** of the founder's core recipe loop: **Import →
Verify → Save → Cook/Log.** A digitised cookbook page lands in Library
exactly like any other import — same per-ingredient verify pipeline, same
0.55 accept-floor trust rules, same `is_verified` semantics — it just does it
N-recipes-at-a-time via batch review instead of one review screen. See
[Import a recipe](import-recipe.md) for the single-recipe version of this
loop and [Verify ingredients](verify-ingredients.md) for the post-save
deep-verify step every imported recipe (cookbook or single) can reach.

**Don't confuse this with Plan Import.** Both are "bring my existing X"
entry points and a returning tracker (an MFP refugee with a saved plan, or
someone digitising a diet-book cookbook) can easily reach for the wrong one:

| | This doc — Cookbook Import | Plan Import |
|---|---|---|
| Brings in | A **cookbook's recipes** | A **whole week's schedule** |
| Entry point | Library → **+ Create → Import cookbook (PDF)** | Plan tab (paste / PDF / screenshot) |
| Result | Many Library rows, `Imported · {book}` tag, **no plan template** | A new **plan template**, optionally importing its recipes to Library too |
| Spec | This doc | [`docs/planning/plan-import-linear-program.md`](../planning/plan-import-linear-program.md) |

Plan Import's entry point is the Plan tab, so it belongs conceptually inside
the [Plan tab journey](meal-planning.md) — but that doc doesn't yet document
the Plan Import entry point; the only written spec today is the planning doc
linked above.

## Entry points

1. **Library** → **+ Create** → **Import cookbook (PDF)**
2. Direct route: `/cookbook-import`

> **Mobile-only today; the API itself is platform-neutral.**
> `/api/cookbook-import/extract` and `/api/cookbook-import/parse` are plain
> REST routes with nothing mobile-specific about their request/response shape
> — only `apps/mobile/app/cookbook-import.tsx` calls them. Web has no batch-PDF
> affordance at all: web's "cookbook" copy on `RecipeUpload` routes users to
> the **single-photo OCR** path (`/api/recipe-import/image`) instead. Whether
> PDF cookbook import should stay **permanent mobile-only** (a "sit down and
> digitise a book once" task some would argue is fine as a phone-only
> affordance) or get a proper web equivalent is an open product question — the
> current mobile-only shape reflects where the feature happens to be, not a
> deliberate platform decision.

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
- Paste a week schedule into [**Plan Import**](../planning/plan-import-linear-program.md) once recipes exist (schedule-only linking is v2) — see [Loop](#loop) above for how the two "bring my existing X" paths differ.

## API limits

| Route | Limit |
|-------|-------|
| `POST /api/cookbook-import/extract` | 10 / user / day |
| `POST /api/cookbook-import/parse` | 3 / user / day (Pro only) |

Kill switch: shared `kill_plan_import` flag.

## Related

- [Plan Import program](../planning/plan-import-linear-program.md) — weekly plan + recipes pipeline; entry point is the Plan tab, not Library (see [Loop](#loop) for how it differs from this doc)
- [Meal planning journey](meal-planning.md) — the Plan tab journey Plan Import's entry point belongs to (not yet documented there — see [Loop](#loop))
- [Import a recipe](import-recipe.md) — single URL / photo import; this doc's sibling in the Import → Verify → Save → Cook/Log loop
- [Verify ingredients](verify-ingredients.md) — the post-save deep-verify step every imported recipe can reach

## Trust

Private user-owned scans only — same posture as cookbook page photo import. No creator marketplace publishing.
