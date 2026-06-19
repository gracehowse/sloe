# ENG-1099 — Today tracker craft-tier redesign spec

**Date:** 2026-06-14 · **Status (updated 2026-06-18):** **ALL M1–M6 SHIPPED to `main` behind `today_tracker_tier_v1` (default-on), both platforms.** Original status below was "spec ready → prototype → build" — the build then happened across PRs #448 (M1/M2/M3), #451, #456, #467, #457. See the **"Implementation status (2026-06-18 reconciliation)"** section at the foot of this doc. Remaining work is two explicitly-deferred follow-up tickets (Skia overflow arc + lower-fold rhythm) and a SIM/visual red-line pass — NOT spec implementation. · **Source:** ui-product-designer, executing the M1–M6 brief in `docs/planning/2026-06-14-eng1099-today-craft-census.md`. iOS leads, web parity.

## The one rule
The recipe screen's whole secret (verified in `recipe/[id].tsx:1344`): the body is **one rule** — `padding: Spacing.xl, gap: Spacing.xl` (24), content flat on cream, macro strip a single hairline slab with serif values coloured per macro, one confident accent. The tracker loses because every block re-decides its own padding, elevation, type, accent. **The whole spec is: make the tracker obey the recipe's one rule — 24 between blocks, flat on cream, two number tiers, one loud accent (the ring), macro-identity colour where the recipe already taught the user to read it.**

## M1 — Governing rhythm (the seam fix, highest leverage)
**One cadence: `Spacing.xl` (24) between blocks.** Scroll `contentContainerStyle.gap` 8 → 24; **delete every `marginTop: Layout.todaySectionBreak` (32)** on meals/north-star/lower blocks; remove per-block `marginBottom` spacers (the parent gap owns spacing). Page padding 20 → 24 (converge to the recipe body). Within a card: padding 20 (hero) / 16 (tiles, slots); element gaps 8–12. **Law: 24 between blocks, 16–20 inside a block, 8–12 in a row.** No 32, no sub-4px micro-nudges (RC-2). `macroTileGridGap: 12` stays (valid `Spacing.dense`, the verified false-positive). Web converges on `gap-6`/`px-6`, drops its fractional steps (RC-5).

## M2 — Flat the card stack
Hero ring, all four macro tiles, all meal-slot cards, north-star default card → `lift="flat"` (drop `cardSoft`). The ring stays the hero by **scale**, not shadow (single-hero cap intact). North-star keeps `tone="primary"` tint (its differentiator surface).

## M3 — Strip the macro tile to the recipe-strip pattern + the colour decision
Remove the per-tile **progress bar AND caption line** (`MacroStatTile.tsx:137-171`). Keep label+glyph → serif value (`Type.heroValue` 20, drop the inline 20 override) → `/target`. `minHeight` 96 → ~64. Press → `PressableScale`.

**The open call — committed: value colour signals over/under (option c, macro identity + amber-over).** Confidence 8/10.
| Tile state | Value colour |
|---|---|
| Empty (0) | `textTertiary` (quiet "nothing yet") |
| Logged, on/under target | **macro identity hue** — protein sage / carbs clay / fat amber / fibre teal (the recipe-strip precedent) |
| Logged, over + `overIsFlag` (protein/carbs/fat/sugar/sodium) | **amber** `Accent.warningSolid` (light) / `warningLight` (dark) — the documented over-signal, NOT red (red = ring carve-out only) |
| Over where over wins (fibre/water) | stay macro hue (over fibre is good) |
Beats state-tint (floods the 2×2 with green/amber) and neutral (silently drops the over signal — "numbers stay visible" includes "legible whether I'm over"). Reuses existing tokens, makes Today rhyme with the recipe strip. **Calm mode unaffected** — it hides aim lines, not logged values; tiles render identically calm-on/off.

## M4 — Two serif tiers
Collapse 17/19/20/24/48 → **Tier 1** ring numeral `Type.ringValue` (48); **Tier 2** block values `Type.heroValue` (20); supporting: section headers `Type.title` (24), names `Type.headline` (17), labels/units `Type.label` (11), grams/target `Type.caption` (11). **Add one ramp step `Type.statValue` (serif 18/22/400)** as the legal home for the orphaned hero-stat — **converge mobile 19 + web 18 → 18.** RC-1 inline overrides (`TodayHeroRing:127`, `MacroStatTile:116`, `NorthStarBlock:754`) all resolve to ramp steps.

## M5 — Quiet the washes (ring = the one note; NO new accent added)
Status chip: empty/under → no fill, text+glyph only (plum/sage); over keeps `overBudgetSoft` (the one earned alarm). Slot icon chip tint 18% → 12% (glyph stays — hue+icon+position is load-bearing). Log-usual pill loses tint+border → `fillQuiet` (matches Add-food — near-duplicate rule). Macro-tile bars removed (M3) kills the loudest colour-noise. Untouched-loud: the ring (gradient/sage/red carve-out) + the FAB.

## M6 — De-chrome the meal log
Slot cards `lift="flat"` (tight flat group, 8 internal gap, 24 from the block above). Meal rows → `PressableScale haptic="selection"` (RC-3 P1 — currently **0 PressableScale across 24 Pressables**). `SlotMacroChips` grams unchanged (numbers stay). North-star band-tight chip: off-family `rgba(34,168,96,0.10)` → `Accent.success + "1A"` / `Accent.successSolid` (RC-4 worst offender, NorthStarBlock:575).

## Cold-open / sparse states (the first impression — red-line hardest)
Gradient ring (ENG-1086) flat card; "Fresh start" chip de-tinted (plum text, no fill); stat row honest 0s at serif 18; macro tiles `0 / 120g` tertiary value, no bar/caption; empty meal slots flat full-opacity with the ENG-1092 aim line (calm-mode ON → name only); north-star `new-user` calm tinted card. Reads as a calm branded column with the gradient ring the one warm focal point.

## Interactions (RC-3 — all tracker interactives → PressableScale)
Meal row / add-food / log-usual / macro tile / macro-rings toggle / browse / north-star hero card → `haptic="selection"`; north-star CTA ("Log it") → `Success` notification (a commit). No new haptic lib.

## Parity — converge each on one token
Hero stat 19/18 → **18**; slot-header padding 12/12 vs 14/10 → **12/12**; slot macro-chips gap 8/10 → **8**; add-food/log-usual gap 8/6 → **8**; slot-pill padding 8/6 → **8**; inter-block gap → **24**. Web fractional steps → 4/8/12/16/24 (recommend a locked Tailwind spacing config as the write-time guard).

## Acceptance criteria (build gate)
1. Single 24 inter-block gap both platforms; zero `marginTop: todaySectionBreak` / block `marginBottom` left (grep clean). 2. Hero + tiles + slots + north-star `lift="flat"`; ring still largest. 3. `MacroStatTile` renders no `today-macro-tile-bar-*`/`-caption-*` testIDs. 4. Macro value colour per M3 exactly; ring red-over carve-out intact. 5. No inline `fontSize`/`fontWeight` in the three components; hero stat `Type.statValue` 18 both platforms. 6. Band-tight chip on-family sage (off-family green gone, grep clean). 7. Washes de-tinted per M5; over-budget chip the only filled state chip. 8. Every §interaction is `PressableScale` + specified haptic; meal rows + north-star hero (the two P1s) tap-verified in sim. 9. Calm mode hides only the aim line; tiles identical calm-on/off. 10. Cold-open captured light + dark. 11. Parity verified by side-by-side capture (not ARIA). 12. Sub-4px gaps (RC-2) + off-token radii (RC-6: 14/11→12, circular→full) gone in touched components.

## Open questions — routed (need a call before build)
1. **Over-budget ring overflow arc (Skia)** — the warm amber→coral overflow arc needs `@shopify/react-native-skia` (native rebuild, not OTA). Recommend **separate ticket** — this pass is OTA-able rhythm/elevation/type/colour cohesion; don't gate the seam fix on the Skia ring. → product-lead sequencing.
2. **Macro amber-over × calm-mode** — amber-on-over is a gentle flag (value+target still shown) → read as in-bounds of "body-neutral." If Grace wants calm mode to ALSO neutralise the over-colour, it's a one-line gate. → Grace at red-line.
3. **Lower-fold rhythm** — `todayScrollGap`/`todaySectionBreak` also feed blocks BELOW north-star (digest, weekly insight, energy balance — out of ENG-1099's named scope). At 32 they'll look mismatched next to the tracker's 24. Recommend extending 24 to the whole scroll. → journey-architect if it's a separate brief.
4. **Macro-identity colour AA** — at 20px serif weight-500 the value is **normal** text (AA 4.5:1), and the base hues mostly fail (sage 4.40 borderline, clay 3.33, amber 2.96). Resolution: macro-tile coloured values use the **`*Solid` (darker) variants** to meet AA 4.5:1 (amber-over already uses `warningSolid`). Confirm with a contrast pass at prototype time — this is the one place to measure, not assume.

## Files (executor / prototype)
`apps/mobile/components/today/{TodayHeroRing,TodayDashboardMacroTiles,TodayMealsSection,NorthStarBlock}.tsx`, `apps/mobile/components/nutrition/MacroStatTile.tsx`, `apps/mobile/app/(tabs)/index.tsx` (scroll `contentContainerStyle` + section-break removals ~3754-3756, 5323/5403/5481/5519/5610), `apps/mobile/constants/theme.ts` (+`Type.statValue`) + `layout.ts` (deprecate the inter-block gap tokens); web twins under `src/app/components/suppr/` + the Today scroll container. Benchmark to match (do not change): `RecipeMacroStrip.tsx`, `recipe/[id].tsx:1344`.

---

## Implementation status (2026-06-18 reconciliation)

The "build NOT started" header was stale. Auditing `main` against the 12 acceptance criteria: **every milestone M1–M6 shipped, both platforms, behind `today_tracker_tier_v1` (default-on; flag-OFF keeps the pre-ENG-1099 path verbatim).** The whole `today_tracker_tier_v1` flag is registered default-on in `apps/mobile/lib/analytics.ts:323` and `src/lib/analytics/track.ts:217`.

| Milestone | Status on `main` | Where (mobile / web) | Carried by |
|---|---|---|---|
| **M1** rhythm (24 inter-block, kill 32 section-breaks) | Shipped | `index.tsx` section breaks all `tierV1 ? 0 : Layout.todaySectionBreak` (incl. lower-fold — open-Q3 resolved toward whole-scroll 24) / web `todaySectionBreakClass` | #448, #467 |
| **M2** flat the card stack | Shipped | hero/tiles/slots/north-star `lift={tierV1 ? "flat" : "soft"}` / web flat since 2026-06-12 | #448 |
| **M3** strip macro tile + value-colour signal | Shipped | `MacroStatTile.tsx` tier path drops bar+caption, value-colour over/under, `minHeight 56`, `PressableScale` / web `today-dashboard-macro-tiles.tsx` | #448 |
| **M4** two serif tiers / stat-row `Type.statValue` | Shipped | `Type.statValue` (#448, bumped 18→22 in #457); `TodayHeroRing` Stat uses it under tierV1 / web `today-hero-stats.tsx` serif 18 under tierV1 | #448, #451, #457 |
| **M5** quiet the washes | Shipped | slot icon chip `tierV1 ? col+"12" : col+"18"`, log-usual pill `tierV1 ? colors.fillQuiet : col+"18"` / web hero chips de-tinted to text-only, slot tints, log-usual quiet | #456, #467 |
| **M6** de-chrome the meal log | Shipped | meal rows/add-food/log-usual/browse/north-star hero all `PressableScale haptic="selection"`; band-tight chip on-family `Accent.success+"1A"` / `successSolid` (off-family `rgba(34,168,96,0.10)` only in flag-OFF else) / web `todayMealRowPressClass` + `active:scale-[0.97]`, north-star `bg-success/10 text-success-solid` | #456, #467 |

**Source-pinned by tests** (break if the wiring is unwired): `apps/mobile/tests/unit/todayCohesionWiring.test.ts` (M5 slot tints + log-usual, M6 meal-row/log-usual PressableScale, RC-3 hero macro-rings toggle, RC-4 north-star sage, figma-hero PressableScale), `apps/mobile/tests/unit/todayRhythmLayout.test.ts` (M1), `tests/unit/todayCohesionWiringWeb.test.ts` (M1 `todaySectionBreakClass`, M6 meal-row press), `tests/unit/todayHeroStats.test.tsx` (M4), `tests/unit/todayCardElevationSweep.test.ts` (M2 flat-gating).

### One deliberate divergence from this spec (documented, not a gap)
- **Interactions §: "north-star CTA ('Log it') → `Success` notification (a commit)."** Code reality: the primary CTA's `onPrimaryCta` runs `router.push('/recipe/${recipeId}')` (`index.tsx:5550`) — it **navigates** to the recipe; it does NOT commit a log (the log happens later in the recipe/cook flow). Firing the iOS Success notification haptic on a pure navigation would lie ("done!" when nothing was logged). The CTA therefore stays on `SupprButton`'s default `confirm` (medium impact), which is the correct grammar for a navigation action. `PressableScale` *does* support `haptic="success"` — it's just wrong here. If the CTA ever becomes a true inline one-tap log, switch it to `success` then.

### Explicitly deferred — separate tickets (per the spec's own "Open questions")
- **Open-Q1: over-budget ring overflow arc (Skia)** — needs `@shopify/react-native-skia` (native rebuild, not OTA). Out of this OTA-able rhythm/elevation/type/colour pass by design. → still a separate ticket (route to product-lead sequencing).
- **Open-Q4: macro-identity colour AA at prototype time** — the tier tiles use the `*Solid` darker variants (e.g. `Accent.warningSolid` for amber-over) so the over-signal meets AA; confirm with a measured contrast pass during the SIM red-line.

### Still needed before the flag can be considered fully validated
- **SIM + web visual red-line** of the tier-ON state on a populated account (light + dark + cold-open/new-user), per the census "Grace red-lines the prototype" gate and `feedback_visual_validation_mandatory`. The code is in; the pixels have not been signed off in this session. This is a visual change — treat the red-line as the merge gate, not the typecheck.
