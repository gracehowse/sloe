# Executor backlog — orchestrator-full-sweep (2026-04-24)

**Source:** [Full-sweep audit 2026-04-24](../audits/2026-04-24-full-sweep.md) + [ship verdict](../decisions/2026-04-24-full-sweep-ship-verdict.md).
**Supersedes:** [sweep-2026-04-executor-backlog.md](./sweep-2026-04-executor-backlog.md) (all P0 rows there shipped; blocker #1 was only half-closed — write-side reopens here as T1).
**Handoff:** `executor` implements in order below; `qa-lead` aligns tests; `docs-keeper` updates policy docs where noted; `product-memory` captures decisions on open questions.

---

## Phase 1 — Unblock next TestFlight build (N=1 → small cohort)

All must ship together. Each is independently testable.

| ID | Title | Problem | Goal | Effort | Deps | Platforms | Validation | Owner | Review |
|----|---|---|---|---|---|---|---|---|---|
| **T1** | Onboarding v2 flag → 0% | Flag is at 100% but Signup, Permissions, Import, and terminal step are all stubs — every install reaches Today without an account | Flag reverted today; legacy `/onboarding` serves; monitor install→first-log funnel stays green | S | — | mobile + web | Manual: install → onboarding completes → profile row written, targets saved, paywall shown. Analytics: `onboarding_completed` fires. Cohort count on v2 funnel drops to zero. | executor | growth-strategist, analytics-engineer |
| **T2** | Column-level RLS for `profiles.user_tier` + billing columns | `profiles_update_own` allows any authenticated client to `UPDATE profiles SET user_tier='pro'` | Trigger or RPC-only path so anon-key UPDATE of `user_tier`, `stripe_customer_id`, `subscription_status`, `trial_*` is rejected; service-role path remains for Stripe webhook + future RC webhook | S | — | backend | Integration test with anon JWT attempting `update({user_tier:'pro'})` returns 42501 or 403. Existing Stripe webhook tier write still passes. `householdPrivacyRls.test.ts`-style regex guard for the policy. | executor | security-reviewer |
| **T3** | Strip fabricated claims | "94% confidence · USDA" chip in onboarding Import + Welcome FloatingPreview; "7-second parse, USDA-verified" on paywall bullets + upgrade dialog | Neutral preview framing ("Sample recipe · preview"), no quantified confidence, no certification-implying verbs. `basePaywallContent.ts:70` + `upgrade-paywall-dialog.tsx:99` rewritten | S | — | web + mobile | Grep for "94% confidence", "USDA-verified", "7-second" returns zero live-rendered matches. Legal-reviewer sign-off on new copy. | copy-reviewer + executor | legal-reviewer |
| **T4** | Macro coercion: display-only contract | `coerceMacrosWhenCaloriesByNoGrams` returns fabricated 28/42/30 P/C/F that reaches `nutrition_entries` writes on mobile (confirmed journal leak) | Type guard `CoercedForDisplay` cannot be written to `nutrition_entries`; `apps/mobile/app/(tabs)/index.tsx` log paths refuse coerced values; planner displays original kcal + "incomplete macros" flag OR kcal only (decision: display-only) | M | Grace decision on display policy | web + mobile | Unit: journal write refuses coerced object. E2E: recipe with kcal + 0g macros logged → entry has null P/C/F OR raises estimation flag. Web + mobile show identical behaviour on same row. | nutrition-engine + executor | product-lead, legal-reviewer |
| **T5** | Rewrite bug-pinning tests | `tests/unit/planCalendarAnchor.test.ts` rewards first-match-offset behaviour (should fail on ambiguity); `tests/unit/totalGramsForVerifyScale.test.ts` asserts 1 ml = 1 g as "correct"; `tests/unit/plannedMealDisplay.test.ts` uses `not.toMatch` (passes too-wide) | Tests fail until T13 (anchor schema) and a density lookup land. Tests assert exact expected strings for `plannedMealDisplay` `<1` / one-decimal / zero branches | S | — | tests | `npm run test` goes red until underlying fixes land (this is the point). No test skipped. | qa-lead + executor | nutrition-engine |

**Phase 1 gate:** re-run `security-reviewer`, `nutrition-engine`, `legal-reviewer`, `qa-lead` → all four must sign off → move to Phase 2.

---

## Phase 2 — Expand TestFlight cohort

Sequenced by dependency. T9 depends on a stable T1 state; T7 depends on decision for anchor schema; T12 depends on T4 policy.

| ID | Title | Problem | Goal | Effort | Deps | Platforms | Validation | Owner | Review |
|----|---|---|---|---|---|---|---|---|---|
| **T6** | RevenueCat server webhook | Mobile cancellations/refunds never reach Supabase; `resolveNextTier` blocks client downgrade | `/api/revenuecat/webhook` route verifies RC shared secret, maps `app_user_id`→userId, writes `profiles.user_tier` via service-role on CANCELLATION / EXPIRATION / BILLING_ISSUE / RENEWAL / INITIAL_PURCHASE | M | RC dashboard config (Grace) | backend | Integration test with signed RC payloads transitions `profiles.user_tier` correctly; unsigned payloads rejected. Manual: TestFlight cancel via Settings → tier revoked within minutes. | integration-manager + executor | security-reviewer, monetisation |
| **T7** | `meal_plans` anchor schema | `findPlanDayIdForCalendarDate` iterates `[0,1,7]` offsets; "next week" plans bleed into today | New `meal_plans(id, user_id, slot_id, start_date)` parent table OR `meal_plan_days.start_date` column; resolver reads persisted anchor; backfill existing rows with `day=1` → today | M | T5 (test rewrite), decision on parent-table vs column | backend + web + mobile | T5 test now passes with disambiguated anchor. E2E: plan saved with offset 7 stays on day+7 across reloads on web + mobile. Migration runs forward + backward. | data-integrity + nutrition-engine + executor | sync-enforcer |
| **T8** | Dead-name fix on household meal attribution | `cook_display_name` snapshot column reintroduces the leak closed on member rows | Drop `cook_display_name` from `householdClient` read path; join live `profiles.display_name` on `added_by` at render; keep column as leaver-only fallback ("A member" when no profile row survives) | S | — | backend + web + mobile | Unit: `tests/unit/householdMealDeadNameGuard.test.ts` pins precedence. Manual: rename test user, verify old household_meals rows show new name everywhere. | data-integrity + executor | diversity-inclusion |
| **T9** | Onboarding v2 rebuild (Phase A — auth + persistence) | Signup/Permissions/Import/terminal are stubs | Signup: real `expo-apple-authentication` + `supabase.auth.signInWithIdToken` OR email+password via `supabase.auth.signUp`; Permissions: real HealthKit request + `Notifications.requestPermissionsAsync` + `registerExpoPushTokenForUser`; terminal step: `persistOnboardingV2` + `router.replace("/paywall?from=onboarding")`; `onboarding_completed` event fires | M | T1 flag still 0% during build | mobile | E2E: 13-step flow creates `auth.users` row + `profiles` row + targets + push token; iOS permissions dialogs actually appear; `paywall_viewed` fires post-complete. | executor + ui-product-designer | integration-manager, analytics-engineer, journey-architect |
| **T10** | Onboarding v2 rebuild (Phase B — Import + polish) | Import is hardcoded setTimeout; 11 files on Ionicons; ambient canvas only on Welcome; status bar white-on-light; hard `\n` breaks | Import calls real recipe-import API with timeout + fallback for unsupported URL / low-confidence / paywall-hit; lucide-react-native sweep for onboarding-v2; ambient canvas across steps; `StatusBar barStyle="auto"`; remove manual `\n` from Welcome headline | M | T9 | mobile | Manual: paste real Instagram URL → recipe appears in library. Grep `@expo/vector-icons` in `apps/mobile/components/onboarding-v2/` returns zero. Status bar readable light mode. | executor + ui-product-designer | design-system-enforcer, copy-reviewer |
| **T11** | Re-enable onboarding v2 flag to 100% (conditional) | Flag stays at 0% post-T1 | After T9 + T10 verified in TestFlight, ramp flag: 10% → 50% → 100% with funnel monitoring | S | T9, T10 | mobile | v2 `onboarding_completed` funnel ≥ v1 funnel on each ramp; no regression in D1 retention | growth-strategist + executor | product-lead |
| **T12** | Allergen surfacing v0 | DI-P0-01 safety-critical, 5+ days no movement | `recipes.allergens text[]` column, auto-populate from confident ingredient matches (block <0.70 confidence), "Contains: …" callout on detail (web + mobile), 14 regulated allergens in onboarding diet step (split Nuts → Peanuts + Tree nuts; add Fish, Wheat, Sesame, Mustard, Celery, Sulfites, Lupin); never paywalled | L | Decision on launch policy (ship v0 vs documented accepted risk) | backend + web + mobile | Unit: allergen inference blocks at <0.70 confidence. E2E: recipe with shellfish shows "Contains: Crustaceans" on both platforms. Copy reviewed by legal-reviewer. | nutrition-engine + data-integrity + executor | legal-reviewer, diversity-inclusion |
| **T13** | Weight surface mode | DI-P0-03 ED/dysphoria risk | `profiles.weight_surface_mode` (`show` / `hide` / `trends_only`); Digest + Progress honour on both platforms; Settings toggle | M | — | backend + web + mobile | E2E: toggle to hide → Digest weight tile replaced with Logging consistency; trends_only → arrow only, no kg. Identical behaviour web + mobile. | journey-architect + ui-product-designer + executor | diversity-inclusion, sync-enforcer |
| **T14** | `generateSmartPlan` off UI thread | 6-11s freeze on-device at pool=40; sync sampler | `InteractionManager.runAfterInteractions` + spinner; sampler cap 20k → 2k stratified; `performance.now()` + PostHog `meal_plan_generate_duration_ms` | M | — | mobile | Maestro: regenerate tap → UI responsive throughout; PostHog p95 < 2s at pool=40 on-device. | performance-optimizer + nutrition-engine + executor | qa-lead |
| **T15** | Plan save → bulk insert + transaction | Mobile: 14 serial RTTs; delete-then-insert no transaction = partial-plan risk on backgrounded app | Single Postgres function `save_meal_plan(plan jsonb)` — delete + inserts in one transaction; mobile calls via RPC. Web already bulk-inserts; adopt same RPC for parity | S-M | T7 (anchor schema) | backend + mobile | Test: kill app mid-save → plan untouched or fully replaced. RTT count on save drops to 1. Both platforms go through same RPC. | data-integrity + executor | performance-optimizer |
| **T16** | Nutrition approximation policy doc | No policy doc for `coerceMacrosWhenCaloriesByNoGrams`, `totalGramsForVerifyScale`, `measureToGrams` "large" ordering | New `docs/product/nutrition-approximation-policy.md` OR extension of `docs/technical/architecture.md §Nutrition` documenting each approximation, its trigger conditions, error bounds, and enforcement boundary. Source headers reference the doc | S | T4 decisions | docs | docs-keeper sign-off; grep sources for `coerceMacros`, `totalGramsForVerifyScale`, `measureToGrams` — each has a reference to the policy | docs-keeper | nutrition-engine |

**Phase 2 gate:** re-run `security-reviewer`, `nutrition-engine`, `sync-enforcer`, `qa-lead`, `diversity-inclusion`, `release-gate` → all must sign off → move to Phase 3.

---

## Phase 3 — App Store submission

| ID | Title | Problem | Goal | Effort | Deps | Platforms | Validation | Owner | Review |
|----|---|---|---|---|---|---|---|---|---|
| **T17** | Canonical domain + DMCA agent reachability | `suppr-club.com` vs `supprclub.com` in production; DMCA + privacy + refund emails may bounce | Pick one; register both; 301 non-canonical; sweep `app/dmca/page.tsx`, `app/pricing/page.tsx`, `app/layout.tsx`, `apps/mobile/app.json`, `REBRAND.md`, `ATTRIBUTIONS.md`, every `support@*` string, VAPID subject, bot UA, Stripe support contact, App Store support URL. DMCA-agent registration updated | M | Grace registrar decision | web + mobile + landing + email | `ripgrep suppr-club\.com\|supprclub\.com` returns only the chosen spelling (plus the 301 redirect config). Manual: `support@<canonical>` delivers. DMCA registration email matches. | brand-manager + executor + Grace | legal-reviewer |
| **T18** | "Suppr Club" branding decision + sweep | Every "Join the Suppr Club" widens TM exposure vs App Store "Supper Club!" | Either (a) pause + rename on first-impression surfaces (web onboarding welcome, landing, paywall footer, CTAs), OR (b) counsel-signed risk-accepted memo in `docs/decisions/`. If rename: global CTA copy rework | L | Counsel input | web + mobile + landing | Decision captured in decision log. If rename: grep for "Suppr Club" returns only deliberate references. If memo: stored in docs with counsel attribution. | brand-manager + product-lead + formal counsel | legal-reviewer |
| **T19** | FatSecret tier resolution | Open action items since 2026-04-19; persisting macros + `fatsecret_food_id` on free/Basic tier breaches ToS | Confirm current tier. If Premier: update `docs/decisions/2026-04-19-fatsecret-caching.md` with evidence. Else: upgrade OR stop persisting macros / remove `fatsecret_food_id` column and re-fetch on demand | M | Grace confirms account tier | backend | Decision doc checkboxes all ticked; legal-reviewer countersigns. Schema audit confirms macro-persistence policy matches tier. | integration-manager + monetisation + Grace | legal-reviewer, data-integrity |
| **T20** | Household write-path hardening | `household_meals` UPDATE WITH CHECK lets creator relocate to foreign household; `household_join_by_invite_code` RPC ignores `disbanded_at` + `invite_code_expires_at` | UPDATE policy WITH CHECK adds `AND household_id IN (public.auth_household_ids())` + immutable `added_by` trigger. RPC lookup adds `AND h.disbanded_at IS NULL AND (h.invite_code_expires_at IS NULL OR h.invite_code_expires_at > now())` with distinct return codes | S | — | backend | pgtap or anon-key integration tests: relocation blocked; stale code returns `invite_expired`; disbanded returns `household_disbanded`. | executor | security-reviewer, data-integrity |
| **T21** | web_push_subscriptions per-user endpoint | Shared browser leaks User A's pushes to User B | Either composite unique `(user_id, endpoint)` + DELETE-on-login-change, OR call `pushManager.getSubscription()?.unsubscribe()` on login/logout mint-fresh. Pick whichever maintains browser push-permission state | S | — | web | Manual: User A subscribes, logs out, User B logs in + subscribes, cron fanout sends A's body only to A's row, B gets B's body. | executor | security-reviewer |
| **T22** | Paywall dark-pattern audit (post-Cal-AI) | Apple pulled Cal AI 2026-04-21 for paywall violations; Suppr must audit against same criteria | Audit both paywall surfaces: (a) actual charge ≥ prominence of per-week equivalent, (b) auto-renew above fold not hidden behind toggle, (c) no second-paywall-on-dismiss, (d) cancel/refund policy visible, (e) statutory rights (UK/EU 14-day) surfaced or waived. Add `paywall_dismissed` event mobile + web `/pricing`. Fix `paywall_viewed` double-fire | M | — | web + mobile | Rubric doc with pass/fail per criterion. Analytics shows proper view/dismiss pair. legal-reviewer + monetisation-architect sign-off. | monetisation + legal-reviewer + analytics-engineer + executor | product-lead |
| **T23** | Stripe webhook persisted dedup | In-memory `Set` clears on cold start; future un-idempotent handler is a fuse | `stripe_webhook_events(event_id pk, received_at)` table; INSERT before handler; duplicate-key = skip. Same pattern for T6 RC webhook | M | T6 | backend | Concurrent duplicate events: only one handler runs. Cold restart + replay: not re-processed. | executor | security-reviewer |
| **T24** | Upgrade dialog full CMA disclosure + annual toggle | Web upgrade dialog is monthly-only at highest-intent surface; disclosure weaker than mobile paywall | Period toggle matching `/pricing` pattern; renewal note mirrors mobile paywall (price, frequency, "renews automatically until cancelled", cancel path, refund policy link, first-charge date) | S | — | web | Visual: annual option visible + selectable in dialog. Text: disclosure passes legal-reviewer against mobile reference. | executor | legal-reviewer, monetisation |
| **T25** | Pre-submission full re-sweep | Need independent verdict before pushing to App Store Connect | Re-run full 28-lens sweep per `orchestrator-full-sweep.md`; compare against this backlog; release-gate returns SHIP | L | T6–T24 | all | Green verdict from release-gate with all Phase 2+3 items closed or explicitly deferred-with-memo. | orchestrator-full-sweep | release-gate |

---

## Follow-up / next-sweep (not in the critical path)

Captured so they don't get lost; not scoped for this gate cycle.

- Rate-limit key per-IP + per-user on `/api/household/join` (security A8).
- Timeout + AbortController on photo-log / voice-log / USDA / FatSecret clients (A7).
- Two meal-plan algorithms consolidation — delete `src/lib/planning/generateMealPlan.ts` or migrate both to shared (C8).
- `measureToGrams` food-specific before size-generic ordering (C5).
- `RECIPE_INGREDIENT_REVIEW_CONFIDENCE` 0.5 → 0.70; block <0.50 (C6).
- Custom-food source label rename from "Suppr" to "User-entered" or "Internal" (C7, B3).
- Digest → `weekly_digest_*` event rename with 30-day dual-emit (I5).
- `upsell_variant_*` events — wire real PostHog experiment with `variant_key` OR rename to not imply A/B (I2, H2).
- HealthKit sync batched update (F5).
- Discover feed virtualisation + `expo-image` (F6).
- `saveVerifiedIngredients` Promise.all or RPC batch (F7).
- Today focus-effect: parallelise targets read vs HealthKit chain (F8).
- Progress screen IA — pick one hero per range (G1).
- Planner day-card redesign (G2).
- Paywall hero-to-body transition (G3).
- Digest narrative hierarchy (G4).
- Planner `▼/▶` chevron + `🔒` emoji → lucide + proper locked-state (G5).
- Two Progress segmented-controls consolidation (G6).
- Digest "Got it" tap target (G7).
- WeightChart label both-edge clamp (G8).
- Planner day-summary strip — gate or strip to progress-bar-only (G9).
- Household-settings slot icons → planner icon parity (G10).
- Household demote from Plan primary scroll to More until N≥2 (H1).
- Discover "Matches your day" — wire real scoring or rename to "Top picks" (H3).
- Planner portion-spread hard floor + empty state (H4).
- Cook-mode "Log this meal" CTA on mobile (H6, analytics I3).
- Onboarding import → verify gate before planning (H7).
- Household invite deep-link route (H8).
- Planner snacks on web OR documented divergence (H9).
- Paywall → context-aware route (not always `/notifications-prompt`) (H10).
- Weekly-recap push Expo-token sync gate (I8).
- Digest mobile entry point (Today nudge or badge) (I9).
- `meal_plan_generated` payload enrichment (I6).
- HealthKit + plan anchor telemetry (I7).
- Gender/pronouns profile fields (E4).
- Halal / kosher / Jain onboarding options; rename "Mediterranean" (D10).
- Regional pricing currency resolver (E5).
- Brand voice unification across landing / web welcome / mobile welcome (B9).
- Onboarding welcome consent linkage (B8).
- UK/EU 14-day statutory cancellation framing (B7).
- Sex subtitle jargon (D14).
- Pace headline asymmetry + loss-as-default (D13).
- ~~Delete `scripts/mealplan_bench.mjs`~~ — deleted 2026-04-24.
- ~~Supersede-link in `docs/decisions/2026-04-full-sweep-ship-verdict.md`~~ — done 2026-04-24.
- **Pre-existing CI flakes surfaced during Phase 1 execution (not caused by this sweep):**
  - `tests/unit/mealPlanAlgo.test.ts` — "scales meal calories toward the target" — day total 1270 vs expected <1200 at 800 kcal target. Introduced around commit `41b1262` (F-70 plan calorie overshoot fix). Tracks to the two-meal-plan-algorithms drift (C8). Verified failing on `main` before T4 changes. Follow-up: consolidate algorithms (C8) will fix.
  - `tests/unit/mealPlanTargets.test.ts` — "no identical day combinations" — 3 unique vs expected ≥5. Same root cause (sampler scoring drift). Same follow-up.
  - `tests/unit/analyticsEvents.test.ts` — "every paywall_viewed emit carries {from, tier, surface, platform}" — 5s default timeout too tight for the filesystem scan under parallel test load. Passes at 30s timeout. Fix: add `timeout: 30000` to the `it()` or raise `testTimeout` in vitest config for this spec.

---

## How to use this backlog

1. Work Phase 1 in parallel where possible (T1 is instant; T2–T5 can branch off). Cross-check each with the lens in the "Review" column before merging.
2. After Phase 1 ships, re-gate with `release-gate` before starting Phase 2. Do not let Phase 2 work begin in main until the Phase 1 gate is green.
3. Phase 3 is explicitly pre-submission — everything in Phase 2 must be stable in TestFlight before Phase 3 starts.
4. Link PRs to the T-number (e.g. `fix(T2): lock down profiles.user_tier write path`). Keep this file updated — strike-through shipped rows and add a "Shipped YYYY-MM-DD" note.
5. Anything discovered mid-phase goes into the Follow-up list, not this file, unless it blocks a phase gate.
