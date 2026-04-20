# 2026-04-19 — Onboarding + UI redesign scope decisions

**Status:** accepted
**Owner:** Grace
**Related:** prototype delivered by Claude Design (mobile + web onboarding flows, Today/Discover/Plan/Progress/More redesign), [docs/ux/brand-tokens.md](../ux/brand-tokens.md), [docs/ux/design-system.md](../ux/design-system.md)

## Context

A full prototype of redesigned onboarding (13 steps, web + mobile, shared state, live Mifflin-St Jeor calc) and core app surfaces (Today/Discover/Plan/Progress/More + ~11 modals) was delivered as standalone HTML/JSX. Production app is materially more mature than the prototype assumes (1,062-line mobile onboarding, 630-line web onboarding, 11 mobile tabs already shipped, full shadcn/ui kit on web, Suppr-specific components in `src/app/components/suppr/`).

Two scope calls had to be locked before implementation could start:

## Decision 1 — Tab structure: **5 main tabs, everything else under More**

Mobile bottom-tab navigation will follow the prototype:

| # | Tab | Icon | Notes |
|---|-----|------|-------|
| 1 | Today | flame | Default landing |
| 2 | Discover | compass | Recipe browse + import |
| 3 | Plan | calendar-days | Weekly meal plan |
| 4 | Progress | trending-up | Weight + macro trends |
| 5 | More | circle-user | Account, library, search, barcode, notifications, settings, household, etc. |

Currently shipped tabs being **moved under More** (not deleted, just demoted from primary nav):
- `library` — accessible via More → Library
- `notifications` — bell icon stays in screen headers; full center under More
- `search` — invoked from search-icon affordances on Discover / Today; no longer a primary tab
- `barcode` — invoked from Log Meal sheet's Scan tab; no longer a primary tab
- `settings` — More → Settings

`planner.tsx` is renamed conceptually to **Plan** in copy but the file stays.

**Why:** five tabs is the empirically-validated ceiling for thumb-reach scanning. Eleven tabs is forcing users into a "find the icon" mode that the mobile-first redesign explicitly rejects. The prototype's More-screen pattern matches Apple Health, Strava, and MyFitnessPal — all of which have similarly broad surface area and ship with a 5-tab limit.

**How to apply:** all `apps/mobile/app/(tabs)/_layout.tsx` work in Phase 4 must reduce primary tabs to 5. Pre-existing tab files stay; their routes become reachable from the More screen instead of the tab bar. No deeplink should break.

## Decision 2 — Pace safety floor: **soft warn, allow advance**

The prototype's Pace step (step 09) hard-blocks "Continue" when projected daily target falls below 1,200 kcal (female) / 1,500 kcal (male). We will **soft-warn** instead: show the warning banner identical in copy and severity, but **never disable the Continue button** purely on the safety floor.

Three warning levels remain visible in the UI:

| Level | Trigger | Copy | Action |
|-------|---------|------|--------|
| `info` | Within 200 kcal of safety floor | "Close to the minimum recommended intake" | Banner only |
| `warn` | Loss rate > 1% bodyweight/week | "Faster than 1% of your bodyweight per week" | Banner only |
| `danger` | Below safety floor | "Below the [floor] kcal safety floor" | Banner only — **no Continue block** |

**Why:** hard-blocking is the safer clinical default but excludes users with legitimate clinical guidance to eat below the floor (post-bariatric, very-low-calorie diets prescribed by a physician, certain metabolic conditions). Suppr is not their physician and shouldn't override one. The user's call here is explicit: warn loudly, respect agency.

**How to apply:**
- `canAdvance(step)` for the `pace` step must NOT factor in the safety floor — only that pace is set
- The `danger` banner stays prominent (red accent, alert icon, full body copy referring to NIH/NHS guidance and prompting clinician consultation)
- `legal-reviewer` must sign off on the final danger-level copy before Phase 2 ships
- Analytics must fire `onboarding_pace_below_safety_floor` when this banner shows AND when the user advances despite it — both are auditable signals if we ever need to revisit

## Out of scope (deferred)

- Hero variants (Bar / Number) on Today screen — Phase 3
- Pace clinician-mode (a "my doctor approved this" toggle that suppresses the banner entirely) — not on roadmap, would need legal review
- Per-region safety floor variation (UK NHS uses different floors than US NIH for some demographics) — accept US NIH floors as default; revisit if region-aware pricing work surfaces a similar need

## Phase plan

| Phase | Scope | Specialist sign-offs |
|-------|-------|---------------------|
| 0 | Decision doc + memory + audit | — |
| 1 | Net-new primitives (`RulerSlider`, `OptionCard`, `SupprMark` web + mobile) — no user-facing change | `code-quality`, `qa-lead` |
| 2 | Onboarding v2 behind flag (web + mobile) — calls real Mifflin-St Jeor against existing targets logic | `legal-reviewer`, `nutrition-engine`, `diversity-inclusion` |
| 3 | Today screen v2 behind flag | `ui-critic`, `sync-enforcer` |
| 4 | Plan / Progress / Discover / More + tab restructure | `journey-architect`, `sync-enforcer` |
| 5 | Modals (Log/Cook/Recipe/Import/Paywall/Household) | `ui-critic`, `qa-lead` |

Cut-over only after each phase passes its specialist sign-offs and `release-gate`.
