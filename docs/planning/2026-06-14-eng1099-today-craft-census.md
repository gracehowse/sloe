# ENG-1099 — Today tracker craft-gap census (the brief)

**Date:** 2026-06-14 · **Status (updated 2026-06-18):** **brief delivered; M1–M6 SHIPPED to `main` behind `today_tracker_tier_v1` (default-on), both platforms.** See the per-milestone reconciliation table in `docs/planning/2026-06-14-eng1099-tracker-redesign-spec.md` → "Implementation status (2026-06-18 reconciliation)". Remaining: SIM/web visual red-line on a populated account + two explicitly-deferred follow-ups (Skia overflow arc, macro AA contrast measure). · **Source:** ui-critic tier diagnosis + visual-qa forensic census (parallel lanes), cross-checked against the live `RecipeDetail` benchmark + a captured Today render (`screenshots/web-drive/today-tall-calmoff.png`).

## Why this exists
The 2026-06-13 "two personalities" review scored Today's **tracker half a 7** and the **recipe-detail screen a 9**. Decision (`docs/decisions/2026-06-13-keep-today-centre-premium-frame.md`): **close the gap by raising the tracker to recipe-tier craft — subtractive cohesion, NOT new chrome; numbers stay visible; single-hero cap holds; zero IA change.** iOS leads, web parity. This doc is the brief for that rebuild — diagnosis only.

## Verification note (don't trust agent text)
Spot-checked the headline findings against code before writing this:
- ✅ **Confirmed real:** band-tight chip uses an off-family green `rgba(34,168,96,0.10)` (`NorthStarBlock.tsx:575`) — pre-Sloe green, not sage `#5E7C5A`; `MacroStatTile` carries a per-tile **progress bar + caption line** on top of value+target (`MacroStatTile.tsx:138,158`); the meal section has **0 `PressableScale`** across 24 `Pressable`s (`TodayMealsSection.tsx`).
- ❌ **False positive — discarded:** "`macroTileGridGap: 12` is off the 4pt scale" (`layout.ts:35`). **12 is a valid token** (`Spacing.dense`, adopted 2026-06-10 ENG-1012). The layout.ts comment is stale. Any visual-qa finding that flags 12 as off-scale is wrong — filter them out.

## The tier diagnosis — why the tracker reads one tier below
The recipe screen earns the 9 with **one loud editorial spine, a calm 24pt grid, content-on-ground, and a single confident accent.** The tracker reads 7 because it's **a stack of competing self-contained cards at an uneven rhythm, each re-deciding its own type and accent.** Concretely:

- **A. Cramped, inconsistent rhythm.** Recipe body = one airy cadence (`padding/gap: Spacing.xl 24`). Today runs 8 / 12 / 20 / 32 across the hero→macros→meals stack with no governing logic. This is most of the "two personalities" seam.
- **B. All boxes vs content-on-ground.** Recipe = title/macro-strip/meta flat on cream, card only for description/source. Today = hero card + 4 macro cards + 4 meal cards + north-star card — a column of ~7+ soft-lifted slabs reads "dashboard," not "premium." (The flat-card sweep already started this — finish it.)
- **C. No single type spine.** Recipe = serif 34 title → serif 24 macros (two clean tiers). Today shows five mid-tier serif sizes on one scroll (17 / 19 / 20 / 24 / 48) — nothing is clearly the second tier.
- **D. No confident accent.** Recipe commits to one solid `Fits your day` banner. Today is all 10–18% washes (status chip, slot pills, macro bars) — restraint-only tips into timid; there's no one loud, decisive note besides the ring numeral.
- **E. Macro tile over-decorated (clearest like-for-like loss).** Same P/C/F data: recipe `RecipeMacroStrip` = one slab, serif value + small-caps label, hairline-divided. Today `MacroStatTile` = 4 separate cards each with label+icon+value+unit+/target+**bar**+**caption** = a 2×2 of mini-dashboards.
- **F. Meal log is the heaviest region.** 4 soft-lift cards, 32pt tinted icon chips, slot-tint washes, in-card pills — where the recipe's equivalent (steps list) is its calmest.

## The moves — subtractive-first, ranked by first-impression leverage
Every move REMOVES or coheres; none adds chrome. Guardrails called out.

1. **M1 — Unify the scroll rhythm to one cadence (~`Spacing.xl` 24).** Cold-open, pure subtraction. Collapse 8/12/20/32 into one governing rhythm matching the recipe body. *Highest leverage — this is the seam.* (In-bounds: no IA, no numbers touched.)
2. **M2 — Flat the card stack; group with whitespace + hairlines.** Cold-open. Drop the soft lift across hero/macro/meal/north-star so the column stops floating. Finishes the 2026-06-12 flat-card direction. (In-bounds: single-hero cap holds — hero stays largest, just not shadow-floated.)
3. **M3 — Strip the macro tile to the recipe-strip pattern.** Cold-open/daily-use. Remove the per-tile **bar + caption**; keep serif value + `/target` on one hairline-divided slab. **Guardrail: numbers stay visible** (value+target remain); move the over/under signal to value colour (recipe-strip precedent), don't re-add a chip. *Open call for ui-product-designer: the macro-tile colour-signal.*
4. **M4 — Collapse the five mid-tier serif sizes toward two.** Cold-open. Ring numeral (48) = tier 1; resolve the rest to one secondary + one supporting ramp step. Retire ad-hoc `fontSize: 19/20` to ramp steps.
5. **M5 — Quiet the washes so the ring is the one confident note.** Daily-use. De-tint status chip + slot pills toward neutral so nothing competes with the plum numeral. *Out-of-bounds: do NOT add a new solid accent to "match" the recipe banner — that's net-new chrome. Quiet the competition, don't add a competitor.*
6. **M6 — De-chrome the meal log to a flatter list grammar.** Daily-use. Dial down per-slot tinted icon chip + slot-tint washes; keep `SlotMacroChips` grams (numbers stay). The ENG-1091 legacy layout, de-chromed.

**M1+M2 are coupled** — pick cadence + elevation together; rhythm reads differently flat vs lifted.

## Forensic drift list (feeds the cohesion pass) — confirmed classes
From the visual-qa census (filtered for the `12` false positive + the on-photo colour carve-outs, which are intentional). Six root-cause classes, highest-count first:

- **RC-1 — Ramp overrides (~15):** spreading `Type.*` then overriding `fontSize`/`fontWeight` with literals (loses `fontFamily`, breaks on ramp change). E.g. `TodayHeroRing.tsx:127` (`fontSize:19`), `MacroStatTile.tsx:116` (`20/24` orphaned from `Type.macroValue`/`Type.heroValue`), `NorthStarBlock.tsx:754` (literal 24/28/500 == `Type.title`). Fix: add a ramp step, never override.
- **RC-2 — Sub-4px micro-gaps (~7):** `marginTop:1/2`, `gap:2`, `paddingVertical:2` — exist only in the tracker, none in the benchmark. → 0 or `Spacing.xs`.
- **RC-3 — Missing `PressableScale` on tracker interactives (~9):** meal rows, Add-food pill, Log-again, Save-as-usual, usual-picker, NorthStar hero card, Browse link, macro-rings toggle, copy-yesterday — all plain `Pressable`; benchmark uses `PressableScale`. **Single biggest tactile gap.** (P1: meal rows + NorthStar hero card.)
- **RC-4 — Off-token rgba/`#000` literals (~7):** worst is the off-family green `rgba(34,168,96,0.10)` (`NorthStarBlock.tsx:575`); rest are correct ink/success family but un-tokenised (`LogSheet.tsx:570,584`, `TodayMealsSection.tsx:479`). On-photo whites/lilacs are an intentional carve-out — leave.
- **RC-5 — Off-scale web spacing (~7):** `px-3.5 / py-2.5 / gap-1.5 / py-1.5` fractional Tailwind steps with no mobile equivalent → snap to 4/8/12/16. A locked Tailwind `spacing` config (disable fractional steps) prevents the class.
- **RC-6 — Off-scale radius (~5):** 14/11 (action-sheet) → `Radius.xl` 12; circular affordances (6.5, 32) → `Radius.full`.

## Cross-platform mismatches to fix in the same pass
Hero stat size (mobile `19` vs web `18`), slot-header padding (mobile 12/12 vs web 14/10), slot macro-chips gap (8 vs 10), Add-food/Log-usual gap (8 vs 6), slot-pill padding (8 vs 6). Both surfaces drift independently — converge on tokens.

## Next (where the brief ends)
1. ui-product-designer: turn M1–M6 into a rendered prototype (the macro-tile colour-signal in M3 is the one open design call). **HTML/prototype before code (G3.5 gate).**
2. Grace red-lines the prototype (light + dark + a sparse/new-user cold-open — the empty-ring + north-star states change the first impression materially).
3. Build behind a flag, iOS-led + web parity, on a populated-account capture wall.
4. A `no-restricted-syntax` lint on inline `fontSize`/`fontWeight` + a locked Tailwind spacing config would prevent RC-1/RC-5 recurring (write-time, per the UI write-discipline contract).
