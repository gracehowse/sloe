# Decision — `suppr:///plan` deep link routes to the Plan tab (ENG-800)

**Date:** 2026-05-30
**Area:** Product / Mobile / Routing
**Status:** Resolved

## Problem

`suppr:///plan` landed on the "We couldn't find that — the link may be
stale or the recipe may have been deleted" 404 screen
(`app/+not-found.tsx`) instead of opening the Plan tab. Any push
payload, marketing link, Siri shortcut, or hand-typed deep link that
addressed the Plan tab by its **user-facing label** (`plan`) was being
treated as a stale recipe link.

## Root cause

The Plan tab's route file is `app/(tabs)/planner.tsx`, so its canonical
Expo Router path is `/planner` — not `/plan`. The 2026-04-29 fix
(`2026-04-29-deeplink-tabs-routing-fix.md`) correctly made navigation
deep links return `ignore` so Expo Router resolves them. But `ignore`
only works when the path **matches a registered route**. `/planner`
resolves; `/plan` does not exist, so Expo Router falls through to
`+not-found.tsx`, which renders recipe-flavoured 404 copy. The deep
link wasn't routed through recipe resolution per se — it hit the
catch-all 404 that the recipe/share flow also lands on, which reads as
"recipe not found".

## Fix

Added a tightly-scoped, well-known **navigation alias map** to
`apps/mobile/lib/deepLinkRouting.ts`:

```
const NAV_PATH_ALIASES = { plan: "/(tabs)/planner" };
```

- `decideDeepLinkAction` now extracts the bare path segment of a
  `suppr://` link (after recipe-URL extraction has been ruled out) and,
  if it matches an alias, returns a new action
  `{ kind: "navigate", pathname }`.
- `app/_layout.tsx`'s `ForwardSocialSharesToImport.forward` callback
  handles `navigate` by calling `router.replace(pathname)`.

The map is deliberately minimal — only labels whose user-facing name
diverges from their route file (Plan → planner) get an entry. Paths
that already match their route file (`settings`, `more`, `progress`,
`library`, `discover`, `planner` itself, …) stay out of the map and
continue to resolve via Expo Router directly (the 2026-04-29 `ignore`
path). Both the two-slash (`suppr://plan`, parsed as host) and
three-slash (`suppr:///plan`, parsed as path) forms are accepted, plus
trailing-slash and query-string variants.

A `suppr://` link that embeds a recipe URL still forwards to
`/import-shared` first — the alias map is only consulted when no recipe
URL is present, so the import path is never shadowed.

## Why no feature flag

Pure routing bug fix with no visual surface of its own — it makes an
already-existing destination (the Plan tab) reachable. Per CLAUDE.md,
flags gate visual/structural changes, not bug fixes that have no UI
surface. No new UI is introduced.

## Verification

- Unit tests: `apps/mobile/tests/unit/deepLinkRouting.test.ts` — 29/29
  passing (21 prior + 8 new for the `plan` alias: three-slash,
  two-slash, trailing slash, query string, case-insensitivity,
  `planner` is NOT aliased, `plant-based` is NOT aliased, and a
  recipe-carrying `plan` link still forwards to import).
- Mobile typecheck: `tsc --noEmit` clean.

## Cross-platform parity

Mobile-only. The web app uses path-based routing where `/planner` (or
the equivalent web Plan surface) is addressed directly; there is no
custom-scheme deep-link forwarder on web, so no `/plan`→`/planner`
alias is needed. Not a parity gap — the alias compensates for a
mobile-specific route-file-vs-label divergence that doesn't exist on
web.

## Follow-ups

- If other external surfaces address tabs by label rather than route
  file name (none found today beyond Plan), add them to
  `NAV_PATH_ALIASES` with a matching unit test. The map is the single
  place to do so.
