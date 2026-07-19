# Plan Import — Linear program

**Initiative:** [Plan Import](https://linear.app/suppr/initiative/plan-import-3ea2269e506b) (`a91fbf2c-53b3-4feb-9b17-5dc6ed3850cf`)  
**Target:** Launch 2026-07-01 (paste + rebalance in Sprint 1; PDF/image in Sprint 2)  
**Program coordination:** [ENG-646](https://linear.app/suppr/issue/ENG-646/plan-import-program-coordination)

Import a third-party meal plan (paste / PDF / screenshot) as a **new plan template**, assess against user targets, optionally auto-rebalance portions. Differentiated wedge — no comparable app imports structured plans end-to-end.

## Product decisions (locked)

| Topic | Decision |
|-------|----------|
| Entry point | **Plan tab only** — wholesale plan import. Individual meals: clients save to Library + auto-gen plan as today (no Library import entry). |
| Commit behaviour | Import creates a **new template**; user chooses whether to **activate** it (never silent replace of current plan). |
| Plan name | Auto-parse from source where possible; **always editable** before commit. |
| Trust / nutrition | Two modes at review: **(A) Author as published** — no ingredient matching; cals/macros imported and logged as stated; Library = **Published** (manual from source). **(B) Match & verify** — match to Suppr foods; show author vs Suppr on each row; per meal: accept Suppr / review & edit ingredients (brand swaps) / keep author's. Library = **Verified** when confidence allows. User can upgrade Published → verify later. |
| Dual kcal display | Match mode: Suppr primary. Author secondary when source provides kcal **or partial per-serving macros** (e.g. `Protein ~38 g` — show alongside Suppr full calc). |
| Plan portion fit | Optional **auto-rebalance** (protein → carbs → fat; never vegetables) — applies in match mode when user wants plan to hit targets. Hidden in author-as-published mode. |
| Library import | Separate toggle: import all recipes to Library; same nutrition pref applies; tag `Imported · {plan name}`. |
| Library hygiene | Meals saved under `Imported · {plan name}` + filter chip ([ENG-653](https://linear.app/suppr/issue/ENG-653/library-imported-plans-filter-chip)). |

## Source requirements (eligible plans)

Import needs enough structure to compute or carry nutrition. **A weekly grid of dish names alone is not enough.**

| Source shape | Example | Import behaviour |
|--------------|---------|------------------|
| **Recipe-backed plan** | Weekly schedule + recipe appendix (PDF or paste) | **Recipes parsed first** (ingredients → Suppr). Schedule linked to those recipes. **Plan compiled** from matched refs. |
| **Meal-prep components** | Batch recipes with `Serves N`, optional `Per serving: Protein ~X g`, full ingredients + method | Same pipeline. Slots may reference **one or several** recipes. Partial author macros for compare; Suppr calc for kcal. |
| **Program PDF** | Fitness/wellness week plan: **p.1 calendar grid** (meal names per day) + **recipe pages** with ingredients, method, and **full nutrition panel** (kcal, P, C, F, fibre, etc.) + optional daily summary + shopping list | Same pipeline. Grid labels link to recipe pages. **Author as published** viable (full kcal per recipe). Daily summary pages optional cross-check vs compiled totals. Ingredient lines may lack weights — match & review expected. |
| **Kcal-per-meal list** | `Mon Lunch: Chicken bowl 580 kcal` | **Author as published** when full kcal provided; match mode if ingredients also present. |
| **Names only** | `Mon lunch: Greek salad` | **Block** at review — no recipe, no nutrition. |

**Parse pipeline (ENG-649) — recipes first, plan compiled second:**

Nutrition lives on **recipes**, not on schedule labels. The weekly grid is only references; we never guess kcal from a dish name.

```
Source (paste / PDF)
  │
  ├─① Extract recipe blocks (title, time, ingredients, method, optional author nutrition panel)
  │     └─ Parse ingredients → match Suppr foods → per-recipe macros  ← canonical in match mode
  │     └─ Store author panel (kcal, P, C, F, fibre…) when present  ← for author mode / diff
  │
  ├─② Extract weekly schedule — calendar grid and/or day × slot list
  │     └─ Fuzzy-link labels → parsed recipes  ("Cilantro Chicken Curry" on Tue lunch → recipe page)
  │
  └─③ Compile plan template from matched recipe refs (+ portion / leftover notes)
        └─ Slot kcal = recipe kcal × portion multiplier — no second nutrition pass
```

| Stage | Output |
|-------|--------|
| **Recipe parse** | N library-ready recipe objects with verified ingredient rows + totals |
| **Schedule parse** | Day/slot grid with text labels only |
| **Link** | Each slot → `recipeId` (or blocked if no match & no kcal) |
| **Compile** | Plan template rows pointing at one or more recipes per slot; day totals = sum of linked recipe nutrition |

4. Flag unlinked slots; user must attach a parsed recipe or skip slot before commit.

**Validation fixtures:** (1) meal-prep paste — partial per-serving protein/fibre; (2) program PDF — calendar grid + recipe pages with full nutrition panels + optional daily totals; (3) coach PDF — grid + ingredients only; (4) kcal-per-meal list.

## Sprint projects

| Project | Target | Umbrella | Focus |
|---------|--------|----------|--------|
| [Plan Import — Sprint 1 (paste + auto-rebalance)](https://linear.app/suppr/project/plan-import-sprint-1-paste-auto-rebalance-129d8235cd12) | 2026-07-01 | [ENG-646](https://linear.app/suppr/issue/ENG-646) | Paste → parse → review → rebalance → template commit |
| [Plan Import — Sprint 2 (PDF + image)](https://linear.app/suppr/project/plan-import-sprint-2-pdf-image-79dba1a5485c) | 2026-07-15 | [ENG-646](https://linear.app/suppr/issue/ENG-646) | PDF + screenshot adaptors → same review UI |

## Issue map

### Sprint 1 — paste + auto-rebalance

| Issue | Notes |
|-------|--------|
| [ENG-646](https://linear.app/suppr/issue/ENG-646) | Program coordination (parent) |
| [ENG-647](https://linear.app/suppr/issue/ENG-647) | Generate ▾ dropdown: library vs import |
| [ENG-648](https://linear.app/suppr/issue/ENG-648) | Paste sheet + plan name field |
| [ENG-649](https://linear.app/suppr/issue/ENG-649) | Parse recipes (ingredients → Suppr) → link schedule → compile plan from matched recipe refs |
| [ENG-650](https://linear.app/suppr/issue/ENG-650) | Review screen + dual kcal trust |
| [ENG-651](https://linear.app/suppr/issue/ENG-651) | Review: nutrition mode (author vs match), Library toggle, plan rebalance, per-meal resolve |
| [ENG-652](https://linear.app/suppr/issue/ENG-652) | Commit as template + optional activate |
| [ENG-653](https://linear.app/suppr/issue/ENG-653) | Library: Imported plans filter chip |
| [ENG-654](https://linear.app/suppr/issue/ENG-654) | API route + auth + rate limit |

### Sprint 2 — PDF + image

| Issue | Notes |
|-------|--------|
| [ENG-655](https://linear.app/suppr/issue/ENG-655) | Multi-source input sheet |
| [ENG-656](https://linear.app/suppr/issue/ENG-656) | PDF text extract adaptor |
| [ENG-657](https://linear.app/suppr/issue/ENG-657) | Image vision adaptor |
| [ENG-658](https://linear.app/suppr/issue/ENG-658) | E2E + Maestro happy path |

### Plan tab follow-ups (independent of import ship)

| Issue | Notes |
|-------|--------|
| [ENG-659](https://linear.app/suppr/issue/ENG-659) | Day P/C/F/Fi chips hidden until `planTargets` loads |
| [ENG-660](https://linear.app/suppr/issue/ENG-660) | Fibre day total near-zero (seed data / field mapping) |

## Ship sequence

1. **Sprint 1 (~2 weeks):** paste + parse + review + auto-rebalance + template commit + Library chip.  
2. **Sprint 2 (~3 weeks):** PDF + image adaptors into the **same** parse/review/commit pipeline.

One parse pipeline for all inputs — adaptors at the input layer only.

## Trust — excluded-line tier cap (ENG-1422)

Since ENG-1305 the recipe confidence tier is computed from the **accepted-rows**
average, so dropping more unmatched/junk lines could *raise* the surviving
average — a more incomplete recipe read at a **higher** confidence (an inverted
trust signal). Fixed 2026-07-17:

- **Cap:** the shared `recipeConfidenceTierWithExclusions(avg,
  belowAcceptFloorCount, acceptedLineCount)` helper caps the displayed tier —
  any excluded line ⇒ never "high" (at most "medium"); half-or-more of the
  recipe excluded ⇒ "low". Monotonic non-increasing in the excluded count, so
  more junk can never read higher. Applied in both verify paths (the parse route
  + the shared `verifyImportRecipe`, so cookbook import inherits it). **Unflagged**
  server logic (bug fix, no visual surface — the tier isn't rendered/persisted).
- **Surfacing:** `stats.excludedLineCount` (summed once per recipe) drives a
  calm amber review advisory — *"N low-confidence line(s) left out of these
  totals — review before importing."* on both web (`PlanImportReview`) and
  mobile (`app/plan-import.tsx`). Gated by `plan_import_excluded_lines_v1`
  (default-ON, PostHog kill switch). Never blocks import.

Full rationale: `docs/decisions/2026-07-17-plan-import-excluded-line-tier-cap.md`.

## Web parity (ENG-696) — shipped

Mobile shipped the full flow first (iOS is the primary surface). The web app
caught up to parity under [ENG-696](https://linear.app/suppr/issue/ENG-696)
(umbrella for the web halves of ENG-647/648/650/651/653). **No fork** — web
reuses the same server route and the same commit pipeline.

| Surface | Web | Mobile |
|---------|-----|--------|
| Route | `/plan-import` → `app/(product)/plan-import/page.tsx` → `App.tsx` `case "plan-import"` → `src/app/components/PlanImport.tsx` | `apps/mobile/app/plan-import.tsx` |
| Entry point (ENG-647) | `MealPlanner.tsx` — "Import plan" ghost button on the summary-card CTA row + the empty-state CTA row (next to Generate/Shopping list/Templates) | Plan tab header Upload icon + "Generate ▾" action sheet → "Import existing plan" |
| Parse route (ENG-648) | `POST /api/plan-import/parse` (same route), same `{ text, planName }` body, cookie auth + same-origin | `authedFetch` → same route |
| Review + dual-kcal (ENG-650) | editable plan name + per-slot rows; trust line shows the non-active figure (author vs Sloe calc) | same |
| Assessment + modes (ENG-651) | avg vs target panel; author/match segmented; import-to-library + auto-rebalance toggles; activate dialog | same |
| Commit pipeline | `src/lib/planning/planImport/commitPlanImport.ts` (shared, takes a Supabase client) | `apps/mobile/lib/planImportCommit.ts` is now a thin wrapper around the shared module |
| Library chip (ENG-653) | `Library.tsx` — contextual plan-import source pills reveal under the category row when the Imported entry-kind is active | `apps/mobile/app/(tabs)/library.tsx` — same contextual pills |

**Feature flag:** the web surface gates on the SAME `plan_import_enabled`
PostHog flag the mobile entry points use. Flag-off → `/plan-import` falls back
to the Plan surface (mirrors mobile's deep-link guard) and the Import
affordance is hidden in `MealPlanner`. Ramp both platforms together.

**Intentional web-vs-mobile difference (not drift):**
- **PDF / photo source** — the mobile flow has source tabs (Paste / PDF /
  Photo) wired to `/api/plan-import/extract`. The web spine ships **paste
  only** for ENG-696; the web PDF/photo source tabs are tracked under the
  Plan Import **Sprint 2 (PDF + image)** project, reusing the same extract
  route + review UI. Web paste reaches full parity with the mobile paste path.
- **Rebalance target** — web seeds the joint fitter from the user's real
  `nutritionTargets` (calories/protein/carbs/fat/fibre); the mobile screen
  used a 2000-kcal placeholder. Web is the more correct of the two; the mobile
  placeholder should converge (tracked under Plan Import Sprint 1 polish).

**Tests:** `tests/unit/planImportSurface.test.tsx` (web surface spine +
states), `tests/unit/libraryPlanImportChip.test.tsx` (ENG-653 chip),
`tests/unit/planImportCommit.test.ts` (shared pipeline + no-fork pin),
`tests/unit/webRouteCompletion.test.ts` (route wiring). Visual capture of the
web surface is owed to `visual-qa` before the flag ramps past internal.

## HTML prototype (approve before build)

Interactive mobile flow mockup — step tabs walk ENG-647 → ENG-652.

Reference source shapes: meal-prep paste, **program PDF** (weekly grid + recipe pages with kcal panels), coach PDF. Same pipeline: recipes first, plan compiled from matched refs.

**`docs/prototypes/2026-05-24-plan-import/index.html`**

```bash
open docs/prototypes/2026-05-24-plan-import/index.html
# Styles are self-contained under docs/prototypes/2026-05-24-plan-import/_shared/
```

Screens: Plan tab **Generate ▾** · paste sheet · Sprint 2 source tabs (preview) · parsing · review + assessment · activate modal · saved template.

## Repo tooling

```bash
# Idempotent: skips existing projects/issues by title
export LINEAR_API_KEY='lin_api_...'   # or .env.local
node scripts/linear/create-plan-import-program.mjs
node scripts/linear/create-plan-import-program.mjs --dry-run
```

## Cookbook PDF import (Library path)

Separate from Plan tab import: **one PDF → many Library recipes** tagged `Imported · {book name}`, no weekly template. Shares extract/parse/verify stack; see [Import a cookbook (PDF)](../journeys/import-cookbook.md). User builds the week in Plan manually or uses Plan Import after recipes exist.

## Screen context (macros / fibre bugs)

| Screen | Route | When |
|--------|-------|------|
| Logged meal macros | `apps/mobile/app/meal-nutrition.tsx` | Tap meal on **Today** |
| Recipe / planned meal | `apps/mobile/app/recipe/[id].tsx` | Plan slot or Library recipe (Re-verify) |
| Plan day totals | `apps/mobile/app/(tabs)/planner.tsx` ~2608 | Plan tab; **Regenerate** is separate from import |
