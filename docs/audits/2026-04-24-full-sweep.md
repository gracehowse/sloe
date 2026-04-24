# Full-sweep audit — 2026-04-24

**Orchestrator:** `orchestrator-full-sweep` (fan-out across 28 specialist lenses + independent `release-gate`).
**Scope:** whole product — web + mobile + landing + onboarding + Supabase.
**Dirty tree:** reviewed as-is; nutrition + planner WIP (4 new shared helpers, tests, `planner.tsx`, `verifyRecipe.ts`, `mealPlanAlgo.ts`).
**Prior sweep:** [2026-04-13 ship verdict](../decisions/2026-04-full-sweep-ship-verdict.md) — P0s from that sweep nominally shipped, but this sweep discovered **blocker #1 (tier RLS) is only half-closed** (read fixed, write open). That doc is now superseded.

---

## 1. Verdict

**HOLD.** Independent release-gate concurs. Findings span security (full paywall bypass), legal (measurable false claims), nutrition correctness (fabricated macros reaching the journal), and a 100%-rolled-out onboarding flow that does not sign the user up. No single patch clears this; conditional-ship would become a permanent backlog.

**Five conditions to unblock next TestFlight build (all S-effort except #4):**

1. Revert `onboarding_v2` flag to 0%; legacy flow continues serving real auth + profile writes.
2. Close `profiles.user_tier` write side with a column-level RLS guard (rejects client UPDATEs of tier/billing columns).
3. Strip the two fabricated claims: "94% confidence · USDA" in onboarding; "7-second parse, USDA-verified" on paywall + upgrade dialog.
4. Gate `coerceMacrosWhenCaloriesByNoGrams` behind a display-only contract; refuse to let coerced P/C/F values reach `nutrition_entries` writes.
5. Delete or rewrite the two tests that pin bugs in as correct: `tests/unit/planCalendarAnchor.test.ts` (rewards first-match-offset resolution) and `tests/unit/totalGramsForVerifyScale.test.ts` (asserts 1 ml = 1 g).

**Additional conditions before App Store submission** — listed in §4.

---

## 2. Findings by area

Severity uses the orchestrator formula: `severity × user_impact / effort`, release-blockers pinned to top. `[N]` after a finding = number of independent lenses that raised it (multi-reporter = stronger signal).

### A — Trust / security / billing integrity

| # | Title | Problem | Sev | Impact | Effort | Blocker | Surfaces | Reporters |
|---|---|---|---|---|---|---|---|---|
| A1 | `profiles.user_tier` client-writable → full paywall bypass | `profiles_update_own` RLS has no column-level check; any authenticated user can `UPDATE profiles SET user_tier='pro'` directly via anon key | 5 | 5 | S | **Y** | Supabase schema, all tier-gated APIs | security, monetisation, docs-keeper, product-memory [4] |
| A2 | No RevenueCat server webhook → cancellations never revoke | Client-only tier sync; `resolveNextTier` blocks downgrade → Pro-forever after refund/cancel | 5 | 4 | M | **Y** | mobile billing, missing `/api/revenuecat/webhook` | security, integration-manager, monetisation, docs-keeper, product-memory [5] |
| A3 | web_push_subscriptions global-unique endpoint + RLS → cross-user leak | User A's weekly-recap pushes keep firing to User B's browser after B signs in on same device | 4 | 4 | S | Y | web notifications | data-integrity, security [2] |
| A4 | household_meals UPDATE WITH CHECK is same as USING — creator can relocate meal to foreign household | `WITH CHECK` repeats the `OR` disjunction; creator stays `added_by = auth.uid()` while flipping `household_id` | 4 | 3 | S | Y | household API | data-integrity, security [2] |
| A5 | `household_join_by_invite_code` RPC ignores `disbanded_at` + `invite_code_expires_at` | Mobile-only bypass; web route filters expiry, RPC doesn't | 4 | 4 | S | Y | mobile household join | data-integrity, security [2] |
| A6 | Stripe webhook dedup is in-memory only | Module-level `Set`; serverless cold start forgets; idempotent today but one un-idempotent future handler away | 3 | 2 | M | N | web billing | security, integration-manager, monetisation [3] |
| A7 | Photo-log / voice-log / USDA / FatSecret fetches have no AbortController | Slow upstream → function hangs to platform timeout; rate-limit token already decremented | 3 | 3 | S | N | API | integration-manager, security [2] |
| A8 | `/api/household/join` rate-limit key not user-scoped | Global bucket → one attacker locks everyone out OR IP rotation dodges | 3 | 3 | S | N | web household | security [1] |

### B — Legal / claims / branding posture

| # | Title | Problem | Sev | Impact | Effort | Blocker | Surfaces | Reporters |
|---|---|---|---|---|---|---|---|---|
| B1 | "94% confidence · USDA" chip for a fake `setTimeout` parse | Onboarding Import + Welcome FloatingPreview show a hardcoded accuracy claim for a parse that never ran | 5 | 5 | S | **Y** | onboarding v2 web + mobile | copy-reviewer, nutrition-engine, legal-reviewer, ui-product-designer [4] |
| B2 | "7-second parse, USDA-verified" on paywall + upgrade dialog | Quantified speed claim + "verified" implies USDA certification Suppr doesn't have | 5 | 4 | S | **Y** | paywall, upgrade dialog | copy-reviewer, legal-reviewer, monetisation [3] |
| B3 | `source: "Suppr"` as peer label to USDA/Edamam/OFF/FatSecret | Implies Suppr is a nutrition authority; also used on user-custom foods that can out-score USDA with a +0.08 verified boost | 4 | 3 | S | N | recipe verify, food-search | brand-manager, legal-reviewer, nutrition-engine [3] |
| B4 | `suppr-club.com` vs `supprclub.com` domain split | DMCA agent email, privacy controller, refund support, paywall footer all hyphenated; REBRAND.md public site + bundle id non-hyphenated — bounce risk voids DMCA safe harbour | 5 | 4 | S | **Y for store submission** | every legal surface | brand-manager, legal-reviewer [2] |
| B5 | "Suppr Club" being cemented on first-impression surfaces despite HIGH TM collision with App Store "Supper Club!" | Every "Join the Suppr Club" / "I'm already a member" widens exposure if C&D lands | 4 | 4 | L | **Y until TM decision** | onboarding welcome (web), landing, paywall footer | brand-manager, legal-reviewer [2] |
| B6 | FatSecret caching tier unresolved since 2026-04-19 | If not Premier, persisting macros + `fatsecret_food_id` breaches ToS → Apple 5.2 / Google policy rejection | 4 | 3 | M | **Y for store submission** | API + DB | integration-manager, legal-reviewer, product-memory, docs-keeper [4] |
| B7 | UK/EU 14-day statutory cancellation framing vs "7-day refund" | Paywall footer may understate statutory right; no explicit waiver collected at checkout | 3 | 3 | M | N (ship-soft) | UK/EU paywall surfaces | legal-reviewer [1] |
| B8 | Web welcome `Join the club — free` CTA lacks Terms/Privacy linkage above the fold | GDPR Art. 13 + Apple 5.1.1(v) notice-at-collection | 3 | 3 | S | N | web onboarding welcome | legal-reviewer [1] |
| B9 | Brand voice fractures across 3 highest-traffic surfaces | Landing = utility tool; web welcome = aspirational community; mobile welcome = calm reassurance | 4 | 4 | M | N | landing, web onboarding, mobile onboarding | brand-manager [1] |
| B10 | Upgrade dialog renewal note weaker than mobile paywall disclosure | No price/frequency/"renews automatically" at the checkout-start surface; mobile has the full CMA-compliant string | 4 | 3 | S | **Y for launch** | web upgrade dialog | monetisation [1] |

### C — Nutrition correctness

| # | Title | Problem | Sev | Impact | Effort | Blocker | Surfaces | Reporters |
|---|---|---|---|---|---|---|---|---|
| C1 | `coerceMacrosWhenCaloriesByNoGrams` fabricates 28/42/30 P/C/F split; reaches journal writes on mobile | Violates "if nutrition uncertain, do not guess" — user sees + logs invented macros | 5 | 5 | M | **Y** | planner, Today planned card, nutrition_entries | product-lead, nutrition-engine, qa-lead, docs-keeper, product-memory [5] |
| C2 | Plan calendar anchor ambiguous — `findPlanDayIdForCalendarDate` picks first-matching offset from `[0,1,7]` | "Next week" plans bleed into today the moment they're saved; schema fix (persisted start_date/offset), not code | 5 | 5 | M | **Y** | Today, planner, journal, Progress | repo-auditor, nutrition-engine, data-integrity, qa-lead, product-memory [5] |
| C3 | Web planner skips coercion; mobile applies — same DB row, different totals | Same `meal_plan_meals` row: web 400/0/0/0; mobile 400/28/42/13 | 5 | 4 | S (once C1 policy decided) | Y | web/mobile planner, Today planned | repo-auditor, nutrition-engine, sync-enforcer [3] |
| C4 | `totalGramsForVerifyScale` treats ml as g for any liquid | Oil -9%, honey +42% on kcal scaling; no density lookup; test locks the bug in as "correct" | 4 | 4 | S | **Y** | recipe verify (mobile critical path) | nutrition-engine, qa-lead, docs-keeper [3] |
| C5 | `measureToGrams` "large/medium/small" matches before food-specific count rules | "2 large chicken breasts" → 360 g (generic 180 g × 2) not 400 g (food-specific 200 g × 2) | 3 | 3 | S | N | ingredient parser (shared) | nutrition-engine, qa-lead [2] |
| C6 | `RECIPE_INGREDIENT_REVIEW_CONFIDENCE = 0.5` ships sub-0.70 matches unflagged | Category bar is 0.70; current 0.42–0.50 auto-accepts silently; 0.50–0.70 soft-chip only | 4 | 4 | S + M | N | recipe verify | nutrition-engine [1] |
| C7 | Custom user "Suppr" foods can reach 0.98 confidence and out-rank USDA | +0.08 verified / +0.03 unverified boost; shown as first-class `source: "Suppr"` peer to USDA | 3 | 3 | M | N | food search | nutrition-engine, legal, brand [3] |
| C8 | Two meal-plan algorithms diverge | `src/lib/nutrition/mealPlanAlgo.ts` (mobile) vs `src/lib/planning/generateMealPlan.ts` (web): recency `+100` vs `+40`, reset 5d vs 3d, asymmetric penalty `*3/*1.5` vs flat `*2`, bands `calorieBandPct` mobile 5 vs web 12 | 4 | 4 | L | N | planner both platforms | code-quality, sync-enforcer, performance-optimizer [3] |
| C9 | `plannedMealDisplay` test is false-positive — `not.toMatch` passes for any non-all-zero string | `<1` branch + one-decimal branch + zero branch all exercise-free | 3 | 3 | S | N | tests/unit/plannedMealDisplay.test.ts | repo-auditor, qa-lead [2] |

### D — Onboarding v2 (mobile) — category-one catastrophe

All below confirmed by 5+ lenses: **customer-lens, journey-architect, copy-reviewer, ui-product-designer, integration-manager, growth-strategist, qa-lead, docs-keeper, product-memory, analytics-engineer.** Flag `onboarding_v2` rolled to 100% on 2026-04-20; every iOS install since lands here.

| # | Title | Problem | Sev | Impact | Effort | Blocker |
|---|---|---|---|---|---|---|
| D1 | Signup step is a UI stub | Apple button: `set({ authMethod: "apple" }); go(1)` — no `signInWithApple`, no email/password, no `supabase.auth` call | 5 | 5 | M | **Y** |
| D2 | Permissions step toggles React state only | No `HKHealthStore.requestAuthorization`, no `Notifications.requestPermissionsAsync`, no Expo push token register | 5 | 5 | S-M | **Y** |
| D3 | Import step is `setTimeout(2200)` with hardcoded "Sheet-pan chicken · 94%" | Every URL (even empty) returns the same card. Fabricated first-value moment | 5 | 5 | M | **Y** |
| D4 | Terminal step is a no-op | `go(1)` clamps past last index; no `persistOnboardingV2` call; no `router.replace("/paywall")`; web equivalent has both | 5 | 5 | M | **Y** |
| D5 | Reveal targets never saved | Reveal shows computed `displayCals` + macros; because nothing persists (D4), Today reads `NUTRITION_DEFAULTS` → promised 1,820 kcal lands as 2,000 | 5 | 5 | M | Y |
| D6 | Welcome "Sign in" link is an untappable `Text` inside a `Text` | Returning users who reinstall have no path back | 5 | 5 | S | Y |
| D7 | StatusBar hardcoded `light-content` on non-Welcome steps | White time/battery on light-grey background unreadable in sunlight during 11 steps | 4 | 4 | S | N |
| D8 | 11 files still on Ionicons in onboarding-v2 (sparkles-outline, chevron-back, link-outline…) | Prototype mandate is lucide-react-native; back button + methodology note + welcome card visibly mixed | 4 | 3 | M | N |
| D9 | Ambient canvas missing on 7 of 8 steps | Only Welcome has the prototype gradient; rest are flat | 3 | 3 | M | N |
| D10 | "Mediterranean" as diet identity + halal/kosher missing | Cultural flattening; Muslim/Jewish user can't express need at onboarding | 4 | 4 | S | N |
| D11 | Hard `\n\n` manual line breaks in Welcome headline | "Eat well, / without / overthinking it." — prosody broken on any device wider than SE | 4 | 3 | S | N |
| D12 | Pace copy has medical disclaimer crammed into methodology note | 3-idea paragraph; break out `/legal/health-disclaimer` link | 3 | 3 | S | N |
| D13 | Pace headline asymmetry privileges Lose goal | Maintain skips Pace; Lose gets the emphatic "How fast should we lose?" projection; reinforces loss-as-default | 2 | 2 | S | N |
| D14 | "Prefer not to say" sex subtitle leaks actuarial jargon | "Uses a midpoint estimate (~166 kcal between sexes)" to the user-group most likely to select it | 2 | 3 | S | N |
| D15 | No `onboarding_completed` event on mobile | F1 (sign_up → onboarding_completed → first food_logged) funnel zero'd on mobile | 5 | 4 | S | Y |

### E — Diversity, inclusion, dignity

| # | Title | Problem | Sev | Impact | Effort | Blocker | Surfaces | Reporters |
|---|---|---|---|---|---|---|---|---|
| E1 | Dead-name leak reintroduced via `household_meals.cook_display_name` snapshot | 2026-05-01 migration adds immutable name column; a trans user who renames sees legacy name attributed to old meals forever on household screens | 5 | 5 | S | **Y** | household API | diversity-inclusion, docs-keeper [2] |
| E2 | Allergen surfacing (DI-P0-01) — safety-critical, 5 days no movement | No `allergens[]` column, no "Contains:" UI, no FDA-compliant wording; 14 regulated allergens not modelled | 5 | 5 | L | **Y** | recipe schema + detail | diversity-inclusion, product-memory, user-sentiment, feature-scout [4] |
| E3 | Weight hide / trends-only mode (DI-P0-03) — 5 days no movement | Digest + Progress render weight as first-class stat; no opt-out for ED/dysphoria risk | 5 | 5 | M | **Y** | Progress, Digest | diversity-inclusion, product-memory [2] |
| E4 | Gender identity + pronouns field absent from `profiles` | Non-binary user has no way to represent gender; onboarding asks "sex" only | 4 | 4 | M | N | onboarding + settings | diversity-inclusion [1] |
| E5 | Pricing hardcoded GBP across regions | Non-UK user sees £ with no conversion; upgrade dialog has no region disclosure at all | 3 | 4 | M | N | pricing, paywall | diversity-inclusion, monetisation [2] |

### F — Performance / responsiveness

| # | Title | Problem | Sev | Impact | Effort | Blocker | Reporters |
|---|---|---|---|---|---|---|---|
| F1 | `generateSmartPlan` freezes mobile UI 6-11s at pool=40 | Sync sampler runs on JS thread under onPress; 20k-combo cap; no `InteractionManager` yield | 5 | 5 | M | **Y** for pool ≥30 | performance-optimizer [1] |
| F2 | Sampler quadratic slot-product blow-up before 20k cap | `perSlot.reduce((a,p)=>a*p.length,1)` then `fitDayToTargets` per sample | 5 | 5 | M | Y (fixes F1 root) | performance-optimizer [1] |
| F3 | Mobile planner save = 14 serial RTTs; web is 1 bulk insert | `for (const dp) { await insert(day); await insert(meals) }` no transaction | 4 | 4 | S | N | performance-optimizer, data-integrity [2] |
| F4 | `persistPlan` delete-then-insert with no transaction | Backgrounded app mid-loop → partial plan: days 1-3 exist, 4-7 gone | 5 | 4 | M | Y | data-integrity [1] |
| F5 | HealthKit sync fires 6 serial column updates on same profile row | Plus `JSON.stringify` diff on 90-day maps on JS thread | 4 | 4 | S | N | performance-optimizer [1] |
| F6 | Discover feed non-virtualised ScrollView, uncached RN `<Image>`, `.limit(200)` | Mount storm on focus | 4 | 4 | M | N | performance-optimizer [1] |
| F7 | `saveVerifiedIngredients` serial-awaits UPDATEs per dirty row | 8-15 sequential RTTs on save-verify tap | 3 | 3 | S | N | performance-optimizer [1] |
| F8 | Today focus chain: HealthKit → nutrition → targets → journal | Targets read hostage to cold HK chain | 3 | 4 | S | N | performance-optimizer [1] |

### G — Surface quality (premium tier)

| # | Title | Problem | Sev | Impact | Effort | Reporters |
|---|---|---|---|---|---|---|
| G1 | Progress is a dashboard of 12 boxes, not a product | Weight card + trend tile + Weight chart card all repeat; no hero | 5 | 4 | L | ui-critic [1] |
| G2 | Planner day cards cramped at 108px | 10px recipe names truncate to "Roast ch…"; 3px progress bar unreadable at arm's length | 4 | 4 | M | ui-critic [1] |
| G3 | Paywall gradient-to-white hard seam | Hero intensity `stopOpacity 1` ends on `paddingBottom Spacing.xl` flat into cards | 4 | 3 | M | ui-critic [1] |
| G4 | Digest reads as data dump, not narrative | Four equal-weight stat tiles + two CTAs; no insight elevated | 4 | 4 | M | ui-critic [1] |
| G5 | Planner `▼`/`▶` chevron + `🔒` emoji + lucide mix | Three icon languages on one screen | 3 | 2 | S | ui-critic, visual-qa [2] |
| G6 | Two segmented-controls on Progress with label mismatch (7d/30d vs 1W/1M) | Different radius, different active treatment, same concept | 3 | 3 | M | visual-qa [1] |
| G7 | Digest "Got it" tap target ~34pt (below HIG 44pt) | No `hitSlop` on primary exit | 3 | 3 | S | visual-qa [1] |
| G8 | WeightChart floating label clamps only the left edge | Narrow chart + early data → label disconnects from dot | 2 | 2 | S | visual-qa [1] |
| G9 | Planner day-summary strip duplicates content visible directly below | 7-cell strip at ~40px each is illegible clutter | 2 | 2 | M | ui-critic [1] |
| G10 | Household-settings slot icons (cafe/moon/restaurant/apple) don't match planner (Coffee/Sun/UtensilsCrossed/Cookie) | Same meal, different glyph across screens | 3 | 2 | S | ui-critic [1] |

### H — Product judgement / overbuild

| # | Title | Problem | Sev | Impact | Effort | Reporters |
|---|---|---|---|---|---|---|
| H1 | Household is full surface area for N=1 | Chip bar, preset picker, superseded-chip decision doc, mixed-initials doc, F-16 share-lunches scope — zero household users exist | 4 | 2 | S (to cut) | product-lead [1] |
| H2 | Two paywall patterns (web upgrade dialog + mobile route) for cohort of 1 | Neither A/B tested; web Variant A/B is not even a real A/B test (no randomisation, no experiment_id, branching on `userTier` as "variant") | 4 | 3 | M | product-lead, analytics-engineer, monetisation [3] |
| H3 | Discover "Matches your day" is `filtered.slice(0,2)` | Rename to "Top picks" or wire real scoring; current claim is a personalisation promise the code doesn't keep | 4 | 4 | M or S | product-lead, ui-product-designer [2] |
| H4 | Plan portion spread penalty fights the wrong problem | Soft-demotes 0.2×/1.8× portions; needs hard floor + "no good plan" empty state | 3 | 4 | M | product-lead [1] |
| H5 | Customer Center + unified dev key for zero paying users (except Grace) | "Nice for paying users someday" work that cost a sweep slot | 2 | 2 | shipped | product-lead [1] |
| H6 | Cook-mode "Log this meal" missing on mobile | Highest-intent retention moment drops user at `router.back()` | 4 | 5 | S | journey-architect, growth-strategist, analytics-engineer, user-sentiment [4] |
| H7 | Onboarding import doesn't enforce verify before planning | Unverified recipes slotted into plan; accuracy bar never enforced at point of highest relevance | 2 | 3 | M | journey-architect [1] |
| H8 | Household invite accept has no deep-link | Manual code copy + type on both platforms; migration implies link was anticipated but routing doesn't exist | 3 | 4 | M | journey-architect [1] |
| H9 | Planner missing snacks on web; mobile has them — not recorded as intentional | Mobile-plan snack rows silently absent on web | 2 | 2 | S or document | journey-architect [1] |
| H10 | Paywall always routes to /notifications-prompt regardless of source | Mid-session upgrade (shopping list, library) dumps user into notif prompt | 3 | 3 | S | journey-architect [1] |

### I — Growth / analytics / taxonomy

| # | Title | Problem | Sev | Impact | Effort | Reporters |
|---|---|---|---|---|---|---|
| I1 | Mobile onboarding has no `onboarding_completed` event | F1 funnel zero'd on mobile — duplicated in D15 | 5 | 4 | S | analytics-engineer, growth-strategist [2] |
| I2 | `upsell_variant_*` events are not a real A/B test | No `variant_key`, no randomisation, deterministic on `userTier` | 5 | 2 | S | analytics-engineer [1] |
| I3 | Mobile paywall has no `paywall_dismissed` | F2 can't measure drop-off; web `/pricing` also lacks it | 5 | 3 | S | analytics-engineer [1] |
| I4 | `paywall_viewed` double-fires on mobile focus change | No dedup ref; denominator inflated | 3 | 2 | S | analytics-engineer [1] |
| I5 | Digest UI renamed, events still `weekly_recap_*` | 9 emit sites; analytics dashboard cycle didn't include rename; product-memory open question | 3 | 1 | M | brand-manager, analytics-engineer, product-memory [3] |
| I6 | `meal_plan_generated` payload is `{days}` only — no perf, no outcome | 6-11s UI freeze not measured; no p95, no abandonment | 4 | 3 | S | analytics-engineer, performance-optimizer [2] |
| I7 | `syncHealthDataThrottled` + plan calendar anchor bleed have zero telemetry | Silent-failure class | 3 | 3 | M | analytics-engineer [1] |
| I8 | Weekly-recap push kill leaves unsynced installs silent with no fallback | P0-1 (Expo token sync) has no owner, no deadline | 3 | 3 | varies | product-lead, growth-strategist [2] |
| I9 | Digest has no mobile entry point outside Progress tab | Old recap fired a push; new loop requires the user to remember | 3 | 4 | S | growth-strategist [1] |
| I10 | Cal AI pulled from App Store 2026-04-21 for paywall dark patterns | Suppr paywall audit urgent against current Apple pattern-enforcement climate | 5 | 5 | S-M | user-sentiment [1] |

### J — Market / category signal (for post-unblock prioritisation)

Not release-blockers; strategy inputs.

- **MFP's paywalled-barcode trauma (2022) is still top-quoted** — "features that were free are now paywalled" = #1 trust-killer. Suppr should write a public "free forever" list and hold it.
- **The one unmet category wish is "tracker + recipes + planner in one"** — that's Suppr's thesis. Reposition landing + App Store against the MFP/Paprika/AnyList stack.
- **Adaptive targets now table-stakes** — Suppr's weekly digest is close; finish the "we adjusted your target because X" loop.
- **Barcode scanning is category table-stakes** — zero in Suppr today. Either ship via Open Food Facts lookup or explicitly de-scope with positioning rationale.
- **"Restaurant logging" + "copy-day" + maintenance mode** — feature-scout high-demand / feasible shortlist. Suppr already has copy-day (marketing hook).
- **Creator monetisation primitives absent** — Suppr publishes altruistically; no tipping/share/affiliate. Decide if creators are a growth vector.
- **HealthKit double-count is a category footgun** — proactive FAQ entry is free insurance.

### K — Documentation & memory hygiene

- **Prior ship-verdict doc is stale.** Marked blocker #1 "Closed in code"; only the read side was closed. Must be superseded by this sweep.
- **No nutrition approximation policy doc** covering `coerceMacrosWhenCaloriesByNoGrams`, `totalGramsForVerifyScale` (ml≈g), or `measureToGrams` "large" fallback order. Project rules mandate documentation of any approximation that materially affects accuracy.
- **Billing architecture decision doc silent on IAP cancellation/lapse path** — no reference to the missing RevenueCat webhook.
- **Onboarding v2 mobile stub status undocumented** — decision doc treats mobile v2 as live parallel; source file says "doesn't write to Supabase yet"; ship checklist has no v2 gating item.
- **FatSecret caching decision doc** has all 4 action items unchecked since 2026-04-19.
- **Roadmap claims `cook_display_name` snapshot shipped**, but the insert-path client write is still pending.
- **Digest events vs UI name** — two docs (digest-primitive brief, progress journey) disagree; open question #11 unresolved.

---

## 3. Top 15 actions (ranked)

Scoring: `severity × user_impact / effort`, release-blockers pinned above non-blockers.

| # | Action | Owner | Expected outcome | Blocker? |
|---|---|---|---|---|
| 1 | Revert `onboarding_v2` flag to 0% today; legacy flow continues serving | executor | Stop creating accountless installs | **Y** |
| 2 | Column-level RLS trigger rejecting client UPDATE of `profiles.user_tier`, `stripe_customer_id`, `subscription_status` | executor + security-reviewer | Close paywall bypass | **Y** |
| 3 | Strip "94% confidence · USDA" chip (onboarding import + welcome floating) and "7-second parse, USDA-verified" (paywall + upgrade dialog); replace with truthful previews | copy-reviewer + ui-product-designer + executor | Close CAP/CMA/FTC claim exposure | **Y** |
| 4 | Gate `coerceMacrosWhenCaloriesByNoGrams` behind a display-only contract (type + lint); journal write-paths refuse coerced output; decide planner display policy (show kcal only / "incomplete macros" flag) | nutrition-engine + product-lead + executor | Nutrition rule restored | **Y** |
| 5 | Rewrite `planCalendarAnchor` + `totalGramsForVerifyScale` tests to assert correct behaviour; fail until the underlying schema fix (anchor) and density lookup land | qa-lead + executor | Stop pinning bugs as correct | **Y** |
| 6 | Add `/api/revenuecat/webhook` route with signed-payload verification → service-role `profiles.user_tier` write on CANCELLATION/EXPIRATION/BILLING_ISSUE/RENEWAL; replace client downgrade guard | integration-manager + security-reviewer + executor | Cancellations actually revoke entitlement | **Y for launch** |
| 7 | Pick canonical domain (`suppr-club.com` OR `supprclub.com`); register both; 301 the non-canonical; sweep every `support@`, DMCA agent, privacy controller, bot UA, paywall footer, VAPID subject, app.json | brand-manager + executor + Grace (registrar) | DMCA safe harbour preserved; email reachability | **Y for submission** |
| 8 | Decide "Suppr Club" branding (pause + rename OR risk-accepted memo from counsel); stop incremental commercial use on first-impression surfaces until decided | brand-manager + product-lead + formal counsel | TM posture clear | **Y for submission** |
| 9 | FatSecret tier decision (Premier-upgrade OR stop persisting macros/`fatsecret_food_id`) | integration-manager + monetisation + legal-reviewer | Apple 5.2 risk closed | **Y for submission** |
| 10 | Ship allergen surfacing v0 — `recipes.allergens text[]` column, auto-populate from confident matches, "Contains:" callout on detail web+mobile, 14 regulated allergens in onboarding diet | nutrition-engine + data-integrity + legal-reviewer + executor | Safety-critical P0 closed | **Y** (or document accepted risk) |
| 11 | Ship `profiles.weight_surface_mode` (`show`/`hide`/`trends_only`); Digest + Progress honour on both platforms | journey-architect + ui-product-designer + sync-enforcer + executor | ED/dysphoria risk closed | **Y** (or document accepted risk) |
| 12 | Fix `cook_display_name` dead-name: drop from read path in `householdClient.ts`; join live `profiles.display_name` on `added_by`; keep column as leaver-only fallback | data-integrity + executor + diversity-inclusion | Trans user dignity | **Y** |
| 13 | Schema migration: add `meal_plans(id, user_id, slot_id, start_date)` parent table OR `meal_plan_days.start_date`; rewrite anchor resolver to read persisted anchor; backfill | data-integrity + nutrition-engine + executor | Today + journal + Progress show correct plan | **Y for launch** |
| 14 | Move `generateSmartPlan` off sync tap path (InteractionManager + spinner); cut sampler cap from 20k to 2k via stratified sampling; telemetry on generation ms | performance-optimizer + nutrition-engine + executor | Plan regenerate stops freezing UI | **Y for pool ≥30 users** |
| 15 | Rebuild onboarding v2 mobile: real Apple/Supabase auth in Signup; real HealthKit/Notifications prompts in Permissions + register Expo push token; real import in Import or clearly-label demo; `handleComplete` at terminal step calling `persistOnboardingV2` + `router.replace("/paywall?from=onboarding")`; add `onboarding_completed` event | executor + ui-product-designer + integration-manager + analytics-engineer | Usable onboarding returns | **Y for re-enabling flag** |

Follow-up (next sweep): household_meals WITH CHECK, household_join RPC, web_push_subscriptions per-user endpoint, Stripe webhook persisted dedup, photo/voice/USDA/FatSecret client timeouts, web upgrade dialog annual toggle + full CMA disclosure, upsell_variant rename-or-wire-real-A/B, Digest→weekly_digest event rename (30d dual-emit), Progress IA (hero + supporting), planner day-card redesign, Discover virtualisation, HealthKit batched update, web planner coercion parity (once policy set), web planner snacks decision, allergen expansion + gender/pronouns + halal/kosher + regional pricing + two meal-plan algos consolidation + two segmented-controls on Progress.

---

## 4. Release readiness

| Gate | Verdict | Conditions |
|---|---|---|
| **Continue TestFlight (N=1)** | **HOLD** | Actions 1, 2, 3, 4, 5 shipped + verified |
| **Expand TestFlight cohort** | **HOLD** | Actions 6, 10, 11, 12, 13, 14, 15 added |
| **App Store submission** | **HOLD** | Actions 7, 8, 9 added; full re-sweep (security, legal, nutrition-engine, qa-lead, release-gate) |

---

## 5. Open questions (for Grace)

1. **C1 policy:** is `coerceMacrosWhenCaloriesByNoGrams` output **planner-display-only** (refuse to persist) or **journal-writable with an "estimated" flag**? Nutrition-engine strong preference: display-only + `<1`/"incomplete" visual flag + route to verify. Affects actions 4, 13.
2. **A2 architecture:** does the new RevenueCat webhook write `profiles.user_tier` directly (fastest) or via an idempotent `purchase_events` table that the webhook appends to and a reducer updates tier (safer, matches Stripe)?
3. **B5 branding:** pause "Suppr Club" naming now OR get formal counsel's risk-accepted memo? The TM-1 timeline determines whether onboarding Welcome copy keeps the Club framing at all.
4. **B4 domain:** `supprclub.com` (cleaner, matches bundle id) or `suppr-club.com` (what all legal/support surfaces currently use)? Pick the one Grace owns or is cheaper to migrate to.
5. **E2 allergen launch policy:** ship v0 (14 regulated allergens + "Contains:" on detail) OR document explicit accepted-risk with product-lead sign-off.
6. **E3 weight-hide default:** `show` (current behaviour) with opt-out in settings OR neutral-by-default until the user opts in?
7. **C7 custom-food source label:** rename "Suppr" to "User-entered" / "Curated" / "Internal"? Distinct branding from DB authority.
8. **H1 household scope:** demote household surface from Plan primary scroll to More until N≥2 households exist?
9. **J benchmark:** is barcode scanning on the roadmap, or explicitly de-scoped with a positioning rationale?

---

## 6. Hygiene notes from this sweep

- **`scripts/mealplan_bench.mjs`** was created by the `performance-optimizer` agent during the sweep. It's a throwaway harness — delete it or move to `scripts/perf/` and document.
- **Prior sweep verdict `docs/decisions/2026-04-full-sweep-ship-verdict.md`** must be marked superseded by this document.

---

## 7. Notion mirror actions (MCP not invoked this session)

List so Grace can run when connected:

- **Decisions log row** (Decisions DB `collection://ffbda5f6-6d65-4b18-8d3f-94c6f0a8837c`): Title "2026-04-24 full-sweep ship verdict — HOLD"; Status: Resolved; Area: Product/engineering; Link: GitHub blob URL for `docs/decisions/2026-04-24-full-sweep-ship-verdict.md`.
- **Decisions log row**: supersede entry for `docs/decisions/2026-04-full-sweep-ship-verdict.md` (add a `Superseded by` field or a status change to "Superseded").
- **Tasks DB** (`collection://a10d55ea-64fe-4468-8a92-65c2b5e6d6df`): create rows for actions 1–15 with owner, status Open, blocker flag, link to the executor backlog file.
- **Roadmap DB** (`collection://c6e2c4f1-5b3b-4c3f-8dff-7c026a453749`):
  - "Onboarding v2 mobile" → revert from Shipped to In progress (flag reverted to 0%; rebuild pending).
  - "Household Netflix v1" → In progress (cook_display_name dead-name regression open; insert-path wiring incomplete).
  - "Weekly recap push" → In progress (Expo token sync gap open).
  - Add new rows: "RLS tier-write lockdown", "RevenueCat webhook", "Plan calendar anchor schema", "Allergen surfacing v0", "Weight surface mode".
