# PostHog rollout runbook

Operator playbook for the PostHog feature flags Suppr owns and the
specific dashboard moves required at each phase of the product rollout.

This is a working runbook — not a decision doc. Decisions for each
flag live alongside the code that introduced them in
`docs/decisions/`. Update this file when a flag is added, ramped, or
retired.

## Alerts

### `vendor_search_degraded` (ENG-1412)

**Event is instrumented and tested; the PostHog Alert object itself still
needs to be created in the PostHog dashboard** — this repo has no PostHog
Personal API key / MCP connector wired up, so a coding agent can emit the
event but cannot create Insights/Alerts via PostHog's API from here. Grace
(or whoever has PostHog admin) needs to do the one-time setup below.

Source: PRA-011 (2026-07-05 deep audit) — food-vendor quota cliffs were
degrading match quality with zero dashboard signal, only a `console.error`
line. Fired server-side from `checkQuota`/`consumeQuota` in
`src/lib/server/vendorSearchCache.ts` whenever ANY vendor's account-wide
quota guard trips — USDA, Edamam, FatSecret, and the OFF proxy guard, not
just Edamam. Payload: `{ vendor, reason: "quota_exhausted", used, cap,
guard: "check" | "consume" }`. Distinct id: `system:vendor_quota` (same
`system:*` convention as `upstash_dependency_failure`).

Setup (PostHog project 389168, https://us.posthog.com/project/389168):

1. **Insight** — New insight → Trends → event `vendor_search_degraded` →
   count, broken down by `vendor` property. This is the dashboard visual;
   add it to the "Analytics basics" dashboard
   (https://us.posthog.com/project/389168/dashboard/1486716) alongside the
   existing five insights.
2. **Alert** — on that insight, "Subscribe" / "New alert" → condition
   "total count" → "is greater than" → `0` → checked every hour (matches
   the USDA/Edamam quota windows) → notify Grace's email. A single
   occurrence in the window is worth paging on: this event only fires when
   the guard has ALREADY decided to degrade a live user's search, so there
   is no noise threshold to tune.
3. Optional refinement once real traffic exists: split the alert per
   vendor (`vendor = edamam` / `usda` / `fatsecret` / `off`) if one vendor
   trips far more often than the others and a shared alert gets noisy.

### Edamam quota-ceiling bump (post billing-tier upgrade)

Buying Edamam's paid tier is a separate billing/vendor-account action
(ENG-1412, Grace-only — not code-actionable). Once that upgrade is live,
the **only line that needs to change** is `VENDOR_QUOTAS.edamam.cap` in
`src/lib/server/vendorSearchCache.ts` (currently `1000`, the free-tier
daily cap) — bump it to whatever the paid tier's effective ceiling should
be (Edamam's Pro tier is metered per-request with no daily cap; pick a
generous-but-bounded number, e.g. `100000`/day, as an abuse guard rather
than a real vendor limit) and update the adjacent `label` string. No env
var, no other call site, no migration — `VENDOR_QUOTAS` is the single
source of truth the guard reads from.

## Active flags

### `cook_multi_timers_v1` (ENG-948)

| Property | Value |
| --- | --- |
| Flag ID | _create in PostHog before ramp_ |
| Type | Boolean |
| Platforms | Mobile (iOS) |
| Owner | Grace |
| Decision doc | [2026-06-20-cook-multi-timers](../decisions/2026-06-20-cook-multi-timers.md) |

Gates **one timer pill per parsed duration** in the current cook step plus a
**concurrent heads-up countdown strip** (timers survive step navigation).
Flag ON → multi-pill + strip on `/cook`. Flag OFF → legacy single suggested
timer + one countdown — byte-identical to pre-ENG-948 mobile. Web already
ships multi-timer without this gate.

Default OFF until ramped. Adoption via existing `recipe_timer_started` /
`recipe_timer_completed`.

#### Ramp schedule

| Phase | Action | Why |
| --- | --- | --- |
| Pre-ramp | Validate multi-pill + concurrent strip in iOS sim | Visual/timer UX must be exercised before ramp. |
| Ramp | Flip flag → 100% | One tester (Grace). |
| Cleanup | After 2 weeks at 100% with no regression | Remove gate; keep kill switch row. |

### `cook_ingredient_checklist_v1` (ENG-946)

| Property | Value |
| --- | --- |
| Flag ID | _create in PostHog before ramp_ |
| Type | Boolean |
| Platforms | Web + Mobile (iOS) |
| Owner | Grace |
| Decision doc | [2026-06-20-cook-ingredient-checklist](../decisions/2026-06-20-cook-ingredient-checklist.md) |

Gates **tap-to-check ingredient rows** (session-local, shared between recipe
detail and cook mode) plus the optional **"Gather your ingredients"** mise en
place screen before step 1. Flag ON → checklist on the Ingredients tab, mise
screen on mobile cook entry, shared store on web cook sidebar. Flag OFF → no
recipe-detail checklist, no mise screen; web cook sidebar keeps legacy local-only
check state.

Default OFF until ramped. Adoption via `cook_ingredient_checked`
(`{ recipeId, index, checked, surface, platform }`).

#### Ramp schedule

| Phase | Action | Why |
| --- | --- | --- |
| Pre-ramp | Validate checklist + mise in iOS sim + web | Structural UI ships validated, never blind. |
| Ramp | Flip flag → 100% | One tester (Grace). |
| Cleanup | After 2 weeks at 100% with no regression | Remove gate; keep kill switch row. |

### `cook_swipe_steps_v1` (ENG-947)

| Property | Value |
| --- | --- |
| Flag ID | _create in PostHog before ramp_ |
| Type | Boolean |
| Platforms | Web + Mobile (iOS) |
| Owner | Grace |
| Decision doc | [2026-06-20-cook-mode-swipe-steps](../decisions/2026-06-20-cook-mode-swipe-steps.md) |

Gates **horizontal swipe between cook steps** plus the quiet segment page
indicator on mobile (replacing the legacy filled progress bar). Flag ON → swipe
with selection haptic + segment indicator on `/cook` and the recipe cook
overlay; touch swipe on web (segment indicator already existed). Flag OFF →
buttons-only navigation; mobile keeps the legacy progress bar — byte-identical
to pre-ENG-947.

Default OFF until the PostHog flag is created and ramped. Adoption is
queryable via `cook_step_swiped` (`{ direction, platform }`).

#### Ramp schedule

| Phase | Action | Why |
| --- | --- | --- |
| Pre-ramp | Validate swipe + indicator in iOS sim + web mobile-web width | Structural UI ships validated, never blind. |
| Ramp | Flip flag → 100% | One tester (Grace); no cohort split needed. |
| Cleanup | After 2 weeks at 100% with no regression | Remove the gate; keep the row as an emergency kill switch. |

### `cook_text_size_control_v1` (ENG-949)

| Property | Value |
| --- | --- |
| Flag ID | _create in PostHog before ramp_ |
| Type | Boolean |
| Platforms | Web + Mobile (iOS) |
| Owner | Grace |
| Decision doc | [2026-06-20-cook-mode-text-size-control](../decisions/2026-06-20-cook-mode-text-size-control.md) |

Gates the in-cook **A−/A+ text-size control** that scales the step
instruction text and persists the choice per user. Flag ON → the control
renders in the cook header (web `CookMode.tsx`) and the cook overlay header
(`apps/mobile/app/recipe/[id].tsx`), a previously-persisted size is applied,
and the mobile step base is 24 px. Flag OFF → no control, no persisted size
re-applied, and the mobile step text stays at the legacy `22 / 32` — i.e.
byte-identical to pre-ENG-949.

Default OFF until the PostHog flag is created and ramped — a cold/missing
client resolves `isFeatureEnabled("cook_text_size_control_v1")` to `false`.
Adoption + most-used size are queryable via the `cook_text_scale_changed`
event (`{ scale, direction, platform }`, same name web ↔ mobile).

#### Ramp schedule

| Phase | Action | Why |
| --- | --- | --- |
| Pre-ramp | Validate in iOS sim + web (light + dark, smallest + largest size) | Structural UI ships validated, never blind. |
| Ramp | Flip flag → 100% | One tester (Grace); no cohort split needed. |
| Cleanup | After 2 weeks at 100% with no regression | Remove the gate; keep the row as an emergency kill switch. |

### `deeplink_skeletons` (ENG-768)

| Property | Value |
| --- | --- |
| Flag ID | _create in PostHog before ramp_ |
| Type | Boolean |
| Platforms | Mobile only (iOS) |
| Owner | Grace |
| Decision doc | _none — UI-consistency change, no separate decision_ |

Gates the deeplink cold-open loading state on the two mobile surfaces
that still used a raw centred `ActivityIndicator` + "Loading…": Activity
Bonus (`apps/mobile/app/burn-detail.tsx`) and Shopping
(`apps/mobile/app/shopping.tsx`). Flag ON → skeleton silhouette of the
loaded layout (`BurnDetailLoadingSkeleton` / `ShoppingLoadingSkeleton`,
both built from the shared `Shimmer` primitive in
`components/ui/SkeletonRow.tsx`), matching the Progress tab's tile
treatment. Flag OFF → the legacy spinner, byte-identical to pre-ENG-768.

Default OFF until the PostHog flag is created and ramped — a cold/missing
client resolves `isFeatureEnabled("deeplink_skeletons")` to `false`, so an
unconfigured flag keeps the spinner. **Visual validation in the iOS sim is
a pre-ramp step** (both light + dark; cold-open both screens) before
flipping the flag on.

#### Ramp schedule

| Phase | Action | Why |
| --- | --- | --- |
| Pre-ramp | Validate skeleton in iOS sim (light + dark, both screens) | Visual changes ship validated, never blind. |
| Ramp | Flip flag → 100% | One tester (Grace); no cohort split needed. |
| Cleanup | After 2 weeks at 100% with no regression | Remove the gate, keep the row as an emergency kill switch (flag-hygiene rule below). |

### `post_log_what_next_v1` (ENG-977)

| Property | Value |
| --- | --- |
| Flag ID | _create in PostHog before ramp_ |
| Type | Boolean |
| Platforms | Web + mobile (iOS) |
| Owner | Grace |
| Decision doc | [2026-06-20-post-log-what-next-micro-moment](../decisions/2026-06-20-post-log-what-next-micro-moment.md) |

Gates the calm post-log "what to eat next" micro-moment: after an AI log
(photo / voice / describe) commits with budget left for the day, the generic
"Logged N items" toast is replaced by one grounded line — a library suggestion
or a plain budget read-out (`buildPostLogSuggestion`,
`src/lib/nutrition/postLogSuggestion.ts`). Flag OFF → the legacy count toast,
byte-identical to pre-ENG-977.

Default OFF until the PostHog flag is created and ramped — a cold/missing
client resolves `isFeatureEnabled("post_log_what_next_v1")` to `false`. The
suggestion is deterministic + grounded (reuses the `northStarSuggestion`
scorer over the user's own library and remaining budget), so there is no
AI-cost or "AI broke → blank" risk to ramp around.

#### Ramp schedule

| Phase | Action | Why |
| --- | --- | --- |
| Pre-ramp | Validate the line on web + iOS sim (over-budget → no nudge; budget-left → suggestion/read-out) | Visual changes ship validated, never blind. |
| Ramp | Flip flag → 100% | One tester (Grace); no cohort split needed. |
| Cleanup | After 2 weeks at 100% with no regression | Remove the gate, keep the default-toast `else` branch as the fallback. |

### `streak_pip_zero_day_web_v1` (ENG-1657)

| Property | Value |
| --- | --- |
| Flag ID | _create in PostHog before ramp_ |
| Type | Boolean |
| Platforms | Web only (mobile already shows the pip at 0-day when mounted) |
| Owner | Grace |
| Decision doc | [2026-07-22-eng1657-streak-pip-zero-day-web-parity](../decisions/2026-07-22-eng1657-streak-pip-zero-day-web-parity.md) |

Gates whether the web Today date header mounts `StreakPip` at 0-day /
1-day streak (mobile calm-streak posture). Flag ON → mount for any
non-negative streak count on today's day view. Flag OFF → legacy web gate
(`streakDays >= 2` only). The primitive always renders when mounted; only
the header mount rule changes.

Default OFF until ramped — a cold/missing client resolves
`isFeatureEnabled("streak_pip_zero_day_web_v1")` to `false`.

#### Ramp schedule

| Phase | Action | Why |
| --- | --- | --- |
| Pre-ramp | Create the PostHog row; validate flag-on pixels on web (`web-drive`) with 0-day and 1-day fresh-user states (light + dark) | Showing a previously-hidden pip is a visual change — validate before ramp. |
| Ramp | Internal (Grace) → 100% | One tester; no cohort split needed. |
| Cleanup | After 2 weeks at 100% with no regression | Remove the gate + legacy ≥2-day branch; keep the row as an emergency kill switch. |

### `progress_hierarchy_v1` (ENG-1525)

| Property | Value |
| --- | --- |
| Flag ID | _create in PostHog before ramp_ |
| Type | Boolean |
| Platforms | Web + Mobile (iOS) |
| Owner | Grace |
| Decision doc | [2026-07-16-progress-hierarchy-v1](../decisions/2026-07-16-progress-hierarchy-v1.md) |

Gates the **Progress tab 5-section hierarchy rebuild** (Trajectory hero ·
This Week · Energy · Body composition · Your Week) on both platforms. Flag
ON → the `ProgressHierarchyV1` composer renders the 5 sections, including
the one tinted hero card (goal-conditional per the decision doc's delta 1)
and the corrected maintenance − intake equation. Flag OFF → the legacy
13-card stack, byte-identical to pre-ENG-1525 — the `else` branch in both
hosts is the kill switch. The flag is read once on mount, so a mid-session
PostHog change never restructures the page under the user.

Default OFF until ramped (the `energy_numbers_v1` structural-rebuild
precedent, not the additive-card "always flag on" convention) — a
cold/missing client resolves `isFeatureEnabled("progress_hierarchy_v1")`
to `false`.

#### Ramp schedule

| Phase | Action | Why |
| --- | --- | --- |
| Pre-ramp | Create the PostHog row; validate flag-on pixels on web (`web-drive`) + iOS sim with before/after screenshots (light + dark; goal-user, trends_only, opt-out, and sparse weigh-in states) | A full-tab structural rebuild ships validated, never blind. |
| Ramp | Internal (Grace) → 100% | One tester; no cohort split needed. |
| Cleanup | After 2 weeks at 100% with no regression | Remove the gate + the dead legacy 13-card branch; keep the row as an emergency kill switch. |

### `session-replay-sample-rate` (ENG-516)

| Property | Value |
| --- | --- |
| Flag ID | 679616 |
| Type | Boolean (with numeric payload) |
| URL | https://us.posthog.com/project/389168/feature_flags/679616 |
| Owner | Grace |
| Decision doc | [2026-05-16-session-replay-sample-rate-flag](../decisions/2026-05-16-session-replay-sample-rate-flag.md) |

Drives the session-replay sample rate on web + mobile. Boolean `true`
at 100%; the numeric payload is the per-session sample rate (0.0 - 1.0).

#### Ramp schedule

| Phase | Date | Payload | Why |
| --- | --- | --- | --- |
| Pre-launch (today) | 2026-05-16 → Phase 1 launch | `"1.0"` | N=1 (Grace). Every TF/web bug report is a replayable session. Storage cost trivial. |
| Day-of Phase 1 launch | Day TF + web open to real users | `"0.1"` | First viral surge could push 1k+ sessions/day; full capture blows the PostHog free tier (5k recordings/month). 10% gives a representative sample without runaway cost. |
| Steady state | Week 4+ of Phase 1 | `"0.05"` or `"0.02"` | Adjust based on actual storage consumption + which sessions we're using. If we're only watching crash-tagged sessions, sample low + use replay filters. |
| Incident response | When needed | `"1.0"` | Temporary flip to capture every session for debugging an outage. Don't forget to flip back. |

#### How to ramp

1. Open https://us.posthog.com/project/389168/feature_flags/679616
2. Edit the flag.
3. Under "Payload", change the `true` variant's value (e.g. from
   `"1.0"` to `"0.1"`). Keep it a JSON-quoted number string.
4. Save.

Takes effect on each user's next session (typically within 24h for
active users). The current session's recording isn't affected because
PostHog decides sampling once at recording-start.

#### Kill switch

To temporarily disable session replay entirely (e.g. a privacy
incident or storage emergency):

- Option A — Flag payload to `"0"`. The SDK won't start any new
  recordings. Reversible without a deploy. Takes effect on each user's
  next session.
- Option B — At the PostHog project level, toggle "Enable session
  recording" off. Immediate effect on all users. Reversible from the
  same toggle.

Option B is faster (no per-user lag). Use it for incidents. Use the
flag payload approach for everyday rate adjustments.

#### Volume sanity check (rough)

PostHog free tier: 5,000 recordings/month.

| Daily sessions | Sample 1.0 | Sample 0.1 | Sample 0.01 |
| --- | --- | --- | --- |
| 100 | 3,000/mo ✅ | 300/mo ✅ | 30/mo ✅ |
| 500 | 15,000/mo ❌ | 1,500/mo ✅ | 150/mo ✅ |
| 1,000 | 30,000/mo ❌ | 3,000/mo ✅ | 300/mo ✅ |
| 5,000 | 150,000/mo ❌ | 15,000/mo ❌ | 1,500/mo ✅ |

So:
- Below ~150 daily sessions → 1.0 is fine.
- 150 - 1,500 daily sessions → 0.1 is the sweet spot.
- Above ~1,500 daily sessions → 0.01 or move off free tier.

Refine these numbers once we have actual traffic. They're back-of-
envelope estimates assuming 30 days/month.

## Retired flags

### `dial_flat_material_v1` (ENG-1571) — resolved without creation, 2026-07-17

| Property | Value |
| --- | --- |
| Flag ID | _never created in PostHog_ |
| Type | Boolean (planned) |
| Platforms | Web + Mobile (iOS) |
| Owner | Grace |
| Decision doc | [2026-07-17-dial-flat-material](../decisions/2026-07-17-dial-flat-material.md) |

Was to gate the flat-material calorie dial (radial bloom removed, all states,
both themes) with the bloom as the `else`/kill switch. **Intentionally never
registered:** the bloom was already removed unconditionally on 2026-06-22
(commit `03946c62`), so both arms of the flag would have been byte-identical —
there is no bloom path to gate or kill-switch back to, and production has run
flat-dial since then with no regression. The ruling is enforced by test pins
instead (`tests/unit/calorieRingDial.test.tsx` +
`apps/mobile/tests/unit/calorieRingDial.test.tsx`). No PostHog archival needed
(nothing exists to archive); listed here so the flag name stays searchable.

## Flag hygiene rules

- Every active flag has a decision doc in `docs/decisions/` linked from
  the table above.
- Every active flag has a named owner.
- Flags that have held 100% for two weeks with no regression are
  candidates for code-side cleanup (remove the gate, leave the flag
  for emergency kill-switch use if applicable).
- Flags retired permanently get archived in PostHog AND moved to the
  "Retired flags" section above with the retirement date.
