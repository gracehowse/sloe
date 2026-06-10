# Figma Today consistency audit

Living log of **known** visual/copy inconsistencies across Stitch HTML, Figma frames, and the shipped iOS Today tab. Use when triaging “is this a bug?” — many rows are **documented drift**, not P0 defects.

**Figma file:** https://www.figma.com/design/B3UdOFup7ITersgNuoXh0l/  
**Pipeline map:** `docs/ux/redesign/design-sources-stitch-figma.md`  
**Sim diff workflow:** `docs/testing/figma-vs-simulator.md`  
**Figma MCP snapshot audit (2026-06-04):** `docs/ux/redesign/figma-today-consistency-audit-2026-06-04.md`

---

## Frame index (Today)

| Frame | Node | Stitch HTML |
|-------|------|-------------|
| 01 · Today | `308:2` | `today.html` |
| TD1 · Activity & energy | `459:2` | `today-activity.html` |
| TD2 · Hydration & stimulants | `463:2` | `today-hydration.html` |
| TD3 · Weekly insight & planned | `480:2` | `today-insight.html` |
| TD4 · Meal log | `481:2` | `today-meallog.html` |

---

## Stitch ↔ Figma inconsistencies

These are gaps between **committed Stitch HTML** and **Figma documentation frames** (not necessarily bugs in the app). After Grace syncs Figma, treat Figma as the documentation source; refresh Stitch exports to close rows.

| # | Topic | Stitch HTML (`today.html` / TD*) | Figma (`308:2` / TD*) | Shipped iOS | Resolution |
|---|--------|-----------------------------------|------------------------|-------------|------------|
| S1 | **Week strip — selected day** | **Fixed** in `_buildtoday.mjs` (2026-06-04): clay numeral + dot, no pill — rebuild `today*.html` | May still show pill until frame updated | **Minimal** indicator: clay number + dot, no fill | **Figma:** refresh `308:2` / hero variants from rebuilt HTML or edit in file. |
| S2 | **Status chip copy** | **Under budget** (sage chip) in `today.html` / `_buildtoday.mjs` `chipText:'Under budget'` | **Under budget** / **Over budget** on `01 · Today` | `todayStatusChip` → Under / Over / Fresh start | Stitch matches Figma on wording. **Superseded note:** `2026-06-04-today-stitch-measured-spec-pass.md` still says “On track” — ignore; see `2026-06-04-today-status-chip-budget-labels.md`. |
| S3 | **Fibre vs Fiber spelling** | Hero macro tiles: **Fibre** (`today.html`, `_buildtoday.mjs`) | TD4 / meal surfaces: often **Fibre** in Figma | App copy: **Fibre** (UK) per `docs/ux/brand-tokens.md` | TD4 Stitch export `today-meallog.html` / `_buildtoday-sections.mjs` use **Fiber** — inconsistent with hero Stitch and brand. Align generators to **Fibre** on next Stitch pass. |
| S4 | **Coach line** | Plum italic ~17px under ring | Should match after measured pass | Shipped (plum 17px) | Closed in app; confirm Figma `308:2` matches post-pass. |
| S5 | **Macro tile progress bar** | Present in Stitch (`h-1` bars) | Varies by frame age | Restored on mobile | `2026-06-04-today-stitch-measured-spec-pass.md` |
| S6 | **Ring centre size** | `text-5xl` (~48px) in Stitch | Should match | `Type.ringValue` 48px | Same decision record |
| S7 | **TD3 weekly insight prose** | Warm marketing-style sentence in `today-insight.html` | One-line marketing in older composites | Data-honest headline + stats + bar | **Optional P3** copy tune only — not layout rebuild (`figma-vs-simulator.md`) |

### How to use this table

- **Agent comparing sim → Figma:** start with intentional drift in `figma-vs-simulator.md`, then check S-rows here for documentation lag.
- **Agent comparing Stitch → Figma:** if S-row says Stitch is stale, do not file a sim bug against Stitch HTML alone.
- **Grace sync checklist:** after changing Stitch, update Figma frames and tick off S-rows (or add new ones).

---

## Figma ↔ iOS simulator (summary)

Full workflow and intentional sim drift: `docs/testing/figma-vs-simulator.md`.

| Topic | Documented in figma-vs-simulator? |
|-------|----------------------------------|
| Week strip minimal vs pill | Yes — intentional (sim) |
| Status chip Under/Over | Yes — matches Figma |
| Overage ring plum lap | Yes |
| FAB plum / clay tab | Yes |
| TD1/TD2 below fold | Yes — compare `459:2` / `463:2` at scroll bottom |

---

## Audit history

| Date | Change |
|------|--------|
| 2026-06-04 | Initial audit; Stitch ↔ Figma section (S1–S7) |
| 2026-06-04 | Stitch generators rebuilt: minimal week strip, Over budget chip, plum overage lap (`#6A4B7A`), TD4 **Fibre** |
