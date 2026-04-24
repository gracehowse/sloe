# Decision log: orchestrator-full-sweep ship verdict (2026-04-24)

**Date:** 2026-04-24
**Status:** active — supersedes [2026-04 full-sweep ship verdict](./2026-04-full-sweep-ship-verdict.md) (that doc's blocker #1 was only half-closed: read-side fixed, write-side open)
**Agents involved:** orchestrator-full-sweep, 28 specialist lenses (fan-out), release-gate (independent verdict), product-memory (capture)
**Audit artifact:** [2026-04-24 full-sweep audit](../audits/2026-04-24-full-sweep.md)

---

## Verdict (one line)

**HOLD.** 20 confirmed blockers across security, legal, nutrition correctness, and product. Conditional ship would turn into a permanent backlog.

---

## Decision

Suppr is **not** ready for continued TestFlight beyond the current solo tester, and **not** ready for App Store submission until the conditions below are met. No amount of partial fixes clears this in one pass; treat as phased re-gate.

### Phase 1 — unblock next TestFlight build (N=1 → small cohort)

Must all ship together:

1. **Revert `onboarding_v2` flag to 0%** — legacy flow continues serving real auth + profile writes.
2. **Column-level RLS lockdown of `profiles.user_tier`** (+ `stripe_customer_id`, `subscription_status`, `trial_*`). Client-side UPDATE of tier columns is rejected; only service-role writes.
3. **Strip fabricated claims**: "94% confidence · USDA" in onboarding (Import + Welcome floating card); "7-second parse, USDA-verified" on paywall + upgrade dialog. Replace with truthful previews.
4. **Gate `coerceMacrosWhenCaloriesByNoGrams` behind a display-only contract.** Journal write-paths refuse coerced P/C/F. Planner policy decided separately (display incomplete-macros flag + route to verify, OR show kcal only).
5. **Rewrite the two tests that pin bugs in as correct**: `tests/unit/planCalendarAnchor.test.ts` (first-match-offset) and `tests/unit/totalGramsForVerifyScale.test.ts` (1 ml = 1 g). They should fail until the underlying schema fix and density lookup land.

### Phase 2 — expand TestFlight cohort

Phase 1 plus:

6. **RevenueCat server webhook** at `/api/revenuecat/webhook` → service-role tier reconciliation on CANCELLATION / EXPIRATION / BILLING_ISSUE / RENEWAL. Removes the Pro-forever bug.
7. **`meal_plans` schema fix** (new parent table with `start_date`, or `meal_plan_days.start_date` column). `findPlanDayIdForCalendarDate` reads the persisted anchor; no more first-match-offset guessing.
8. **`cook_display_name` dead-name fix** — drop from household client read path; join live `profiles.display_name` on `added_by`; keep column as leaver-only fallback.
9. **Onboarding v2 mobile rebuild** — real Apple/Supabase auth in Signup; real HealthKit + push registration in Permissions; real (or clearly-demo-labelled) import; terminal step calls `persistOnboardingV2` + `router.replace("/paywall")`; `onboarding_completed` event fires. Only then: flag back to 100%.
10. **Allergen surfacing v0** — `recipes.allergens text[]` column, auto-populate from confident matches, "Contains:" callout on detail, 14 regulated allergens in onboarding diet. OR document explicit accepted-risk sign-off.
11. **`profiles.weight_surface_mode`** (`show` / `hide` / `trends_only`) respected by Digest + Progress on both platforms.
12. **`generateSmartPlan` off UI thread** — `InteractionManager` yield + reduced sampler cap (20k → 2k stratified).

### Phase 3 — App Store submission

Phase 2 plus:

13. **Domain decision** — pick `suppr-club.com` OR `supprclub.com`; register both; 301 the non-canonical; sweep every legal/support surface (DMCA agent, privacy controller, refund, bot UA, app.json, VAPID subject, paywall footer).
14. **Suppr Club branding call** — pause + rename OR documented risk-accepted memo from counsel. TM-1 timeline determines onboarding Welcome copy.
15. **FatSecret tier decision** — Premier upgrade OR stop persisting macros + `fatsecret_food_id`.
16. **Household write-path hardening** — `household_meals` UPDATE WITH CHECK (enforce `household_id IN auth_household_ids()`); `household_join_by_invite_code` RPC filters `disbanded_at IS NULL` + `invite_code_expires_at > now()`.
17. **web_push_subscriptions per-user endpoint** — either composite unique `(user_id, endpoint)` + DELETE-on-login, or `pushManager.unsubscribe()` on login/logout.
18. **Paywall dark-pattern audit** against Apple's current enforcement (Cal AI pulled 2026-04-21) — auto-renew above the fold, actual charge vs per-week equivalence, no second-paywall-on-dismiss.
19. **Full re-sweep** covering security, legal, nutrition-engine, qa-lead, release-gate.

---

## Rationale

The sweep surfaced three classes of problem, each fatal on its own:

- **Monetisation integrity:** `profiles.user_tier` is client-writable (anon key UPDATE sets Pro). The 2026-04-13 sweep closed the read-side but never audited writes. Paired with the missing RevenueCat webhook, paid-user revenue is effectively unprotectable.
- **Consumer-law claim exposure:** Fabricated "94% confidence · USDA" chip and "7-second parse, USDA-verified" paywall bullet are measurable false claims. In the post-Cal-AI climate (pulled from App Store 2026-04-21 for paywall dark patterns), Apple's enforcement bar is higher than before. Domain split between `suppr-club.com` (legal surfaces) and `supprclub.com` (REBRAND.md + bundle id) creates DMCA safe-harbour risk.
- **Nutrition rule violated:** `coerceMacrosWhenCaloriesByNoGrams` fabricates a 28/42/30 P/C/F split and that invented data reaches `nutrition_entries` writes on mobile. This directly violates the project non-negotiable "if nutrition is uncertain, do not guess." Compounded by `totalGramsForVerifyScale` treating ml as g (oil -9%, honey +42%), `measureToGrams` "large" matching before food-specific rules, and two tests that lock these bugs in as correct behaviour.

The fourth class — **onboarding v2 mobile is a non-functional stub at 100% rollout** — is a category-one category-one catastrophe: Signup doesn't create accounts, Permissions doesn't prompt iOS, Import is `setTimeout(2200)` with hardcoded recipe data, terminal step is a no-op. Eleven lenses raised this independently. Every iOS install since 2026-04-20 has reached Today without a profile row.

---

## Alternatives considered

- **Conditional ship under memo.** Rejected. Too many load-bearing gates are open; memo cannot cover paywall bypass + fabricated health claims + unusable onboarding simultaneously.
- **Ship Phase 1 only and re-gate per-phase.** Accepted. This decision is the first of three gated verdicts; Phase 2 and Phase 3 will re-run release-gate before unlock.
- **Keep onboarding v2 flag at 100% while rebuilding.** Rejected. Flag-off is a one-line change; rebuilding a mobile auth flow under production traffic is not.

---

## Platforms affected

- **Web:** paywall claims (B2), upgrade dialog disclosure (B10), welcome CTA TM posture (B5), onboarding consent linkage (B8), domain sweep (B4), profiles RLS (A1).
- **Mobile:** every Phase 1 condition, all of Section D (onboarding v2), macro coercion journal-write path (C1), plan calendar anchor (C2), `totalGramsForVerifyScale` (C4), cook_display_name dead-name (E1), plan regenerate freeze (F1-2), plan save RTT chain (F3), HealthKit 6-RTT chain (F5), cook-mode log (H6), onboarding_completed event (I1).
- **Supabase:** `profiles` RLS (A1), `household_meals` UPDATE (A4), `household_join_by_invite_code` RPC (A5), `web_push_subscriptions` uniqueness (A3), `meal_plans` schema (C2), `recipes.allergens` column (E2), `profiles.weight_surface_mode` (E3).

---

## Related artifacts

- Audit doc: [`docs/audits/2026-04-24-full-sweep.md`](../audits/2026-04-24-full-sweep.md) — full findings, scoring, ranked actions
- Executor backlog: [`docs/planning/sweep-2026-04-24-executor-backlog.md`](../planning/sweep-2026-04-24-executor-backlog.md) — sequenced implementation with owners + validation
- Superseded verdict: [`docs/decisions/2026-04-full-sweep-ship-verdict.md`](./2026-04-full-sweep-ship-verdict.md)
- Related open items still pending from 2026-04-19: [`docs/decisions/2026-04-19-fatsecret-caching.md`](./2026-04-19-fatsecret-caching.md) (action items unchecked), [`docs/decisions/2026-04-19-diversity-inclusion-audit.md`](./2026-04-19-diversity-inclusion-audit.md) (DI-P0-01 allergen, DI-P0-03 weight hide)

---

## Revisit when

- Phase 1 actions shipped → re-run security-reviewer + nutrition-engine + qa-lead + legal-reviewer → Phase 2 gate.
- Phase 2 actions shipped → re-run full sweep → Phase 3 gate.
- Any change to `profiles` RLS, tier-gated APIs, RevenueCat integration, macro-coercion policy, or onboarding v2 flag state.

---

## Open questions (for Grace)

See §5 of the audit doc. TL;DR:

1. `coerceMacrosWhenCaloriesByNoGrams` policy — display-only vs journal-writable with flag.
2. RevenueCat webhook architecture — direct tier write vs append-only events table + reducer.
3. Suppr Club branding — pause now vs counsel memo.
4. Canonical domain — `supprclub.com` vs `suppr-club.com`.
5. Allergen launch — v0 ship vs documented accepted-risk.
6. Weight-hide default — opt-out (current show default) vs opt-in neutral default.
