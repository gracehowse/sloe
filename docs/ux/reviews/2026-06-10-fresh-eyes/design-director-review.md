I have the full census and wall. The three heaviest off-scale spacing values are 6 (246), 12 (224), 10 (169) — together ~75% of the 875 off-scale instances. The value 12 is the critical system-level call: it's used 224 times but isn't on the scale {4,8,16,20,24,32,40}. I have everything needed. Writing the review.

---

# Design Director Review — Suppr/Sloe whole-product wall · 2026-06-10

## 0. Coverage ledger & capture provenance

**Provenance:** Captures taken 22:40–23:00 on the `claude/sloe-redesign-2026-06-04` branch, ~50 min before HEAD commit `19bbff72` (the Sloe redesign #375, which squashes the branch's redesign commits `ba10feb4`/`95067b11`/`3f4404d5`). The captures render the **Sloe aubergine system** — confirmed by cross-checking against `theme.ts:28` (`primary: '#3B2A4D'`), the macro hues, and `Elevation.cardSoft` (`theme.ts:599`). Captures are **verdict-grade and HEAD-faithful** for the Sloe system. Censuses read from current source (`docs/ux/reviews/2026-06-10-fresh-eyes/census-raw.md`).

**Reference discipline:** Mobbin/WebSearch unavailable this session. Calibrated against the saved board `docs/ux/mobbin-refs/warm-coaching-direction.md` (Julienne/Lifesum/Headspace/Fitbit pulls, 2026-06-02) — stated here per instruction rather than inventing external refs.

| Surface | Light | Dark | Web | Status |
|---|---|---|---|---|
| Today empty / populated / scrolled (×4) | ✅ | ✅ | ✅ | verdict-grade |
| Planner / Plan + scrolls | ✅ | ✅ | ✅ | ✅ |
| Library / Discover | ✅ | ✅ | ✅ | ✅ |
| Progress + scrolls / weight / recap | ✅ | ✅ | ✅ | ✅ |
| Shopping | ✅ | ✅ | ✅ | ✅ |
| Settings / profile / targets / household / sources / notifications | ✅ | ✅ | ✅ (settings) | ✅ |
| Fasting / health-sync / whats-new | ✅ | ✅ | — | ✅ |
| Paywall / onboarding step 1 | ✅ | ✅ | ✅ | ✅ |
| Log / edit-meal / move-meal / portion / calendar / meal-row sheets | ✅ | ✅ (log only) | — | ✅ |
| Recipe detail + scrolls / macro / burn / meal-nutrition detail | ✅ | ✅ | — | ✅ |
| Imports (plan/cookbook/shared) / create ×2 / barcode | ✅ | ✅ | — | ✅ |
| Landing / pricing / login | — | — | ✅ | ✅ |
| **Cook mode** | ❌ | ❌ | ❌ | **UNCOVERED** (sim input infra down — not an app bug) |
| **Onboarding steps ≥2** | ❌ | ❌ | partial | **UNCOVERED** |
| **Recipe-detail Log/portion flow** | ❌ | ❌ | ❌ | **UNCOVERED** |

Three flows uncovered, declared loudly. Everything else is the whole wall.

---

## 1. Identity verdict

**Premium — and unusually close to Flagship on the cold-open surfaces, held back from it by spacing-rhythm drift and an unrealised imagery layer.** This reads as **one product designed by one person**, and that is a genuine step-change. Crop the logo from Today, the recipe detail, the paywall, the landing — the aubergine-ink + warm-card + serif-display + single-warm-accent signature is unmistakable and carried everywhere I looked, both schemes, both platforms. The **signature exists and is real**: the multi-ring hero (`dark/02-today-populated-top.png` — plum outer + sage/clay/amber/honey macro sub-rings is the most ownable element in the category, and the over-budget ring overflowing in warm clay rather than turning red is exactly the premium treatment the brief calls the highest-leverage move — **already shipped**), the sage "Fits your day ~45%" chip (`light/25-recipe-detail.png`), the calm sparse weight chart (`light/07-progress.png`). These beat the comparables; do not sand them.

Why not Flagship yet, in one line each: (a) the **spacing rhythm is not yet measured** — 875 off-scale literals, and the warm-editorial look is now AI-default (project-context calibration note line 174), so the premium has to be *earned* in the rhythm a template can't fake, and it isn't yet; (b) the **food-row thumbnails are empty grey squares** (`light/40-log-sheet.png`) — the Julienne painterly-imagery system that would land the whole aesthetic is specced but unbuilt, leaving the single highest-traffic logging surface looking like a wireframe; (c) **three different macro-stat renderings** fight across the tabs. None of these is fatal; all are systemic.

---

## 2. Palette & colour language

**One palette, genuinely unified — this is the win of the redesign.** The aubergine system (`theme.ts:24–104`) is coherent: plum `#3B2A4D` chrome/CTA, 6-hue macro map (olive-sage protein, clay carbs, amber fat, teal fibre, honey activity, damson AI/win). The same colour means the same thing on Today tiles, Planner pills, Progress bars, recipe macros. The calorie-ring 3-state carve-out is correctly applied (`dark/02` "Over budget" pill in destructive, ring overflowing in clay/amber — **not flagged**, per project context).

The root-level finding is **not drift, it's literals**: the census found **188 hex literals outside `theme.ts`** across 41 files including six tab/detail screens (`(tabs)/index.tsx`, `progress.tsx`, `planner.tsx`, `discover.tsx`, `recipe/[id].tsx`, `library.tsx` — census lines 132–171). The rendered palette is correct *today* because those literals were hand-tuned to match the tokens — but that is exactly how the *next* redesign drifts: 188 places where the aubergine won't follow a token change. **Root cause: the redesign retinted values inline instead of routing through `theme.ts`.** Fix the class — migrate all 188 to semantic tokens — not the rendered colours (which are fine).

Colour-as-emotion is well-handled (warm gradient on the onboarding cold-open `light/32`, sage on wins, amber on over-macros). One ground-colour note settled by code, not eye: the cards read "warm grey" but are actually `#F6F5F2` warm slab on a `#FFFFFF` white page (`theme.ts:301–303`) — this **matches the Sloe white-base spec**, not a cream-canvas violation. Not a finding.

**Contrast:** `theme.ts:19–21` documents that base hues (clay 3.33:1, amber 2.96:1, sage 4.40:1 on oat) fail AA as text and that `*Solid` variants carry text — verify in the migration that the 188 literals use the Solid variants where they're text/icons, since inline hexes are where that discipline silently breaks.

---

## 3. Cross-surface consistency matrix

| Primitive | Today | Planner | Recipes | Progress | Settings | Stack screens | Verdict |
|---|---|---|---|---|---|---|---|
| Radius | mixed | card-12 | card-12 | card-12 | card-12 | — | **DRIFT** — census: radius literals 24, 22, 14, 11, 10, 9, 5, 3, 2 off-scale {4,6,8,12} (census 90–129); `SupprCard.tsx:27` = 24, `SubTabPill.tsx:102` = 9 |
| Card elevation | flat tonal (intentional) | cardSoft | cardSoft | cardSoft | cardSoft | varies | OK — one-card decision applied (`theme.ts:599`); Today deliberately flat |
| Macro-stat rendering | icon+number tile (`light/02`) | tinted P/C/F/Fi pill (`light/03`) | inline colored letters (`light/06`) + big 4-up gram row (`light/25`) | labelled bar (`light/07`) | — | — | **DRIFT — 4 renderings of one data type** |
| Header pattern | wordmark centred | screen-title left | photo+back | screen-title left | **title centred** (`light/08`) | **left** (`light/15` fasting) | **DRIFT** — centred vs left across stack screens |
| Filter chip | — | segment | **filled grey "All"** (`light/05`) | outline pills (`light/07`) | — | — | **DRIFT** — filled vs outline chip, same role (near-duplicate rule) |
| Tab/nav order | Today·Plan·＋·Recipes·Progress | — | — | — | — | — | **DRIFT vs web** — web sidebar Today·**Recipes·Plan**·Progress; web mobile bar Today·**Recipes·＋·Plan**·Progress (`today-desktop/mobile`) — Plan/Recipes swapped 3 ways |
| Spacing unit | off-scale | off-scale | off-scale | off-scale | off-scale | off-scale | **DRIFT — system-wide**, see below |

**The headline census, root-caused:** 875 off-scale spacing literals; the three heaviest values are **6 (246×), 12 (224×), 10 (169×)** — ~75% of all violations. **12 is the load-bearing system decision:** used 224 times but absent from the canonical scale {4,8,16,20,24,32,40}. This is not 224 bugs — it's **one missing scale step**. My call (confidence 8): the 8→16 jump is too coarse for chip/pill internal padding and dense meal-row rhythm, which is *why* 12, 10 and 6 keep getting reached for. **Adopt 12 into the scale as the legal dense-padding step** (→ {4,8,12,16,20,24,32,40}), then **migrate 6 and 10 onto {4,8,12}**. That single decision legalises 224 instances and leaves a tractable ~415 (6+10) to snap — versus migrating all 875 onto a scale that has a hole in it. Route to Grace as a scale decision; it's a token change, not a per-surface one.

**Intentional divergences NOT filed:** Today flat-vs-soft elevation (one-card decision), Today dark tone `#19181C`↔web (`theme.ts:347`, carve-out), onboarding step count, Go-Public/Move-meal platform splits.

---

## 4. Material & depth

**Depth model is consistent and correct** — this was a 2026-05-22→2026-06-04 fix and it landed. `cardSoft` (plum-tinted `#221B26` @ 0.16, 18px radius, y+6 — `theme.ts:592`) mirrors web `--elev-card-soft` exactly, applied as the default resting card on every tab except Today (deliberately flat-tonal). No hairline-doing-a-shadow's-job tells, no stock-component flatness. The sheets/FAB carry their own heavier shadow correctly. This is Premium-tier materiality and not a laggard surface in the set.

**The one cheap tell is not depth — it's the empty thumbnails.** `light/40-log-sheet.png` food rows and `light/05-library.png` placeholder card render **blank grey squares** where the Julienne painterly-ingredient / hyperreal-meal imagery should be (the board's single-highest-leverage move, `warm-coaching-direction.md:245`). On the app's two highest-traffic surfaces (logging + recipe library) this reads as wireframe-coloured-in, not crafted. The recipe *hero* photos that exist (`light/25`, `light/21` paywall) are genuinely premium — which makes the empty rows next to them look worse by contrast. This is the depth/material gap that costs the most first-impression weight.

---

## 5. Motion & sensory delight (haptics from code — pixels cannot show motion; stated per brief)

**Haptic census** (`grep` over `apps/mobile`): 50 `selectionAsync`, 33 `Success`, 32 `Light`, 11 `Medium`, 2 `Warning`, 1 `Heavy`. The **`Success` count (33) is healthy** — the old "Light over-reliance" gap has improved; target hits and ring-closes are likely buzzing. **Two root findings:**

1. **The canonical primitive is barely adopted.** `PressableScale haptic=` is used **5 times total (3 of them `none`)** while the app makes ~129 raw `expo-haptics` calls. The design-system primitive exists but isn't the path of least resistance — so weight discipline lives in 129 scattered call-sites instead of one prop. **Root cause: raw `expo-haptics` is still the default.** Route commit-actions through `PressableScale` with the right `haptic` weight (the write-discipline rule, `apps/mobile/CLAUDE.md`).
2. **`Light` (32×) is still over-weighted vs `Medium` (11×).** Per the brief's target distribution, most *tap confirmations* (log meal, save, toggle) want `Medium`/`confirm`, not `Light` (which is hover/preview only). 32 Lights is the residue of the old habit. Rebalance toward Medium on commits.

**Win moments:** the multi-ring close + over-budget warm-overflow is the marquee moment and the `Success`/`Warning` counts suggest it's wired — verify the **sequenced** `Medium`→80ms→`Success` on ring-hitting-100% (the brief's signature pattern) is present, not a single buzz. **Web has no haptic analog on any of these** — recommend the colour-pulse/200ms-tween confirm on web for ring-close, meal-log, and weight-log so the win lands on both platforms (`feedback_mobile_decisions_apply_to_web`).

---

## 6. THE DIRECTION (the spine — my unifying call from this wall)

If the whole product obeyed five rules, it would cross into Flagship:

1. **One spacing scale with 12 in it.** Adopt {4,8,**12**,16,20,24,32,40}; migrate 6/10 onto it. This is the single highest-leverage move — it legalises 224 instances and is the rhythm the warm-editorial look can no longer fake its way past.
2. **Every colour traces to a token.** Migrate all 188 inline hexes to `theme.ts`. The palette is right; the *plumbing* isn't.
3. **One macro-stat rendering, dialled by density** — not four. Pick the tile (Today) as canonical; derive the compact pill from the same tokens for dense surfaces; kill the inline-letters and ad-hoc 4-up variants.
4. **The painterly imagery system ships before launch.** Empty thumbnails on Log + Library are the one wireframe tell on a premium wall. This is the move that *lands* the aesthetic.
5. **Every commit-action confirms through `PressableScale`** (`Medium`/`confirm`), every win celebrates (sequenced `Success`), and **web mirrors each with a colour-pulse**. One delight grammar, both platforms.

Plus one parity rule: **lock the tab order** (Today·Plan·Recipes·Progress) identically on web sidebar, web mobile bar, and native bar — it's swapped three ways today.

---

## 7. Prioritised moves (ranked by leverage × first-impression weight)

1. **Spacing-scale decision + migration** — adopt 12, snap 6/10. Touches every surface. Generic→Good on rhythm. → Grace (decision) then `design-system-enforcer` + `executor`.
2. **Painterly imagery system on Log + Library** — cold-open + viral-hook surfaces. Premium→Flagship on material. → `ui-product-designer` (art-direction lock first) + `executor`.
3. **188 hex → token migration** — protects the unified palette from the next drift. → `design-system-enforcer`.
4. **Collapse 4 macro-stat renderings to 1 system** — daily-use consistency. → `ui-product-designer` + `design-system-enforcer`.
5. **Haptic rebalance via `PressableScale`** (Light→Medium on commits) + **web colour-pulse analogs**. Engagement. → `executor` + `sync-enforcer`.
6. **Lock tab order across all three nav surfaces** + normalise stack-header alignment + filter-chip filled-vs-outline. → `sync-enforcer` + `visual-qa`.
7. **Radius literal cleanup** (24/22/14/11/10/9/5/3/2 → {4,6,8,12}). → `design-system-enforcer`.

---

## 8. Scorecard (verdict-grade wall per ledger; censuses attached)

| Lens | Tier | One-line why |
|---|---|---|
| Identity | **Premium** | One unmistakable aubergine + serif + multi-ring signature, carried everywhere both platforms; held off Flagship by rhythm + imagery |
| Palette & colour | **Premium** | One coherent palette; the 188 inline hexes are plumbing-debt, not rendered drift |
| Consistency | **Good** | Elevation/depth unified; pulled down by 875 off-scale spacing, 4 macro renderings, 3-way tab order, chip/header drift |
| Material & depth | **Premium** | `cardSoft` model correct + web-mirrored; sole tell is empty Log/Library thumbnails |
| Motion | **Good** | Healthy `Success` count; `PressableScale` underadopted, `Light` over-weighted, no web analog |
| Delight (haptics + win moments) | **Good** | Marquee multi-ring win shipped; sequenced/commit haptics + web pulse incomplete |
| **Overall** | **Premium** | A genuinely unified, signature-bearing product; the gap to Flagship is measured spacing, the imagery layer, and one delight grammar — all systemic, all tractable |

(Next run can track: Consistency Good→Premium after the 12-scale migration; Material Premium→Flagship after imagery ships.)

---

## 9. Handoffs

- **Grace (decision):** adopt **12** into the spacing scale vs migrate-all-875 — the load-bearing call gating move #1.
- **`ui-product-designer`:** the painterly imagery system (art-direction lock first) on Log/Library; the single canonical macro-stat rendering.
- **`design-system-enforcer`:** encode the 12-inclusive spacing scale; migrate 188 hex literals + off-scale radii to `theme.ts` tokens; encode the one macro-stat component.
- **`executor`:** mechanical spacing/radius snapping behind the scale; route raw `expo-haptics` commit-calls through `PressableScale` with correct weights.
- **`sync-enforcer`:** lock tab order across web sidebar / web mobile bar / native bar (3-way swap); web colour-pulse analogs for ring-close/meal-log/weight-log wins.
- **`visual-qa`:** stack-header alignment (centred vs left) + filter-chip filled-vs-outline near-duplicates.
- **`product-memory`:** record "one spacing scale (incl. 12) / one token source / one macro-stat rendering / one delight grammar both platforms" as the Sloe design-language spine.

**Pending Notion/Linear mirror** (MCP not invoked this turn): no roadmap/decision state changed by this review — silence is correct until the move #1 scale decision lands.

All changes ship flag-gated (`isFeatureEnabled`) per CLAUDE.md — the implementer's gate, noted here.