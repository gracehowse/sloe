# Search tab safe-area inset (2026-05-05)

> **Superseded 2026-06-08.** The "Food search" tab
> (`apps/mobile/app/(tabs)/search.tsx`) this fix applied to has since
> been **deleted** — it was a vestigial read-only USDA dev-stub, removed
> per the nutrition-log spec §3.15. Food search lives only in the Log
> sheet now. This doc is kept as a historical record of the safe-area
> fix; the screen and its inset code no longer exist.

**Status:** Resolved (screen later deleted — see banner).
**Authority:** 2026-05-05 supplemental mobile audit (finding N1, P0).
**Owner:** Grace / executor.

## Problem

`apps/mobile/app/(tabs)/search.tsx` (the "Food search" tab) rendered
its title and subtitle BEHIND the iOS status bar. The `9:41` notch
overlapped "Food search" letter-for-letter, with the dynamic island
black pill obscuring the centre of the heading.

Visual evidence:
`docs/audits/2026-05-05-full-sweep/mobile/route-tabs-search.png`.

Root cause: the screen's container had `padding: Spacing.xl` from the
StyleSheet, but no `useSafeAreaInsets()` adjustment for `insets.top`.
Every other primary tab (Today, Planner, Discover, Notifications,
Library) already applies `paddingTop: insets.top` — Search was the
hold-out.

## Fix

One file, three small edits to
[apps/mobile/app/(tabs)/search.tsx](../../apps/mobile/app/(tabs)/search.tsx):

1. Import `useSafeAreaInsets` from `react-native-safe-area-context`.
2. Read `insets` inside the `SearchScreen` component.
3. Apply `paddingTop: insets.top + Spacing.xl` on the root `View`
   (additive — keeps the existing horizontal padding from the
   StyleSheet, but bumps the top to clear the status bar AND keep
   the same visual breathing room above the title that other tabs
   have).

Why additive (`insets.top + Spacing.xl`) instead of replacing: the
StyleSheet's `Spacing.xl` already encodes the design's intentional
gap between the top of the safe area and the title. Today, Planner,
and Discover all use this pattern.

## Validation

Visual screenshot at `/tmp/sim-check/after-N1-search.png` (kept off
the audit dir intentionally — it's a single after-fix shot, not part
of the comprehensive audit set):

- BEFORE: "Food search" string clipped/overlapped by the iOS status
  bar's `9:41` time and dynamic island pill.
- AFTER: "Food search" sits in its own row below the status bar,
  with the same visual breathing room as Today / Planner.

`tsc --noEmit` clean.

## Cross-platform

Mobile-only — web has its own header chrome and is unaffected.

## Closes

- Audit finding N1 (P0)
- Notion task [`Audit P0] N1`](https://www.notion.so/35759b41503081ff8276d3bfa6fa698a) → mark Done
