# ENG-828 — `text-primary` on a `bg-primary/N` tint: dark-mode AA fix

**Date:** 2026-06-29
**Status:** Implemented
**Scope:** web (`src/app/components/**`) + mobile (`apps/mobile/components/**`)
**Related:** ENG-1109 / ENG-1217 (the macro `-solid` discipline this mirrors),
`docs/decisions/2026-06-08-aubergine-accent-system.md` (the token system),
`docs/decisions/2026-06-23-muted-text-contrast-macrofactor-route.md` (muted-ink AA fix).

## The ticket premise was stale

ENG-828 described `text-primary` (`#588ce4`) on a `bg-primary/10` fill
(`#ebeff4`) measuring **2.89:1** — failing WCAG AA — with a mobile twin of
`colors.tint` text on a `tint + "1A"` fill.

That blue palette no longer exists. The Sloe v3 migration replaced the blue
8-slot lock with the deep-plum aubergine family. Under the **current** tokens:

| Surface | `text-primary` (= `--primary` FILL hue) | on `bg-primary/10` |
|---|---|---|
| Light (`--primary` `#3B2A4D`) | deep plum | **10.79:1 — PASS** |
| Dark (`--primary` `#7E5C92`) | lifted plum FILL | **2.81:1 — FAIL** |

So the light-mode failure the ticket described was already resolved by the v3
reskin. **The real, current defect is dark mode**: Tailwind's `text-primary`
maps to `--primary`, which is the primary *fill* hue. In dark that fill is the
OLED-lifted `#7E5C92`, which reads only ~2.8:1 as small text on its own soft
tint — below AA-normal (4.5:1) and below even the 3:1 graphical bar for an
icon-in-disc.

## The fix (mirrors the macro `-solid` discipline)

Ink the chip/badge/pill label or icon with **`text-primary-solid`**
(`--primary-solid` → `#3B2A4D` light / `#C4ACD0` dark), not the bare fill hue.

- **Light is a pixel-identical no-op** — in `:root`, `--primary-solid` ===
  `--primary` (both `#3B2A4D`). The swap changes nothing in light.
- **Dark lifts the text** from `#7E5C92` (2.81:1) to `#C4ACD0` (7.44:1 on the
  tint, 8.15:1 on the dark card) — AA PASS in both contexts.

This is exactly the pattern ENG-1109/1217 used for the macro tiles
(`text-macro-*-solid`), and it is what
`docs/decisions/2026-06-08-aubergine-accent-system.md` already prescribed for
selected pills ("`bg-primary/10` + `text-primary-solid` label"). Many chips had
drifted back to the bare `text-primary` — this sweep re-enforces the rule.

### Mobile twin

`useAccent()` already returns a scheme-resolved palette: `accent.primary`
(`#3B2A4D` light / `#7E5C92` dark, the FILL) and `accent.primarySolid`
(`#3B2A4D` light / `#C4ACD0` dark, the AA-safe text/icon). The mobile fix swaps
small-text-on-tint usages of `accent.primary` → `accent.primarySolid`, the
direct twin of the web class swap. (`Badge.tsx` `pro`/`custom`, `HouseholdBar`
selected chip + Manage link, `PortionPicker` unit pill/chips/rows, `StreakPip`
active pip — the last also reads `colors.tint` #5B3B6E whose dark text-on-tint
was 1.77:1; it now reads `primarySolid` and converges to web's active-streak
ink.)

## Why a measured swap, not a token redefinition

`--primary` / `accent.primary` is the brand *fill* hue and is correct as a
3:1-graphical FAB / border / ring fill (the lifted `#7E5C92` is the intended
dark fill). Darkening it would wreck the FAB identity. The fill-vs-text split
(`--primary` vs `--primary-solid`) is the deliberate Sloe pattern; this change
respects it rather than collapsing it.

## Scope boundary (flagged, not silently expanded)

This sweep fixed the **chip/badge/pill class**: `text-primary` co-located with
a `bg-primary/N` tint fill (the ticket's stated target).

A **larger, related class exists**: `text-primary` / `accent.primary` used as
small text on the **dark card or page** (no tint) — e.g. ghost-link CTAs.
`#7E5C92` on the dark card is 3.08:1 (FAIL); the dark background is 3.50:1
(FAIL). These are out of ENG-828's stated scope (they'd touch every primary
ghost link app-wide) and are tracked as a follow-up — see the ENG-828 Linear
comment. The sweep DID route the handful of on-card primary CTAs that already
carried a `hover:bg-primary/N` to `-solid` (free dark-card win, light no-op).

## Regression guard

Measured-contrast guards, following the `eng1109MacroContrastCensus` pattern:

- `tests/unit/eng828PrimaryTintContrastCensus.test.ts` (web suite; reads both
  `theme.css` and the mobile `theme.ts`) — pins the bare-fill dark failure,
  the `-solid` AA pass in both schemes, web↔mobile token parity, and the
  canonical call sites (`badge.tsx`, `icon-box.tsx`, mobile components).
- `apps/mobile/tests/unit/eng828PrimaryTintContrast.test.ts` (mobile suite) —
  pins the mobile token ratios + call sites.

## One test adjusted (not silenced)

`tests/unit/householdButtonSystemWeb.test.ts`'s `OUTLINE_LABEL = /text-primary-solid/`
regex (ENG-1080 button cohesion) was too broad: it forbade the *retired
outline-pill CTA* but matched any `text-primary-solid`, including the
now-legitimate chip ink. Tightened to require the retired pill's
`border-[1.5px] border-primary-solid` OUTLINE edge to co-occur — the guard
still catches the real CTA regression, but no longer false-positives on a
contrast-token chip (verified: retired pill → matches; ENG-828 chip → does not).
