# Audit-vs-competitors wave 2 — polish + trust + nudge re-prioritisation

**Date:** 2026-04-30
**Status:** Resolved
**Area:** Plan / Settings / Paywall / Today nudge queue
**Owner:** Grace
**Authority:** customer-lens + product-lead + legal-reviewer audit
verdicts (2026-04-30); approved before implementation; sequel to
wave 1 (HealthKit writes + activation hooks + barcode portion memory,
landed in commits e2265cc + c883109).

## Problem

Wave 1 landed the high-effort competitive-parity items. Wave 2 picks up
the remaining S-effort polish + trust items from the same audit set.
Six (de-scoped from seven) discrete fixes, one per surface, all
mobile-only with the nudge queue staying mobile-only by design (no web
equivalent surface — see
`apps/mobile/components/today/onboarding-nudges/types.ts`).

## Fixes

### FIX 1 — Plan default 7 days

`apps/mobile/app/(tabs)/planner.tsx` initial `days` state changes from
`1` to `7`. Plan IS a week tool, and the 1-day default hid the
"week-view wow" behind a tap and made Plan look like Today with extra
steps. Free-tier users who can't generate >1-day plans are auto-
clamped back to 1 once the async tier resolves, gated by a
`userPickedDaysRef` so a Pro user who manually chose 1 isn't bumped
back to 7 by a later effect re-run.

`startOffset` (today / tomorrow / next week) is unchanged — the spec
floated "Mon-Sun of current week" as an alternative anchor, but
expanding the union beyond `0 | 1 | 7` would have been a non-trivial
refactor (the type drives both the chip UI and the calendar anchor in
`src/lib/planning/planCalendarAnchor.ts`). Today-anchored 7-day
already lands the wow.

### FIX 2 — Plan meal-row recipe thumbnail (scoped)

`PlanRecipeRef` extended with an optional `image` field. The 36×36
slot icon-box on each meal row in the per-day plan now renders the
recipe's hero image when one is available; otherwise falls through to
the existing tinted lucide slot icon. A 7-day plan reads as a visual
scan of meals instead of a column of identical Coffee / Sun / Utensils
icons.

The original spec called for stacked thumbnails inside the small day-
strip cards on top of the plan. Those cards are flex:1 across a 7-day
grid (~50px wide on iPhone) — too narrow for stacked 24×24 thumbnails
per slot. The per-day meal rows are where users actually scan.

Dead code (`truncateMealName`, never called; `dayCardMeal*` styles,
never referenced) flagged by the audit was partially removed
(`truncateMealName` deleted; `dayCardMeal*` styles kept for now —
mechanical removal not in scope for this fix).

### FIX 3 — Onboarding nudge priority reorder + eligibility predicate

`apps/mobile/components/today/onboarding-nudges/nudges.ts` reordered
from **permissions → import → recipes** to **import → recipes →
permissions**. Asking for HealthKit BEFORE the user has felt the value
of logging is the highest-blow-rate prompt in the queue. Cal AI defers
HK until after the first food log for the same reason.

Each nudge now carries an `eligibility(state)` predicate against a
new `NudgeEligibilityState`:

| Nudge       | Eligibility                                                |
| ----------- | ---------------------------------------------------------- |
| import      | libraryCount < 3                                           |
| recipes     | libraryCount < 5                                           |
| permissions | lifetimeMealCount >= 3 AND OS permissions === undetermined |

The OS-already-answered gate is the load-bearing change — when iOS has
returned `granted` or `denied` from `Notifications.getPermissionsAsync`,
the permissions nudge is permanently skipped. Re-asking past an
authoritative OS answer is noise.

`OnboardingNudgeBanner` now takes `mealsTodayCount` + `libraryCount`
props (from the Today host) and resolves `lifetimeMealCount` (Supabase
`nutrition_entries` count) + notifications status (OS) internally.

### FIX 4 — Paywall trial-end disclosure (trust)

`apps/mobile/app/paywall.tsx` previously rendered `today + 7` as a
concrete calendar date inline ("Your 7-day free trial ends on Apr 30,
2026; first charge on Apr 30, 2026."). If the user delayed purchase
by 2 days the printed date was wrong by 2 days — Apple anchors the
real trial-end + first-charge dates from the receipt's purchase
moment. That is a trust-grade fault.

New copy: "Starts your 7-day free trial — first charge after 7 days."
Length-and-cadence form, no baked dates. Apple's own subscription
manager (post-purchase) owns the concrete dates. UK CMA disclosure
elements all preserved: price, renewal frequency, auto-renew until
cancelled, cancel path, trial length, when the first charge falls,
VAT inclusion, refund policy.

### FIX 5 — Sign Out colour neutral

`apps/mobile/app/(tabs)/settings.tsx` Sign Out row swapped from
`Accent.destructive` (red) to default `colors.text` for the label and
`colors.textTertiary` for the trailing icon. Sign Out is reversible
— signing back in is a single tap. Red is reserved for irreversible
actions like Delete Account.

### FIX 6 — Settings search

`apps/mobile/app/(tabs)/settings.tsx` gains a search `TextInput`
pinned at the top of the ScrollView. Section-level filter: each
section is gated by a `matchesSearch(keywords)` call against a static
list of section title + row label + row description strings. A non-
empty query that doesn't match any section shows an empty-state row.

Section-level (not per-row) was the deliberate choice — per-row would
have required wrapping every Pressable / Switch / segmented control
in the file (~50 elements, mixed shapes). Section-level keeps the
diff small, avoids orphan section headers, and matches the user's
mental model ("this is in Notifications").

The `SettingsBundleContent` block is hidden when the query is non-
empty — its sections aren't filterable from this surface, and showing
the full bundle below filtered legacy sections would make the result
dishonest. When the bundle grows in-bundle search, do that inside the
bundle component, not here.

### FIX 7 — Web parity

The post-onboarding nudge queue is mobile-only by design, documented
in `apps/mobile/components/today/onboarding-nudges/types.ts`. No web
equivalent exists — `/home` on web has no Today surface that hosts
post-launch nudges. The wave-2 priority + eligibility changes
therefore have no web counterpart. Sync-enforcer carve-out logged
here.

## Coverage

| Surface | Implementation | Tests | Docs |
| ------- | -------------- | ----- | ---- |
| Plan default + clamp | planner.tsx | plannerDefaults.test.ts | this doc |
| Plan thumbnail | planner.tsx | plannerMealRowThumbnail.test.ts | this doc |
| Nudge reorder + eligibility | nudges.ts + types.ts + useNextNudge.ts + OnboardingNudgeBanner.tsx | onboardingNudgeQueue.test.tsx (rewritten, 16 tests) | this doc |
| Paywall trust copy | paywall.tsx | paywallTrialDisclosureNoStaleDates.test.ts | this doc |
| Sign Out neutral | settings.tsx | settingsSignOutNeutralColor.test.ts | this doc |
| Settings search | settings.tsx | settingsSearch.test.ts | this doc |

## Risks / follow-ups

- **FIX 2 is partial vs the spec** — full thumbnail-stack per slot in
  the small day-strip cards was de-scoped (cards too narrow).
  Recipe-image-on-meal-row landed instead. If a future redesign makes
  the day strip wider (e.g. landscape iPad), revisit.
- **Settings search doesn't cover SettingsBundleContent** — the bundle
  has its own section structure (membership / goals / connections /
  recipes / app / legal / build / danger zone) and is hidden during
  search rather than filtered. When a user types a keyword that lives
  in the bundle (e.g. "Delete account" → Danger zone) they'll see the
  empty state. Acceptable for now — the bundle can grow its own
  search later.
- **`startOffset` Mon-Sun anchor not implemented** — flagged but de-
  scoped per the >30-min budget rule in the spec. Day-anchored 7-day
  default is the wow moment regardless.
