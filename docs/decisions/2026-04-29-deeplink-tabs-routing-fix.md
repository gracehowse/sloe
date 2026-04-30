# Decision — Fix (tabs) deeplink routing

**Date:** 2026-04-29
**Area:** Product / Mobile / Routing
**Status:** Resolved

## Problem

The 2026-04-29 mobile E2E audit (`docs/audits/2026-04-29-mobile-e2e-audit-findings.md`) ran a screenshot tour across 20 deeplinked surfaces. **10 of them silently re-rendered Today** instead of routing to the intended screen:

- `suppr:///planner`, `/progress`, `/settings`, `/more`, `/fasting`, `/health-sync`, `/notifications`, `/whats-new`, `/create-recipe`, `/profile`

All 10 are routes inside `app/(tabs)/` or hidden via `href: null`. Routes living at the root (`/shopping`, `/weight-tracker`, `/targets`, `/paywall`, `/import-shared`, `/nutrition-sources`) routed correctly.

User impact: any push notification, share-sheet handoff, Siri shortcut, or marketing email linking to `suppr:///settings` (etc.) silently dumped the user on Today with no idea why. This also caused a long tail of Maestro suite failures we couldn't diagnose during the IA migration audit.

## Root cause

`app/_layout.tsx`'s `ForwardSocialSharesToImport` callback caught **every** `suppr://` URL, attempted to extract a recipe URL via `urlFromDeepLink`, and on null result fell through to `router.replace("/")` to "redirect home so expo-router doesn't show 'Unmatched Route'". That fallback fired for any navigation deeplink because no recipe URL was embedded in `suppr:///settings` (etc.).

The intent of the handler was to forward Instagram / TikTok share-sheet handoffs that arrive as `suppr://?url=https://...` — a real and supported entry point. The bug was over-application: the no-URL branch shouldn't have intervened at all.

## Fix

Extracted the deeplink decision logic to `apps/mobile/lib/deepLinkRouting.ts` as a pure `decideDeepLinkAction(href)` function returning one of `{kind: "ignore"}`, `{kind: "siri"}`, `{kind: "forward-to-import", url}`. Updated `app/_layout.tsx` to call this and only act on `forward-to-import`. Navigation deeplinks now return `ignore`, allowing Expo Router to resolve them normally.

Locked behind 21 unit tests in `apps/mobile/tests/unit/deepLinkRouting.test.ts`:

- 12 tests covering the core regression — every previously-broken navigation deeplink now returns `ignore`.
- 4 tests covering share-sheet forwarding still works (`suppr://import-shared?url=…`, raw `https://instagram.com/…`, raw `https://tiktok.com/…`).
- 2 tests covering Siri handoff returns `siri` (ownership stays with `HandleSiriDeepLinks`).
- 3 tests for junk inputs.

## Verification

- Unit tests: 21/21 passing.
- E2E regression: re-running the screenshot tour (`apps/mobile/.maestro/00_screenshot_tour.yaml`) should produce distinct screenshots for the 10 previously-broken targets. Pre-fix baselines exist in `apps/mobile/screenshots/baseline/tour-{05,07,08,09,11,13,14,16,18,20}.png` — all currently identical to Today and will diff as expected.

## Cross-platform parity

Web is unaffected — this was a mobile-only handler. No web change needed.

## Follow-ups

- Re-run the screenshot tour and promote a fresh set of baselines now that the deeplinks resolve.
- Audit any push-notification copy / Siri shortcut / share extensions that may have been written assuming the bug-affected behaviour and may now route differently than intended (e.g. landing on Today as a fallback was masking errors elsewhere).
