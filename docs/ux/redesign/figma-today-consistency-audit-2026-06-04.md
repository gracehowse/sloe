# Figma Today consistency audit — Sloe file

**Date:** 2026-06-04 (layout pass refreshed same day)  
**File:** [Suppr Sloe](https://www.figma.com/design/B3UdOFup7ITersgNuoXh0l/) (`B3UdOFup7ITersgNuoXh0l`)  
**Auditor:** Agent (Figma MCP only — no app code changes)  
**Product refs:** [Week strip decision](../decisions/2026-06-03-today-week-strip-minimal-current-day.md), [Plum nav / FAB](../decisions/2026-06-04-plum-nav-clay-content-cta-split.md), [Today diff plan](file:///Users/graceturner/.cursor/plans/today_figma_diff_assessment_38fa03a5.plan.md)

### Pass 7 — full file alignment to `654:2` (2026-06-04)

See `figma-sloe-borderless-cards-pass.md` Pass 7: plum FAB all nav, macro/plan/recipe/progress slabs, cookbook cards, toggles, S6 ring/chip, Design System components. **greyBorders: 0** on both Figma pages.

### Pass 4b — main-artboard frames (2026-06-04)

Earlier passes only hit **staging** frames at **x≈11200** (`308:2`, `654:2`). The frames most reviewers open on the **main artboard** (`W1` `337:2`, `W2` `338:2`, `L1`, `K4`) still had **16 / 15 grey card borders** until this pass.

| Frame | Borders removed |
|-------|-----------------|
| `337:2` W1 desktop | 16 |
| `338:2` W2 tablet | 15 |
| `326:2` L1 loading | 4 |
| `498:2` K4 fasting | 3 |

**Canonical** `654:2` renamed and moved to **x=3420, y=140** (beside S6). `308:2` → deprecated @ 35% opacity.

### Pass 4 — borderless warm slab (card chrome, Figma-only, 2026-06-04)

Applied shipped Sloe resting-card spec to hero + TD frames: **`#F6F5F2`** fill, **no grey hairlines** on content cards, **`cardSoft`** drop shadow in light (`0 6px 18px rgba(34,27,38,0.16)` — strengthened from `0 4px 14px …0.10` on 2026-06-04 so the slab lifts off the white page on-device), **white page**; dark `314:2` gets **`#2A2730`** + hairline. Skips `Image (` nodes and Log Dinner CTA strokes.

| Frame | Borders cleared | Fills set | Shadows |
|-------|-----------------|-----------|---------|
| `654:2` (chosen) | 0 | 13 | 12 |
| `308:2` | 11 | 13 | 12 |
| `360:2` | 13 | 17 | 16 |
| `357:2` | 12 | 15 | 14 |
| `314:2` | 1+9 dark pass | 5+9 | 0 |
| `339:2` | 13 | 17 | 13 |
| `459:2`–`481:2` | 6–10 each | 4–8 | 4–8 |

Renames: `654:2` → **chosen · borderless warm slab**; `308:2` → **composite · borderless warm slab**. `357:61` chip text set to **Over budget**.

### Pass 3 — minimal week strip + S6 plum overage (Figma-only)

- **Week strip** on `613:98` (01), `613:7` (S5), `618:7` (L5 dark), `357:14` (S6): removed clay pill fills; selected day = **clay number + clay dot**; logged days = **sage dot**; no cell background.
- **S6 ring** (`357:68` → SVG): full plum calorie lap + **damson `#6A4B7A` second overage lap** (~7% arc); macro rings unchanged; coach copy set to over-state quote on `357:97`.

### Pass 2 — layout, alignment, readability (Figma-only)

Applied a unified **468px content column** pass on hero frames: centred greetings/coach, full-width hero card innards (418px), centred 220px rings, equal Goal/Eaten/Bonus columns, repacked scroll heights. **L5** north-star cloned from **01**; dark macro labels set to cream/soft ink. **S6** chip → **Over budget**; marketing Weekly Insight hidden on S6. **TD4** `Fiber` → **Fibre**.

| Frame | Layout / alignment | Readability | Still open |
|-------|-------------------|-------------|------------|
| `308:2` | Pass | Pass (light) | — |
| `314:2` | Pass | Pass (cream headings, dark cards) | — |
| `360:2` | Pass | Pass | — |
| `357:2` | Pass | Pass | — (minimal strip + plum overage lap applied in Figma pass 3) |
| `481:2` | Pass | Pass | — |
| `480:2` TD3 | Not re-run this pass | — | Spot-check vs app |

---

## Scope

Compared Today-related frames named in the audit brief:

| Node | Frame | Section |
|------|-------|---------|
| `308:2` | `01 · Today` | `372:2` · 01 · Core app |
| `360:2` | `S5 · Today (empty)` | `372:4` · 03 · Onboarding & states |
| `357:2` | `S6 · Today (over)` | `372:4` · 03 · Onboarding & states |
| `314:2` | `L5 · Today (dark)` | `372:5` · 04 · Loading / Error / Dark |
| `459:2` | `TD1 · Today — Activity & energy` | `470:2` · 09 · Today & Plan — deep dive |
| `463:2` | `TD2 · Today — Hydration & stimulants` | `470:2` |
| `480:2` | `TD3 · Today — Weekly insight & planned` | `470:2` |
| `481:2` | `TD4 · Today — Meal log` | `470:2` |

Method: `get_metadata` + targeted `get_screenshot` on week strip (`308:18`), hero (`308:75`, `357:57`, `360:57`), nav FAB (`308:297`), insight blocks (`308:283`, `480:18`).

---

## Severity table (vs shipped decisions)

| ID | Severity | Topic | Shipped / Grace direction | Figma state | Frames affected |
|----|----------|-------|---------------------------|-------------|-----------------|
| F-01 | **P0** | Week strip | Minimal indicator: clay number + dot, **no filled clay pill** | Selected day (Tue 24) still uses **filled clay pill** with inverted text | `308:2`, `360:2`, `357:2`, `314:2` (same strip component) |
| F-02 | **P0** | Over chip copy | **Over budget** (or agreed kcal-over variant) — not “On track” | `357:2` hero shows **“140 over”** (kcal-style), not “Over budget” | `357:2` |
| F-03 | **P1** | Overage ring | **Plum second lap** on calorie ring — not red/coral arc or hash | `357:2` outer ring overage segment reads **coral/red-orange**, not plum continuation | `357:2` |
| F-04 | **P1** | Weekly insight (composite) | App + **TD3** = stats card (headline, 3 stats, week bar, coach line). **308 bottom** = marketing prose variant | `308:2` still has single **“Weekly Insight”** paragraph card; **TD3 (`480:2`)** matches app structure | `308:2` vs `480:2` |
| F-05 | **P2** | Fibre spelling | **British “Fibre”** on Today | `308:2`, `360:2`, `357:2`, `314:2` use **Fibre**; **`481:2` (TD4)** uses **“Fiber”** on fibre row | `481:2` |
| F-06 | **P2** | File organisation | Today states + scroll slices should be discoverable together | **S5/S6** live under **Onboarding & states**; **L5** under **Dark**; **TD1–4** under **deep dive**; hero composite only in **Core app** | Whole file |
| F-07 | **P3** | Stale layer names | Text layers should match visible copy for dev handoff | e.g. `357:61` layer name `Under budget` while canvas shows **140 over**; `360:61` layer name `Under budget` while canvas shows **Fresh start** | `357:2`, `360:2` |
| F-08 | **Pass** | Status chip (logged under) | Under budget | `308:2` hero chip **Under budget** | `308:2` |
| F-09 | **Pass** | Status chip (empty) | Fresh start | `360:2` hero chip **Fresh start** | `360:2` |
| F-10 | **Pass** | Greeting | Two-line: Newsreader greeting + sans date; **en-GB** date | `308:2` **Morning, Grace** + **Tuesday, 24 October** | `308:2`, `360:2`, `357:2` |
| F-11 | **Pass** | Plum FAB | Centre log = plum nav primary | Tab bar FAB **plum** with white + | `308:297`, TD nav variants |
| F-12 | **Pass** | TD3 insight structure | Stats + week bar + coach | `480:2` aligns with shipped `WeeklyInsightCard` pattern | `480:2` |

---

## Top 5 inconsistencies (executive)

1. **Week strip still uses the old filled clay pill** on the selected day across all Today hero frames — contradicts the 2026-06-03 minimal-strip decision.  
2. **S6 over state chip** shows **“140 over”** instead of the agreed **“Over budget”** label.  
3. **S6 overage ring** uses a **coral/red outer segment** instead of **plum second-lap** overage.  
4. **`01 · Today` composite (`308:2`)** still embeds the **marketing Weekly Insight prose card** at the bottom while **`TD3`** is the structural source of truth for the app.  
5. **Today frames are scattered** (Core app + Onboarding states + Dark + deep dive), which confuses agents and reviewers about which frame to diff.

---

## Reorg recommendation

**Recommend Option B (yes)** — keep **TD1–TD4** as scroll siblings, but **rename, group, and relink**; do **not** rely on a single 2000px composite for parity checks.

### Why not Option A alone

- `308:2` is useful as a **marketing / full-story** board but is **wrong** for week strip and bottom insight vs shipped code.  
- A new “Today full scroll” composite would duplicate TD slices unless maintained automatically.

### Option B — concrete steps for Grace

1. **Create a Figma section** `09 · Today — source of truth` (or expand existing `470:2`) with subfolders:
   - `Today / Hero states` → `S5 empty`, `308 logged (hero crop)`, `S6 over`, `L5 dark`  
   - `Today / Scroll — TD1 Activity` … `TD4 Meals` (existing nodes, moved or linked)  
   - `Today / Deprecated` → move or label `308:2` bottom Weekly Insight block; add description “marketing copy only”.  
2. **Move or duplicate** `360:2` and `357:2` out of `03 · Onboarding & states` into the Today hero group (onboarding section should not own Today calorie states).  
3. **Rename** for agents:
   - `308:2` → `01 · Today (composite · marketing scroll)`  
   - `480:2` → keep as **Weekly insight — canonical**  
4. **Pin a cover note** on section `470:2` listing node IDs and “diff sim against these, not 308 only”.  
5. **Optional Option A lite:** one **non-exported** “Today agent checklist” frame that **instances** hero + TD1–4 vertically (no duplicate edits).

### Concrete Figma edits (priority order)

| Priority | Edit |
|----------|------|
| P0 | On shared week-strip component: remove clay fill on selected cell; use **bold clay number + 4px clay dot**; logged days **sage dot** only. Apply to `308:2`, `360:2`, `357:2`, `314:2`. |
| P0 | `357:2`: change status chip to **Over budget** (or **Over budget · 140** if width needs kcal). |
| P1 | `357:2`: redraw overage as **plum second lap** on main calorie ring (match `CalorieRing` / stitch pass — no red arc). |
| P1 | `308:2`: either **remove** bottom Weekly Insight section or **group + label** `Deprecated · marketing prose — use TD3`. |
| P2 | `481:2`: **Fiber → Fibre**. |
| P3 | Rename text layers to match visible strings (chip, Fresh start). |
| P3 | `308:2` / `357:2`: sync coach line copy with data-honest TD3 tone where needed (optional). |

---

## Source of truth per section (for sim diff)

| UI slice | Canonical Figma frame | Notes |
|----------|----------------------|--------|
| Week strip + greeting + hero ring/chip (empty) | `360:2` | Fresh start chip correct |
| Hero logged under target | `308:2` (hero only, not full scroll) | Under budget + plum ring OK; strip still wrong |
| Hero over target | `357:2` | Fix chip + ring before sim diff |
| Dark mode hero | `314:2` | Under budget chip; verify strip after P0 |
| Activity & energy | `459:2` | Below-fold canonical |
| Hydration & stimulants | `463:2` | Below-fold canonical |
| Weekly insight + planned | `480:2` | **Canonical** vs app; not `308:283` |
| Meal log slots | `481:2` | Canonical; fix Fibre spelling |
| Full-page story / marketing | `308:2` | **Not** sim parity SSOT — strip + bottom insight drift |
| Tab bar / FAB | Any Today frame nav (`308:297`, etc.) | Plum FAB OK |

---

## PR-ready snippet — `docs/testing/figma-vs-simulator.md` frame map

Replace the single-frame workflow bullet with:

```markdown
## Today frame map (Sloe file `B3UdOFup7ITersgNuoXh0l`)

Do **not** diff only `308:2` — it is a marketing composite (old week strip + prose insight).

| Check | Figma node | Frame name |
|-------|------------|------------|
| Empty hero | `360:2` | S5 · Today (empty) |
| Logged hero (under) | `308:2` | 01 · Today — **hero crop only** |
| Over hero | `357:2` | S6 · Today (over) |
| Dark hero | `314:2` | L5 · Today (dark) |
| Activity | `459:2` | TD1 · Today — Activity & energy |
| Hydration | `463:2` | TD2 · Today — Hydration & stimulants |
| Weekly insight | `480:2` | TD3 · Today — Weekly insight & planned |
| Meals | `481:2` | TD4 · Today — Meal log |

**Intentional sim ≠ Figma until file refresh:** minimal week strip (no pill), S6 chip “Over budget”, plum overage lap on `357:2`.

Full audit: `docs/ux/redesign/figma-today-consistency-audit-2026-06-04.md`
```

---

## Related

- Living Stitch ↔ Figma ↔ sim log: `docs/testing/figma-today-consistency-audit.md`  
- Design pipeline: `docs/ux/redesign/design-sources-stitch-figma.md`  
- Implementation plan (code): `.cursor/plans/today_figma_diff_assessment_38fa03a5.plan.md`  
- Agent diff checklist: same plan §6  
- iOS dossier: `docs/ux/redesign/today-ios-dossier.md`
