# User-avatar monogram — Rule 7 serif + frost-ring, one shared primitive (ENG-1593)

**Date:** 2026-07-20
**Area:** App chrome — persistent header identity avatar + Profile/Settings identity monogram (web + mobile)
**Status:** Resolved
**Flag:** `avatar_monogram_frost_ring_v1` (default-OFF on both platforms; not in `REDESIGN_DEFAULT_ON`)

## Context

The 2026-07-17 design sweep (`docs/audits/2026-07-17-design-sweep/report.md`)
flagged the persistent user/household avatar monogram as a **Rule 7**
violation on every screen it appears on, with the specifics differing across
capture passes:

- Mobile Today header: sans-serif "G" on solid plum, no ring.
- Web Today/household surface: sans monogram, no ring, and a **different**
  fill shade than mobile in one capture.
- Mobile Settings vs. web Profile: a *third* pairing — mobile serif
  dark-plum, web sans lighter-mauve-plum, neither ringed.

DESIGN-CONSTITUTION Rule 7 (`docs/ux/redesign/v3/DESIGN-CONSTITUTION.md`
§"Photography or nothing"):

> Food is photographed … or rendered as the plum-duotone texture system.
> **Letter monograms never represent food.** People may use serif initials
> only with the frost-ring treatment, as a stated placeholder until real
> photography lands.

The exact "frost-ring" spec lives in the ratified prototype, not just the
prose rule: `docs/ux/redesign/v3/Sloe-App.html` L1727-1728 —

```css
/* 4 · placeholder kill — creator monograms get a quiet frost ring while real photos are pending */
[data-premium="1"] .creator-rail-av{ box-shadow:0 0 0 2px var(--card), 0 0 0 3.5px var(--accent-frost); }
```

a 2px `--card`-coloured gap ring, then a 3.5px `--accent-frost` ring — plus
the prototype's `.avatar`/`.avatar-lg` classes, both `font-family: var(--font-serif)`.

## What was actually wrong (traced past the audit's captures)

Both platforms already share **one** identity-avatar primitive and **one**
canonical fill token, from the S5 avatar ruling (2026-07-10, ENG-1375):
mobile `GradientAvatar`'s `ink` default (`Accent.purple`, `#6A4B7A` damson)
and web `AvatarDisc`'s `identity` default (`--avatar-identity`, the same
`#6A4B7A`). Every header/sidebar call site (mobile `TodayHeaderBar` +
`TodayDateHeader`; web `desktop-sidebar` + `today-date-header`) already used
it correctly — no fill mismatch there. Neither platform's header avatar had
the serif + ring treatment, which is the real, reproducible Rule 7 gap.

The "plum-vs-olive"/"two different plum shades" half of the ticket traces to
a **different** bug: the mobile Profile/Settings identity monogram
(`EditorialProfileBlock.tsx` + `ProfileIdentityStrip.tsx`, both mobile) never
routed through `GradientAvatar` at all — each hand-rolled its own `View` +
`Text` filled from `accent.primarySolid`, a **theme-variable** token
(`#3B2A4D` deep-plum in light mode, `#C4ACD0` lilac in dark mode), not the
fixed `Accent.purple` damson the web `AvatarDisc` and the mobile Today header
already use. That's the concrete source of "two different plum shades" —
not a cross-platform drift in the shared token itself.

Household **member** avatars (`householdMemberAccent` per-index palette —
stone/green/amber/pink) are a separate, already-reviewed pattern (see
`docs/ux/redesign/v3/conformance-backlog.md` L406, "different but reasonable
identity treatment") and are out of scope here — Rule 7 governs the
single-person identity monogram, not the household member-chip grammar.

## Decision

1. **One shared avatar-monogram primitive, each platform's existing one.**
   No new component — `GradientAvatar` (mobile) and `AvatarDisc` (web), both
   already the ONE identity-fill primitive per ENG-1375, gain a
   `treatment?: "legacy" | "frostRing"` prop (default `"legacy"`, byte-for-
   byte unchanged render). `"frostRing"`:
   - Renders the initial in the Newsreader serif (`FontFamily.serifMedium`
     mobile / `var(--font-headline)` web) instead of sans.
   - Wraps the disc in the prototype's exact double ring — box-shadow on
     web; two nested `View`s sized `width/height` (not `padding`/`margin`/
     `gap`, so `check:spacing-scale` never sees the sub-4px ring geometry)
     on mobile, since RN has no multi-layer `box-shadow`.
2. **Single canonical fill, no new token.** `treatment="frostRing"` does not
   change the fill — it's carried by whatever `fill`/`bg-[var(--avatar-
   identity)]` the call site already resolves. The header sites already
   resolve to the canonical damson; the mobile Profile/Settings sites are
   fixed to pass `Accent.purple` explicitly in their flag-ON branch (their
   flag-OFF branch keeps `accent.primarySolid` untouched as the kill switch —
   see below).
3. **Every ad-hoc header avatar replaced**, gated behind
   `avatar_monogram_frost_ring_v1`: mobile `TodayHeaderBar`,
   `TodayDateHeader` (×2 render paths), `EditorialProfileBlock`,
   `ProfileIdentityStrip`; web `desktop-sidebar`, `today-date-header` (×2),
   `EditorialProfileBlock`. Flag-OFF renders every one of these exactly as
   before — including the mobile Profile/Settings `accent.primarySolid` fill
   quirk, preserved deliberately as the kill switch rather than silently
   "fixed" underneath an unreviewed flag-off default.

## Why default-OFF

This is app-wide chrome, visible on every screen that shows the identity
avatar. Per the root feature-flag rule, visual/structural changes ship
behind a flag with the old path alive in the `else`. No device/sim visual
pass landed in this change (ios-simulator MCP unavailable this session) and
web has no unauthenticated route to the sidebar/Today-header avatar, so this
mirrors the ENG-1612 precedent
(`docs/decisions/2026-07-19-fits-your-day-verdict-chip.md`): ship the
correct implementation, gate it, and ramp only after a real visual pass.

## Explicitly out of scope

- Household **member** avatars (`householdMemberAccent`, the Today household
  glance bar, `HouseholdCard`, `PlanHouseholdBannerV3`) — a deliberately
  different per-member accent grammar, already reviewed and kept.
- `SettingsProfileHeaderCard.tsx`'s gradient avatar — pinned as "the LAST
  gradient consumer" by `tests/unit/profileAvatarGradient.test.ts`, a
  separate, already-tracked S5 follow-up slice.
- `app/pricing/PricingHeaderAuth.tsx` — a marketing/pre-auth surface, not the
  signed-in app chrome loop this ticket scopes to.
- Creator-profile avatars (`CreatorRail`, `creator/[id].tsx`) — other users'
  identity, not the signed-in user/household monogram Rule 7 and this ticket
  describe; the prototype's own frost-ring rule (`.creator-rail-av`) is a
  `data-premium="1"`-gated teaser treatment, a different feature.

## Verification

No ios-simulator MCP session or authenticated web route was available this
session, so this shipped on token/style reasoning + tests, not a pixel pass:
render tests for both primitives' `frostRing` branch (ring geometry, serif
font, fill token) in `apps/mobile/tests/unit/gradientAvatar.test.tsx` and
`tests/unit/avatarDisc.test.tsx`, plus a cross-platform source-pin test
(`tests/unit/avatarMonogramFrostRingFlagWiring.test.ts`) confirming every
call site gates on the flag and the mobile fill fix lands only in the
flag-ON branch. Ramp only after a real device/browser visual pass.
