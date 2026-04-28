# Onboarding v2 mobile port — sprint backlog

**Date:** 2026-04-28
**Author:** planner (Phase 6 P0-4)
**Status:** Ready for execution

---

## Surprise finding

The mobile port is **~80% pre-built**, not 0% as the audit suggested. Direct file reads showed the state machine, all 15 step components, the provider, the shell, the slider, the recipe-picker grid, the seeds shim and the persist helpers all exist on mobile. The remaining work is **four targeted gaps**, not a full rebuild.

### Already shipped on mobile (no work required)

| Module | Path |
|---|---|
| Shared state machine | `src/lib/onboarding/v2/state.ts` (mobile shim at `apps/mobile/lib/onboarding-v2.ts`) |
| Targets pipeline | `src/lib/onboarding/v2/targets.ts` |
| OnboardingV2Provider | `apps/mobile/components/onboarding-v2/context.tsx` |
| MobileFlow shell | `apps/mobile/components/onboarding-v2/mobile-flow.tsx` |
| All 15 step components | `apps/mobile/components/onboarding-v2/steps/{welcome,signup,goal,sex,age,height,weight,activity,pace,diet,strategy,reveal,permissions,import,recipes}.tsx` |
| MobileMiniSlider | `apps/mobile/components/onboarding-v2/slider.tsx` |
| RecipePickerGrid | `apps/mobile/components/onboarding/RecipePickerGrid.tsx` |
| Persist helper | `src/lib/onboarding/v2/persist.ts` (platform-agnostic) |
| Seed resolver + first-week builder | `src/lib/onboarding/onboardingSeedResolver.ts`, `onboardingFirstWeek.ts` |
| Final-step picker state | `src/lib/onboarding/v2/finalStep.ts` |
| Route entry | `apps/mobile/app/onboarding-v2.tsx` |
| Flag redirect from legacy | `apps/mobile/app/onboarding.tsx` (already wired) |
| Seed migration | `supabase/migrations/20260503110000_onboarding_seed_recipes.sql` (staged) |

---

## Backlog — 8 tasks (3 ops, 5 executor)

### OB-M-01 — Terminal-step completion handler in MobileFlow

**Severity:** P0 — without this, "Build my first week" is a no-op. No profile saved, no first week generated, no nav to the app.

**Effort:** M (~3h)

**File:** `apps/mobile/components/onboarding-v2/mobile-flow.tsx`

Mirror `web-flow.tsx:87–200`:
1. Call `persistOnboardingV2(supabase, { userId, state, targets })` from the shared lib.
2. If `pickedSeeds.length > 0`, call `resolveSeedsToRecipeIds` → `saveResolvedSeeds` → `buildFirstWeekFromSeeds`.
3. Fire `track(AnalyticsEvents.onboarding_completed, { flow: "v2", ... })`.
4. `router.replace("/(tabs)")` (with `?onboarding_complete=1` or `?plan_build=failed` query if Today reads them).
5. Gate on non-null `userId`; route unauthenticated to `/login`.
6. Disable CTA + show ActivityIndicator while completing.

**Tests:** unit (persist call shape, resolver/save/build calls, unauth path, plan-build failure path); integration (mocked Supabase, full flow).

**Owner:** executor. **Reviews:** qa-lead, data-integrity.

---

### OB-M-02 — Wire real Supabase auth in MobileSignupStep

**Severity:** P1 — without this, users without an existing session click "Sign in with Apple", advance, and hit the unauthenticated guard at terminal step.

**Effort:** M (~3h)

**Files:**
- `apps/mobile/components/onboarding-v2/steps/signup.tsx`
- `apps/mobile/components/onboarding-v2/mobile-flow.tsx`

What:
1. Wire `expo-apple-authentication` for the Apple button. On success, `supabase.auth.signInWithIdToken(...)` → advance only after session established.
2. Add auto-skip for already-authed users in MobileFlow (mirror web-flow.tsx:67–71).
3. Suppress footer Continue when on signup step — the step's own CTA drives progression.
4. Email/password fallback can stub-only for v1 launch (Q1 below).

**Note:** Google OAuth on web is intentional divergence — App Store requirements favour Apple Sign-In on iOS.

**Owner:** executor. **Reviews:** qa-lead.

---

### OB-M-03 — Wire real iOS permission requests in MobilePermissionsStep

**Severity:** P1 — currently the "Allow" buttons set state flags but make no OS calls. Permissions never get requested.

**Effort:** S (~1h)

**File:** `apps/mobile/components/onboarding-v2/steps/permissions.tsx`

What:
1. **Apple Health card:** tap "Allow" → call existing HealthKit auth helper from `apps/mobile/app/health-sync.tsx`. On success → `set({ healthGranted: true })`. On denial → `set({ healthGranted: false })`.
2. **Notifications card:** tap "Allow" → `Notifications.requestPermissionsAsync()`. On `granted` → `set({ notifGranted: true })`.
3. "Not now" path stays state-only.

**Owner:** executor. **Reviews:** qa-lead.

---

### OB-M-04 — Add `onboarding-v2` to STACK_HEADER_HIDDEN

**Severity:** P1 — without this, native stack renders an auto-titled header bar over the MobileFlow custom top bar (double headers).

**Effort:** XS (~15min)

**File:** `apps/mobile/app/_layout.tsx`

One-line: add `"onboarding-v2"` to the `STACK_HEADER_HIDDEN` Set.

**Owner:** executor.

---

### OB-M-05 — Confirm seed migration applied on linked prod

**Severity:** P0 blocker for OB-M-01 — if seed recipes don't exist, `resolveSeedsToRecipeIds` returns empty, `saveResolvedSeeds` and `buildFirstWeekFromSeeds` are no-ops.

**Effort:** XS (~5min, ops)

What: `supabase migration list --linked`; if `20260503110000` absent, `supabase db push --linked`. Do NOT use MCP `apply_migration`.

**Validation:** `SELECT title FROM recipes WHERE title ILIKE 'Sheet Pan Salmon%' LIMIT 1` returns a row.

**Owner:** Grace (per `feedback_supabase_db_push_authorised`).

---

### OB-M-06 — Cutover: promote `onboarding_v2` PostHog flag to 100% on mobile

**Severity:** P1 ship gate

**Effort:** XS (PostHog flag flip)

**Prerequisites:** OB-M-01, -02, -03, -04, -05, -07 all complete.

The flag redirect in `apps/mobile/app/onboarding.tsx:277–287` already subscribes to flag changes — flipping the flag on the dashboard is the only action.

**Cutover plan for mid-onboarding users:** N=1 tester (Grace), so mid-onboarding state loss is acceptable. Legacy `saveAndFinish` still writes a valid `profiles` row if a user finishes the legacy flow they started before the flip.

**Owner:** Grace (PostHog dashboard).

---

### OB-M-07 — Tests for mobile v2 completion path

**Severity:** P1 — required before OB-M-06.

**Effort:** M (~2.5h)

**Files to create:** `apps/mobile/tests/unit/onboardingV2Completion.test.ts`

**Coverage:**
- `buildProfileUpsertRow` mapping for all 4 goal types
- `derivePickerState` threshold (picked.size < 5 / >= 5)
- `resolveNextStep` auto-skips for maintain goal + weight skipped
- `canAdvance("recipes", ...)` = true; gate is on `pickerState.canSubmit`
- `paceWarning` returns `danger` when below safety floor
- Full completion path with mocked Supabase (4 calls in order)
- Partial failure (`buildFirstWeekFromSeeds` ok:false → still tracks completion)
- Unauthenticated path (no upsert call)

**Owner:** executor. **Reviews:** qa-lead.

---

### OB-M-08 — Delete legacy `onboarding.tsx` (deferred)

**Severity:** P2

**Effort:** XS (~30min)

**Prerequisite:** Two TestFlight builds shipped post-cutover with no regressions.

Reduce to redirect tombstone or delete. Update `STACK_HEADER_HIDDEN` if the route name can be removed.

**Owner:** executor.

---

## Critical path

```
OB-M-05 (Grace, ~5min)
    │
    ├── OB-M-04 (executor, 15min)        — independent, can run anytime
    │
    ├── OB-M-02 (executor, 3h)           — parallel with OB-M-01, -03
    ├── OB-M-03 (executor, 1h)           — parallel with OB-M-01, -02
    └── OB-M-01 (executor, 3h)           — critical path bottleneck
            │
            └── OB-M-07 (executor, 2.5h)
                    │
                    └── OB-M-06 (Grace, PostHog flip)
```

Minimum clock time with parallel executor lanes: ~1 sprint day.

---

## Open questions

- **Q1 — Signup email+password.** Three options: (a) Apple-only for v1 (lowest risk), (b) wire signUp + handle email-confirm interstitial, (c) signUp with confirm-email disabled in Supabase project config. Route to `product-lead`. Recommend (a).
- **Q2 — First-week plan: live `meal_plans` rows vs draft.** Web writes live rows. Maintain parity? Or stage with `is_onboarding_seed` flag? Route to `product-lead`. Recommend live (parity).
- **Q3 — Seed migration applied on prod?** Blocker for OB-M-01 integration test. Grace to confirm.
- **Q4 — HealthKit auth helper.** Confirm with `health-sync` route maintainer which helper `MobilePermissionsStep` should call.

---

## Out of scope

- UI design for any step (all 15 already exist; ui-product-designer can review independently but no design work blocks execution)
- Web changes (web v2 is at 100%)
- Cook mode multi-timer port (separate item D10)
- Discover "Following" pill (separate item D5)

---

## Total effort estimate

| Task | Effort | Owner |
|---|---|---|
| OB-M-01 Terminal handler | M (~3h) | executor |
| OB-M-02 Auth wiring | M (~3h) | executor |
| OB-M-03 Permissions wiring | S (~1h) | executor |
| OB-M-04 STACK_HEADER_HIDDEN | XS (~15min) | executor |
| OB-M-05 Migration confirm | XS (~5min) | Grace |
| OB-M-06 Flag flip | XS (~5min) | Grace |
| OB-M-07 Tests | M (~2.5h) | executor |
| OB-M-08 Legacy deletion (deferred) | XS (~30min) | executor |

**Critical-path total (executor work, parallelised):** ~1 sprint day.

**Scope correction vs initial brief:** the brief assumed everything needed building from scratch. None of that is true — the actual remaining work is the four targeted gaps above plus tests + cutover.
