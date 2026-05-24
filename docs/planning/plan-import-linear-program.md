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
| Trust | When source kcal ≠ Suppr calc: show **both** on review rows (source as "claimed", Suppr as primary). |
| Auto-rebalance | Scale protein-lean items → carbs → fats; **never scale vegetables**. |
| Library hygiene | Meals saved under `Imported · {plan name}` + filter chip ([ENG-653](https://linear.app/suppr/issue/ENG-653/library-imported-plans-filter-chip)). |

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
| [ENG-649](https://linear.app/suppr/issue/ENG-649) | LLM parse → structured plan JSON |
| [ENG-650](https://linear.app/suppr/issue/ENG-650) | Review screen + dual kcal trust |
| [ENG-651](https://linear.app/suppr/issue/ENG-651) | Assessment panel + 3 actions |
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

## HTML prototype (approve before build)

Interactive mobile flow mockup — step tabs walk ENG-647 → ENG-652:

**`docs/prototypes/2026-05-24-plan-import/index.html`**

```bash
open docs/prototypes/2026-05-24-plan-import/index.html
```

Screens: Plan tab **Generate ▾** · paste sheet · Sprint 2 source tabs (preview) · parsing · review + assessment · activate modal · saved template.

## Repo tooling

```bash
# Idempotent: skips existing projects/issues by title
export LINEAR_API_KEY='lin_api_...'   # or .env.local
node scripts/linear/create-plan-import-program.mjs
node scripts/linear/create-plan-import-program.mjs --dry-run
```

## Screen context (macros / fibre bugs)

| Screen | Route | When |
|--------|-------|------|
| Logged meal macros | `apps/mobile/app/meal-nutrition.tsx` | Tap meal on **Today** |
| Recipe / planned meal | `apps/mobile/app/recipe/[id].tsx` | Plan slot or Library recipe (Re-verify) |
| Plan day totals | `apps/mobile/app/(tabs)/planner.tsx` ~2608 | Plan tab; **Regenerate** is separate from import |
