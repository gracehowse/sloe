# Suppr Full-Sweep Audit — 2026-05-05

> **Source:** `orchestrator-full-sweep` agent run on 2026-05-05.
> **Scope:** end-to-end product (landing, onboarding, all buttons, all pages, all flows) across web + mobile, per Grace's directive.
> **Sim:** iOS 26.4 (18.4 wedge avoided per same-day fix).

---

## 1. Sweep scope and assumptions

4-tab IA on mobile. Onboarding redesign Phase 2 at 100% rollout. Macro-tracker spine + Free/Pro tiers + canonical Today + "what to eat next" north-star.

**Inputs read:** ~60 PNGs in `apps/mobile/screenshots/latest/`. Yesterday's audit (`docs/audits/2026-05-04-full-sweep-audit.md`) read for closed-item context. Code source-of-truth: `middleware.ts`, onboarding routes, public-route map, Maestro flows.

**Crucial framing:** the 2026-05-04 sweep shipped 34 of 37 items including 7 P0s. Most yesterday's surface-level issues are now closed. Today's job: (a) surface what's NEW from the fresh 2026-05-05 capture, (b) verify the 3 deferred items are still open. Non-deferred yesterday items are NOT re-listed unless the fresh capture shows the fix didn't actually land.

**Top-line:**

- **Total findings: 22** (after dedupe across lenses)
- **P0: 4** (1 new legal, 1 new onboarding-deeplink, 2 deferred from yesterday)
- **P1: 11** (5 new, 6 deferred / re-found from yesterday's deferred list)
- **P2: 7** (all new papercuts)
- **Surface coverage:** mobile (Today, Library partial, Profile partial, Onboarding ALL 404), web (landing, pricing, signup, onboarding, help, privacy, terms, dmca, licences, whats-new, roadmap, dev/primitives, reset-password). Mobile maestro flow capture incomplete (3 splash-wedged captures + onb-* all 404 due to dead deep-link).

---

## 2. Findings by area

### A. Auth & access (legal/router)

| # | Title | Sev | Surface | Lenses | Evidence |
|---|---|---|---|---|---|
| **A1** | `/dmca` and `/licences` auth-gated by middleware — DMCA safe-harbor compliance failure | **P0** | web | legal-reviewer, security-reviewer, repo-auditor | `middleware.ts:5–28` PUBLIC_ROUTES omits both; `app/dmca/page.tsx` exists; `web-desktop-dmca.png` + `web-desktop-licences.png` both render the `/login` form |
| A2 | `/whats-new` redirects to `/login` for unauthenticated users — marketing surface unreachable from cold traffic | P1 | web | growth-strategist, repo-auditor, customer-lens | `middleware.ts` PUBLIC_ROUTES omits `/whats-new`; `web-desktop-whats-new.png` shows Sign-in form |
| **A3** | Mobile onboarding deep-link `suppr:///onboarding-v2` is dead — every `onb-03..onb-15` capture renders the +not-found 404 ("We couldn't find that") | **P0** | mobile | repo-auditor, qa-lead, sync-enforcer | `apps/mobile/.maestro/00c_onboarding_v2_steps.yaml:35`, `apps/mobile/scripts/capture-every-route.sh:122`, `apps/mobile/.maestro/00b_screenshot_tour_extended.yaml:226`. Route was renamed to `/onboarding` on 2026-04-30 |
| A4 | Mobile +not-found CTA "Back to Today" is a dead loop for an onboarding-stuck user (no Today exists yet) | P1 | mobile | journey-architect, customer-lens | `onb-13-permissions.png` etc. |
| A5 | Mobile +not-found copy "The link may be stale or the recipe may have been deleted" — but the hit page is *onboarding*, not a recipe | P2 | mobile | copy-reviewer | same |

### B. Onboarding (mobile + web)

| # | Title | Sev | Surface | Lenses | Evidence |
|---|---|---|---|---|---|
| B1 | Web onboarding-step capture didn't advance past step 01 — three identical welcome PNGs | P2 (capture-side) | web | qa-lead, visual-qa | `web-desktop-onb-01-welcome.png`, `…-02-signup-empty.png`, `…-02-signup-filled.png` |
| B2 | Welcome web onboarding still "Join the Suppr Club" — trademark risk language unchanged from 2026-04-19 memo | P1 | web | brand-manager, legal-reviewer | `project_trademark_risk.md` flagged HIGH-risk live App Store competitor "Supper Club!" |

### C. Today / app shell + landing

The 2026-05-04 fixes for streak hide, food-log filter, weight parity, shimmer, gradient avatar, NorthStarBlock flat, plan spinner, shopping badge, streak grey at 0, YOU eyebrow, offline pill, cook empty all landed and are reflected in the v3 verify PNGs. No re-find.

| # | Title | Sev | Surface | Lenses | Evidence |
|---|---|---|---|---|---|
| **C1** | Today empty-state full rebuild — populated DailyRing at 0/target, 2x2 macro tiles, time-aware single CTA. **DEFERRED from yesterday #1.** Category-table-stakes failure for an MFP refugee | **P0** | mobile | ui-product-designer, customer-lens, design-system-enforcer | yesterday's deferred list |
| C2 | Mobile-web pricing tier cards not visible above fold — desktop hierarchy was fixed yesterday but mobile-web ordering still buries the conversion CTA two scrolls deep | P1 | web (mobile) | monetisation-architect, growth-strategist, ui-critic | `web-mobile-pricing.png` |
| C3 | Mobile-web landing header CTA truncates to "Get sta…" in the top-right pill | P2 | web (mobile) | visual-qa, copy-reviewer | `web-mobile-landing.png` |

### D. Recipes / Library / Discover

The 2026-05-04 fixes for RecipeHeroFallback, P/C/F labels, filter pill clip, library card placeholder all landed.

| # | Title | Sev | Surface | Lenses | Evidence |
|---|---|---|---|---|---|
| D1 | Discover real photography for Suppr Kitchen curated recipes + 12-archetype illustration set — DEFERRED from yesterday | P1 | both | ui-product-designer, brand-manager | content commissioning |
| D2 | `web-mobile-authed-discover.png` is mostly empty grey — capture-side or rendering-side? | P1 (capture-suspected) | web (mobile) | qa-lead, visual-qa | needs re-capture with confirmed authed storage state |

### E. Paywall / monetisation

| # | Title | Sev | Surface | Lenses | Evidence |
|---|---|---|---|---|---|
| E1 | Web auth-gated routes (`/home`, `/fasting`, `/account/billing`, `/whats-new`) need product call: redirect to `/login` (current) or softer cold-traffic prompt? — DEFERRED from yesterday #8 | P1 | web | growth-strategist, monetisation-architect | 7 captures all show `/login` form |
| **E2** | Paywall always-render-Pro-tier fix from 2026-05-04 — not visually reverified in today's capture set; `19_paywall.yaml` exists but no `tour-15-paywall.png` | **P0** | mobile | qa-lead, monetisation-architect | absence in `apps/mobile/screenshots/latest/`. Cannot ship without confirming. |

### F. Plan / Shopping / Cook (mobile)

| # | Title | Sev | Surface | Lenses | Evidence |
|---|---|---|---|---|---|
| F1 | `state-50-plan-week.png` and `state-90-shopping-top.png` wedged on Metro/Expo dev splash — yesterday's #25 polling gate not catching this case | P2 | mobile (capture-side) | qa-lead, visual-qa | identical splash render in two files |

### G. Legal / privacy

| # | Title | Sev | Surface | Lenses | Evidence |
|---|---|---|---|---|---|
| G1 | Privacy publicly displays "UK Representative … To be appointed" + "EU Representative … To be appointed" — acceptable for SOLO TESTER; non-compliant moment a non-Grace UK/EU tester is added | P1 (latent) | web | legal-reviewer | `web-desktop-privacy.png` lines 26–35 |
| G2 | Privacy "Controller: Suppr is currently operated by Grace Howse as a sole operator pending incorporation" — public surface names a private individual; needs replacing once incorporation completes | P1 (latent) | web | legal-reviewer | same; cross-ref `docs/decisions/2026-04-20-incorporation-jurisdiction-pending.md` |

### H. Design system / brand consistency

| # | Title | Sev | Surface | Lenses | Evidence |
|---|---|---|---|---|---|
| H1 | Web Help page renders inside `max-w-2xl` on desktop — looks lost on a 1440px viewport (~70% empty slate) | P2 | web (desktop) | ui-critic, design-system-enforcer | `app/help/page.tsx:16` hardcodes `max-w-2xl mx-auto` |
| H2 | Mobile-web landing header has no visible nav — only logo + Sign-in + truncated "Get sta…" CTA. No hamburger menu in capture | P2 | web (mobile) | ui-critic, journey-architect | `web-mobile-landing.png` vs `web-desktop-landing.png` |

### I. Code health / drift

| # | Title | Sev | Surface | Lenses | Evidence |
|---|---|---|---|---|---|
| I1 | `onboarding-v2` string referenced 9 times across mobile (settings, mobile-flow, capture script, 2 maestro YAMLs, onboarding entry, context, lib) — incomplete v2 → canonical rename | P1 | mobile | repo-auditor, sync-enforcer | grep `onboarding-v2` in `apps/mobile/`; 23 hits across `src/`, `docs/`, `TODO.md` |
| I2 | `console.error/warn/log` calls in 15 mobile screen files (23 occurrences) — yesterday's fix added LogBox.ignoreLogs but didn't centralize | P2 | mobile | repo-auditor, code-quality | grep |
| I3 | Maestro flow `00c_onboarding_v2_steps.yaml` opens dead deep-link — linked to A3 | P1 | mobile | repo-auditor, qa-lead | same |

### J. Capture infra / coverage gaps

| # | Title | Sev | Surface | Lenses | Evidence |
|---|---|---|---|---|---|
| J1 | Mobile maestro coverage incomplete — only 7 mobile non-onb captures vs yesterday's 35+ | P1 | mobile (infra) | qa-lead | folder listing |
| J2 | Web tour didn't run authenticated storageState — 7 of 18 web routes still capture as `/login` redirect | P1 | web (infra) | qa-lead | folder + middleware combined |
| J3 | Re-capture in dark mode never run despite yesterday adding `SUPPR_CAPTURE_DARK=1` flag — design-system-enforcer prototype-parity diff cannot be performed | P2 | both | design-system-enforcer, qa-lead | no `dark-*` PNGs |

---

## 3. Top actions (ranked)

### P0 (must fix before ship)

1. **A1 — Make `/dmca` and `/licences` publicly reachable.** DMCA safe-harbor §512(c) is conditional on the takedown form being publicly accessible. Auth-gating is a legal compliance failure that defeats the OFF/Edamam ingestion stack's defense.
   - **Owner:** `legal-reviewer` (verify scope) → `executor` (one-line patch to `middleware.ts` PUBLIC_ROUTES adding `/dmca` and `/licences`)
   - **Outcome:** unauth user visiting `/dmca` reaches the takedown form
   - **Blocker for release:** **YES**

2. **A3 — Fix dead `suppr:///onboarding-v2` deep-link OR rename all 3 internal callsites.** Three internal scripts/yamls open a route that 404s. `apps/mobile/components/settings/SettingsBundleContent.tsx` ALSO references it, meaning a real user-facing path could 404.
   - **Owner:** `executor` — choose: (a) add a redirect entry from `/onboarding-v2` → `/onboarding` in mobile router, OR (b) rename callsites
   - **Outcome:** every internal/external link to onboarding lands; Maestro `00c` and `00b` resume capturing real onboarding screens
   - **Blocker for release:** **YES** (settings link, if user-reachable, breaks)

3. **C1 (deferred from #1) — Today empty-state rebuild.** Populated DailyRing at 0/target + 2x2 macro tiles + time-aware single CTA. Category-table-stakes failure for an MFP refugee landing on Today and seeing "Start your day" with no log button.
   - **Owner:** `ui-product-designer` (spec from 2026-05-04 second pass) → `executor`
   - **Outcome:** new install lands on Today and the primary action is unmistakably "Log breakfast"
   - **Blocker for release:** **YES** (MFP-exodus posture from `project_competitor_set_and_mfp_exodus.md`)

4. **E2 — Re-verify paywall always-renders-Pro-tier fix is not regressed.** Yesterday's third pass found the gating-on-`hasPro` defeat and re-fixed it; today's capture set has no paywall PNG to confirm it still works post-rebase.
   - **Owner:** `qa-lead` (re-run `19_paywall.yaml` Maestro flow + visual diff against yesterday's `v3-paywall-fixed.png`)
   - **Outcome:** paywall shows Pro tile + FALLBACK_PRICES even when StoreKit unavailable
   - **Blocker for release:** **YES**

### P1 (premium-feel + retention)

5. **A2 — Add `/whats-new` to PUBLIC_ROUTES** (`executor`, one-line patch)
6. **A4 — Mobile +not-found CTA needs context** — adapt based on session
7. **C2 — Mobile-web pricing tier cards above fold** (`monetisation-architect` spec → `executor`)
8. **D1 (deferred) — Discover real photography for curated recipes** (`brand-manager` + Grace + `legal-reviewer`)
9. **E1 (deferred) — Web auth-fixture + product call on `/home`/`/fasting` cold-traffic redirect**
10. **G1 + G2 — Privacy GDPR-rep + sole-operator language gates** — automated gate before adding non-Grace UK/EU tester
11. **I1 + I3 — Complete `onboarding-v2` → `onboarding` rename** — focused multi-hour PR per memory
12. **J1 — Mobile maestro coverage gap** — re-run + diff
13. **D2 — Authed mobile-web Discover blank** — disambiguate
14. **B2 — Brand audit on "Suppr Club" persistence** — Grace's pivot/accept call

### P2 (papercuts)

15. **H1** — Web Help page `max-w-2xl` desktop-sparse → `max-w-3xl` or side-rail TOC
16. **H2** — Mobile-web landing header has no visible nav — restore or accept funnel
17. **C3** — `Get sta…` truncation on mobile-web header CTA
18. **B1** — Web onboarding-step capture script doesn't advance past welcome
19. **F1** — Two mobile state captures wedged on Metro/Expo splash
20. **I2** — 23 `console.*` calls — centralise behind a logger
21. **J3** — Dark-mode capture flag exists but never run
22. **A5** — `+not-found` "The link may be stale or the recipe may have been deleted" generic copy lies about onboarding context

---

## 4. Release readiness verdict

**Conditional ship.**

**Conditions to ship to TestFlight (anything wider than solo tester):**
- Close P0 #1 (A1 DMCA legal gate) — one-line fix
- Close P0 #2 (A3 onboarding-v2 deep-link / rename) — verify SettingsBundleContent path
- Close P0 #4 (E2 paywall regression check) — Maestro re-run + visual confirm
- Close P0 #3 (C1 Today empty-state rebuild) OR explicitly accept the MFP-refugee bounce risk and ship anyway with a 14-day clock to fix

**Cannot ship to a second tester (UK or EU):** Until G1/G2 are addressed (privacy reps appointed OR explicit consent screen on TestFlight invite). Currently solo-tester carve-out per memory protects this.

**Cannot ship to Production:** All 4 P0s + G1/G2 + B2 (trademark) must close before suppr.club goes from beta→GA.

**Existing strengths reflected in the capture set:**
- Yesterday's 22 visually-verified fixes are all reflected in today's PNGs — no regressions detected on those surfaces
- Privacy `[PLACEHOLDER]` removed (verified)
- Reset-password mobile-web 404 fixed (verified)
- `/dev/primitives` "See onboarding" label fixed (verified)
- Library card placeholder fix (verified)
- Roadmap, terms, pricing-desktop hierarchy all healthy

---

## 5. Open questions

1. Was the `onboarding-v2` deep-link a real user surface? (settings link, push notifications, etc.)
2. Should `/home` and `/fasting` redirect to `/login` (current) or `/` (softer cold-traffic)?
3. Why did the mobile maestro suite produce only 7 captures today vs ~35 yesterday?
4. Is the authed `/discover` mobile-web blank a render bug or a capture-state bug?
5. Is the "Suppr Club" trademark risk now accepted as ship-anyway, or still pending pivot?
6. Has yesterday's #4 paywall fix been integration-tested with a real receipt this week, or only with FALLBACK_PRICES?

---

## Per-specialist split

- **legal-reviewer:** A1 (P0), G1, G2, B2, D1 (licensing portion)
- **repo-auditor:** A1, A3, A2, I1, I3, J2
- **qa-lead:** A3 (test side), E2, F1, J1, J3, B1, D2
- **customer-lens:** C1, A4, A5
- **journey-architect:** A4, H2
- **design-system-enforcer:** J3, H1, D1
- **ui-critic:** H1, H2, C2
- **visual-qa:** B1, F1, C3, D2
- **copy-reviewer:** A5, C3
- **sync-enforcer:** I1, I3, A3
- **data-integrity:** (no new findings — clean today)
- **security-reviewer:** A1
- **performance-optimizer:** I2
- **monetisation-architect:** E2, C2, E1
- **growth-strategist:** A2, E1, C2
- **diversity-inclusion:** G1
- **nutrition-engine:** (no new findings — clean today)
- **integration-manager:** E2 (RevenueCat), D1 (asset licensing)
- **analytics-engineer:** (no new findings; PostHog event funnel still not pulled — same blind spot as 2026-04-30 + 2026-05-04)
- **product-lead:** C1 (north-star), B2 (brand call), E1 (cold-traffic call)
- **brand-manager:** B2, D1
- **ui-product-designer:** C1, A4, D1

---

---

# Supplemental mobile findings (2026-05-05 v2 — comprehensive capture)

> **Source:** second `orchestrator-full-sweep` run on the comprehensive 67-PNG mobile capture (35 routes via `simctl openurl` + 32 populated-state via Maestro fixtures). Read from `mobile-thumb/` (1800px-resized to fit image-batch limits).

## Top-line

- **NEW findings: 14**
- **Severity split:** P0: 2 · P1: 6 · P2: 6
- **Paywall verdict (P0-E2): RESOLVED.** `route-paywall.png` confirms Pro tile renders with FALLBACK_PRICES (£59.99/year, £5.00/mo, "save 37%"), "Subscriptions unavailable" banner correctly shown for sim, all benefit lines present.
- **Total updated count:** **36 findings** (22 initial + 14 supplemental). **5 P0** (was 4: A1, A3, C1 + 2 new mobile P0s — K1 milestone modal, N1 Search tab chrome). E2 closed.

## Cross-cutting discovery

The single most damaging issue surfaced by the comprehensive capture is **K1**. The "49 days of meal logging" milestone modal auto-fires on every deep-link landing AND on every tab/state capture, blocking content access at 12+ surfaces: route-recipe-verify, route-macro-detail-{protein,carbs,fat,fiber}, route-progress-metric-{weight,calories}, route-onboarding-v2-entry, route-onboarding-legacy-entry, route-final-tabs-shell, route-login, state-60-today-current, state-61-today-scrolled, state-10-log-sheet-default. The fix on commit `69650cd` ("subtitle no longer fights the headline number") tweaked styling but did not fix the trigger gate. For a real user: open Today → modal → close → tap macro tile → modal again → close → tap a notification → modal again. Brutal.

## Findings (new only)

### K. Cross-app overlay / modal triggering

| # | Title | Sev | Surface | Lenses | Evidence |
|---|---|---|---|---|---|
| **K1** | "49 days of meal logging" milestone modal auto-fires on every deep-link landing and tab navigation, blocking content. Throttling/once-per-event gate is broken | **P0** | mobile (system-wide) | qa-lead, customer-lens, ui-product-designer, repo-auditor | 12+ captures (see cross-cutting note above) |
| K2 | Milestone modal "MOST-LOGGED FOODS" body shows "(via Lose It!)" and "(via MacroFactor)" attribution strings — competitor brands surfaced inside Suppr's flagship celebration moment | P1 | mobile | brand-manager, copy-reviewer, product-lead | same captures; e.g. `route-recipe-verify.png` lines "1. Organic Valley | Milk (1% Lowfat) (via Lose It!) 5×" |

### L. Routing / deep-link integrity

| # | Title | Sev | Surface | Lenses | Evidence |
|---|---|---|---|---|---|
| L1 | `route-progress-metric-weight` renders the **Calories** detail screen, not Weight — header reads "CALORIES THIS WEEK". Routing param ignored or overridden | P1 | mobile | repo-auditor, sync-enforcer, qa-lead | `route-progress-metric-weight.png` vs `route-progress-metric-calories.png` (identical content) |
| L2 | `route-onboarding-legacy-entry` renders Library imports list (with milestone modal on top), not onboarding — legacy entry no longer routes anywhere meaningful | P1 | mobile | repo-auditor, sync-enforcer | `route-onboarding-legacy-entry.png` |
| L3 | `route-cook` deep-link with no recipeId renders "No cook steps yet → Back to recipe" CTA — but there is no recipe to go back to. Dead-end loop similar to A4 | P2 | mobile | journey-architect, customer-lens | `route-cook.png` |
| L4 | `route-tabs-today` and `route-tabs-library` rendered Metro/Expo bundling splash — capture infra failure on the two most important tabs (also `state-30-library-saved.png`, `state-31`, `state-50`, `state-80`, `bundle-1b-mobile-format-comparison.png`) | P1 (capture-side, but masks real Today/Library) | mobile (infra) | qa-lead | listed |

### M. Macro-detail / Targets visual consistency

| # | Title | Sev | Surface | Lenses | Evidence |
|---|---|---|---|---|---|
| M1 | Macro-detail Fiber pill is **blue** (same as Protein) — violates `project_prototype_carryover_rules.md` which mandates Fiber=green-leaf per the prototype. Targets screen correctly uses green leaf icon for Fiber, but the macro-detail header pill colour does not match | P1 | mobile | design-system-enforcer, ui-critic, sync-enforcer | `route-macro-detail-fiber.png` vs `route-targets.png` |
| M2 | Targets "Reach 50 kg" projection text truncates: "could reach by ≈ 20" — unit (days/weeks/months) cut off | P2 | mobile | copy-reviewer, ui-critic | `route-targets.png`, `state-70-targets-summary.png` |
| M3 | Profile/targets-edit form has **fiber + water fields** in the Edit form but the "Daily Targets" summary card shows only **kcal/protein/carbs/fat** — fiber and water absent from the summary even though they're tracked | P2 | mobile | ui-critic, sync-enforcer | `route-profile.png` |
| M4 | Profile "Edit Targets" form mixes **Display Name** field with macro target fields — IA confusion. Display Name belongs in account/profile, not under "Edit Targets" | P2 | mobile | ui-critic, ui-product-designer | `route-profile.png` |

### N. Settings / Search / status-bar overlap

| # | Title | Sev | Surface | Lenses | Evidence |
|---|---|---|---|---|---|
| **N1** | `route-tabs-search` page header "Food Search" overlaps the iOS status bar — title rendered THROUGH the "9:41" notch. SafeAreaView/header padding missing on Search tab | **P0** (chrome breakage on primary tab) | mobile | visual-qa, design-system-enforcer, qa-lead | `route-tabs-search.png` |
| N2 | Settings tab shows "0 Streak" tile prominently — but streak was deliberately hidden from Today per `feedback_no_duplicate_today_hero_content.md` and yesterday's #C-streak-grey-at-0 fix. Same "0 anchoring" problem now lives in Settings | P1 | mobile | product-lead, customer-lens, ui-product-designer | `route-tabs-settings.png` ("13 Recipes / 0 Streak") |

### O. Empty / loading-state correctness

| # | Title | Sev | Surface | Lenses | Evidence |
|---|---|---|---|---|---|
| O1 | `route-notifications-prompt` renders only **shimmer skeleton placeholders** (6 grey rounded blocks, no header, no copy, never resolves to content). Either the prompt screen is broken or its loading state never resolves | P1 | mobile | qa-lead, journey-architect, ui-critic | `route-notifications-prompt.png` |
| O2 | Burn detail "Activity Bonus" page renders "No bonus yet  0" in **blue link styling** — appears tappable but is a state label. Wrong affordance | P2 | mobile | ui-critic, copy-reviewer | `route-burn-detail.png` |
| O3 | Weight tracker has **two separate time-range pickers** stacked: top "1M / 3M / 12M / All" and below "3 mo / 6 mo / 9 mo / 12 mo / All". Redundant control | P2 | mobile | ui-critic, ui-product-designer | `route-weight-tracker.png` |
| O4 | Create Recipe screen shows **"Save Recipe" CTA overlapping greyed-out "Paste list / Scan photo / + Add ingredient" controls** — z-index/layering bug at the form footer | P2 | mobile | visual-qa, ui-critic | `route-create-recipe.png` |

## Severity-bumped findings (existing)

- **C1 (Today empty-state)** — confirmed by 3 independent captures showing "Start your day" with 0-circle and "Why this number?" link. No log affordance above the fold. Stays P0; conviction overwhelming.
- **A3 (onboarding-v2 dead deep-link)** — `route-onboarding-v2-entry` confirms 404 "Not found" header + K1 modal stacks on top. Stays P0.

## Updated P0 list (5 items, was 4)

1. **A1** — `/dmca` and `/licences` public exposure (legal blocker)
2. **A3** — `suppr:///onboarding-v2` deep-link / rename (sync+UX blocker)
3. **C1** — Today empty-state rebuild (MFP-refugee category-table-stakes)
4. **K1 (NEW)** — Milestone modal auto-fires on every deep-link/tab landing (system-wide content blocker)
5. **N1 (NEW)** — Search tab status-bar/header overlap (chrome breakage on a primary tab)

**E2 (paywall reverify) — CLOSED.**

## Updated release-readiness verdict

**Conditional ship — UNCHANGED in posture, but with two new P0 conditions added.** Before TestFlight ship to anyone wider than solo tester:

- Close A1, A3, C1 (existing)
- **Close K1** — milestone modal must fire only on the actual achievement event, not on every navigation. Without this fix the app is functionally hostile.
- **Close N1** — Food Search tab header padding fix; one-line SafeAreaView correction
- E2 no longer a blocker (resolved)
- L1 (progress-metric-weight routes to calories) should be P1-fixed in the same release; navigation that lies about its destination is a trust failure
- M1 (fiber pill colour) should ride along with K1 modal patch as low-risk visual polish

A solo-tester ship is still acceptable but *only* with a hard accept of K1+N1 papercuts in writing.

## Per-specialist split (new findings only)

- **qa-lead:** K1, L1, L2, L4, N1, O1
- **executor:** K1 trigger gate, N1 SafeAreaView, L1 routing param
- **ui-product-designer:** K1 (modal design), N2, M3, M4, O3
- **product-lead:** K2, N2
- **brand-manager:** K2
- **copy-reviewer:** K2, M2, O2
- **design-system-enforcer:** M1, N1
- **ui-critic:** M2, M3, M4, N1, O2, O3, O4
- **visual-qa:** N1, L4, O4
- **sync-enforcer:** L1, L2, M1, M3
- **repo-auditor:** L1, L2, K1
- **journey-architect:** L3, O1
- **customer-lens:** K1, L3, N2

---

## Pending Notion mirror actions (final)

- ✅ Decisions log row created earlier; needs **update** to reflect 5 P0s + E2 closed
- ✅ 4 P0 task rows created earlier; **2 new** to add: K1 (milestone modal) + N1 (Search status bar)
- 4 P1 task rows to add: L1 (progress-metric routing), M1 (fiber pill colour), N2 (streak-on-settings), O1 (notifications-prompt skeleton)
- Update Roadmap if "Today empty-state rebuild" is on it (mark "In progress" once owner picked up)
