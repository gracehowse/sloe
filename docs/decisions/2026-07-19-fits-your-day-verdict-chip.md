# "Fits your day" verdict — prototype-scale soft chip, not a solid banner (ENG-1612)

**Date:** 2026-07-19
**Area:** Recipes tab / recipe detail (web + mobile)
**Status:** Resolved
**Flag:** `recipe_verdict_chip_v1` (default-OFF on both platforms; not in `REDESIGN_DEFAULT_ON`)
**Supersedes:** [2026-06-13 — "Fits your day" verdict, confident banner (ENG-1085)](./2026-06-13-fits-your-day-verdict-banner.md)

## Context

Grace, reviewing a recipe-detail screenshot of Soothing Chicken Congee
(2026-07-19, annotated): **"fits your day is too big and agressive."** The
full-width solid-green `✓ Fits your day ≈ 20%` banner — shipped 2026-06-13
under ENG-1085 specifically to make the verdict "the loudest informational
element on the recipe detail" — overshot. A slab that wide, that saturated,
reads as a warning or a system banner, not a quiet nutrition signal sitting
above the description.

Prototype canon (`docs/ux/redesign/v3/Sloe-App.html`) never rendered it this
way. `.rd-fits` (~L2055) is an inline-flex **soft pill**: `success-soft`
background, `success` text, 11px semibold, `padding: 4px 12px`, radius full.
The card-level `.fit-tag` used on Discover/Library cards is the same scale.
Nothing in the prototype renders the verdict as a full-width solid banner —
ENG-1085 was a deliberate, documented departure from the prototype, made for
a real reason (the verdict needed presence) that turned out to overcorrect.

## Decision

Render the verdict as an **inline soft chip**, matching `.rd-fits` /
`.fit-tag`:

- **Fill:** the tone's `*Soft` tint — `successSoft` (fits ≈ half the day or
  less), `warningSoft` (over-half), `destructiveSoft` (over-a-full-day).
- **Text/icon colour:** the tone's base token, with one exception —
  `warningSoft` pairs with `warningSolid` (not the plain `warning` base,
  which is documented 2.96:1 — an AA text-fail — in `theme.ts`; mobile's
  `success`/`destructive` base tokens clear AA as text at this size, ~4.7:1
  / ~4.9:1+, matching the existing `TrustChip` soft-pill pairing). Web
  mirrors this with the `icon-box` tone-class map
  (`bg-warning-soft text-warning-solid`).
- **Layout:** inline (`alignSelf: flex-start` / `w-fit`), radius full,
  `paddingHorizontal: Spacing.dense` (12) / `paddingVertical: Spacing.xs`
  (4) — both legal spacing-scale steps, matching the prototype's
  `padding: 4px 12px` exactly. Check glyph only when the recipe fits
  (matching the prototype's single-state example).
- **Type:** 11px semibold, sentence case, no letter-spacing, no uppercase —
  `fontSize: 11` is on the mobile `Type` ramp and the web type-scale ladder
  as a raw legal step (both ramps carry 11 as a first-class size), but no
  existing named `Type.*` role matches "11px semibold, no transform" exactly
  (`Type.caption` is 500-weight, `Type.label`/`Type.statLabel` are
  uppercase/tracked). The style is constructed inline against the legal
  `11` literal rather than forcing an existing eyebrow/label role's
  transform onto sentence-case verdict copy — flagged here rather than
  silently reusing a mismatched token.
- **Tri-state semantics + the ≈% figure are unchanged** — still the shared
  `computeFitsYourDayVerdict` in `src/lib/recipe/recipeDetailLayout.ts`. Only
  the presentation changed.
- Still a **verdict surface, not a CTA** (`accessibilityRole="text"` /
  `role="status"`, no tap target) — unchanged from ENG-1085.

### Why flag-gated, and why default-OFF

Per `docs/decisions/2026-05-13-session-replay-and-feature-flags.md`: a
full-width banner shrinking to an inline chip is a real layout/visual shift on
a launch-critical surface (Recipes tab is dual-initiative — Launch
2026-07-01 + Surface polish), so it ships gated. Default-OFF (not the
"redesign default-on" convention some 2026-06/07 flags used) because:

1. No device/sim visual validation landed in the change that introduced this
   flag — the ios-simulator MCP tooling was unavailable in that session, and
   the web app requires an authenticated session (Recipe Detail is not
   reachable from an unauthenticated route) that this session was not
   permitted to fabricate against prod Supabase. Verification there was
   token/contrast math + source-pin tests only.
2. Recent adjacent-era precedent (`referral_invite_loop_v1`, ENG-1541) ships
   default-OFF when a real precondition (there: entitlement wiring; here:
   device-verified visual pass) isn't yet met — the safe default absent that
   signal.

Flag-on renders the soft chip; flag-off keeps the ENG-1085 confident SOLID
banner alive as the kill switch (nothing from that ruling was deleted, only
gated). Grace ramps in PostHog after a TestFlight/device pass. Once the flag
holds 100% for two weeks with no regression, the legacy banner branch can be
removed in a follow-up cleanup PR (mirroring the ENG-1356 collapse that
retired ENG-1085's own predecessor pill).

## Files

- `apps/mobile/components/recipe/RecipeTitleBlock.tsx` — chip (flag-on) +
  ENG-1085 banner (flag-off); already an extracted component, unaffected by
  the screen-line-budget ratchet.
- `src/app/components/recipe/RecipeFitsYourDayVerdict.tsx` — **new**. Web
  had no equivalent extraction (the verdict was inline in the
  `RecipeDetail.tsx` monolith); adding the chip branch there would have
  pushed a `check:screen-budget`-pinned file (3527 lines) further over
  budget. Extracted the verdict (chip + legacy banner, both branches) into
  its own component — mirrors the mobile architecture. `RecipeDetail.tsx`
  net-shrank to 3502 lines as a result; re-pinned lower with
  `npm run check:screen-budget:write`.
- `src/app/components/RecipeDetail.tsx` — now just computes `verdict` via
  `computeFitsYourDayVerdict` and renders
  `<RecipeFitsYourDayVerdict verdict={verdict} />`.
- `apps/mobile/app/recipe/[id].tsx`, `src/app/components/RecipeDetail.tsx` —
  updated the stale ENG-1085/ENG-1356 carve-out comment near
  `recipeDetailV3` to point here.
- `apps/mobile/lib/analytics.ts`, `src/lib/analytics/track.ts` —
  `recipe_verdict_chip_v1` registered in the default-OFF discoverability
  block (not `REDESIGN_DEFAULT_ON`).
- Tests: `tests/unit/recipeDetailLayoutWeb.test.tsx` (now reads the
  extracted `RecipeFitsYourDayVerdict.tsx` for the structural pins, plus a
  wiring check on `RecipeDetail.tsx`), `apps/mobile/tests/unit/recipeDetailV3SourcePins.test.ts`
  — both re-pinned for the two-branch (chip / banner) flag-gated structure.

## Verified

No ios-simulator MCP tooling was connected in this session (checked via
`ToolSearch` before claiming otherwise), and the web app's recipe-detail
surface requires an authenticated session with no unauthenticated
demo/preview route — creating a throwaway account to reach it is prohibited
regardless of the Cursor-Cloud dev convention documented elsewhere in
`CLAUDE.md`. Verification here is precise token/contrast arithmetic (padding
4/12 = `Spacing.xs`/`Spacing.dense`, both on-scale; radius full = legal;
11px = a raw-legal step on both ramps; `warningSoft`/`warningSolid` pairing
chosen over the AA-failing plain `warning` per the documented 2.96:1 contrast
note in `apps/mobile/constants/theme.ts`) plus the re-pinned source-string
test suites on both platforms. A device/sim visual pass is a precondition for
ramping the flag past 0% — tracked by leaving the flag default-OFF, not by a
follow-up ticket, since the flag itself is the tracking mechanism.
