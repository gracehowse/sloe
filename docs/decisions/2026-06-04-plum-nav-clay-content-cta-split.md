# Plum = nav/brand primary; clay = content CTAs (Sloe)

- **Date:** 2026-06-04
- **Area:** Design system / Today re-skin
- **Status:** Resolved
- **Owner:** Grace

## Decision

Sloe's two warm accents own two distinct roles, and must not be used
interchangeably:

- **Plum `#3B2A4D` (light) / `#815E91` (dark) = NAV / BRAND primary.** The
  centre Log **FAB** on the bottom tab bar, the wordmark, and page titles.
  Nav and brand chrome only. Mobile token: `Colors.*.navPrimary`. Web mirror:
  `--sidebar-primary` (already plum) + `--macro-calories` (the plum calorie
  ring).
- **Clay `#C8794E` (light) / `#D58A5E` (dark) = inline CONTENT CTAs.** The one
  "do it" action per content region — Save, Log Dinner, Start Cooking — plus
  the active tab label/icon and links. Token: `Accent.primary` / `Colors.*.tint`.

This refines the prior three-role colour law (PRIMARY clay / SUCCESS sage /
WIN damson) into a four-role split by promoting plum from "calorie-ring +
brand-mark hue" to an explicit NAV/BRAND primary role.

## Why

The centre Log FAB previously used `colors.tint` (clay) — the same hue as
every inline content CTA on the screen (Save, Log Dinner, the suggestion
card's "Log it"). Two same-colour buttons within a thumb's reach blurred the
hierarchy: the FAB is nav chrome (always present, opens the canonical Log
sheet from any tab), not a content action tied to the current view. Painting
it plum makes it read as nav chrome and matches the Sloe Figma TD frames +
the prototype `_gen.mjs` `tabBar` (which renders the FAB as `bg-plum`).

## Scope of the change (mobile, this commit)

- `apps/mobile/constants/theme.ts` — new `navPrimary` token (light/dark).
- `apps/mobile/components/tabs/LogTabBarButton.tsx` — FAB fill + glow → plum.
- `docs/ux/brand-tokens.md` — `navPrimary` role row + four-role colour law.

The marketing brand gradient (`Brand.gradient`, paywall/landing) is out of
scope and stays on its legacy endpoints — that is a brand-manager call (see
the note in `theme.ts` `Brand`).

## Parity

- Web has no centre FAB (its "Log a meal" CTA is the sidebar button, already
  on `--sidebar-primary` plum), so there is no web FAB to repaint. The plum
  nav/brand concept is already present on web via `--sidebar-primary` and
  `--macro-calories`. The new mobile `navPrimary` token mirrors those.
- This is a documented mobile-leads change (iOS is the primary surface); web
  already satisfies the role with existing tokens.

## SSOT

`docs/prototypes/stitch-sloe/_gen.mjs` (`tabBar` → `bg-plum` FAB);
`_buildtoday.mjs` (plum page titles + calorie ring).
