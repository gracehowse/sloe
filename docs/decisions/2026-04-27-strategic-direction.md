# Strategic direction — ratified decisions (2026-04-27)

**Status:** Binding direction, ratified by Grace 2026-04-27
**Source:** `docs/audits/2026-04-27-product-lead-strategic-challenge.md`
**Owner:** product-lead
**Frame:** Picks one promise (macro tracker that uses recipes as the input layer), demotes the second (recipe/meal-planning as input layer not destination), defers the third (creator/social network).

---

## Decisions

### D-2026-04-27-01: Suppr is a macro tracker that uses recipes as the input layer
**Status:** Resolved (2026-04-27)
**Decision:** Yes. Product A (macro tracker) is the spine. Product B (recipe/plan/cook loop) is the input layer that feeds it. Product C (creator/social network) is deferred indefinitely from the v1 surface.
**Reasoning:** Trying to be best-in-class at three things simultaneously is the failure mode of consensus product-building. The wedge is "the recipes I save and cook hit my macros" — neither MacroFactor nor Mob nor MFP can deliver that. Picking one promise is the only path to a defensible position.
**Tradeoff:** We lose the creator-economy fundraising narrative and a household differentiator vs MacroFactor. We accept that.
**Implementation owner:** product-lead (frame-holder), planner (sequencing).
**Reconsider on:** single-user retention is healthy at N>50 and external research shows demand for creator-side surfaces.

### D-2026-04-27-02: Tab structure collapses 6 → 4 (Today / Recipes / Plan / You)
**Status:** Resolved-pending-execution
**Decision:** Yes. Today, Recipes (Library + Discover with sub-tabs, Library default), Plan (planner + shopping list as sub-view), You (Progress + Settings + More merged). Mobile and web both.
**Reasoning:** Six tabs is a tell that nothing is canonical. Best-in-class apps run 3-5 tabs. Merging Library+Discover fixes the "Library is hard to find" tester feedback without inflating to six. Merging Progress+More resolves the indecision between two user-centric tabs.
**Tradeoff:** Discover gets less prominence. Acceptable — Discover is not why anyone uses Suppr today.
**Prerequisite:** Tab refactor on `apps/mobile/app/(tabs)/_layout.tsx` + web sidebar; deep links audited; tests updated.
**Implementation owner:** journey-architect (structure), ui-product-designer (treatment), planner (sequencing).
**Reconsider on:** post-launch analytics show a tab is consistently dead-ended or a sub-tab is being missed by >40% of users who'd benefit.

### D-2026-04-27-03: Ship one canonical Today; kill the three-variant proposal
**Status:** Resolved (2026-04-27)
**Decision:** Yes. One canonical Today. Day strip → calorie ring (remaining-first, no streak ribbon, no motivational copy) → "what to eat next" suggestion → macros remaining bar (amber over-budget) → meals → persistent Log FAB. Hydration/steps/adaptive hint/recap behind progressive disclosure.
**Reasoning:** Three variants is design indecision dressed as pluralism. With N=1 tester, "user picks" is a hedge, not a feature. Linear didn't ship three inboxes; Things didn't ship three task views.
**Tradeoff:** Some internal taste disagreements get overruled. Acceptable.
**Implementation owner:** ui-product-designer (canonical spec), executor (delete the other two variants).
**Reconsider on:** external research with 3+ users consistently asks for a different primary view. Internal taste disagreements are not a trigger.

### D-2026-04-27-04: "What to eat next, from your library, that hits your remaining macros" is the north-star moment and a permanent block on Today
**Status:** Resolved-pending-execution
**Decision:** Yes. Promote the gated "Dinner could hit" suggestion from a card to a permanent block on Today, second thing the eye lands on after the calorie ring. One suggested recipe at a time, swipeable to skip, one tap to log/cook.
**Reasoning:** This is the single moment Suppr does what no competitor can. MacroFactor doesn't have your recipes. Mob/Paprika don't know your macros. The data and scoring exist; the integration into Today's render path is what's missing. Every screenshot, every TestFlight description, every landing-hero should be this moment.
**Prerequisite:** Planner scoring threaded into Today render path. Library must have ≥5 saved recipes to render — handled by D-2026-04-27-14 (onboarding produces a first plan).
**Implementation owner:** nutrition-engine (scoring threading), ui-product-designer (treatment), executor (wiring).
**Reconsider on:** suggestion accept-rate falls below 20% in real usage and root cause is not library size.

### D-2026-04-27-05: Pricing collapses to Free + Pro (Base tier removed)
**Status:** Resolved-pending-execution
**Decision:** Yes. One Pro tier at £7.99/mo or £59.99/yr. Base goes away. Stripe + RevenueCat reconfigured.
**Reasoning:** Three tiers obscures the value prop and tests two prices on a population we don't have. With N=1 tester, the Base tier is a hedge against churn we can't observe yet. Two tiers is decisive and easier to communicate.
**Tradeoff:** Lose the £3.99 entry anchor. Some users who would have taken Base will churn instead of upgrading. Acceptable on the hypothesis that Base was diluting the Pro pitch more than it was capturing churn.
**Confirms:** `docs/decisions/2026-04-19-pricing-default-billing-period-divergence.md` survives — the Free→Pro decision does not change web/mobile default-billing-period split (web defaults monthly, mobile defaults annual). Sync-enforcer carve-out remains valid.
**Confirms:** `docs/decisions/2026-04-19-pricing-v1.md` is superseded only on tier count; price points and per-surface defaults remain.
**Implementation owner:** monetisation-architect (Stripe + RevenueCat reconfig), legal-reviewer (T&C + paywall copy), sync-enforcer (parity check on remaining tiers).
**Reconsider on:** Free→Pro conversion is below 2% sustained for 8 weeks AND qualitative evidence shows users wanted a middle tier.

### D-2026-04-27-06: Voice + photo logging stay, demoted from hero placement
**Status:** Resolved (2026-04-27)
**Decision:** Yes. Keep voice + photo as Pro features. Remove from hero treatment on Today. Live as tabs inside the canonical Log sheet (D-2026-04-27-15). Not surfaced in onboarding.
**Reasoning:** They are not why anyone picks the app; they are why someone upgrades once activated. Surfacing them as primary capabilities competes with the canonical log path and the recipe loop for the same screen real estate.
**Implementation owner:** ui-product-designer (de-hero treatment), executor (move to Log sheet tabs).
**Reconsider on:** activation telemetry shows voice/photo as a top-3 trigger for Pro upgrade — at which point hero treatment may be earned by data.

### D-2026-04-27-07: Streak shrinks to a pip; weekly recap stays as Sunday card, demoted from primary retention
**Status:** Resolved (2026-04-27)
**Decision:** Yes. Streak is a small pip on Today, not a celebration ribbon. Weekly recap is dismissible and weekly only — does not anchor Progress.
**Reasoning:** Streaks are the laziest retention loop in tracker design — they generate adherence guilt and don't differentiate. Progress should be about adaptive maintenance and weight trend (the actual changing thing), not a stat-card recap.
**Implementation owner:** ui-product-designer (pip treatment), executor (Today + Progress refactor).
**Reconsider on:** N/A — this is a stance, not a hypothesis to test.

### D-2026-04-27-08: Caffeine + alcohol removed from Today; behind Settings opt-in, default off
**Status:** Resolved (2026-04-27)
**Decision:** Yes. Caffeine + alcohol off Today. Settings opt-in, default off. Hydration stays — it's a near-universal target.
**Reasoning:** Macro tracker's job is macros. Caffeine and alcohol bloat the daily card and are feature creep dressed as wellness. The "we track everything" pitch isn't a wedge.
**Implementation owner:** ui-product-designer (Today recompose), executor (Settings flag + chip removal), nutrition-engine (data still captured if opted in).
**Reconsider on:** specific user demand from real users (not N=1) AND a clear story about why Suppr should track these vs deferring to dedicated apps.

### D-2026-04-27-09: Cook Mode is frozen — no new features
**Status:** Resolved (2026-04-27)
**Decision:** Yes. Cook Mode stays as-is. No "Cook Mode 2." No additional investment.
**Reasoning:** It exists, it's fine. Mob and Paprika do it better. Don't compete with them on a surface we won't win — invest in the macro+log integration nobody else has.
**Implementation owner:** planner (block any Cook Mode ticket from sneaking in).
**Reconsider on:** users explicitly cite Cook Mode as a top-3 reason for retention.

### D-2026-04-27-10: Shopping list stays as-is; no commerce/affiliate
**Status:** Resolved (2026-04-27)
**Decision:** Yes. Shopping list keeps auto-generate-from-plan and share-out. No "shoppable links". No affiliate. Strike from roadmap.
**Reasoning:** Affiliate revenue won't move the needle vs subscription, and it adds disclosure complexity, vendor curation, and consumer trust burden. Shopping is a function, not a product.
**Implementation owner:** planner (strike from roadmap), legal-reviewer (confirm no compliance work needed), monetisation-architect (no monetisation lever here).
**Reconsider on:** subscription revenue is healthy AND a credible commerce partner emerges with terms that don't compromise nutrition trust posture.

### D-2026-04-27-11: Mobile is the primary surface; web is the long-form companion
**Status:** Resolved (2026-04-27)
**Decision:** Yes. Mobile is primary. Web is for sit-down work — recipe import, planner editing, account management. Stop trying to build mobile-grade tracking on web.
**Reasoning:** Daily macro tracking is a phone activity. Building HealthKit-equivalent on web, web push, and mobile-grade quick-log on web is investing in the wrong surface.
**Honours:** `feedback_mobile_decisions_apply_to_web.md` — visible UI changes on mobile still land on equivalent web surfaces in the same commit. This decision narrows the *scope* of equivalence (web doesn't replicate phone-activity surfaces), not the principle.
**Honours:** `project_move_meal_web_gap.md`, `project_recipe_go_public_web_only.md` — both remain valid intentional divergences.
**Implementation owner:** sync-enforcer (revised parity rules), planner (deprioritise web push, web HealthKit-equivalent).
**Reconsider on:** PWA install rate >15% sustained, OR meaningful share of daily-log events come from web sessions.

### D-2026-04-27-12: Adaptive TDEE is always-on; confidence is metadata, not gating
**Status:** Resolved (2026-04-27)
**Decision:** Yes. Show the engine's estimate to the user with a confidence flag. Do not gate display on confidence threshold. "We think your maintenance is X with medium confidence."
**Reasoning:** The user is an adult. Hiding the estimate behind a confidence gate is paternalism and obscures the engine's value. Confidence is metadata that informs how much weight to give the number, not whether to show it.
**Implementation owner:** nutrition-engine (always-on rendering + confidence chip), ui-product-designer (chip treatment).
**Reconsider on:** support load shows users are being misled by low-confidence estimates AND a confidence-gated UX would meaningfully reduce that.

### D-2026-04-27-13: Allergen depth — pick gluten/coeliac and do it brilliantly; defer broad dietary depth
**Status:** Resolved-pending-execution
**Decision:** Yes. Coeliac/gluten is the chosen depth. Ingredient-level filter, confidence flag on every recipe, plain-English uncertainty when contamination risk is non-trivial. Other dietary tags stay as breadth-only browse filters.
**Reasoning:** Coeliac is the most acute case — accidental gluten is medically harmful, not a preference miss. "We tag eight diets" is breadth-without-depth, the worst of both worlds. One depth done well builds trust transferable to other allergens later.
**Tradeoff:** Vegan/vegetarian/keto/etc. users get equal-or-worse experience than today (no regression, no special depth). Acceptable.
**Implementation owner:** nutrition-engine (gluten classifier + confidence), ui-product-designer (filter UX + warning posture), legal-reviewer (claim language).
**Reconsider on:** coeliac depth ships and retention/NPS lift is measurable AND a second allergen has a clear medical-acute case (e.g. nut allergies).

### D-2026-04-27-14: Onboarding ends with a populated first week, not just a target
**Status:** Resolved-pending-execution
**Decision:** Yes. Onboarding's last step seeds Library with 5-10 recipes the user picks, and auto-generates their first weekly plan. End-state on Today + Plan is a working artifact, not an empty dashboard.
**Reasoning:** Best-in-class onboarding ends with the user having a thing, not just knowing a thing. Current end-state ("you have a target, now go figure it out") is the cliff that kills activation. The recipe-picking step also seeds D-2026-04-27-04 (north-star moment needs library content to render).
**Honours:** `project_onboarding_redesign.md` — Phase 2 at 100% rollout. This decision extends Phase 2 with the populated-first-week step; legacy `/onboarding` deletion countdown is unaffected.
**Honours:** `project_onboarding_welcome_divergence.md` — web/mobile welcome copy divergence remains intentional.
**Implementation owner:** ui-product-designer (recipe-picker step), nutrition-engine (auto-plan-from-seed), executor (wiring), planner (sequencing).
**Reconsider on:** the recipe-pick step itself drops onboarding completion >5% — at which point reduce the minimum from 5 to 3.

### D-2026-04-27-15: One canonical log path — persistent FAB → single sheet with sub-tabs
**Status:** Resolved-pending-execution
**Decision:** Yes. Persistent Log FAB on Today. One sheet with tabs: search / barcode / recent / saved / voice / photo. Replaces the current 8+ entry points (Quick Add, search, barcode, voice, photo, recipe-detail-log, planned-meal-log, household, copy-meal, usual-meal).
**Reasoning:** MacroFactor/Cronometer/MFP all let you log in two taps from any screen. The number of paths in Suppr is the actual problem. Progressive disclosure via tabs in a single sheet keeps the power without splaying the entry surface.
**Tradeoff:** Some entry points lose their direct affordance (e.g. household copy-meal becomes a sub-flow inside Recent). Acceptable — it's a Settings-flagged feature post D-2026-04-27 anyway.
**Implementation owner:** ui-product-designer (sheet spec), journey-architect (entry-point audit), executor (consolidation), nutrition-engine (no change to underlying data flows).
**Reconsider on:** specific tab is below 5% usage after 8 weeks AND user research shows the affordance was needed elsewhere.

### D-2026-04-27-16: Trust posture is consistent on every macro-bearing row
**Status:** Resolved-pending-execution
**Decision:** Yes. Verified pipeline / source attribution / confidence dot on every row that displays macros — diary, planner, recipe ingredients, saved meals, voice/photo review, Quick Add, search results. Same chip language everywhere.
**Reasoning:** Nutrition apps live or die on whether users believe the numbers. Suppr is already better than competitors here, but unevenly. Consistency is the cheap win that compounds trust.
**Implementation owner:** ui-product-designer (chip standardisation), nutrition-engine (data plumbing for sources/confidence on each surface), sync-enforcer (parity across web/mobile), executor (wiring).
**Reconsider on:** N/A — this is table stakes, not a hypothesis.

### D-2026-04-27-17: Progress is a weekly story, not a stat-card dashboard
**Status:** Resolved-pending-execution
**Decision:** Yes. Adaptive TDEE recap line is the headline. Engine commentary in plain English ("we adjusted up by 60 kcal this week — your average intake on weeks you lost weight was X"). Weight + maintenance trend with narrative context. Stat cards demoted.
**Reasoning:** MacroFactor's recap is the gold standard because it's narrative, not numeric. The data exists in the adaptive TDEE engine; the narrative isn't built. Best-day-by-protein is stat-card thinking.
**Honours:** `project_progress_direction.md` — "Progress = story not dashboard" already accepted. This decision ratifies it as binding direction, not a tentative product call.
**Implementation owner:** nutrition-engine (commentary generation), ui-product-designer (story treatment), legal-reviewer (claim language on weight + adaptation), executor (wiring).
**Reconsider on:** narrative commentary generates support load due to misinterpretation — at which point copy gets tighter, not abandoned.

---

## 90-day execution sequence

### Batch 1 — Cut and consolidate (Weeks 1-4)

#### B1.1 — Tab collapse 6 → 4
- **Files/surfaces:** `apps/mobile/app/(tabs)/_layout.tsx`; web sidebar (`components/nav/*` or equivalent); deep-link map; route tests; navigation analytics events.
- **Owner:** journey-architect (structure) + executor (refactor).
- **Dependencies:** none — independent first move.
- **Acceptance:** mobile + web show 4 tabs (Today/Recipes/Plan/You); Library is default sub-tab in Recipes; Shopping is sub-view of Plan; Progress + More merged into You; all deep links resolve; tests green; sync-enforcer happy.

#### B1.2 — Today canonical, kill 3 variants
- **Files/surfaces:** `apps/mobile/components/today/*` (variant components deleted); web Today; M4 progressive disclosure rules retained; streak ribbon → pip.
- **Owner:** ui-product-designer (canonical spec) + executor (delete losing variants).
- **Dependencies:** B1.1 not blocking but prefers tab structure landed first.
- **Acceptance:** one Today renders on mobile + web; two variants deleted from repo + tests; streak is a pip; caffeine + alcohol removed from Today; recap is a Sunday card.

#### B1.3 — Pricing collapse Free + Pro
- **Files/surfaces:** `app/pricing/PricingTiersGrid.tsx`; `apps/mobile/app/paywall.tsx`; Stripe products; RevenueCat entitlements; T&C; paywall copy; tests.
- **Owner:** monetisation-architect + legal-reviewer + executor.
- **Dependencies:** independent. Coordinate with B1.1 only on `You` tab settings entry.
- **Acceptance:** Free + Pro live on web + mobile; Base tier deprecated and grandfathered (or migrated, monetisation-architect to call); web defaults monthly, mobile defaults annual (preserves 2026-04-19 divergence); sync-enforcer carve-out documented.

#### B1.4 — Caffeine + alcohol behind Settings, household demoted
- **Files/surfaces:** Today components; Settings page (web + mobile); household entry points; onboarding screens (remove household pitch).
- **Owner:** ui-product-designer + executor.
- **Dependencies:** B1.2 (Today recompose).
- **Acceptance:** caffeine + alcohol opt-in, default off; household behind Settings flag, not in primary nav, not in onboarding; existing household RLS + infra untouched.

### Batch 2 — Build the north-star moment (Weeks 5-8)

#### B2.1 — Canonical Log FAB + single sheet
- **Files/surfaces:** new `LogSheet` component (mobile + web); kills/demotes Quick Add, standalone barcode, voice/photo entry buttons; FAB component; entry-point audit doc.
- **Owner:** ui-product-designer (spec) + journey-architect (entry-point audit) + executor.
- **Dependencies:** B1.2 (canonical Today must exist for FAB placement).
- **Acceptance:** one FAB on Today; one sheet with 6 tabs (search/barcode/recent/saved/voice/photo); old entry points removed or routed into the sheet; logging two taps from anywhere; web + mobile parity.

#### B2.2 — "What to eat next" permanent block on Today
- **Files/surfaces:** `apps/mobile/lib/mealPlanAlgo.ts` (scoring exposed for single-meal suggestion); Today render path; web equivalent; tests on edge cases (empty library, all-over-budget remaining macros, no-slot-detected).
- **Owner:** nutrition-engine (scoring) + ui-product-designer (treatment) + executor (wiring).
- **Dependencies:** B1.2 (canonical Today), B3.1-prereq (library has content — see B2.3).
- **Acceptance:** suggestion renders on Today as second block; one recipe at a time; swipe-to-skip; tap-to-log or tap-to-cook; degrades gracefully when library <5; web + mobile parity.

#### B2.3 — Onboarding produces first plan
- **Files/surfaces:** `apps/mobile/app/onboarding.tsx`; web `app/onboarding/page.tsx`; recipe-picker step; auto-plan generator; first-run state on Today + Plan; tests.
- **Owner:** ui-product-designer (recipe-picker step) + nutrition-engine (auto-plan-from-seed) + executor.
- **Dependencies:** B1.1 (Recipes tab exists), B1.2 (canonical Today exists for first-run state).
- **Acceptance:** onboarding ends with ≥5 recipes saved + a weekly plan generated; Today + Plan render real content first-launch; legacy onboarding still on deletion countdown; web/mobile welcome copy divergence preserved.

#### B2.4 — Trust posture consistent on every macro row
- **Files/surfaces:** chip component standardised (web + mobile); diary rows; planner rows; recipe-ingredient rows; saved-meal rows; voice/photo review rows; Quick Add results; search results.
- **Owner:** ui-product-designer (chip standardisation) + nutrition-engine (source/confidence plumbing) + sync-enforcer (parity) + executor.
- **Dependencies:** B2.1 (Log sheet exists, contains rows that need the chip).
- **Acceptance:** verify chip / source dot present on every macro-bearing row across web + mobile; sync-enforcer green; visual-qa pass.

### Batch 3 — Sharpen Progress as a story (Weeks 9-12)

#### B3.1 — Adaptive TDEE recap as Progress headline
- **Files/surfaces:** Progress page (web + mobile, now within `You`); adaptive TDEE engine commentary generation; weight + maintenance trend chart; stat cards demoted.
- **Owner:** nutrition-engine (commentary) + ui-product-designer (story treatment) + legal-reviewer (claim language) + executor.
- **Dependencies:** B1.1 (You tab exists), D-2026-04-27-12 (always-on TDEE).
- **Acceptance:** Progress headline is narrative recap line; weight + maintenance trend with engine commentary; stat cards still present but demoted; legal-reviewer signed off on weight/adaptation language.

#### B3.2 — Coeliac/gluten depth
- **Files/surfaces:** ingredient-level gluten classifier; recipe filter UX; per-recipe confidence flag; warning posture on contamination risk; legal-reviewed claim copy.
- **Owner:** nutrition-engine (classifier + confidence) + ui-product-designer (filter UX) + legal-reviewer (claim language) + executor.
- **Dependencies:** B2.4 (trust posture chip is the carrier for the gluten-confidence flag).
- **Acceptance:** every recipe has a gluten classification with confidence; ingredient filter usable from Recipes; warning chip explicit on non-trivial contamination risk; legal sign-off on copy.

#### B3.3 — TestFlight expansion (open beyond N=1)
- **Files/surfaces:** TestFlight invite flow; analytics dashboards (PostHog cohorts); feedback intake; release-gate criteria for first cohort.
- **Owner:** release-gate + growth-strategist + Grace.
- **Dependencies:** B2.1, B2.2, B2.3, B2.4 all shipped (the demo moment exists). B3.1 ideally landed for retention story.
- **Acceptance:** first external cohort onboarded; cohort analytics flowing; feedback loop into product-memory; first qualitative read on the north-star moment.

### Out of scope for 90 days (named explicitly)
Multi-format creator authoring; friends graph; plan sharing; partner sync; affiliate/commerce; Android Health Connect; Strava/Garmin partner APIs; Apple Watch; iOS widget native target; net-carbs lens UI; web push; web HealthKit-equivalent.

---

## Memory entries — confirm or kill

| Memory entry | Status |
|---|---|
| `project_pricing_default_billing_period_divergence` (web monthly / mobile annual) | **Confirm.** Survives D-2026-04-27-05. Sync-enforcer carve-out remains. |
| `project_onboarding_redesign` (Phase 2 at 100%, legacy deletion countdown) | **Confirm.** D-2026-04-27-14 extends Phase 2; deletion countdown unchanged. |
| `project_onboarding_welcome_divergence` (web/mobile copy divergence) | **Confirm.** Unaffected by tab/canonical-Today/onboarding decisions. |
| `project_today_screen_direction_apr2026` (keep quick-log/week-toggle/week-strip/meals; remove streak + disclaimer; etc.) | **Confirm and supersede.** D-2026-04-27-03 picks the canonical Today; the directional notes here are absorbed. Streak demotion goes further (pip, not ribbon). Profile→More now Profile→You per D-2026-04-27-02. |
| `project_progress_direction` (Progress = story not dashboard) | **Confirm.** D-2026-04-27-17 ratifies as binding. |
| `project_move_meal_web_gap` (mobile-only, deferred) | **Confirm.** Web-as-companion (D-2026-04-27-11) reinforces this. |
| `project_recipe_go_public_web_only` (intentional web-only) | **Confirm.** Same. |
| `project_delete_account_flow_exists` | **Confirm.** No design brief needed inside Settings sweep. |
| `project_prototype_carryover_rules` (9 rules — over-budget=amber, prototype icons, sodium=orange, bg tone, sidebar 248, etc.) | **Confirm.** All carry into canonical Today + canonical Log sheet + tab refactor. |
| `feedback_mobile_decisions_apply_to_web` | **Confirm with refinement.** D-2026-04-27-11 narrows scope (web doesn't replicate phone-activity surfaces) without weakening the principle. |
| `feedback_no_duplicate_today_hero_content` | **Confirm.** Reinforced by canonical Today decision. |
| `project_solo_tester` (N=1 on TestFlight) | **Confirm.** B3.3 expands beyond N=1, but only after the demo moment exists. |

No memory entries killed.

---

## Cross-references

- `docs/decisions/2026-04-19-pricing-default-billing-period-divergence.md` — survives D-2026-04-27-05.
- `docs/decisions/2026-04-19-pricing-v1.md` — superseded on tier count; price points unchanged.
- `docs/decisions/2026-04-19-billing-architecture-pattern-a.md` — unaffected.
- `docs/audits/2026-04-27-product-lead-strategic-challenge.md` — source.
- `docs/product-roadmap.md` — must be updated to mark Phase C/D/F items affected by these decisions.
- `docs/planning/design-system-sweep-plan-2026-04-21.md` — per-screen audits roll up under B1.2 + B2.4.

---

## Open sub-decisions (flagged for downstream specialists)

- **D-2026-04-27-05 sub:** Base tier migration path (deprecate-grandfather vs force-migrate vs hard-cancel) — `monetisation-architect` to call.
- **D-2026-04-27-13 sub:** UK/EU gluten claim language — `legal-reviewer` sign-off before B3.2 ships.
- **D-2026-04-27-04 sub:** Library-size threshold for north-star block (≥5? ≥3? ≥1 with apologetic copy?) — `nutrition-engine` to characterise during B2.2 build.
