# Plan Import — HTML prototype

Interactive mobile flow for Sprint 1 (paste → parse → review → activate).

## Open locally

From repo root:

```bash
open docs/prototypes/2026-05-24-plan-import/index.html
```

Or double-click `index.html` in Finder. All styles live in this folder (`_shared/` + `plan-import.css`) — no dependency on `docs/audits/…`.

Use the **step tabs** above the phone. Step **2** = meal-prep paste sample; **2b** = program PDF (weekly grid + recipe pages with kcal panels); **3** parse animates grid → link → compile.

## Pipeline (locked)

1. **Parse recipes** — ingredients → Suppr match → per-recipe nutrition.
2. **Parse schedule** — weekly grid (day × slot × label).
3. **Link** — slots → parsed recipes (bowls may reference several).
4. **Compile plan** — template rows from recipe refs.

## Spec

`docs/planning/plan-import-linear-program.md`
