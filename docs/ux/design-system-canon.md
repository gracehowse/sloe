# Sloe design-system canon — the single cohesion source of truth

**Status:** Living. This is THE reference every visual wave checks against. If a
surface disagrees with this doc, the surface is wrong (or this doc is out of
date and must be updated in the same change — never silently diverge).

**Why this exists.** Drift creeps in when each surface re-derives its own
card/button/chip treatment. The serif-on-a-button miss (2026-06-12) happened
because a primitive was declared done by checking "is it tokenized?" instead of
"is this the right token, judged next to its siblings and the reference?" This
doc + the cohesion gate below make that question mandatory.

**Reference bar (Mobbin, re-checked each wave):** Withings Health Mate
([home](https://mobbin.com/screens/3e0d9ab3-1658-4490-8738-6c7f90940729),
[measure](https://mobbin.com/screens/5ee3baa3-689f-4248-8ba8-69aaec2a6c1f)),
Alma ([flat card + solid CTA](https://mobbin.com/screens/d5d1920d-5970-4437-92d8-e9097400bac1)),
Alan, pliability. We match their *grammar* (flat surfaces, solid primary, sans
controls), not their palette — Sloe's aubergine-on-cream is the differentiator.

---

## The two laws (memorize these — they catch most drift)

1. **Control vs editorial type.** Newsreader **serif** is EDITORIAL only:
   screen/section titles, the big hero numbers. Inter **sans** is EVERY
   interactive control: buttons, chips, pills, inputs, tabs, segmented labels,
   toggles, list rows. **A serif on a control is a defined error.**
2. **Flat surfaces, contrast separates.** No drop shadows / borders on resting
   cards. Separation comes from fill-vs-ground contrast. Shadows are reserved
   for *transient* surfaces only (sheets, modals, popovers, toasts, the FAB).

---

## Tokens & treatments (the canonical table)

| Element | Treatment | Token(s) | Notes |
|---|---|---|---|
| **Page ground** | cream | `--background` #FBF8F3 / mobile bg | the warm ground; NOT pure white |
| **Resting card** | flat white, no shadow, no border | `--card` #FFFFFF / `useCardElevation` flat | white-on-cream contrast is the separation (`docs/decisions/2026-06-12-flat-card-surfaces.md`) |
| **Card radius** | 24 | `CARD_RADIUS`/`TILE_RADIUS` (carve-out, not on the 4-12 scale) | cards AND macro tiles |
| **Nested affordance fill** | quiet grey | `--fill-quiet` #F2EFE9 / `Colors.fillQuiet` | add-rows, "show all", inside a white card only — never standalone on cream |
| **Dark card** | tonal fill, no shadow/hairline | `--card-elevated` / `cardElevated` | fill IS the separation in dark too |
| **Transient surface** (sheet/modal/popover/toast/FAB) | KEEPS elevation | `--elev-card-soft` / `Elevation.cardSoft` | the ONE place shadow is allowed |
| **Primary CTA** | SOLID aubergine pill, white sans label | `accent.primarySolid` #3B2A4D, `Radius.full`, `Type.button` (Inter SemiBold 16), no border/shadow | exactly ONE per screen (FAB + paywall excepted); `SupprButton variant="primary"`; disabled opacity 0.65 (ENG-1011 floor); loading = spinner + block |
| **Secondary CTA** | GHOST: transparent, no border, plum sans label | `accent.primarySolid` label, `Type.button` | `SupprButton variant="ghost"`; replaces all old outline + beige `colors.card` CTAs |
| **Filter / option chip** | rounded-full, quiet fill at rest; selected = primary-soft fill + plum label, NO ring | `Radius.full`, `--card`/`colors.card` (rest) → `--primary-soft`/`accentSoft` (selected) | §7 grammar; same on web + mobile. Rest = the white card fill on the cream ground (the white-on-cream contrast IS the quiet-fill read post the 2026-06-10 inversion — Library + Discover share this exactly); the border is gated through `cardElevation.useBorder` (dead → flat-card decision) so NO light-mode ring. Selected border == fill colour, never a solid accent ring. (ENG-1082, 2026-06-13) |
| **Segmented control** | one container; active thumb = its own fill treatment (NOT a button) | per `ProgressPeriodControl` | active thumb is a *state*, leave its subtle lift |
| **Quick-action pill** (water +100, portion ×) | quiet-fill pill, sans | `--fill-quiet`, `Type.body`/sans | inside white cards only |
| **Input** | quiet fill or hairline, sans value | sans | never serif |
| **Accent** | aubergine `#3B2A4D` / lift `#5B3B6E` | `accent.primary*` | clay `#C9892C` survives ONLY as carbs/warning; never "the accent" |
| **Calorie ring** | empty=gradient, under=success, over=destructive | locked (`feedback_calorie_ring_colour_mapping`) | stroke == macro-ring stroke (F-164) |
| **Macro colours** | protein sage / carbs clay / fat honey / fibre teal | `MacroColors` | canonical v4 |

**Spacing** snaps to 4/8/12/16/20/24/32/40 (`Spacing.dense`=12). **Radius**
snaps to 4/6/8/12/full (card/tile 24 carve-out). **No literal hexes at call
sites** — values live in the token files only.

---

## The cohesion gate (run before any visual surface is "done")

For every primitive or surface a wave touches:
1. **Render it** (sim + web; light AND dark). Read the PNG — never claim a pass from the test tree or ARIA alone.
2. **Place it beside (a) its nearest in-app sibling and (b) the Mobbin reference.** Ask: *does this belong to one system?* If a button, chip, card here looks like a different app's part than the screen above it — it's drift.
3. **Run the two laws** against it (serif-on-control? shadow-on-resting-card?).
4. **Check the canonical table** — does each element use the listed token/treatment? A different value = either fix it or update this doc with the reason.
5. Only then: tokenized + tested + captured = done.

A wave's review phase includes a `design-director`/cohesion pass that does exactly this across the wave's surfaces, Mobbin-referenced.

---

## Known cohesion debt (audit-tracked, drains over the visual waves)

From the 2026-06-13 whole-product cohesion read (sim captures in
`docs/audit/captures/2026-06-13-cohesion/`, Mobbin-grounded). Ranked; each → a
wave. Today (top + meals) PASSES — flat white cards, quiet-fill add rows,
solid Complete Day, consistent type. Drift is concentrated:

**HIGH — breaks "one system" on sight**
1. ~~**Plan: Generate + Adjust constraints are still outline/beige buttons**~~
   — DRAINED (ENG-1080, 2026-06-13 cohesion wave). The Plan summary-card CTAs
   migrated onto `SupprButton`: Generate = solid `primary` (white sans label +
   white icon), Adjust constraints = `ghost` (plum sans label + plum icon). The
   retired hand-rolled outline (`borderColor: accent.primarySolid`) + beige
   (`colors.background` fill) treatment is gone — the `summaryPrimaryBtn` /
   `summarySecondaryBtn` overrides are now layout-only (SupprButton owns
   fill/border/radius/padding). Generate keeps its `loading={generating}`
   no-double-submit wiring and the ▾ menu trigger. Pinned by
   `apps/mobile/tests/unit/planSummaryCtaButtonSystem.test.ts`. **Web parity
   landed in the same wave:** all three `MealPlanner.tsx` CTA sites (empty-state
   Generate, week-summary card, bottom CTA row) route through the web
   `SupprButton` — Generate/Regenerate = solid `primary`, Shopping list =
   `ghost`. The retired aubergine OUTLINE pill (`border-[1.5px]
   border-primary-solid`) and the beige `bg-card border border-border`
   secondary slab are gone. Generate keeps its `loading={isGenerating}`
   no-double-submit wiring + source-blocked `disabled`. Pinned by
   `tests/unit/plannerButtonSystemWeb.test.ts`.
   **One-CTA enforcement (follow-up fix, same wave):** making all three web
   sites SOLID exposed two latent one-CTA-law breaks the outline treatment had
   masked — on the empty plan the empty-state Generate co-rendered with BOTH
   the bottom CTA row AND the "Plan your week" summary card, stacking 2–3 solid
   primaries. Fixed: the bottom row now hides on `showSummaryCard || isPlanEmpty`,
   and the big empty-state card gates on `isPlanEmpty && !showSummaryCard` so it
   yields to the summary card (which then leads with the kanban's empty day
   columns + add chips — exact mobile parity). The summary-card verb flips
   `planHasRealMeals ? "Regenerate" : "Generate"` (DC12). Verified on the live
   web empty plan: exactly ONE solid primary. The mobile setup-card
   `generateBtn` (bespoke 7-dot loader) flipped outline→solid in the same wave
   (stays a styled Pressable by design — the shared primitive's spinner can't
   express the 7-dot ribbon; documented divergence).
2. ~~**Progress: "This Week" maintenance card is grey while the adjacent
   "Average Adherence" card is white**~~ — DRAINED (ENG-1081, 2026-06-13
   cohesion wave). No genuine drift remained: on both platforms every
   page-ground Progress card (Weight, Maintenance, Daily calories, Average
   Adherence) routes its fill through the one card primitive
   (`useCardElevation` on mobile, `SupprCard` on web), which resolves to white
   `colors.card` / `--card` in light. There is no grey same-rank card to
   re-fill — the grey-vs-white split the audit snapshot described was already
   closed by the flat-card primitive migration. The Sloe Pro upsell banner
   (Settings, both platforms) stays a deliberate `accent.primarySoft` /
   `--primary` 16% tint — a sanctioned conversion-surface accent, NOT a
   same-rank content card, so it is intentionally left tinted.

**MEDIUM**
3. ~~**Discover filter chips inconsistent**~~ — DRAINED (ENG-1082,
   2026-06-13). The chips were already §7-shaped, but the rest chip carried an
   unconditional light-mode hairline RING the identical Library row does not.
   Border now gates through `cardElevation.useBorder` (dead → flat-card
   decision) on both pill rows, so they render byte-identical: flat quiet card
   slab at rest, `accentSoft` tint + `accentInk` label selected, no ring. Web
   (`DiscoverFeed.tsx`) already converged under ENG-1022. Pinned by
   `discoverThreeSectionLayout.test.ts`.
4. ~~**Discover "Import from TikTok…" banner**~~ — DRAINED (ENG-1082,
   2026-06-13). Decision: it's a **deliberate soft-tint affordance** (Sloe
   treatment §10), NOT a white card — it's the import nudge and should stand
   apart from the white recipe cards. Converged on both platforms to a
   token-sourced `accent.primarySoft` / `--accent-primary-soft` fill (mobile
   dropped its off-token `t.accent + "08"`/`"22"` literal hexes) with NO border
   (flat-surface law: the soft tint IS the separation), radius matched to the
   sibling card grammar.
5. **Pill census** — water +100/+250 and the meal-row add affordance use
   `colors.fillQuiet` (the §7 quick-action quiet-fill grammar — confirmed
   consistent, 2026-06-13). Discover/Library filter chips now share the §7
   treatment exactly (item 3). **One outlier to converge in the LogSheet lane:**
   the LogSheet `slotPill` ("Log to Breakfast/Lunch/…") still uses a
   `transparent` rest fill + hairline border, where the filter chips use a
   quiet `colors.card` rest + no ring — both call themselves §7 round option
   chips but don't render identically. The slot pills are a `flex: 1`
   one-of-N row (closer to a §8 segmented selector), so the convergence call
   belongs to the Today/LogSheet lane, not Discover. (ENG-1082)

**Process:** every visual wave's review phase now runs the cohesion gate
(render → beside sibling + Mobbin → two laws → canonical table) before "done".
