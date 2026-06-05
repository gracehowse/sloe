# Today — Stitch measured-spec pass (coach plum/17px, ring 48px, macro bars back, hero padding)

- **Date:** 2026-06-04
- **Area:** Today tab — hero ring + macro tiles + coach line (mobile)
- **Status:** Resolved
- **Related:** SLOE Today re-skin reference `docs/prototypes/stitch-sloe/today.html`
  (the canonical Today mock), `docs/decisions/2026-06-03-today-week-strip-minimal-current-day.md`,
  `docs/decisions/2026-06-04-plum-nav-clay-content-cta-split.md`

## Problem

A founder pixel-comparison of the live mobile Today against the Stitch mock
(`today.html`, treated as THE Today reference) surfaced four measured gaps:

1. The coach line under the ring renders **grey 14px**; the mock is plum,
   italic, ~17px (`font-headline italic text-[17px] text-plum/90`).
2. The ring centre numeral is **36px**; the mock is `text-5xl` (~48px).
3. The macro tiles have **no progress bar**. The mock's tiles each carry a
   thin `h-1 … rounded-full` macro-coloured bar under the value. The bar was
   dropped in an interim "Figma 01" pass on mobile; the founder wants it back.
4. The hero card uses `paddingHorizontal: 16`; the mock is `p-6`.

## Decision

Apply all four, scoped to the mobile Sloe Today surfaces:

1. **Coach line → plum + 17px.** `Type.coach` fontSize 14→17, lineHeight 20→23
   (serif-italic family unchanged). `TodayDeficitInsight` colour switched from
   the grey `textSecondaryColor` to **plum**, dark-aware: light `#3B2A4D`
   (`MacroColors.calories`) / dark `#815E91` (the lifted plum `StatusChip`
   already uses), so the line stays legible on the dark Today surface. The
   now-dead `textSecondaryColor` prop was removed (single call site updated).
2. **Ring centre → 48px.** `Type.ringValue` fontSize 36→48, lineHeight 36→48
   (serif family + `-0.5` tracking unchanged). The numeral is a single
   unconstrained `Text` overlaying the SVG, so it never wraps; slight overlap
   of the side macro arcs matches the mock's own look. `ringValueLg` (56) is
   untouched. **44px is the documented fallback** if a capture shows crowding
   on the narrowest device (ring `SIZE = min(W·0.53, 230)` ≈ 208 on iPhone 17).
   The two collateral `Type.ringValue` consumers that are NOT the hero ring —
   `TodayActivityBonusCard` net headline and `WinMomentPlayer` pct — pin their
   own `fontSize: 36` at the call site, so the bump lands only on the ring and
   doesn't silently resize unmeasured surfaces.
3. **Macro tile progress bar — re-added.** Under each tile's value row:
   a frost-mist track (light `#EDEAF1` / dark `cardBorderColor`) with a
   macro-identity-coloured fill at `min(current/target, 1) · 100%`, `height 4`,
   full radius, `marginTop: Spacing.sm`. Identity colour never flips to
   amber/red on over (over-budget signalling is the calorie ring's job).
   `referenceOnly` macros (sugar/sodium — generic reference, not a personal
   target) render the fill at `opacity 0.45` so the bar never reads as a hit
   goal.
4. **Hero padding 16→20.** `TodayHeroRing` `paddingHorizontal` `Spacing.md`
   → `Spacing.lg`.

## Explicitly UNCHANGED (founder-confirmed correct, do not "fix" toward the mock)

- **Status chip (superseded 2026-06-04):** this note said **"On track"** and
  rejected mock **Under budget**. Product direction now ships **Under budget**
  / **Over budget** on the hero chip only — see
  `docs/decisions/2026-06-04-today-status-chip-budget-labels.md`. Other
  Today surfaces still avoid those phrases via `FORBIDDEN_TODAY_PHRASES`.
- The week strip stays **minimal** (clay number + dot, no filled clay pill)
  per `2026-06-03-today-week-strip-minimal-current-day.md`. The mock's filled
  pill is the OLD design.
- The greeting's date-label-on-past-days behaviour is unchanged.

## Web ↔ mobile parity

- **Macro tile bar (#3): parity RESTORED.** Web
  (`src/app/components/suppr/today-dashboard-macro-tiles.tsx`) never lost the
  bar (it carries an `h-[6px]` track + `%`-width fill). Mobile had lost it; this
  change brings mobile back in line with web.
- **Coach line (#1): mobile-only surface.** Web Today has **no**
  `TodayDeficitInsight` (documented in `NutritionTracker.tsx`). No web
  counterpart to keep in sync.
- **Ring 48px (#2) + hero padding (#4): mobile Sloe Today is ahead of web.**
  Web Today still renders `DailyRing` (centre numeral `text-[36px]` under
  `redesign_motion`, `text-[22px]` flag-off) and the prototype-2026-04-19 hero
  grammar — it has **not** been migrated to the Stitch/Sloe redesign that
  mobile is on. Bumping web's ring/padding in isolation would create a worse
  half-migration of a screen that's otherwise on the older grammar.

  **Follow-up (NOT a silent deferral):** the web Today → Stitch/Sloe migration
  is a separate, larger workstream (ring sizing, hero card, coach line, tile
  treatment all move together there). Route to `sync-enforcer` to confirm /
  open the web-Today-Sloe parity item. iOS leads the Sloe redesign; web
  follows in parity, per `project_ios_primary_surface`.

## Tests

- `apps/mobile/tests/unit/todayMacroTilesProgressBar.test.tsx` (new) — renders
  the tiles and pins the bar back as observable behaviour: every tracked macro
  renders its bar, fill width = `min(current/target,1)·100%`, over-target
  clamps at 100%, and a `referenceOnly` macro (sugar) renders the de-emphasised
  `opacity 0.45` fill.
- `apps/mobile/tests/unit/macroColorConsistency.test.ts` — was already RED on
  `main` (it expected the `const barColor = def.color` line the Figma-01 pass
  removed); now green again with the bar restored.
- `apps/mobile/tests/unit/designTokensPhase1.test.ts` — added explicit pins for
  `Type.ringValue` (48/48), `Type.ringValueLg` (56, untouched), and
  `Type.coach` (17/23). Also aligned the pre-existing stale `Type.title`
  assertion (700/-0.5 → the shipped SLOE serif 400/-0.3 — incidental drift fix,
  unrelated to the four changes; the SLOE font pass had changed the token
  without updating the test).
