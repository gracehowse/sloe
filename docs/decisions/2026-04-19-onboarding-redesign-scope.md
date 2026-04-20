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

## Decision 2 — Pace safety floor: **soft warn + acknowledgement, allow advance**

The prototype's Pace step (step 09) hard-blocks "Continue" when projected daily target falls below 1,200 kcal (female) / 1,500 kcal (male). The shipped behaviour is **soft-warn with an explicit acknowledgement** for the danger level: the warning banner shows, and for `info` / `warn` levels Continue stays one-tap; for `danger`, Continue requires a checkbox tick *"I understand this is below the recommended safety floor and accept responsibility for proceeding."* before activating. The soft-warn product intent is preserved (we don't refuse the user's choice), but consent is now explicit and auditable.

This evolution was added during Stage F per `legal-reviewer` sign-off — one-tap Continue plus loud warning was deemed legally weak ("dark pattern in reverse"). The acknowledgement is the affirmative-action piece that makes "respect agency" coherent.

Three warning levels remain visible in the UI:

| Level | Trigger | Copy | Action |
|-------|---------|------|--------|
| `info` | Within 200 kcal of safety floor | "Close to the minimum recommended intake" | Banner only |
| `warn` | Loss rate > 1% bodyweight/week | "Faster than 1% of your bodyweight per week" | Banner only |
| `danger` | Below safety floor | "Below the [floor] kcal safety floor" | Banner only — **no Continue block** |

**Why:** hard-blocking is the safer clinical default but excludes users with legitimate clinical guidance to eat below the floor (post-bariatric, very-low-calorie diets prescribed by a physician, certain metabolic conditions). Suppr is not their physician and shouldn't override one. The user's call here is explicit: warn loudly, respect agency.

**How to apply (post Stage F):**
- `canAdvance("pace", state, ctx)` accepts an optional `paceWarning` context. For `info` / `warn` / no-warning states, only the unconditional shape requirement (a numeric pace) gates the button. For `danger`, advance is additionally gated on `state.paceDangerAcknowledged === true`.
- `paceDangerAcknowledged` resets whenever the warning reason changes (e.g. user drags out of danger then back in) so an intentional advance is captured per-decision.
- The `danger` banner shows (a) the slow-down recommendation as the primary action, (b) the prescribed-VLCD carve-out, and (c) the "Not suitable if you're pregnant, under 18, or managing a medical condition" line inside the banner body — not just in the methodology footer.
- Analytics fire `onboarding_pace_below_safety_floor` with payload `{ acted: "shown" | "advanced", level, reason, pace_kg_per_week, projected_target_kcal, sex, acknowledged }`. The `acknowledged` field is `true | false | null` — `null` for non-danger levels where no checkbox exists.

## Stage F sign-off summary (2026-04-19)

All three required reviews completed before Phase 2 ships behind the
PostHog flag:

- **`nutrition-engine`** — APPROVE-WITH-CHANGES applied. Macro mapping
  updated: `gain` and `recomp` now both map to `high_protein`
  (2.2 g/kg) per ISSN position stand (Jäger et al. 2017) — `recomp` is
  the highest-leverage protein scenario in the literature, `gain`'s
  stated muscle-building goal warrants the upper end. `lose` stays on
  `high_satisfaction` (1.8 g/kg, satiety beats peak hypertrophy in a
  deficit). The 7,700 kcal/kg constant, the 1,500/1,200 safety floors,
  the 200 kcal `near_floor` buffer, and the `>1 %/week` `fast_loss`
  trigger are all approved as-shipped. The 1,350 unspecified-sex
  midpoint is documented as a Suppr policy choice (no health authority
  defines it).

- **`legal-reviewer`** — BLOCK → APPROVE after fixes:
  1. Danger-banner copy rewritten to (a) name NHS / NIH explicitly,
     (b) make "slow the pace" the primary recommendation, (c) carve
     out the prescribed-VLCD case, (d) include the
     pregnancy / under-18 / medical-condition disclaimer inside the
     banner.
  2. Explicit acknowledgement checkbox added for the `danger` level
     (Decision 2 evolution above).
  3. `warn` body hedged ("can increase lean-mass loss" vs the prior
     "can cost muscle").
  4. Analytics payload extended with `acknowledged` so the audit
     trail captures consent state.

  Open follow-ups for formal counsel (not blocking the flag flip but
  required before UK / EU traffic):
  - UK / EU regulatory treatment of unsupervised sub-floor calorie
    targets given the existing non-established-supplier VAT posture.
  - Account-creation age gate (under-18 exclusion).
  - Whether to bring forward the deferred clinician-mode toggle.

- **`diversity-inclusion`** — APPROVE-WITH-CHANGES applied:
  1. Sex step subtitle reworded ("Used to estimate your metabolic
     rate. You can change this anytime.") — no longer implies forced
     choice.
  2. Sex hormone-affirming copy hedged ("there's no perfect answer
     here", "may begin to fit better — but evidence is limited") to
     match the actual state of the literature.
  3. "Prefer not to say" subtitle sharpened to name the trade-off
     ("Uses a midpoint estimate (~166 kcal between sexes).").
  4. Recomp goal subtitle rewritten ("Slight deficit, strength-focused")
     so it doesn't assume the user lifts heavy.
  5. Pace slider visible max for `lose` lowered from 0.9 to
     0.75 kg/week to avoid ED-normalising the high end. (A future
     "extended range" disclosure flow may reintroduce 0.9 — tracked
     in `docs/planning/ongoing-backlog.md`.)
  6. Weight step now offers an explicit "Prefer not to enter" path:
     when chosen, `weightSkipped: true`, the Pace step auto-skips,
     and the Reveal step shows a calibrate-from-logs message instead
     of concrete kcal targets.

## Out of scope (deferred)

- Hero variants (Bar / Number) on Today screen — Phase 3
- Pace clinician-mode (a "my doctor approved this" toggle that suppresses the banner entirely) — not on roadmap, would need legal review
- Per-region safety floor variation (UK NHS uses different floors than US NIH for some demographics) — accept US NIH floors as default; revisit if region-aware pricing work surfaces a similar need
- Pace "extended range" disclosure flow that re-permits >0.75 kg/week
  loss after a separate consent gesture — diversity-inclusion's
  preferred shape, deferred to follow-up
- Account-creation age gate — formal-counsel question; not in this
  scope but flagged for the auth flow
- Targets persistence — **shipped** at OB2-1 ([src/lib/onboarding/v2/persist.ts](../../src/lib/onboarding/v2/persist.ts)). v2 completers now upsert a `profiles` row identical in shape to a legacy completer. `daily_targets` snapshot is still "first food log of the day wins" by design (F-2 invariant) — not called from this path.

## Rollout — 2026-04-20

- PostHog flag `onboarding_v2` (id 648164) flipped from `email == gracehowse@outlook.com` to `100% rollout` for everyone. Rationale: no other users on the app yet, and OB2-1 closes the persistence gap that previously blocked broad rollout.
- Legacy `/onboarding` stays mounted for one validation week as a fallback (its Stage E redirect honours the same flag, so legacy is unreachable while flag=100%). Delete the route + `app/onboarding/page.tsx` after the validation week if no rollback signal surfaces.
- Middleware preview-window allowlisting of `/onboarding/v2` ([middleware.ts](../../middleware.ts) `PUBLIC_ROUTES`) should be reverted to the auth-gated default once we're confident there's no longer a need for unauthenticated preview links.

## Phase plan

| Phase | Scope | Specialist sign-offs |
|-------|-------|---------------------|
| 0 | Decision doc + memory + audit | — |
| 1 | Net-new primitives (`RulerSlider`, `OptionCard`, `SupprMark` web + mobile) — no user-facing change | `code-quality`, `qa-lead` |
| 2 | Onboarding v2 behind flag (web + mobile) — calls real Mifflin-St Jeor against existing targets logic | `legal-reviewer`, `nutrition-engine`, `diversity-inclusion` ✅ all signed off Stage F |
| 3 | Today screen v2 behind flag | `ui-critic`, `sync-enforcer` |
| 4 | Plan / Progress / Discover / More + tab restructure | `journey-architect`, `sync-enforcer` |
| 5 | Modals (Log/Cook/Recipe/Import/Paywall/Household) | `ui-critic`, `qa-lead` |

Cut-over only after each phase passes its specialist sign-offs and `release-gate`.
