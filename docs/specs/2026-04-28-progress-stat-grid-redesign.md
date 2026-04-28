# Progress stat grid (2×2 tiles) — redesign spec

**Phase 6 P1.** Visual refit. Surfaces: `apps/mobile/app/(tabs)/progress.tsx` lines ~1145-1263; `src/app/components/ProgressDashboard.tsx` lines ~1087-1185.
**Authority:** production design spec §1.1 motion, §1.2 type, §1.3 depth, §1.5 icons, §1.6 source/provenance; D-2026-04-27-17 Progress is a story (stat cards demoted), D-2026-04-27-07 streak demoted to a pip.
**Source:** visual-qa pixel-level audit finding #3.

---

## 1. Design intent

The 2×2 stat grid is **secondary** content. Progress is now a story (D-2026-04-27-17), and ProgressHeadline (engine commentary) is the lead. These four tiles give a glance at four numerical pulse-checks — **average calories, protein adherence, logging streak, weight trend** — and act as deep links into the per-metric breakdown sheet.

They must read as "supporting evidence under the story", never compete with the headline.

That demotion does NOT mean cheap. Visual-qa flagged the live tiles as one of the 5 cheapest-looking surfaces. Fixing the cheap-look is what this spec resolves; the demotion is honoured by treatment, not by neglect.

**Feel target:** calm, scannable, trustworthy. One number per tile, sized to be the obvious first thing the eye reads.

---

## 2. Tile anatomy

Every tile is the same anatomy. Five regions top-to-bottom:

```
┌─────────────────────────────────────┐
│ [icon-box-12pt] EYEBROW LABEL       │  row 1: 16pt high
│                                     │
│ 47%        [optional delta badge]   │  row 2: stat value (dominant)
│                                     │
│ days on target                      │  row 3: context caption
│                                     │
│ ╶─────────────────────────╴         │  row 4 (optional): mini-viz strip
└─────────────────────────────────────┘
   the whole tile is the button
   no chevron, no "Tap for breakdown" label
```

- **Row 1 — Eyebrow row.** Flex-row align-centre, 8pt gap. Left: 16pt icon-box (web `<IconBox size="xs">`, mobile `IconBox size={20}`) housing 12pt lucide glyph. Right: eyebrow label `Type.label` (11pt 700 0.08em uppercase, `text-secondary`). Bottom margin 10pt.
- **Row 2 — Stat value (dominant).** New `Type.statValue` token: **24pt 700 -0.4 letterspace tabular-nums** in metric's role colour. Single line, no truncation. If metric has delta-vs-last-week, render inline 18pt delta badge to the right.
- **Row 3 — Context caption.** `Type.caption` (11pt 500 `text-secondary`). Single line. "vs 2,200 target", "days hit ≥120g", etc. Top margin 4pt.
- **Row 4 — Mini-viz strip (optional).** 24pt-tall mobile / 28px web sparkline / mini-bar / mini-pip. Top margin 10pt. Stroke-only at 1.5pt 60% opacity in metric's colour. See §4.

**Hierarchy ladder (visual weight):** stat value → eyebrow label → context caption → mini-viz → (removed footer chevron).

**Geometry:** padding 14pt all sides. **Min-height 132pt/px fixed** — all four tiles equal regardless of content. Radius `Radius.lg` (14pt mobile / `rounded-[14px]` web).

---

## 3. Type ladder (replaces ad-hoc literals)

Live grid uses ad-hoc `10`/`11`/`12`/`22` — none read as a type system.

| Region | Token | Mobile | Web |
|---|---|---|---|
| Eyebrow | `Type.label` | 11pt 700 0.88 letter-spacing uppercase | 11px 700 0.08em uppercase |
| Stat value | **NEW `Type.statValue`** | 24pt 700 -0.4 letter-spacing tabular-nums | 24px 700 -0.02em tabular-nums |
| Context | `Type.caption` | 11pt 500 `text-secondary` | 11px 500 `text-muted-foreground` |
| Delta badge | `Type.caption` 700 + tabular-nums | 11pt 700 tabular-nums | 11px 700 tabular-nums |
| Mini-viz labels | `Type.caption` tabular-nums | 10pt 500 | 10px 500 |

**Mobile theme.ts addition:**
```ts
statValue: { fontSize: 24, lineHeight: 26, fontWeight: '700' as const, letterSpacing: -0.4 },
```

**Web:** ship as Tailwind composition `text-[24px] leading-[26px] font-bold tracking-[-0.02em] tabular-nums`. Add to design tokens as `--text-stat-value: 24px / 26px / 700 / -0.02em`.

**Tabular-nums everywhere on numerics** — mobile `fontVariant: ['tabular-nums']` / web `tabular-nums` Tailwind class.

---

## 4. Per-tile stat treatment

### Tile A — Average calories

**Stat value:** absolute kcal e.g. `2,083`. Colour: `t.green` if `≤ target`, `t.amber` if `> target`. Tabular-nums.

**Mini-viz:** **mini-bar strip** — 7 (or N capped at 14) day-bar slivers, height-encoded against `max(target, max-day)`. Same green/amber rule per day, 0.6 opacity. 24pt tall, 1pt gap. Mini-mirrors the full Daily Calories chart 200pt below.

**Eyebrow:** dynamic `formatAvgCaloriesLabel(daysWithFood)` — already shared.

**Context:** `vs {target.toLocaleString()} target`. **No delta badge** (already a comparative).

### Tile B — Protein hit

**Stat value:** `5/7` (numerator/denominator format). Colour: `t.green` if ratio ≥ 0.7, `t.amber` otherwise.

**Mini-viz:** **mini-pill row** — 7 small pill dots (8pt diameter), one per day. Filled green = hit-target, hollow border = missed, hollow grey-fill = un-logged. 24pt strip height.

**Eyebrow:** "PROTEIN HIT".

**Context:** `day{plural} on target`. **No delta badge** (5/7 is self-anchoring).

### Tile C — Streak

**Stat value:** `12 days` — number-then-unit. Colour: `t.green` if ≥ 3, `t.accent` below.

**Mini-viz:** **none** (a streak doesn't have a sensible visual encoding at this size). Use the row 4 slot for a **freeze-pip row** instead: up to 3 small `Snowflake` lucide glyphs at 12pt in `t.accent`, count = `freezesAvailable` capped at 3. If 0 freezes, leave row empty (not a placeholder dash).

**Eyebrow:** "STREAK".

**Context:** `logging streak`.

### Tile D — Trend (weight)

**Stat value:** `−1.2 kg` (signed weight delta) or `78.4 kg` (latest if no trend). Colour: depends on user goal direction — `t.green` when delta direction matches goal, `t.amber` when opposing, `t.accent` when stable / no goal.

**Mini-viz:** **sparkline** — true sparkline using existing weight-by-day series, 1.5pt stroke in role colour at 60% opacity, last point dot at 100%. 24pt tall. If `series.length < 2`, render flat dim hairline at mid-height, no dot.

**Eyebrow:** "TREND".

**Context:** `losing ({range})` / `gaining ({range})` / `maintaining ({range})` / `no weight data`.

### Why these treatments

- **Avg Calories + Trend** earn mini-viz because they're inherently time-series.
- **Protein Hit + Streak** earn pip-style discrete encodings because they're discrete by nature.
- **No tile gets sparkline-PLUS-delta-badge.** Belt-and-braces noise. Pick one.
- **No tile gets a tiny ring.** Rings reserved for Today calorie ring.

### New mini-viz primitives

1. `<TileMiniBars values={number[]} max={number} target={number} />` — Tile A.
2. `<TilePipRow states={('hit' | 'miss' | 'idle')[]} />` — Tile B.
3. `<TileSparkline series={number[]} colour={string} />` — Tile D.

Each at:
- mobile `apps/mobile/components/progress/{TileMiniBars,TilePipRow,TileSparkline}.tsx`
- web `src/app/components/progress/{TileMiniBars,TilePipRow,TileSparkline}.tsx`

Shared compute helper at `src/lib/progress/tileMiniViz.ts` (sparkline path / bar heights) so platforms can't drift.

---

## 5. Surface depth

Live tiles are flat-on-flat with no rest/hover/press differentiation. They read as labelled containers, not interactive cards.

**Replace with Card elevation tier (production design spec §1.3):**

### Rest

- Mobile: `backgroundColor: t.elevated`, `borderRadius: Radius.lg` (14pt), `borderWidth: 1`, `borderColor: t.cardBorder`, shadow `Elevation.card` (`shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1`).
- Web: `bg-card border border-border rounded-[14px] shadow-[var(--elev-card)]`.
- Both: padding 14pt, min-height 132pt/px.

### Hover (web only)

- `box-shadow: 0 4px 12px rgba(0,0,0,0.06)`
- `transform: translateY(-1px)`
- `border-color: var(--border-strong)`
- 150ms `--ease-pm` transition; `cursor: pointer`

### Press

- Mobile: scale `0.98` over 100ms, return on release. Shadow unchanged.
- Web: `transform: translateY(0)` (cancels hover lift), shadow back to rest, 80ms transition.

### Focus (web only)

- 2px primary ring, 2px offset.

### Dark mode

- Mobile: drop `shadowOpacity` to 0; add 1px hairline top-edge highlight `borderTopColor: 'rgba(255,255,255,0.06)'`.
- Web: `dark:shadow-none dark:border-[var(--border-strong)]` + `before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-white/[0.06]`.

---

## 6. "Tap for breakdown" affordance — REMOVED

Chevron + "Tap for breakdown" footer competes with the stat value. **Remove it entirely**. The whole tile is the affordance.

1. Delete the row at mobile lines 1256-1259 (`<View>...<Text>{footerLabel}</Text><ChevronRight /></View>`).
2. The whole `<Pressable>` (mobile) / `<button>` (web) carries the tap target — already true.
3. Affordance signals: web hover lift + cursor pointer + focus ring; mobile press-scale; both card depth.
4. Existing accessibility unchanged: `accessibilityRole="button"`, descriptive label, `accessibilityHint="Opens detailed breakdown"`.

The "Trend" tile previously had a different footer label ("Chart & breakdown") because it routes to `/weight-tracker`. Footer removed; destination divergence preserved in `openTile()`.

---

## 7. Grid spacing

### Container

- **Mobile:** `flexDirection: "row"`, `flexWrap: "wrap"`, gap `8pt`. Each tile width: `flexBasis: '48%'` (NOT `width: '47%'` literal hack). Two tiles per row at 48% with gap 8 produces a true 2-column grid that respects container `paddingHorizontal: 20`.
- **Web:** CSS Grid `grid grid-cols-2 gap-3` (12px gap; bumped from `gap-2` to give breathing room).

### Vertical position

The grid sits below WeightRangeCard / CaloriesRangeCard hero pair, above Daily Calories chart. Position preserved.

**No section header above the grid** ("Quick stats" / "At a glance") — adds visual noise we just removed from the footer.

### Tile-internal recap

```
[14pt padding-top]
[icon-box 16pt + 8pt gap + eyebrow 11pt]   row 1
[10pt gap]
[stat value 24pt]                          row 2
[4pt gap]
[context caption 11pt]                     row 3
[10pt gap (only when row 4 present)]
[mini-viz 24pt]                            row 4 (optional)
[14pt padding-bottom]
```

Total at largest: ~127pt. Round to 132pt min-height.

When row 4 is absent (Tile C with no freezes), placeholder 24pt empty space — all four tiles align.

### Edge case: `weightSurfaceMode === "hide"`

3 tiles render; bottom-right cell empty. Grid does NOT reflow to 1×3 — visual stability across mode changes is more important than full-width usage.

---

## 8. Cross-platform notes

| Concern | Mobile (touch) | Web (mouse / kbd) |
|---|---|---|
| Affordance signal | press-scale 0.98 over 100ms | hover lift translateY(-1px) + shadow bump 150ms |
| Cursor | n/a | `cursor: pointer` |
| Focus ring | system Pressable focus | 2px primary, 2px offset |
| Touch target | ≥44pt — already true (132pt min) | ≥36px — already true |
| Mini-viz rendering | `react-native-svg` `<Polyline>` + `<Circle>` | inline `<svg><polyline /><circle /></svg>` |
| Shadow | `shadowOpacity: 0.04, shadowRadius: 4, elevation: 1` light / 0 + top-edge highlight dark | `0 1px 2px rgba(0,0,0,0.04)` light / none + top-edge highlight dark |
| Haptic on tap | `selection` haptic | none |
| Reduce-motion | mini-viz still renders; press-scale suppressed | hover lift + shadow transition suppressed via `@media` |

**No long-press on tile.** Considered "long-press to share this stat", rejected (undiscoverable, marginal use case).

**What's identical:** anatomy, type ladder, per-tile metric/colour/mini-viz, grid layout, removal of footer, min-height, Card depth tier rest state.

---

## 9. States

- **Default** (loaded, populated): the spec.
- **Loading:** existing skeleton at mobile lines 824-846 — update to **132pt min-height**, Card depth tier, replace `width: 47%` with `flexBasis: 48%`, remove `opacity: 0.6` for pulse-shimmer (250ms `--ease-pm`, 0.6 ↔ 0.9). Reduce-motion: static at 0.7. **Web equivalent missing today** — add `<ProgressTileSkeleton>` × 4 in 2×2 grid.
- **Empty (`!hasData`):** unchanged — grid suppressed entirely, "Your progress will appear here" full-width block.
- **Partial (some days logged):** default render with dynamic eyebrow `formatAvgCaloriesLabel`. Already supported.
- **Error:** if `weekStats` failed → grid skipped (full-page error path higher up). If single metric returns null → tile in "no data" form (e.g. Tile D context "no weight data", stat "—", no sparkline).
- **Stale / Offline:** cached values render. No staleness indicator — at this granularity, noise.
- **Over-budget:** Tile A amber when avg > target; Tile B amber when ratio < 0.7. Already handled. Amber is **never red** (per `project_prototype_carryover_rules.md`).

---

## 10. Acceptance criteria

1. Same four tiles in same order: Avg Calories, Protein Hit, Streak, Trend.
2. Each tile exactly **132pt/px minimum height**, all four equal.
3. No "Tap for breakdown" / "Chart & breakdown" / equivalent footer. No `ChevronRight` glyph in-tile footer.
4. Stat values rendered at 24pt 700 -0.4 (mobile) / 24px 700 -0.02em (web) tabular-nums. Grep `fontSize: 22` and `text-[22px]` returns zero in stat-grid block.
5. Eyebrow labels at 11pt 700 0.08em uppercase. Grep `fontWeight: "500"` / `font-semibold` on eyebrows returns zero.
6. Context captions `Type.caption` 11pt 500 muted on both platforms.
7. Mobile tile widths via `flexBasis: '48%'` — grep `width: "47%"` returns zero.
8. Web tile container `grid grid-cols-2 gap-3` (not `gap-2`).
9. Tile A renders `<TileMiniBars>`; Tile B `<TilePipRow>`; Tile D `<TileSparkline>`; Tile C freeze-pip row (NOT a sparkline).
10. Each tile carries Card depth tier rest state. Dark mode: shadow dropped, 1px top-edge highlight added.
11. Web hover lifts 1px + bumps shadow 150ms. Web focus shows 2px primary ring with 2px offset.
12. Mobile press scales 0.98 over 100ms; selection haptic on tap.
13. Tap routes correctly: Avg/Protein/Streak → metric breakdown sheet; Trend → `/weight-tracker` (mobile) / weight-tracker view (web).
14. Loading skeleton matches default geometry on both platforms.
15. `weightSurfaceMode === "hide"` → 3 tiles + 1 empty cell (no reflow).
16. `!hasData` path unchanged.
17. All four tiles `accessibilityRole="button"` / `<button>` with descriptive labels + "Opens detailed breakdown" hint.
18. **Web parity** — every change lands on `ProgressDashboard.tsx` in same commit.
19. CI passes locally.
20. Snapshot tests on `<ProgressStatTile>` (or inline tests on the block) verify anatomy renders for each tile + empty/loading.

---

## 11. Component refactor (proposed but optional for ship)

Extract `<ProgressStatTile>` accepting `{ icon, eyebrow, value, valueColour, context, miniViz, onPress, accessibilityLabel }`. Each tile becomes `<ProgressStatTile {...props} />`. Reduces drift between web and mobile.

Not strictly required for visual refit. If scope creep, ship inline; queue refactor as follow-up.

---

## 12. Open questions

- **Q1.** `<TileSparkline>` series respects active range pill (7d/30d/90d/All) or always trailing 7 days? Recommend: **active range** (consistent with surface). Routes to nutrition-engine.
- **Q2.** Tile B mini-pip row at 30d/90d range — 7 pips (one-week sample) or N pips capped at 14 with smaller diameter? Recommend: **cap at 14, scale diameter 8pt → 5pt as N grows**. visual-qa to verify legibility at 5pt.
- **Q3.** Tile D colour-by-goal-direction — when no goal weight set, neutral or "any movement is engaged"? Recommend: **neutral `t.accent`**. nutrition-engine to confirm goal-direction inference reliable.
- **Q4.** Streak freeze-pip glyph — `Snowflake` lucide or existing `Icons.streakFreeze`? Recommend: **`Snowflake`** (production spec §1.5 mandates lucide). design-system-enforcer to retire custom glyph.
- **Q5.** Loading skeleton on web is currently absent. Confirm executor scope includes adding `<ProgressTileSkeleton>` × 4 to web.
- **Q6.** First-tile-tap discoverability — ship without tooltip? Recommend yes; revisit post-cohort-expansion. product-lead to confirm.

---

## 13. File touch-list for executor

- `apps/mobile/app/(tabs)/progress.tsx` — replace stat-grid block (~lines 1145-1263 + skeleton block ~824-846)
- `src/app/components/ProgressDashboard.tsx` — replace stat-grid block (~lines 1087-1185 + add web skeleton)
- `apps/mobile/constants/theme.ts` — add `Type.statValue` token + verify `Elevation.card`
- `src/styles/theme.css` — add `--text-stat-value` token + verify `--elev-card`
- New: `apps/mobile/components/progress/{ProgressStatTile,TileMiniBars,TilePipRow,TileSparkline}.tsx`
- New: `src/app/components/progress/{ProgressStatTile,TileMiniBars,TilePipRow,TileSparkline}.tsx`
- New: `src/lib/progress/tileMiniViz.ts` (shared compute helper)
- Tests: extend `progress.test.tsx` (mobile) and `ProgressDashboard.test.tsx` (web)
- Audit: mark `docs/audits/2026-04-28-visual-qa-pixel-level.md` finding #3 resolved when shipped.
