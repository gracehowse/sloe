# Engineering backlog sweep — 2026-05-29

**Branch:** `feat/eng-762-coverage-and-followups`  
**PR:** [#351](https://github.com/gracehowse/Suppr/pull/351)  
**Commit:** `3a424527` (rename `tdeeEdgeCases.test.ts`)

## Summary

| Metric | Count |
|--------|------:|
| Issues processed | **106** |
| Shipped / Done (code on PR #351 or main) | **15** |
| Grace-only (Owner + checklist, stays Backlog/Todo) | **38** |
| Parked / Canceled | **2** |
| Backlog scoped (code deferred post-launch) | **51** |

## PR #351 merge recommendation

**✅ MERGE** — CI was green before final push; re-run in progress after `3a424527`.

Ships: coverage ratchet (74%), web recipe edit, mobile go-public, food-search ranking/plausibility, test-debt closure, type-scale CI gate.

**Grace-only post-merge:** RevenueCat (ENG-198), Small Business Program (ENG-3), billing decisions (ENG-49/123), Maestro capture (ENG-531/533), TestFlight QA on go-public + recipe edit.

## CI final status

Check `gh pr checks 351` — last known: all green pre-push; pending re-run after rename commit.

---

## P0 — merge blockers / launch

| ID | Title | Outcome | Commit / note |
|----|-------|---------|---------------|
| ENG-762 | Whole-app Vitest coverage ratchet | **Done** | PR #351, 74% functions gate |
| ENG-761 | Storybook + Chromatic + visual CI | **Done** | main `fcb27ee6`–`18ea58dc` |
| ENG-759 | Recipe full edit | **Done** | PR #351 `recipe-edit-dialog.tsx` |
| ENG-700 | Go Public mobile parity | **Done** | PR #351 + Maestro `eng_700_go_public.yaml` |
| ENG-745 | FatSecret 0 kcal log | **Done** | PR #327 on main |
| ENG-742 | Cut plan/cookbook import from launch | **Done** | flags default-off |
| ENG-689 | Test debt audit | **Done** | PR #351 + `3a424527` rename |
| ENG-198 | RevenueCat offerings | **Grace** | Dashboard config checklist |
| ENG-49 | Lifetime Pro provisioning | **Grace** | Billing decision |
| ENG-123 | Base tier migration | **Grace** | Billing decision |
| ENG-3 | Apple Small Business Program | **Grace** | App Store Connect |

## P1 — high backlog (code shipped or scoped)

| ID | Title | Outcome | Note |
|----|-------|---------|------|
| ENG-702 | Portion picker plausibility | **Done** | PR #351 |
| ENG-706 | Food-search ranking extract | **Done** | PR #351 `foodSearchRanking.ts` |
| ENG-662 | Atomic verify-save RPC | **Done** | PR #351; Grace: `supabase db push` |
| ENG-735 | Bulk photo import | **Backlog** | Flag-gated; primary launch path |
| ENG-670 | Reel parse-rate gate | **Grace** | 100-Reel metrics test |
| ENG-699 | Move-meal web parity | **Backlog** | Post-launch |
| ENG-695 | Discover IA convergence | **Backlog** | Post-launch |
| ENG-685 | expo-image adoption | **Backlog** | Post-launch perf |
| ENG-703 | Today decompose/memoise | **Backlog** | ENG-619 dependency |
| ENG-728 | Import magic moment | **Backlog** | ENG-725 child |
| ENG-725–727 | Premium wow / motion / achievements | **Backlog** | Epic + children scoped |
| ENG-531 | Maestro onboarding flow | **Grace+agent** | CF-1 capture blocker |
| ENG-533 | CF-3–CF-8 capture rollup | **Grace** | Evidence capture |
| ENG-62 | Cook ↔ Recipe Detail | **Backlog** | Post-launch |

## P2 — medium

| ID | Title | Outcome | Note |
|----|-------|---------|------|
| ENG-119 | Type ladder lint + sweep | **Done** | Web + CI; mobile fonts post-launch |
| ENG-120 | Lucide sweep | **Backlog** | ~64 files |
| ENG-125 | Post-onboarding target edit | **Backlog** | Mobile settings |
| ENG-713 | Hide-weight / trend-only | **Backlog** | D&I + legal sign-off |
| ENG-732 | Web fibre parity | **Backlog** | Macro detail alignment |
| ENG-746 | genericFoods in verifyIngredients | **Backlog** | Nutrition-engine |
| ENG-749–752 | Typed DB / enrichment / deferrals | **Backlog** | Architecture |
| ENG-758 | tdeeLearnDays real weigh-ins | **Backlog** | Adaptive TDEE |
| ENG-193 | Discover feed depth | **Backlog** | Filters, creator profile |

## P3 — plan import cluster (post-launch, flag-gated)

| ID | Title | Outcome |
|----|-------|---------|
| ENG-646 | Program coordination | **Backlog** — post-launch umbrella |
| ENG-647–654 | Sprint 1 paste flow | **Backlog** — flag-gated |
| ENG-655–658 | Sprint 2 PDF/image | **Backlog** — deferred |
| ENG-696 | Web Plan Import UI | **Backlog** — post-launch |

## P4 — low / housekeeping

| ID | Title | Outcome |
|----|-------|---------|
| ENG-693 | Rebrand + domain | **Parked** — Canceled |
| ENG-666 | Creator marketplace | **Parked** — Canceled |
| ENG-202 | Google Fit spike | **Grace** — post-iOS |
| ENG-560 | Sentry DSN cleanup | **Grace** |
| ENG-558 | Leaked password protection | **Grace** |
| ENG-557 | SECURITY DEFINER RPC audit | **Backlog** |
| ENG-559 | Drop unused indexes | **Backlog** |
| ENG-535 | Web Today authed capture | **Grace** |
| ENG-65 | Hero ring gesture asymmetry | **Backlog** |
| ENG-716–718 | P2 clusters / sweep log | **Backlog** |

## Grace-only legal / ops / billing (unchanged status, descriptions updated)

ENG-667, ENG-184, ENG-522, ENG-510, ENG-7, ENG-183, ENG-513, ENG-514, ENG-179, ENG-182, ENG-190, ENG-189, ENG-122, ENG-172, ENG-148, ENG-525, ENG-199, ENG-2, ENG-4, ENG-194, ENG-541, ENG-538, ENG-539, ENG-71, ENG-28, ENG-376, ENG-96, ENG-697, ENG-715, ENG-714, ENG-717, ENG-719–724, ENG-720, ENG-721, ENG-736, ENG-737, ENG-718

## Architecture / tech debt (Todo → scoped)

| ID | Title | Outcome |
|----|-------|---------|
| ENG-573 | P5 umbrella | **Todo** — coordination |
| ENG-619 | useToday extract | **Todo** — post-launch |
| ENG-620 | nutrition-core package | **Todo** — post-launch |
| ENG-622 | App Router migration | **Todo** — post-launch |
| ENG-665 | Tech debt program | **Backlog** — sequencing |
| ENG-661 | OFF ODbL cache-only | **Backlog** — Grace legal first |
| ENG-663 | Onboarding parity | **Backlog** — spec-first |
| ENG-567 | Premium launch bar | **Backlog** — coordination |

## Remaining blockers (Grace-only only)

1. **ENG-198** — RevenueCat dashboard provisioning  
2. **ENG-3** — Apple Small Business Program enrollment  
3. **ENG-49 / ENG-123** — billing migration decisions  
4. **ENG-531 / ENG-533** — premium-sweep Maestro captures  
5. **ENG-667** — VAT/EUR legal + Stripe SKUs  
6. **ENG-510** — Supabase PITR restore drill  
7. **ENG-670 / ENG-7** — Reel parse-rate measurement  
8. **ENG-662 follow-up** — `supabase db push --linked` for atomic RPC  

No agent-codeable launch blockers remain open on the Engineering queue.
