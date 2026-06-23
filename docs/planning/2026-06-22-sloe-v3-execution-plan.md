# Sloe v3 Reskin — Ordered Execution Plan

**Author:** Claude (synthesized from 8 per-surface build specs)
**Date:** 2026-06-22
**Executor model:** solo, mobile-first → web parity, SEE-validate every surface before commit, commit at discretion.

---

## How to read this

Work is grouped into **11 sequential blocks**. Each block ends in a **commit + SEE-validation pass** (sim for mobile, browser for web — never trust ARIA tree or workflow text as proof; Read the actual PNG). Blocks are ordered by: (1) hard dependencies, (2) in-flight work, (3) user-value × leverage, (4) line-budget risk front-loaded so the riskiest extractions happen while context is freshest.

Each block lists the mobile deliverable, the web-parity deliverable **in the same block** (non-negotiable per CLAUDE.md sync rule), the flag, the line-budget move, and the literal SEE steps.

---

## Cross-cutting rules (apply to EVERY block)

1. **Flag-collapse posture (COLLAPSE rollout, per `project_sloe_v3_reskin`).** Every surface ships behind its named transient flag, **default-OFF**. To SEE-validate, force the flag ON locally (force-on in the `isFeatureEnabled` resolver or a dev override — do NOT ramp PostHog to validate). Once both platforms pass SEE, **add the flag to `REDESIGN_DEFAULT_ON`** (mobile `apps/mobile/lib/analytics.ts:311`, web `src/lib/analytics/track.ts`) so it ships ON in every build. The legacy `else` branch + dead flag stay alive only until the flag has held default-ON clean; the **collapse PR (delete flag + legacy branch) is a same-or-next-block follow-up**, not deferred indefinitely. Never delete a legacy path while its flag is still a live gate.

2. **No-grow-pinned-files rule.** `npm run check:screen-budget` pins legacy offenders to "shrink-only." Confirmed pins relevant here: `planner.tsx` 4736, `SettingsBundleContent.tsx` 4078, `NutritionTracker.tsx` 4178, `TodayScreen.tsx` 6985, `discover.tsx` 1160, `library.tsx` 1166, `MealPlanner.tsx` 2540, `progress.tsx` 2376. **Net-new code lands in NEW child component/hook files, never inline in a pinned screen.** Where the spec says "extract," do the extraction in the SAME block so the pinned file ends flat-or-smaller. Re-pin lower with `npm run check:screen-budget:write` after any real shrink. `reveal.tsx` (web 534 / mobile 845) and `Profile.tsx` (web 1279) and `profile.tsx` (mobile 982) are NOT pinned — but stay under intent.

3. **Web parity in the same block.** Mobile (iOS primary) is built and SEE'd first; web parity lands and is SEE'd before the block's commit. Verdict logic, lock/cooked state, dialogs, resolvers, and data contracts are **shared** (hooks / `src/lib/...`), never duplicated. Intentional divergences are documented in-block.

4. **Tokens only.** Colour/spacing/radius/type/shadow from `apps/mobile/constants/theme.ts` (mobile) / `src/styles/theme.css` + Tailwind (web). Spacing snaps 4/8/12/16/20/24/32/40; radius 4/6/8/12/full; type from the ramp (`Type` mobile / type-scale-gated classes web — run `npm run check:type-scale`). If a token is missing, add it first. No literal hexes, no off-scale numbers.

5. **Scoped CI per block** (touched mobile → `mobile:lint && mobile:typecheck && mobile:test`; touched web → `typecheck && lint && test`), full `npm run ci` only before the final push of a block. Rebase on `origin/main` before every push.

---

## BUILD ORDER

### Block 1 — Plan IA: hook extraction + data spine (in-flight, unblocks everything in Plan)
**Surface:** `plan` · **Flag:** `sloe_v3_plan` · **Effort:** ~1.5d

Plan IA is the in-flight surface (PlanHeaderV3 + planWeekStatus already landed). It also carries the single highest line-budget risk in the whole programme (`planner.tsx` 4736, zero headroom). **Do the extraction first, alone, behind a passing test, before any new UI** — this de-risks every subsequent Plan block.

**Deliverable:** Extract the plan state machine out of `planner.tsx` with zero behaviour change.
- NEW `apps/mobile/hooks/useWeekPlan.ts` (~280 lines): `week`, `selectedDay`, `mealFilter`, `locked`, `cooked`, `household`, `planState`, `actions{lock,unlock,toggleCooked,swapMeal,moveMeal,removeMeal,setMealFilter,selectDay}`. Pulls `AppDataContext.mealPlan` + `computePlanWeekVerdict` (from shared `src/lib/planning/planWeekStatus.ts`) + `AppDataContext.household/planLocks/cookedMeals`. **Locked meals must NOT count toward "full" day status** (risk #3 in spec) — wire verdict off real unlocked meals only.
- NEW `apps/mobile/components/plan/index.ts` barrel (~30 lines), re-exporting existing `PlanHeaderV3` + future v3 children.
- `planner.tsx`: replace inline handlers/state with the hook. Target: planner.tsx shrinks (move ~280 lines of logic out). **Must stay drop-in compatible with `03-meal-plan.test.ts` state shape** (spec risk #1).

**Line budget:** planner.tsx net-shrinks; all new code in `useWeekPlan.ts` + barrel. Re-pin planner.tsx lower.

**SEE:** Sim → Plan tab with flag OFF (legacy path). Verify the existing planner renders identically (day bar, meals, lock toggle, swap/move) — this block ships NO visible change, it's a safe refactor. Run `03-meal-plan.test.ts` green. Commit.

---

### Block 2 — Plan IA: v3 day-strip + day-detail band + household banner
**Surface:** `plan` · **Flag:** `sloe_v3_plan` · **Effort:** ~1.5d

**Deliverable (mobile):**
- `PlanWeekStripV3.tsx` — day selector, calorie badges, 3-state rings (full green / part amber / empty outline), today highlight, selection state.
- `PlanDayDetailBandV3.tsx` — bold day + serif 18px title, kcal current/target top-right, 7px progress bar (width % capped 100, success/warning colour), gap subline, optional macro pill row.
- `PlanHouseholdBannerV3.tsx` — stacked avatars (first 3, −8px overlap, owner primary BG), "Cooking for N · [names]", mismatch flag right.
- Wire into `planner.tsx` render tree behind flag: `PlanHeaderV3 → PlanWeekStripV3 → PlanHouseholdBannerV3 (if household) → PlanDayDetailBandV3`.

**Web parity (`MealPlanner.tsx`, pinned 2540):** 7-column grid; day-selector folded into column headers (abbrev + kcal total); household banner above grid. NEW web child components for the grid columns + banner so MealPlanner.tsx stays flat. Shared verdict/household contract via the hook pattern.

**Line budget:** All v3 UI in new `components/plan/*` files (mobile) + new web column/banner components. planner.tsx/MealPlanner.tsx grow only by the conditional render call (≤10 lines each, offset by Block 1 shrink).

**SEE:** Sim — tap each day in `PlanWeekStripV3`, verify day-detail band loads correct kcal/target + progress bar colour + ring states (full/part/empty match real plan). `household.enabled=true` → 3 avatars + "Cooking for N" + mismatch flag when servings ≠ eaters. Web — `/plan`, verify 7 columns + verdict headline + household banner; PlanHeaderV3 verdict updates reactively when a day lands/unlands (no reload). Read PNGs both platforms. Commit.

---

### Block 3 — Plan IA: per-slot cards + empty slots + meal-filter + dialogs
**Surface:** `plan` · **Flag:** `sloe_v3_plan` · **Effort:** ~2d (completes the 5-day Plan estimate)

**Deliverable (mobile):**
- `PlanMealCardV3.tsx` — 48px thumb (image or tint+utensil), name + kcal, slot label, lock overlay when locked, batch chip (flame + "Batch · covers N"), cooked opacity + strikethrough.
- `PlanEmptySlotV3.tsx` — dashed row, "Add [slot]" + plus, tap → meal-log/library.
- `PlanMealFilterChipsV3.tsx` — All/Breakfast/Lunch/Dinner/Snack, aria-pressed, soft active BG. When filter ≠ All → across-week card list per slot ("N of 7 planned").
- Card interactions: tap → recipe detail; options menu → swap/move/portion dialogs (reuse existing dialogs via hook actions). **Virtualize the across-week list** (49 cells worst case) to avoid FPS drop (spec risk #4).
- Generating state: spinner + "kept N locked meals" copy on completion.

**Web parity:** meal-filter chips identical; per-slot cards in grid cells; same swap/move/portion dialogs (shared). Day-detail as split-pane/modal on column click.

**Line budget:** all in new `components/plan/*` + web equivalents.

**SEE:** Sim — toggle a lock via card options, verify lock icon on thumb + survives nav-away/back (persisted). Tap "Add [slot]" → routes to meal-log → re-surfaces same slot after pick. Options → "Swap" → list shows other days' meals with kcal+slot. Filter "Breakfast" → only breakfast across week + "N of 7". `planState='generating'` → spinner, locks preserved, completion message. Web — same filter behaviour + column day-detail. Read PNGs. **Add `sloe_v3_plan` to `REDESIGN_DEFAULT_ON` (both platforms).** Commit. Queue collapse-PR.

---

### Block 4 — Onboarding reveal: jewel dial swap (highest value-per-line, lowest risk)
**Surface:** `onboarding_reveal` · **Flag:** `sloe_v3_ring` · **Effort:** ~1.5d

Front-loaded because it's a **net line-shrink** (delete ~32-line hand-rolled SVG, add one `<CalorieRingDial/>` call), both target files are **already verified to exist** (`apps/mobile/components/charts/CalorieRingDial.tsx`, `src/app/components/suppr/calorie-ring-dial.tsx`), and onboarding is the first-impression surface — high user value, ~1.5d.

**Deliverable (mobile `apps/mobile/components/onboarding/steps/reveal.tsx`, 845 lines, not pinned):** Replace hand-rolled SVG ring (lines ~267–298) with `<CalorieRingDial consumed={displayCals} target={targets.target} size={220} />`. Delete custom defs/circle/`ringProgress` state + geometry. Preserve 700ms anticipation beat + 1.2s count-up. **Sync risk (spec risk #2):** `displayCals` must stay 0 until `revealStarted` so the dial's internal 1050ms grow doesn't race the beat.

**Web parity (`src/app/components/onboarding/steps/reveal.tsx`, 534 lines):** identical swap at lines ~177–209. **Drop the radial bloom on the white onboarding ground** to match mobile (Grace 2026-06-22 note already in `calorie-ring-dial.tsx`).

**Line budget:** both files net-shrink ~30 lines. Neither pinned. No ratchet concern.

**SEE:** Sim (mobile) + browser (web), deep-link/flow to Reveal. Verify 48 frost ticks, segments light with state gradient (under=sage/over=destructive/empty=frost), leading luminous gem cap, stagger over ~1.05s, count-up 0→target 1.2s cubic-out centred. **No bloom halo on either** (verify side-by-side). Flag OFF → old hand-rolled ring; flip 3× no state leak/centering shift. Weight-skipped branch (`targets==null`) → fallback copy, no ring attempt. Read PNGs both. **Coordinate rollout (spec risk):** land flag-gated on BOTH before adding to `REDESIGN_DEFAULT_ON`, so web can't ship the new ring while iOS shows the old one. Add to `REDESIGN_DEFAULT_ON` both platforms. Commit.

---

### Block 5 — Cookbook/Recipes editorial shelves
**Surface:** `cookbook` · **Flag:** `sloe_v3_editorial_shelves` · **Effort:** ~2d

High viral value (recipes = the spread/hook surface per `project_keep_today_centre_premium_frame`), self-contained, reuses existing filter matchers. Comes after Plan/onboarding because those were in-flight / first-impression.

**Deliverable (mobile):**
- NEW `apps/mobile/hooks/useLibraryShelves.ts` — three semantic shelves from filtered list: "Fits your day" (≤600 kcal), "Quick — under 30 min" (≤30 min), "High protein" (≥27g), each capped 6, empty shelves filtered out, memoized on `[filtered]`. Reuse `recipeCategoryFilters.ts` matchers (adjust 600 vs 500 threshold).
- NEW `EditorialShelf.tsx` (horizontal snap-scroll, 14px gap, memoized), `FeaturedHero.tsx` ("Tonight's pick", 150px photo, serif 21pt), `RecipeCardWide.tsx` (188px fixed).
- NEW `apps/mobile/components/library/RecipeCardRow.tsx` — **extract the ~80-line `renderRecipe` callback** out of `library.tsx` (1166, pinned) so the screen net-shrinks before shelves are added. Thread closures (handleGoPublic, toggleCardSave, confirmRemove, userId, router) carefully (spec risk).
- `library.tsx`: `showShelves = filter==='All'`. ListHeader renders hero + shelves above flat grid on All; flat 2-col grid on other filters.

**Web parity (`src/app/components/Library.tsx`, 721):** mirror shelves above grid on All; CSS class names `.cook-shelf`, `.cook-feat`, `.section-head` match the v3 prototype HTML exactly; `rcard--wide` 188px/128px-image. Extract section components to keep Library.tsx lean.

**Line budget:** library.tsx net-shrinks via RecipeCardRow extraction, then re-pin lower. All shelf code in new files.

**SEE:** Sim — `/library?category=all` → hero + 3 shelves in order. Tap "Quick 30" pill → shelves hide, flat grid (or empty state). Return to All → shelves re-render. Swipe each shelf → snap + 14px gap, no card cutoff. Save 1 recipe that's not-quick/not-high-protein/>600kcal → all shelves hidden, flat grid with 1 card (verify hero+shelves don't render the SEED fallback into a personal library — spec risk: hide entirely when `filtered.length===0`). Light + dark theme. Web — same on mobile-web <680px (2-col quick-weeknight) and desktop (flat 3-col). Read PNGs. Add to `REDESIGN_DEFAULT_ON`. Commit.

---

### Block 6 — Discover editorial structure
**Surface:** `discover` · **Flag:** `sloe_v3_discover_editorial` · **Effort:** ~7d (largest single surface)

Discover is the most-built (62%) but largest remaining — and pairs naturally with Cookbook (shared recipe-card grammar, `SEED_CLUSTERS`). Note the flag gates only hero/collections/quick-weeknight; **cuisine selector + Following section ship unconditional** once built.

**Deliverable (mobile):** 5 new `components/discover/*`: `DiscoverEditorialHero.tsx` (16:10, overlay, byline, CTA), `DiscoverCollectionsCarousel.tsx` (4 gradient tiles), `DiscoverCuisineSelector.tsx` (chip row, UI-only — does NOT filter main feed), `DiscoverQuickWeeknight.tsx` (no-photo, ≤30min, 2-col), `DiscoverFollowingSection.tsx` (conditional on followed creators). EDIT `src/lib/discover/collections.ts` → `loadCuratedCollections()` (4 hardcoded; comment the ENG-907 DB upgrade path — **not a silent TODO**). EDIT `discover.tsx` (1160, pinned): extract `useDiscoverLayout()` + child components, target ≤900.

**Web parity (`src/app/components/DiscoverFeed.tsx`, 1152):** extract `DiscoverEditorialSection`, `DiscoverCollectionsSection`, `DiscoverCuisineSection`, `DiscoverQuickWeeknightSection`. Desktop md+ flattens to 3-col grid + 4-col collections; mobile-web <680px mirrors native. Shared collections list + cluster grouping + quick-weeknight filter logic.

**Line budget:** both screens net-shrink via extraction; new sections in new files. Re-pin both lower.

**SEE:** Sim — `/discover?following=1` → "From your follows" surfaces (if ≥1 followed), "Recipe ideas" hidden. Filter "High protein" → editorial sections stay (unfiltered), recipe sections respect filter. 0-recipe filter → hero/collections/cuisine/quick-weeknight all hide, only "Nothing to show" + import CTA. No-photo feed → hero+carousels hide, quick-weeknight shows. Cuisine "Asian" chip → plum ring/text, cluster carousel scrolls, main feed unfiltered. Web — desktop 3-col + 4-col collections; mobile-web 2-col quick-weeknight; breakpoints 320/375/680/1080. Verify no recipe appears in both quick-weeknight and More ideas (spec risk #4). Read PNGs. Add hero/collections/quick-weeknight flag to `REDESIGN_DEFAULT_ON`. Commit.

---

### Block 7 — Profile editorial sections
**Surface:** `profile` · **Flag:** `sloe_profile_editorial_v3` · **Effort:** ~2d

35% built; adds Streak + Recipes + Milestones. Self-contained, client-side data (no new DB queries).

**Deliverable:** NEW shared resolver `src/lib/achievements/profile-milestones.ts` — `(streak, recipeCount, weightProgress) → [3 milestones {icon,title,description,status}]` (flame/progress/sparkles; missing data → "To unlock"). Both platforms call it.
- **Mobile `apps/mobile/app/profile.tsx` (982):** add Current Streak (freeze dots/tokens/best), Your Recipes grid (4 via NEW `useRecipesForProfile` in `apps/mobile/lib/recipes.ts`, fail-silent empty), Milestones (3 rows). Render below stats, above Edit Targets. Extract Dietary Preferences → `-dietaryPreferences.tsx` to claim headroom. First-Day mode gates editorial (mobile-only segmented control).
- **Web `src/app/components/Profile.tsx` (1279):** same 3 blocks after upgrade banner, before Settings. `savedRecipesForLibrary.slice(0,4)`. Extract `-milestones.tsx` + `-streak.tsx` for headroom. **No mode switch — web always shows full editorial** (intentional divergence: mobile gates first-day, web assumes established).

**Line budget:** spec's extractions keep both within ratchet (mobile net +~100 → ~1082; web net +~30 → ~1309). Keep inline styles, single-responsibility children. If extraction can't hold mobile within +10%, extract more before adding (spec risk #1).

**SEE:** Sim — flag OFF → sections hidden; ON → Streak/Recipes/Milestones in order; 0 recipes → no grid (fail silent); segmented "First day" → editorial hides, first-day CTA appears; recipe tap → `router.push('/recipe/:id')`. Web — flag ON, sections below upgrade banner; recipe tap → detail; "Go public" → creator profile; milestone done = green check vs "X to go". 0-streak/0-recipe user → renders at-zero (doesn't hide). Read PNGs. Add to `REDESIGN_DEFAULT_ON`. Commit.

---

### Block 8 — Today hero structural refactor + energy equation
**Surface:** `today_structural` · **Flag:** `sloe_v3_energy_equation` · **Effort:** ~2.5d

iOS-primary surface and the retention centre — handled carefully because `TodayScreen.tsx` is 6985 (largest pinned file, zero headroom). Net-new code goes in NEW component files only; the screen itself does not grow.

**Deliverable:**
- NEW `apps/mobile/components/progress/ProgressEnergyEquation.tsx` (~80 lines) — 1:1 port of web `ProgressEnergyEquation`: intake − maintenance = deficit/day, collapsible "How maintenance works", dynamic result colour (plum deficit / amber surplus / neutral zero), `—` on null.
- EDIT `apps/mobile/components/progress/ProgressEnergyTriad.tsx` — flag-gate at the return: ON → equation, OFF → existing triad (untouched).
- EDIT `apps/mobile/components/today/TodayHero.tsx` — wrap ring + stats + pills + coach line in `SupprCard lift='soft' radius='lg' padding='lg'`, 14px section gaps per Figma. `TodayHeroRing.tsx` unchanged.
- EDIT `apps/mobile/lib/analytics.ts` — confirm/add `sloe_v3_energy_equation`.

**Web parity:** `src/app/components/suppr/progress-energy-triad.tsx` already flag-gated — verify exact parity (prop shape, colours, text, explainer). Web hero already carded (Figma 654:2) — confirm no drift.

**Line budget:** TodayScreen.tsx does NOT grow (equation is a new file; hero edit is a localized wrapper ~+20 lines in the already-separate TodayHero.tsx component). No extraction from the 6985 screen required.

**SEE:** Sim — Progress tab, flag ON: equation shows "1,900 − 2,240 = −340/day", maintenance sage, deficit plum; toggle explainer; null → "—"; surplus → amber positive. Today tab: hero is a soft-lifted card, ring centred, stat row + pill + coach line inside, 14px gaps; empty day → ring 0/target, pills hidden; logged → on-track pill within ±10%. **Test iPhone 12 mini** for long coachLine overflow + null-coachLine layout collapse (spec risks). Web Progress — equation parity (pixel-compare tones). Flag OFF both → 3-cell triad, no layout shift, existing triad tests pass under both flag states. Read PNGs. Add to `REDESIGN_DEFAULT_ON`. Commit.

---

### Block 9 — Coach + Daily Digest modals
**Surface:** `coach_digest` · **Flag:** `sloe_v3_coach_digest` · **Effort:** ~4.5d

42% built but the highest-risk extraction set (touches NutritionTracker 4178 + TodayScreen 6985, both pinned) **and** needs a new API route. Sequenced after Today-structural so the TodayScreen hero work is already settled before more extraction.

**Deliverable:**
- NEW `app/api/nutrition/daily-digest-narrative/route.ts` — `POST {yesterdayStats, goalMet, proteinGap, calorieGap} → {narrative, coachingLine, source}`. **Facts-only grounding contract** matching `digest-narrative.ts` (no invented numbers), daily scope. Handle midnight-boundary "yesterday" off-by-one (spec risk).
- NEW hooks `src/lib/today/useDailyDigestNarrative.ts` + mobile mirror `apps/mobile/lib/useDailyDigestNarrative.ts` (authedFetch bearer).
- Web modals `src/app/components/suppr/coach-modal.tsx` + `daily-digest-modal.tsx`; mobile `apps/mobile/app/coach.tsx` + `daily-digest.tsx` (expo-router full-screen). NEW `src/app/components/suppr/today-digest-pill.tsx` sidebar entry.
- **Extractions (no pinned growth):** web — `useGuideLineLogic` + `useYesterdayStats` (~150 lines out of NutritionTracker); mobile — coach-ranking-display + digest-stats hooks (~400 lines out of TodayScreen). `useCoach` + `/api/nutrition/coach` already exist — validate end-to-end for the first time (spec risk #1).

**Web parity:** coach modal = 3 ranked candidates (thumb/name/kcal/protein/why-line/best-fit pill) identical both; digest = date header + greeting + narrative + dg-chips + stats grid + coaching line + settings button. Divergence: web `navigator.share`/clipboard vs mobile `Share.share`.

**Line budget:** both pinned screens net-flat-or-shrink via the extractions before modals land. Re-test Today rendering thoroughly post-extraction (spec risk #6).

**SEE:** Tap "Your coach" on Today hero → Coach modal, 3 ranked from library; empty library → 0 candidates, no crash (spec risk #4). Narrative matches "X g protein short with Y kcal". Chip → "Coach is thinking…" toast. Open Daily Digest (web pill / mobile coach screen) → date header (local date, not UTC — spec risk #5), greeting, "closed yesterday X kcal under", stats grid, "One thing for today" line, dg-chips route correctly. Deep-links `/coach` `/digest` (web), `coach://` `digest://` (mobile). Flag OFF → both hidden, guide-line unchanged, pill hidden. Read PNGs. Add to `REDESIGN_DEFAULT_ON`. Commit.

---

### Block 10 — In-app Billing surface
**Surface:** `billing` · **Flag:** `sloe_v3_in_app_billing` · **Effort:** ~2.5d

Lowest user-facing urgency (15% built, no surface exists yet) and intentionally divergent (RevenueCat mobile / Stripe web). Sequenced late because it's monetisation-infra, not a launch-blocking daily-loop surface, and several sub-flows are honestly out-of-scope stubs.

**Deliverable:**
- NEW shared pure helper `src/lib/subscriptionStateResolver.ts` — `{customerInfo, profile_tier} → {state, planName, renewalDate, bannerConfig}`. Unit-testable, no side effects.
- NEW `apps/mobile/hooks/useSubscriptionStatus.ts` — RevenueCat `getCustomerInfo()` + `/api/profile` tier, read-only (no entitlement-column writes — `persist_path_guardrails`).
- NEW `apps/mobile/app/billing.tsx` (≤250 lines) — status hero, state banner (past-due destructive / grace warning / canceled neutral), read-only payment summary, restore, history. **Remove plan-switch toggle and payment-"Update" link** (spec risks #4, #5 → display-only until backend routed). EDIT `SettingsBundleContent.tsx` (4078, pinned) — add ~15-line "Subscription & billing" row only.
- NEW `src/app/components/BillingModal.tsx` (≤300 lines, new file) — hero, feature grid, payment card, manage section, history. EDIT `Settings.tsx` opener. **Dev-only state-picker must be flag-gated** (spec risk #2 — never ship the toggle).

**Web parity:** intentional divergence — mobile 4 states (active/pastdue/grace/canceled), web 3 (no grace; iOS-only path). Cancel/resume: mobile toast-confirm; web routes to existing Stripe portal `/account/billing`. Invoice history is a hardcoded stub (real `/api/stripe/invoices` out of scope — comment with ticket, not a silent TODO).

**Line budget:** SettingsBundleContent +~15 (row fits existing density). BillingModal + billing.tsx are new files. No extraction needed.

**SEE:** Sim — Settings → Membership → "Subscription & billing" → hero + state badge; cycle states via dev picker; verify banner tones; "Cancel" (active) → toast + state→canceled; "Renew" (grace) → toast→active. Skeleton loader on cold RevenueCat fetch (spec risk #1). Web — Settings → BillingModal: hero, feature grid, payment card, history rows; cycle states; Cancel routes to Stripe portal. Grace-period + lapsed states need a **real TestFlight build** (sandbox can't trigger Apple lapsing — spec risk #6); validate the 4-state UI in dev-picker now, flag stays OFF until TF verification. Read PNGs. Add to `REDESIGN_DEFAULT_ON` only after TF grace-state check. Commit.

---

### Block 11 — Flag collapse sweep + docs/Linear/Notion mirror
**Effort:** ~1d

After each surface has held default-ON clean, collapse the transient flags and delete dead branches (per COLLAPSE rollout). Batch the cleanup PRs (respect the 3-open-PR cap).

**Deliverable:**
- Remove `sloe_v3_plan`, `sloe_v3_ring`, `sloe_v3_editorial_shelves`, `sloe_v3_discover_editorial`, `sloe_profile_editorial_v3`, `sloe_v3_energy_equation`, `sloe_v3_coach_digest`, `sloe_v3_in_app_billing` gates + legacy `else` branches once each has validated. (`sloe_v3_in_app_billing` last — gate it longest until Apple grace-state is TF-confirmed.)
- `npm run check:screen-budget:write` to re-pin every shrunk file at its new floor.
- Update docs immediately (CLAUDE.md non-negotiable): `docs/planning/sloe-polish-handoff-*`, roadmap.
- **Notion mirror:** Roadmap rows for each shipped surface → Shipped; close matching Tasks. **Linear:** move the matching ENG issues to Done with code-evidence; post Redesign initiative + project status updates (`save_status_update`) so the "child projects requiring updates" banner clears.
- Run full `npm run ci`, rebase, push.

**SEE:** Final regression pass — each of the 8 surfaces with NO flag override (proving default-ON path), one capture each, both platforms. Read all PNGs.

---

## Effort estimate

| Block | Surface | Days |
|---|---|---|
| 1 | Plan — hook extraction | 1.5 |
| 2 | Plan — day-strip/detail/household | 1.5 |
| 3 | Plan — cards/filter/dialogs | 2.0 |
| 4 | Onboarding reveal — jewel dial | 1.5 |
| 5 | Cookbook — editorial shelves | 2.0 |
| 6 | Discover — editorial structure | 7.0 |
| 7 | Profile — editorial sections | 2.0 |
| 8 | Today — hero + energy equation | 2.5 |
| 9 | Coach + Daily Digest | 4.5 |
| 10 | In-app Billing | 2.5 |
| 11 | Flag collapse + mirror sweep | 1.0 |
| **Sum of spec efforts** | | **28.0** |

**Realistic total: ~32–34 working days (~6.5 weeks solo).** The 28-day sum of raw spec estimates undercounts three real costs this solo, SEE-every-surface workflow incurs: (1) web-parity SEE passes are folded into each block but add wall-clock the per-surface estimates under-weight; (2) the four pinned-screen extractions (planner, library, discover, NutritionTracker+TodayScreen) carry refactor-regression risk that needs re-running e2e suites; (3) the Billing grace-state and Coach end-to-end AI validations have external dependencies (TestFlight build, untested `/api/nutrition/coach`) that will cost a re-loop. I'm budgeting **+15–20%** over the raw sum. **Confidence: 7/10** — the spine (Plan, ring, shelves) is well-understood and dependency-verified; the tail (Discover's 7d, Coach's extraction, Billing's external deps) is where the estimate could stretch.

---

**Files referenced (all verified to exist or correctly specced as NEW):** `apps/mobile/app/(tabs)/planner.tsx` (4736, pinned), `src/app/components/MealPlanner.tsx` (2540, pinned), `src/lib/planning/planWeekStatus.ts` (shared, landed), `apps/mobile/components/plan/PlanHeaderV3.tsx` (landed), `apps/mobile/components/charts/CalorieRingDial.tsx` + `src/app/components/suppr/calorie-ring-dial.tsx` (both exist), `apps/mobile/lib/analytics.ts:311` + `src/lib/analytics/track.ts` (`REDESIGN_DEFAULT_ON`), `apps/mobile/app/(tabs)/library.tsx` (1166, pinned), `apps/mobile/app/(tabs)/discover.tsx` (1160, pinned), `apps/mobile/app/(tabs)/_today/TodayScreen.tsx` (6985, pinned), `src/app/components/NutritionTracker.tsx` (4178, pinned), `apps/mobile/components/settings/SettingsBundleContent.tsx` (4078, pinned).