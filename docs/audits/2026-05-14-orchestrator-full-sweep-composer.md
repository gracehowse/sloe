# Orchestrator full sweep (Composer / composer-2-fast)

**Model:** Cursor `Task` subagent `orchestrator-full-sweep` with `composer-2-fast`.  
**Subagent ID:** `9c1a48b8-6eae-4754-bf5b-2f4e61a4a4ba`.  
**Date:** 2026-05-14.  
**Companion:** Prior consolidated sweep in [`2026-05-14-full-sweep-orchestrator.md`](./2026-05-14-full-sweep-orchestrator.md).

---

Evidence check: **`/dmca` and `/licences` are public**, **`apps/mobile/app/onboarding-v2.tsx` redirects** to `/onboarding` with analytics (closes 2026-05-05 A3), **tier DB lockdown migrations** exist, **RevenueCat webhook** exists at `app/api/revenuecat/webhook/route.ts`, **web `/login`** uses the Suppr “S” tile and drops duplicate page H1 (rows 5.1/5.2), **`PricingHero`** drops the SUPPR pill and compresses padding (3.3/3.1/4.1). Planned-meal logging from Today now **blocks coerced-macros writes** with a Verify alert (`index.tsx` T4 comment). Outstanding premium P0-valid items still cluster around **mobile paywall soft-fail**, **capture/Maestro debt**, **operational Stripe Tax / VAT disclosure**, **Settings vs Profile tile pattern (DC14)**, and deferred **trust / surface** backlog from older sweeps.

---

## PART A — Per-lens briefs

### repo-auditor
Suppr is a Next.js App Router web app (`app/`), shared `src/` library, Expo mobile (`apps/mobile/`), Supabase Postgres with a large migration set, Stripe (web) and RevenueCat (iOS). **Prior audit “truth” drift is shrinking:** defensive `/onboarding-v2` redirect, public legal routes, and P0-pricing/login polish appear implemented in-repo. Vestigial `onboarding-v2` **strings keys and Maestro/capture scripts** still reference the old name—operational hygiene, not a broken route anymore.

- Coherent mono-repo spine: shared nutrition, landing SSOT (`src/lib/landing/content.ts`).
- Regression vs 05-05: **A1 (DMCA/legal public)** fixed in `middleware.ts`.
- Regression vs 05-05: **A3 (dead onboarding-v2 deeplink)** mitigated via `Redirect` route + tests.
- Residual naming debt: **`suppr.onboarding-v2.state`**, YAML comments, **`capture-every-route.sh`** still mention `suppr:///onboarding-v2`—should converge for maintainer sanity.

### code-quality
The codebase skews toward “production-grade but dense”: ESLint `--max-warnings` ratchet, large mobile screens (`index.tsx`), many Vitest suites. Duplication hotspots called out historically include **dual meal-plan algorithms** (mobile `mealPlanAlgo` vs web `generateMealPlan`). Mobile **console leakage** was noted as papercuts in May sweeps.

- Watch **planner parity** (`sync-enforcer` overlaps): two planners = long-term correctness risk.
- **Large components** hinder review velocity; acceptable for N=1 if bounded.
- Prefer centralised logging vs scattered `console.*` on mobile (05-05 I2-class).

### product-lead
Strategic spine (Today first, macro tracker north star, “what to eat next”, single Log sheet, Free+Pro) is reflected in `_project-context.md` and routing. Historical tension remains between **premium cold-open aspirations** (MFP exile moment) and **household/complex surfaces** prioritised ahead of cohort scale.

- Decide **Grace call on login in-card signup/signin tabs** vs Stripe-style splitting (debated row 5.3 in `P0-proposal.md`).
- **Household prominence** (#10-class from Apr-30) still a strategic cut vs defer question.
- **Discover/library labelling** and **north-star truncation** deferred from Apr-30 remain product debt.

### customer-lens
First-session narrative: onboarding Welcome is strong aesthetically; friction clusters on **anything that reads “broken load”** (paywall unavailable card), **web vs mobile parity of expectations** (pricing fold, login wall depth links), and **empty states that don’t cue logging**—partially addressed in later captures but historically a refugee-risk.

- Paywall **“Subscriptions unavailable”** dominates first viewport vs Calm-tier expectation.
- **Returning users** pathways (Welcome secondary CTA) debated: premium audit wants subtraction; accessibility to sign-in matters for reinstalls—needs product-balanced resolution.
- **`+not-found`** copy mismatched to onboarding (05-05) may still confuse if redirects fail.

### journey-architect
Critical paths span landing → onboarding (auth inlined) → Today → Log sheet → Planner → Paywall/post-trial; web uses Stripe checkout, mobile App Store/RevenueCat. **Erase/reset → canonical onboarding** fixed per decisions; **`/signup` redirect to `/onboarding`** intentional to kill duplicate-account loop (do not resurrect standalone `/signup` form without risk analysis).

- **Cook → log** retention gap flagged in older sweeps (#H6-class)—verify parity with Growth lens.
- **Paywall exit to notifications** mid-flow (historical)—can feel like hostage routing.

### design-system-enforcer
Bundles under `docs/ux/claude-design-bundles/` remain reference—not mandate. Respect **macro colour map**, **over-budget amber except calorie-ring carve-out**, **no raw hex** directive. **`Settings`** flat tiles vs **`Profile`** DC14 outlined pattern is an explicit Allowed-borrow delta (row 23.1).

- Pricing hero duplication of wordmark: **pill removed** in current `PricingHero.tsx` ✓  
- Login **brand tile** aligns with canonical mark ✓  
- **Settings dark tiles** vs Profile outlined tiles: erosion risk per premium DC14 notes.

### visual-qa
Pixel-level defects from route captures: truncation, stacking, capsule collisions (Search/Dynamic Island-era), ALL-CAPS nav drift, cramped planner cards. Recent **after** PNGs exist for login/pricing (premium sweep)—visual gate improving.

- Re-run **mobile paywall dark** (RTP-7).
- Confirm **sticky headers** and **Island** intersections on smallest device class.
- **Web mobile viewport** truncation (“Get sta…”) class from 05-05—spot-check landing header.

### ui-critic
Commercial surfaces trending **above “Bootstrap” shame** post-pricing/login tightening; Digest/Progress/dashboard density still skew “admin panel” vs hero-led product (historic G1/G4). Planner micro-readability remains a retina/contrast problem at default card heights.

- Progress/Digest need **single hero thesis**, not grids of peers.
- **Paywall gradient seam** historically called out—aesthetic cohesion with trust chips inside card matters.

### premium-auditor
P0 cold-open verdict: mobile **Today** + **mobile paywall card** hit or exceed bar versus MyFitnessPal, Cronometer-class lack of narrative, Cal AI noise; weakest link is **soft-failure states** (unavailable subscriptions card) and **evidence gaps** (onboarding Maestro RTP-6). Many refuse-to-pass **RTP rows are phantom** post code-reality audit—**do not re-litigate RTP-1/2/7/10 as written** unless regressed.

- Holding **non-negotiable:** RTP-3 soft-fail; capture closure RTP-6/7.
- **DC15 VAT line:** code-gated; operational enablement—not “missing code” phantom.

### brand-manager
“Suppr Club” onboarding/landing wording remains a **conscious trademark-risk trade** (historic B5/B2); brand continuity improving on **login mark** + **pricing hero de-duplication**. Avoid unsubstantiated **social-proof lines** (“Join thousands…”) per DC12 premium notes.

- Align **`SUPPR` vs `Suppr`** on mobile login (`P0-proposal` 15.1).
- Maintain **functional, calm** voice vs shouty competitor patterns (MFP, Cal AI).

### copy-reviewer
Trust language must stay **estimated / approximate**; avoid **measurable false claims**. Full-sweep 04-24 called out onboarding/paywall “USDA-verified” class claims—assume addressed unless resurfaced during copy regressions.**Always** tense rule: yesterday vs today.

- Audit **any new AI/voice** surfaces for absolute nutrition claims (**nutrition-engine + legal** tandem).
- **Reset vs Erase** clarified by decision (Apr-30)—don't re-break with new settings copy.

### ui-product-designer
Direction exists for subtractive polish: condensed pricing hero, brand-correct login, paywall unavailable **footnote not billboard**, Welcome **proof-line** removal. Larger IA questions (Signup URL shape) are **answered by redirect philosophy**—design should reinforce “single canonical signup surface” vs fragmenting URLs.

- Spec RTP-3: collapsed notice, retry affordance, preserve Pro card prominence.
- **Settings** adopts Profile tile language for dark cohesion (borrow list in P0-proposal).

### nutrition-engine
`coerceMacrosWhenCaloriesByNoGrams` remains central to trust; repo shows **planned-meal-from-Today logging now refuses persisted coerced macros** with Verify routing (major April concern narrowed). Lingering diligence: **`totalGramsForVerifyScale` ml≈g**, **measureToGrams ordering**, **`mealPlanAlgo` vs web generator** divergence, **confidence thresholds** below category bar—all historical multi-reporter.

- Treat **silent macro invention on any path** as release-class if reintroduced.
- **Allergens migration** landed in repo (`20260503100200_recipes_allergens.sql`)—needs product surfacing/UI to close historic safety gap.

### data-integrity
Tier column **server-enforced lockdown + forward-compat banned billing columns** in migrations mitigate Apr-24 paywall bypass. **RevenueCat events migration** aligns server-side tier updates. Remaining classical risks from April: **persistPlan transaction boundaries**, **`household_*` RPC edge cases**—treat as “verify closed per migration history” unless new repro.

- Confirm **prod migration parity** (`20260503100000` onward) vs staging (**open question**).
- **Push subscription cross-user leak** (A3-class)—requires explicit verification closure in Ops/security passes.

### sync-enforcer
Documented carve-outs honoured: web monthly default pricing vs mobile annual paywall default, MoveMealSheet mobile-only, Go Public web-only, Welcome copy divergence. Highest ongoing risk remains **dual planning engines** differing in scoring bands and behavioural outputs for the same underlying rows.

- Unify planner algorithm or formally document divergence as intentional with parity tests (**not** silently drift).

### integration-manager
Integrations footprint: Stripe, RevenueCat webhook present, FatSecret/USDA/OpenFoodFacts, analytics. March toward **abortable upstream fetches**, **webhook signature verification**, **idempotency**, **stripe dedup persistence** remains good hygiene backlog from older security/integration notes.

- **FatSecret tier / licencing posture** historically store-submission-touching—keep in checklist pre-App Store widen.

### performance-optimizer
Historic blockers included **blocking smart-plan sampler on JS thread**, **many serial planner RTTs on mobile**, **Discover scroll performance**. Not re-profiled live in this sweep; treat as conditional if user reports jank after recent UI changes.

- If plan pool scales, revisit **interaction manager / worker offload** patterns.

### security-reviewer
Major Apr-24 **tier client write** addressed in DB rules. **`/dmca` / `/licences` public** restores safe-harbor posture vs 05-05 regression. Stripe/RevenueCat paths need recurring review: webhook secrets, RLS edges, replay masking for health-adjacent data.

- **PostHog session replay masking** checklist on new PHI-adjacent fields.
- **`/api/household/join`** rate-limit scoping historically weak—grep before assuming fixed.

### legal-reviewer
UK/EU **VAT-inclusive display** wired but **environment-gated**—legal/marketing consistency requires **Stripe Tax inclusive** flipped before outbound claims. Privacy **EU/UK representative placeholders** appropriate for solo tester carve-out—not for widened testers. Domain/DMCA coherence improved once **public takedown** route fixed.

- **Operational gate**: `STRIPE_TAX_ENABLED` + dashboard price `tax_behavior` before “inc VAT” comms (**RTP-9 class**).

### diversity-inclusion
Historic P0 themes: allergen UX absence, dead-name snapshots in households, lack of weight-privacy modes, onboarding sex-vs-gender framing. Repo shows **recipe allergens migration**—execution requires inclusive **UI + wording** (“Contains” parity, no shame).

- **Allergen disclosure** UX must match legal/safety expectation (FDA-ish clarity without fear-mongering).
- Maintain **body-neutral** progress copy; suppress toxic streak gamification (**calm streak pip** aligns).

### qa-lead
CI is broad (`npm run ci` bundles web + mobile). Premium bucket **blocked on harness truth**: onboarding Maestro still named v2 historically; **`00c`** must advance beyond Welcome **RTP-6**. Evidence: **dark paywall**, **web authed Today** still capture debt from premium DC1 notes.

- Close **capture fixtures** ahead of asserting P0-complete.
- Periodic **screenshot-diff** regressions vs `tests/e2e/screenshots/` public routes spec.

### user-sentiment
No live Reddit/App Store scrape this pass; proxy signal remains **MFP exodus** (pain: paywalls, removals, mistrust)—aligns with product trust chips and honesty on estimates. Synthetic personas deprioritised per **solo-tester** rule.

### competitor-intelligence
Canonical eight: MyFitnessPal, Lose It!, Cronometer, MacroFactor (trackers); Cal AI (AI-photo); Paprika, Recime, Honeydew (recipe/plan). Suppr wedges: **import + honesty + narrative Today** vs MFP hostility; risks: **photo-calorie apps’ marketing wedge** exposes Suppr unless photo/voice tiers feel premium-clear.

### feature-scout
Public feedback themes (historical audits): barcode parity expectations, fasting adjacency, better **coach-like planning**, Discover truth vs “personalised” label, **MFP import** desires.

### growth-strategist
Activation hinge remains **first log + onboarding completion events** (**firstLog** taxonomy). **`/whats-new` public-route** stance should match growth wants (historically gated—verify `middleware`). Remove friction on **cold landing → start** path; suppress **panic affordances** (paywall unavailable) that increase bounce without teaching value.

### monetisation-architect
Free + Pro posture locked. **Regional pricing** incomplete if single-currency artefacts remain anywhere in non-fallback flows. **Trust-strip** parity between web checkout affordances vs mobile paywall is strong when visible; degraded when RC misses offerings.

### analytics-engineer
Canonical `AnalyticsEvents`; **avoid platform suffix divergence**. **`onboarding_v2_redirect_followed`** is a pragmatic funnel for ageing links. Replay/taxonomy reviews when adding voice/photo logging events—include **confidence buckets**, not floats.

### docs-keeper
Many sweep artefacts (`2026-04-24`, `05-05`, `05-14`, `premium-v2`). **Prefer single dated verdict chain** linking `P0-proposal.md` phantom table to reduce thrash. Operational steps (VAT, migrations) belong in **`docs/decisions/`** plus Notion mirror per CLAUDE.md.

### product-memory
Record: **premium code-reality audit spared ~61% phantom work**; intentional **`/signup` → `/onboarding`** redirect rationale; **`/home` login wall intentional** legacy authed surface. Sweep verdict stays **conditional** until paywall soften + Stripe Tax ops + harness closure—or explicit acceptance memo.

### planner
Prioritise backlog: RTP-3 → ops VAT disclosure → captures → Settings DC14 adoption → planner algorithm unification/divergence memo → longstanding diversity/safety backlog post-allergens schema.

### release-gate
**Cannot call unconditional GA:** paywall degraded state UX, operational tax alignment, unresolved broad QA evidence for onboarding steps remain **conditional-release** items. Solo TestFlight narrower bar than UK/EU public marketing or Store featuring.

---

## PART B — Consolidation

**(1) Scope paragraph**

This sweep scopes **Suppr as built in-repo** for **suppr.app (web), marketing/landing lanes, iOS Expo (TestFlight; Android Expo template vestigial)**, using **`_project-context.md`** (locked competitor set eight, calorie-ring carve-out, trust posture including estimates-only, region-aware VAT, documented web/mobile intentional divergences). **Deduped** against `docs/audits/2026-05-14-full-sweep-orchestrator.md`, **`2026-05-15-premium-sweep-v2/`** (`P0-auditor-report.md`, **`P0-proposal.md`** code-reality phantom resolution), **`2026-05-05-full-sweep/findings/SUMMARY.md`**, **`2026-04-30-full-sweep-audit.md`**, and **`2026-04-24-full-sweep.md`**. **Regressions closed since prior sweeps:** public **`/dmca`/`/licences`**, **`/onboarding-v2` → `/onboarding` redirect**, **`PricingHero`/login P0-valid polish** in-tree, **`profiles.user_tier` lockdown migrations**, **RevenueCat webhook presence**, partial **macro-coercion guard** on planned-meal logging. **Not rerun:** production DB migration application state, StoreKit receipts, CI green, external sentiment scrape—the verdict stays **deployment-conditional**.

**(2) Findings by area** (deduped; Sev/Imp 1–5, Eff S/M/L, Blk Y/N)

| Area | Finding | Sev | Imp | Eff | Blk | Agents |
|------|---------|-----|-----|-----|-----|--------|
| Paywall / monetisation | Mobile **“Subscriptions unavailable”** panel competes with Pro card when RC misses (RTP-3 valid) | 4 | 4 | M | N* | premium-auditor, visual-qa, ui-critic, monetisation-architect |
| Legal / commerce | **`STRIPE_TAX_ENABLED`** gates visible **VAT-inclusive copy** despite policy intent (**RTP-9 ops**) | 4 | 4 | S | **Y** if UK/EU paid claims ship | legal-reviewer, brand-manager, design-system-enforcer |
| QA / evidence | **Onboarding Maestro/capture gap** — cannot sign off steps 03–15 visually (**RTP-6**) | 3 | 3 | M | Y† | qa-lead, premium-auditor, docs-keeper |
| QA / evidence | **Mobile paywall dark capture** gap (**RTP-7**) | 2 | 2 | S | N | visual-qa, design-system-enforcer |
| QA / evidence | **Web authed Today** capture gap (**DC1** premium note) | 2 | 3 | S | N | qa-lead, sync-enforcer |
| Design parity | **Settings vs Profile dark tile pattern** (DC14 erosion, row 23.1) | 3 | 3 | M | N | ui-product-designer, design-system-enforcer |
| Growth / onboarding copy | **`Join thousands tracking smarter`** + **extra Welcome “Sign in”** — premium argues subtract DC12-wise (rows 10.1/10.2) | 3 | 4 | S | N | premium-auditor, copy-reviewer, growth-strategist |
| Naming | Mobile login **`SUPPR` all-caps** vs mixed-case brand (15.1) | 2 | 2 | S | N | brand-manager, visual-qa |
| Product | **Login in-card mode toggle** (5.3) unresolved product override | 2 | 3 | M | N | product-lead, ui-product-designer |
| Nutrition correctness | **`mealPlanAlgo` vs `generateMealPlan`** divergence — same DB rows, different optimisation | 4 | 4 | L | N | nutrition-engine, sync-enforcer, code-quality |
| Nutrition correctness | Residual approximation risks (**ml≈g**, **`measureToGrams`**, **confidence policy**) per Apr-24 | 4 | 5 | M | Y‡ | nutrition-engine, data-integrity, qa-lead |
| Trust / integrations | History: **stripe dedupe in-memory**, **abortless upstream**, **FatSecret licence tier** — not re-proven closed | 3 | 3 | M | N | integration-manager, security-reviewer |
| Diversity / safety | **Allergens schema migrated** — **surfacing/UI** incomplete vs historic safety mandate | 4 | 5 | M | **Y**§ | diversity-inclusion, legal-reviewer, nutrition-engine |

\*Blocking for claiming **premium P0 bucket closed**, not inherently for private TF if RC configured. †Blocks **premium-auditor-defined P0-complete**, not intrinsic app boot. ‡Treat as **blocking for App Store positioning as “nutrition correct”**, unless signed policy doc proves containment. §Blocking for **regulated-allergen marketing** promises; intra-app disclosure still trust-critical before wide launch.

**(3) Top 10–15 ranked actions**

1. **Soften RTP-3 paywall unavailable state** — grey panel reads broken above Pro tier. Owner: **ui-product-designer** → **executor**. Outcome: footnote/subtle degraded state preserving trust chips. Blk **N** (except premium “P0 bucket” closure definition).
2. **Operational Stripe Tax + flip `STRIPE_TAX_ENABLED`** when Prices are inclusive — align UI VAT line + marketing/legal. Owner: **monetisation-architect** + **executor** + **legal-reviewer**. Outcome: viewport-visible conformity for UK/EU. Blk **Y** for UK/EU **paid** outbound claims otherwise **N**.
3. **Fix Maestro onboarding capture (CF-1 / RTP-6)** — evidencing steps beyond Welcome. Owner: **executor** + **qa-lead**. Outcome: step-distinct PNGs + CI-trustworthy flow. Blk **Y** for audit sign-off regimes; **N** for raw TF ping.
4. **Dark paywall re-capture (CF-2 / RTP-7)** — Owner: **executor** + **visual-qa**. Outcome: DC4 contrast proof. Blk **N**.
5. **Ship mobile Welcome subtractive tweaks (10.1/10.2)** pending product OK on reinstall sign-in. Owner: **product-lead** → **executor** + **copy-reviewer**. Outcome: calmer cold-open DC12 fidelity. Blk **N**.
6. **Settings dark tiles harmonise toward DC14 outlines (23.1)** — Owner: **ui-product-designer** → **executor**. Outcome: neighbour consistency Profile↔Settings. Blk **N**.
7. **Mobile login casing `SUPPR` → `Suppr` (15.1)** — Owner: **brand-manager** → **executor**. Outcome: typographic parity. Blk **N**.
8. **Planner algorithm unification or formal divergence memo + parity tests** — Owner: **nutrition-engine** + **product-lead** sequence **executor**. Outcome: one truth or documented split with tests. Blk **N** short-term unless user-visible divergence confirmed hot.
9. **`measureToGrams` / ml-g / coercion policy audit + regression tests** close remaining Apr-24 C-class leaks beyond Today planned guard. Owner: **nutrition-engine** → **executor** + **qa-lead**. Outcome: no silent inventions on journal paths. Blk **Y** if leaks remain on shipped paths claiming accuracy.
10. **Allergens UI rollout** leveraging `recipes_allergens` migration. Owner: **executor** + **diversity-inclusion** + **legal-reviewer**. Outcome: “Contains” surfaced safely. Blk **Y** once marketing promises allergen completeness.
11. **Web authed Today + checkout modals screenshot coverage** (`CF-*` tails). Owner: **qa-lead** + **executor**. Outcome: DC1/evidence completeness. Blk **N**.
12. **Resolve 5.3 login-tab design defence** explicit memo. Owner: **product-lead**. Outcome: stable auth IA. Blk **N**.
13. **Clean remaining `onboarding-v2` string references** in scripts/Maestro for maintainer ergonomics (post-redirect stability). Owner: **executor**. Outcome: no ghost P0 drills. Blk **N**.
14. **PostHog replay masking checklist** whenever health fields touched. Owner: **security-reviewer** + **executor**. Blk **N** unless PHI-class fields exposed raw.

**(4) Release readiness verdict**

**Conditional ship.**

- **OK to iterate on TestFlight / internal** while: RTP-3 acceptably soft-fails or is fixed; **no UK/EU commercial VAT claims ahead of Stripe Tax**; **tier lockdown migrations applied** on target DB (verify externally); onboarding evidence debt accepted as non-blocker **only inside explicit premium/QA waiver**.
- **Hold wider marketing / App Store featuring / EU consumer scale** until: allergen UX matches safety expectation if claimed; operational VAT/copy alignment; onboarding step evidence or manual QA checklist substitutes Maestro parity.

**(5) Open questions**

1. Have **`20260503100000_profiles_tier_column_lockdown`** and **`20260503102000_profiles_lockdown_forward_compat`** **definitely landed on prod** (`fnfgxsignmuepshbebrl`) vs local-only?
2. **Product stance on Welcome “Sign in”** after premium subtractive recommendation—minimal text link vs full removal?
3. **Planner divergence:** unify vs document—preferred timeline before first non–N=1 cohort?
4. **`/whats-new` public routing** resolved to match growth posture (historic 05-05 A2)?
5. Historical **cross-user push subscription** leak (Apr-24 A3)—closed by migration or still open?

---

**Sweep completeness:** All specialist lenses synthesised from **repo reads + anchored audit chain**—not **SWEEP INCOMPLETE** for legal/nutrition; **partial** empirical layers (sentiment scrape, CI, prod migration state) called out explicitly in scope and release conditions.
