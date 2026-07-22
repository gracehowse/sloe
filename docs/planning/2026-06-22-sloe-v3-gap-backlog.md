# Sloe v3 — gap-analysis backlog (generated 2026-06-22)

> Produced by the `sloe-v3-gap-audit` workflow (11 agents, 10 surfaces). Source of
> truth for the rest of the v3 reskin. Cross-check flag/ramp state in PostHog
> before acting on any "wire/ramp" item. Project: Linear "Sloe v3 — full reskin".

## Progress log

- **2026-06-21 — #1 + #2 DONE (commit f4e30acd).** Jewel dial wired into BOTH
  real Today heroes behind `sloe_v3_ring`: web `DesktopHeroStats`
  (`today-hero-stats.tsx`) swaps `DailyRing`→`CalorieRingDial`; mobile native
  hero via extracted `TodayHeroRingGraphic` (keeps the pinned 459-line
  `TodayHeroRing` host at budget). **Real bug caught by SEEing:**
  `TodayHeroStats` mounts both breakpoint dials at once → shared
  `cr-dial-<state>` SVG defs ids collided → visible dial's lit segments never
  painted. Fixed with `React.useId()` namespacing. Web verified all 3 states
  in the carded desktop hero (new `today-hero-stats.stories.tsx` regression
  layer). **Mobile-sim SEE still owed** (no sim bootable this session; dial is
  sim-verified standalone + web parity is fully SEEn).
- **2026-06-21 — weight-line token-role DONE (commit 90ef51e6).** Web Progress
  weight card line/gradient/dots carbs-amber → `--macro-protein` (plum), parity
  with mobile `WeightChart` (`accent.primary`). Visual pass on the rendered
  card queued with #23 (same card drive). Mobile already correct.
- **OPEN — #25 onboarding reveal ring is NOT a clean wire.** `CalorieRingDial`
  is a *kcal-left/over* dial (center = `target − consumed`, sweep =
  consumption); the reveal needs the *target* number counting up with a
  celebratory 0→100% sweep. Drop-in would show "0 kcal left" on a target-reveal
  surface. Needs a small design decision + a shared ring primitive (the
  prototype's `SloeRingHero` shows an arbitrary numeral + full dial) + both
  platforms + sim. Re-scope out of "Phase-0 wire."
- **RESOLVED — energy-triad colours, grounded on `Sloe-App.html`.** The triad's
  `const sage = MacroColors.protein` alias was sage pre-recolour, plum after.
  Prototype Progress energy-balance (L5008/L5010): **maintenance = sage, deficit
  = plum (`--primary-active`)**; surplus stays amber. Net: TDEE → sage (cf2b0a16),
  deficit → plum (07c1d3df, after a brief wrong sage detour from grounding on the
  *Today* NetEnergy card where deficit-is-good=sage). Mobile schemed too.

## Verified status — 2026-06-21 gap-audit workflow (7 agents, supersedes §2 prose)

The ranked table in §2 was **wrong on ~15 items**. Verified against current code:

**DONE / not-a-gap (no action):** #1, #2 (dial in heroes — this session); **#8
mobile macro Rings is fully built** (3-way `TodayMacroSection` switch +
`TodayDashboardMacroRings`, no silent Bars fallback — backlog FALSE); #11 (meal
detail flag-asymmetry intentional); **#12/#13 Plan** has no `sloe_v3_plan` flag
and nothing was promised-and-missing — no-op until a v3 Plan spec lands; **#21
web Apple Health card WIRED this session** (38b0e7ec); #6 mobile billing
deep-links to RevenueCat (functionally done, no screen); **#16 editorial Profile
DONE** (ENG-1246 — shared `EditorialProfileBlock` behind `sloe_v3_profile`,
default-on both platforms).

**#23 EQUATION LAYOUT — web DONE (c9a48725).** Progress energy balance →
prototype equation (intake − maintenance = deficit/day, operators + "How
maintenance works" explainer) behind `sloe_v3_energy_equation` (default-OFF);
triad in the else. Maintenance sage / deficit plum. Web-SEEn + tested. **Mobile
equation parity owed** (next sim session). Adapt-row numbers omitted (no
formula-baseline value — would be fabricated; explainer uses words).

**#14 Discover creator rail — BUILT FLAG-DARK (2026-06-23).** Creator rail (both
platforms), web featured hero, and mobile Following feed shipped behind the NEW
default-OFF flag `discover_creator_rail_v1` (NOT in `REDESIGN_DEFAULT_ON` — ships
dark pending Grace's SEE-approval on the sim). The `creators` table is still
EMPTY pre-launch, so the rail/feed fall back to a **presentation-only SEED set**
(`src/lib/discover/seedCreators.ts`, grounded on the prototype `CREATORS`) so the
surface is reviewable; **real creators always win** the moment they exist
(`resolveCreatorRail`). New components: web `discover-featured-hero.tsx` +
`discover-import-card.tsx` (extracted to hold the pinned-file budget); mobile
`FollowingFeed.tsx` + `DiscoverImportCard.tsx`. **OPEN follow-up (track as
Linear):** wire the rail/feed to REAL creator data — seed a `creators` table with
launch-partner cooks + make `top_creators_by_saves` return rows, then retire the
seed fixture in the flag's gate-removal sweep. The seed is the interim, not the
endpoint.

**SIM RESTORED + visual-test capability confirmed (2026-06-22).** `Sloe-Verify`
(iOS 26.5) boots; dev client pre-installed; eyes (`simctl io screenshot`+Read) +
hands (`idb` companion). **To force a mobile flag:** inject
`__SUPPR_FORCE_FLAGS__` = `{"flag":true}` into the sim's AsyncStorage manifest
(`<dataContainer>/Library/Application Support/com.supprclub.supprapp/RCTAsyncLocalStorage_V1/manifest.json`)
with the app terminated, then relaunch (primes from AsyncStorage). Verified the
**mobile Today hero jewel dial** (sloe_v3_ring forced) + **energy-triad TDEE
sage** live. Data-gated mobile verifications (deficit plum, weight-chart plum,
apple-health) need a seeded account (empty sim account hides those cards).

**LEGAL LAUNCH-GATE CLUSTER — DONE 2026-06-22 (Grace authorised):**
- **recipe_reports queue APPLIED TO PROD** (269826a0) — durable OSA/DSA report
  queue. Built → security-reviewer (safe-to-apply) + data-integrity (fix-first =
  post-apply type regen) → `supabase db push --linked` → **live-DB verified**
  (rls on, deny-all policy, anon/auth revoked) → types regenerated. Report sheet
  now POSTs non-copyright reports here (describe→submit→ack), email only on
  failure.
- **getsloe.com canonical** (262bac2b) — DMCA + privacy pages migrated off
  suppr-club.com (Grace's call). **OPS owed (Grace):** provision dmca@getsloe.com
  + privacy@getsloe.com mailboxes; file the USCO designated agent against
  getsloe.com.
- **REVIEW FOLLOW-UPS OWED (track as Linear, no silent deferrals):**
  (1) **Edge-IP rate-limit hardening** before flipping `IG_TT_IMPORT_ENABLED` —
  both `/api/recipe-report` + `/api/dmca-takedown` key the limit on the
  client-forgeable `x-forwarded-for[0]`; switch to the platform-trusted IP
  (`request.ip` / `x-vercel-forwarded-for`) once in `getIpFromHeaders`, + a
  CAPTCHA/auth second factor for the public report endpoint. (2) **Mobile parity**
  for the report sheet (`apps/mobile/app/recipe/[id].tsx` → same endpoint) — iOS
  is primary + this is a legal channel; needs a sim.

**SHIPPED 2026-06-22 (Grace's-call batch):** **#10** web cook multi-timer gated
behind `cook_multi_timers_v1` to match mobile (bd1b099a — web was always-multi;
now both default single until ramp). **#19** per-recipe Report/DMCA sheet
(7cfad7c2) — **legal-reviewer PASS-WITH-CHANGES for the beta window**; copyright
→ pre-filled `/dmca`, else → support email + in-dialog ack; copy corrected
(recipes aren't copyrightable; no guaranteed takedown; 5-day SLA; IP/UA
disclosure). **Legal follow-ups OWED (surfaced to Grace, not resolved):**
(a) **public-launch BLOCK** before flipping `IG_TT_IMPORT_ENABLED` — a durable
`recipe_reports` queue (email-only fails OSA/DSA once imported UGC is live) +
USCO designated-agent registration; (b) **Grace decision** — canonical
legal-contact domain (`getsloe.com` app-wide vs `suppr-club.com` on DMCA/privacy
pages; intersects the USCO filing); (c) mobile parity for the report sheet +
same copy. Full review in the legal-reviewer agent output this session.

**SHIPPED 2026-06-22 (earlier this session):** #22 web weight "No weigh-ins yet" empty
state (48c5011c, mirrors mobile WeightSparseState); **#4 + #20 the shareable
WeeklyRecap** — SVG brand-lacquer card (f5770772) + Save/Share dialog (9dd0cf4b)
+ Today StreakPip wiring with real week stats (3975ae96). The viral artifact is
reachable + shareable on web. Mobile recap-card parity (its weekly-recap.tsx is
still a check-in screen) is the remaining #4 follow-up.

**BUILD NOW (unblocked, web-verifiable, no sim) — corrected order:**
1. **#10** — `cook_multi_timers_v1` is mobile-only; web appends timers
   unconditionally. Parity gap (S). *Decision needed: gate web to match mobile,
   or un-gate mobile — multi-timer is a flagged feature.* NOT web-SEEable.
2. **#22** — web Progress new-user empty state (M). **NUANCE (don't blind-port):**
   the prototype (L4950-4962) is two cards — "Weekly recap → A little more to go"
   + "Weight → No weigh-ins yet → Log weight". But web already has
   `ProgressStoryGate` (progress-ring + "N days logged · 3 needed to unlock"),
   which is *richer* than the prototype's plain recap card — KEEP it
   (mix-and-match rule). The real gap is the missing dedicated "No weigh-ins
   yet → Add your first weight" weight empty card (the weight card currently
   only renders a chart at ≥2 weigh-ins, with no first-weight CTA). Surgical add,
   not a two-card replace. Confirm keep-vs-replace with Grace before building.
3. **#18** — editorial Cookbook shelves + featured hero, replacing the flat grid
   (`Library.tsx` ~L537) (L).
4. **#19** — per-recipe Report/DMCA sheet (`RecipeDetail.tsx`) (M) — legal bundle.
5. **#4** — shareable WeeklyRecap card (gradient hero + sparkline + `sloe.co`
   watermark + Save/Share) (L) — viral artifact; mobile `weekly-recap.tsx` is a
   check-in screen, not the card.
6. **#3** — unify the fragmented importer (URL/CSV/Plan are 3 surfaces) (M).
7. **#24** — two-pane WebSettings (L). (**#16 editorial Profile — DONE**,
   ENG-1246, `sloe_v3_profile` default-on both platforms.)

**Backlog claims that were FALSE:** #3, #5, #7, #8, #15, #20, #21(stale), #12,
#13, #14(partial), #10(count), #6, #9, #24, #4. Full per-item evidence in the
workflow output (run `wtmcqvkuv`).

**Genuinely-open large builds (need design/scope):** #15 trial step (no flow),
#9 Coach destination (only a NorthStarBlock fragment), #17 BatchCook (doesn't
exist), #4 recap card, #24 two-pane settings.

The reports' file/flag facts check out: the v3 ring dial is built on both platforms but only web's mobile-web branch wires it; the cook flags exist (default-OFF); the macro-rings primitives exist on both but mobile's branch is missing. I have enough verified grounding to synthesize. Here's the backlog.

---

# Sloe v3 Reskin — Build Backlog

## 1. Executive summary

**Where v3 stands: roughly 55–60% landed, but unevenly, and a lot of what's "built" isn't what users see.** The daily-loop surfaces (Today, Logging, Paywall sell, Recipe detail, Cook mode, Fasting/Hydration/MealEdit) are mature and mostly at web↔mobile content parity. The *narrative* and *commerce-management* surfaces (Coach, daily Digest, shareable WeeklyRecap, in-app Billing) and two whole tabs (Plan, Discover) are barely started or entirely pre-v3. Onboarding is well-factored but structurally non-conformant to the prototype (step granularity, web shell, missing motivation/trial/referral/first-win steps). Settings/Profile is functionally rich but its v3 *layout/IA* (two-pane web Settings, editorial Profile) is unbuilt on both platforms.

**The five biggest themes:**

1. **"Built but not wired / flag-off" is the dominant failure mode.** The signature v3 jewel ring (`CalorieRingDial`) exists on both platforms but is invisible in the real hero (mobile renders legacy `CalorieRing`; web desktop renders `DailyRing`; only mobile-web < md shows it). All five cook-mode polish features ship default-OFF. `web_meal_nutrition_detail` is OFF on web while mobile ships it live. The work here is mostly *wiring and ramping*, not building — high leverage, low cost.

2. **Three missing "narrative" screens are first-class destinations in the prototype, not Today fragments.** Coach, daily Digest, and the shareable WeeklyRecap card don't exist on either platform — and the latter two are explicit viral-growth artifacts (the `sloe.co` watermark recap card is the whole point) tied to the launch push.

3. **Two tabs are pre-v3 entirely.** Plan has no `sloe_v3_plan` flag and runs the old kanban/stacked layout on both platforms; Discover is missing every editorial block (creator rail, featured hero, Following feed, collections).

4. **Parity is breaking in both directions and accumulating.** Macro Rings layout is web-only; Apple Health card is mobile-only; meal-nutrition detail is mobile-live/web-flagged-off; the styled date picker is mobile-only; web has no weekly-recap destination at all (dead streak pip). "Same preference, different render" (rings→bars fallback) is the worst kind — it silently degrades a synced setting.

5. **Several token-role mismatches are load-bearing, not cosmetic.** Web's surplus/energy-balance stop uses plum where the v3 system maps "over" to amber; the web weight line uses carbs-amber where the prototype/mobile use protein-plum. These are colour-*role* bugs the system explicitly forbids.

**Confidence: 8/10** on the synthesis — the reports are detailed and their file/flag claims spot-check correct (verified `CalorieRingDial`, the cook flags, `web_meal_nutrition_detail`, the macro-rings primitives). The main residual uncertainty is exact flag ramp state in PostHog, which gates several "wire it" items.

---

## 2. Top ~25 highest-leverage gaps (ranked)

Ranking weights: launch-critical (viral hooks, monetisation, MFP capture) > daily-loop visibility > parity breaks > structural conformance > polish. "Wire/ramp" items rank high because they're near-free fixes for signature surfaces.

| # | Surface | Gap | Sev | Parity? | Web file(s) | Mobile file(s) | Recommendation |
|---|---------|-----|-----|---------|-------------|----------------|----------------|
| 1 | Today | v3 jewel dial built but NOT wired into mobile Today hero (renders legacy `CalorieRing`) | High | Yes | — | `components/today/TodayHeroRing.tsx`, `components/charts/CalorieRingDial.tsx` | Swap `CalorieRingDial` into `TodayHeroRing` behind a mobile `sloe_v3_ring` flag, mirroring web. Near-free; signature surface is invisible today. |
| 2 | Today | Web **desktop** hero (≥md) renders concentric `DailyRing`, not the jewel dial | High | Yes | `suppr/today-hero-stats.tsx`, `suppr/calorie-ring-dial.tsx` | — | Add the same `sloe_v3_ring`/`CalorieRingDial` swap to `TodayHeroStats`' desktop branch (carded). Today the v3 ring never shows on a real desktop dashboard. |
| 3 | Logging | Unified "detect-anything" importer (paste→classify recipe/reel/collection/plan/CSV) doesn't exist as one surface | High | No | `RecipeUpload.tsx`, `imports/MfpCsvImportCard.tsx`, `plan-import/PlanImportReview.tsx` | `app/import-shared.tsx`, `components/imports/MfpCsvImportCard.tsx` | Build a shared classifier (extend `detectSourcePlatform`) feeding one Import sheet with Detected-chip + 4 review phases. **The headline viral wedge.** iOS first. |
| 4 | Progress | Shareable WeeklyRecap card (gradient hero + sparkline + `sloe.co` watermark + Save/Share) missing on both | High | No | — (no recap destination) | `app/weekly-recap.tsx` (is a check-in screen, not the card) | Build the shareable hero card (ViewShot/captureRef mobile, canvas/share web). Viral-growth artifact per the TikTok/IG plan. |
| 5 | Logging | LogHub quick-log routines ("Log usual / Copy yesterday / Duplicate day" + saved-meal Routine rows) missing | High | Yes | `suppr/log-sheet.tsx` (none) | `components/today/LogSheet.tsx` (copy-yesterday only) | Add the 3-pill quick row + saved-meal Routine treatment to both. Core daily-loop accelerator. Flag-gate. |
| 6 | Paywall/Billing | Mobile has **no** in-app billing screen (deep-links to RevenueCat/App Store) | High | Yes | — | `components/settings/SettingsBundleContent.tsx` (Manage → RevenueCat) | Build `apps/mobile/app/billing.tsx`: status hero + state banners + included-features + history, populated from RevenueCat `customerInfo`; native manager only for the card/cancel mutation. |
| 7 | Logging | MFP/CSV import: source-picker + fuzzy column-mapping + preview table missing (single idle→success card today) | High | No | `imports/MfpCsvImportCard.tsx` | `components/imports/MfpCsvImportCard.tsx` | Build the mapping + preview phases. **The MFP-refugee trust moment** — users must SEE history mapped before committing. |
| 8 | Today | Macro **Rings** layout exists on web but unwired on mobile (synced `rings` pref silently falls back to Bars) | High | Yes | `suppr/today-macro-section.tsx`, `suppr/today-dashboard-macro-rings.tsx` | `app/(tabs)/_today/TodayScreen.tsx`, `components/charts/MacroRingSmall.tsx` | Build mobile `TodayDashboardMacroRings` (`MacroRingSmall` primitive exists) + add the third branch. Silent pref divergence is the worst parity break. |
| 9 | Coach | Coach screen (ranked "what to eat next" + ask-the-coach chips) unimplemented on both | High | No | `suppr/north-star-block.tsx` | `components/today/NorthStarBlock.tsx` | Build a dedicated Coach destination (mobile push / web modal); only a single-recipe north-star fragment exists today. Flag-gate, ship both in one change. |
| 10 | Cook | All cook-mode v3 polish (mise/checklist/swipe/multi-timer/text-size) is default-OFF — v3 baseline not live | High | No | `CookMode.tsx` | `app/cook.tsx`, `components/cook/*` | Ramp `cook_ingredient_checklist_v1`/`cook_step_ingredients_v1`/`cook_swipe_steps_v1`/`cook_multi_timers_v1`/`cook_text_size_control_v1` to 100% after a clean hold, then schedule gate removal. Components are built+correct. |
| 11 | Secondary | **DONE (ENG-1651, 2026-07-22)** — was: Meal-nutrition detail live on mobile but flag-OFF on web (`web_meal_nutrition_detail`) | High | Yes | `NutritionTracker.tsx`, `suppr/meal-nutrition-dialog.tsx` | `app/meal-nutrition.tsx` | Done: `web_meal_nutrition_detail` was ramped default-ON 2026-06-22, then collapsed entirely (ENG-1651) — `NutritionTracker.tsx` mounts both the per-meal and slot-aggregate `MealNutritionDialog` unconditionally now, matching mobile's unconditional `TodayScreen.tsx` wiring. |
| 12 | Plan | Mobile Plan is pre-v3: no day-selector strip, de-carded header, calorie band, meal-filter chips (all 7 days stacked) | High | Yes | `MealPlanner.tsx` | `app/(tabs)/planner.tsx` | Build single-day-via-day-selector v3 mobile Plan behind `sloe_v3_plan`. Extract child components — `planner.tsx` is already huge. |
| 13 | Plan | **BUILT (PR #599, flag-dark on web)** — was: Web Plan pre-v3, no two-column grid + Smart/Shopping rail + stat strip | High | Yes | `MealPlanner.tsx` | `app/(tabs)/planner.tsx` | Done: `PlanV3WebDashboard.tsx` (prototype `WebPlan`) — two-column (week-stack + grounded insight/shopping rail), verdict header, week-health stat strip; `PlanV3Connected` renders it at `lg+`, keeps the phone column below `lg`. `sloe_v3_plan` stays **web-off** pending Grace's desktop SEE-approval (mobile already default-on). Story + render test green; `MealPlanner.tsx` untouched. |
| 14 | Discover | Creator rail (both), web featured hero, mobile Following feed missing | High | Yes | `DiscoverFeed.tsx` | `app/(tabs)/discover.tsx` | Add creator rail to both, web featured hero, mobile Following feed-card. Creator plane = launch growth. |
| 15 | Onboarding | No post-reveal trial/paywall decision step (7-day free → annual) | High | No | `lib/onboarding/state.ts`, `onboarding/web-flow.tsx` | `onboarding/mobile-flow.tsx` | Build the trial-decision step (StoreKit/RevenueCat mobile, Stripe web), flag-gated. **Highest-value commercial gap** — flow ends at data-bridges with no upgrade ask. Pricing must be region-aware (no hardcoded £). |
| 16 | Settings/Profile | **BUILT (ENG-1246, default-on `sloe_v3_profile`)** — was: editorial streak-dots + milestones + recipe-grid block missing on **both** Profiles | High | No | `Profile.tsx`, `profile/EditorialProfileBlock.tsx`, `lib/profile/editorialProfileBlock.ts` | `app/profile.tsx`, `components/profile/EditorialProfileBlock.tsx` | Done: shared `EditorialProfileBlock` (identity → 7-day streak dots + best/freezes line → milestones list → recipe grid) on both platforms, gated behind `sloe_v3_profile` (default-on; legacy "More" hub / identity strip stay in the `else` as the kill switch, extracted to `ProfileHubHeader` (web) / `ProfileIdentityStrip` (mobile) so both pinned screens net-shrank). Pure shaping (dot states, best-streak, milestones from the existing `STREAK_MILESTONES`) lives in `src/lib/profile/editorialProfileBlock.ts`; display-only, wired to the already-loaded freeze ledger + `savedRecipesForLibrary` / `useSavedLibraryRecipes` — no new queries. Streak-dot/milestone logic pinned by `tests/unit/editorialProfileBlock.test.ts`. |
| 17 | Recipes | BatchCook flow ("cook once, assign portions, fridge tracker") entirely missing on both | High | No | `Library.tsx`, `CookMode.tsx` | `app/(tabs)/library.tsx`, `app/cook.tsx` | Build on both (leftover-tracking = retention hook), or drop the prototype's dead "Batch cook" button and ticket it. Don't ship a button that opens nothing. |
| 18 | Recipes | Editorial Cookbook shelves (featured hero + fit-based shelves) absent — Library is a flat grid | High | No | `Library.tsx` | `app/(tabs)/library.tsx` | Add featured hero + 3 computed shelves (kcal≤600 fits / time≤30 quick / protein≥27) above the grid. Loses the "cook what fits your day" differentiator on the surface that drives cooking. |
| 19 | Recipes | Per-recipe "Report an issue"/DMCA ReportRecipe sheet missing on both | High | No | `RecipeDetail.tsx` | `app/recipe/[id].tsx` | Add the report link + reasons sheet; route copyright→DMCA. UGC-safety + IP-launch requirement (ties to ENG-857/858/859). |
| 20 | Secondary | No weekly-recap destination on web (streak pip is a dead end) | High | Yes | `NutritionTracker.tsx`, `suppr/streak-pip.tsx` | `app/weekly-recap.tsx`, `components/today/StreakPip.tsx` | Wire a web recap route/modal + pass `onStreakPress`, then host the shareable recap card (#4) there. Pairs with #4. |
| 21 | Progress | Web has no Apple Health card (mobile has one); web carries legacy Steps + Body-Fat input cards instead | High | Yes | `ProgressDashboard.tsx` (Steps ~L2426, Body Fat ~L2465) | `components/AppleHealthCard.tsx` | Add web Apple Health card (Steps/Active energy/Weight + Synced badge); fold steps in, move body-fat to the Pro body-comp card; delete the pre-redesign input cards. |
| 22 | Progress | Web lacks the full new-user empty state (two-card "A little more to go" + "No weigh-ins yet") | High | Yes | `ProgressDashboard.tsx` | `app/(tabs)/progress.tsx` (single generic card) | Build the two-card empty state on web; align mobile's single card to the two-card framing + Log-weight CTA. |
| 23 | Progress | Energy balance is a bare 3-cell triad, not the prototype's intake−maintenance=deficit equation + adapt-step expander | High | No | `suppr/progress-energy-triad.tsx`, `ProgressDashboard.tsx` | `components/progress/ProgressEnergyTriad.tsx` | Replace with the equation layout (− / = operators) + "How maintenance adapts" 2,260→2,100 expander + Why? deep-link. |
| 24 | Settings | **BUILT (flag-dark on web)** — was: WebSettings is single-scroll cards, not the v3 two-pane left-nav + panel | High | No | `Settings.tsx`, `settings/SettingsTwoPaneShell.tsx`, `settings/SettingsDialogs.tsx` | — | Done: `SettingsTwoPaneShell.tsx` (prototype `WebSettings` — sticky left sub-nav + a right panel that swaps to the selected section) renders at `md+`; below `md` a single-column stacked fallback (no broken half-pane). `Settings.tsx` adds a ≤15-line flag branch that reuses the SAME section cards in both paths (no setting dropped/added). Sub-nav sections: **Account & billing** (plan + personal + subscription + about + promo), **Preferences**, **Connections** (hidden when its own flag is off), **Notifications**, **Privacy & data**. The modal cluster was extracted to `SettingsDialogs.tsx` to keep the host under its line pin (re-pinned 2346→2302). `sloe_v3_settings` is **default-OFF** in `KNOWN_DEFAULT_OFF_FLAGS` pending Grace's desktop SEE-approval. Shell render/behaviour test + Storybook story green; web-only (mobile Settings is a separate native surface). |
| 25 | Onboarding | Reveal ring is a hand-rolled gradient SVG, not the shared v3 jewel `SloeRingHero` (breaks reveal→Today continuity) | High | No | `onboarding/steps/reveal.tsx` | `onboarding/steps/reveal.tsx` | Swap both reveal rings to the shared v3 ring (same `sloe_v3_ring` posture as Today). First place a user sees the ring — must match. Pairs with #1/#2. |

*(Just below the line, tracked in phases: onboarding web `wob` shell rebuild; onboarding body-stats granularity; in-app web Billing/invoices; Coach/Digest split; Settings/Profile IA reshuffle; daily Digest screen; barcode community-DB framing; ConfirmFood low-conf note; Daily-calories corridor band.)*

---

## 3. Build order (phases)

Principles applied throughout: **iOS leads** every paired item (capture/verify mobile first, web follows in parity); **web hero stays carded, mobile de-cards**; **flag-gate the new path → ramp → collapse the gate in a follow-up**; and **no growth of pinned screen files** — every Plan/Today/Progress/Settings touch extracts a `use<Screen>()` hook or child components rather than inflating `planner.tsx`, `TodayScreen.tsx`, `NutritionTracker.tsx`, or `Settings.tsx`.

### Phase 0 — Wire & ramp what's already built (days, not weeks; highest leverage)
The cheapest wins — these surfaces exist and just aren't visible.
- **Mobile v3 ring → Today hero** behind new mobile `sloe_v3_ring` (#1).
- **Web desktop hero → jewel dial** under existing `sloe_v3_ring` (#2).
- **Onboarding reveal ring → shared v3 ring**, same flag posture (#25) — do alongside #1/#2 so reveal→Today is continuous.
- ~~Ramp `web_meal_nutrition_detail` to 100% + remove gate (#11).~~ **DONE** — ramped 2026-06-22, gate collapsed entirely 2026-07-22 (ENG-1651).
- **Ramp the cook-mode flag set** to 100% after a clean hold, schedule gate removal (#10).
- **Token-role fixes** (no new surface, just correctness): web surplus stop plum→amber; web weight line carbs→protein.
- iOS-verify each in sim before web; ship behind flags, ramp via PostHog.

### Phase 1 — Daily-loop parity + the macro/rings break (iOS-led)
The retention spine; close the silent parity breaks.
- **Mobile macro Rings layout** — build `TodayDashboardMacroRings` from `MacroRingSmall`, add the third branch (#8). Extract as a child component, don't grow `TodayScreen.tsx`.
- **LogHub quick-log routines** on both (#5), flag-gated.
- **Web Apple Health card** + delete legacy Steps/Body-Fat inputs (#21); **Progress energy-balance equation** (#23); **web Progress empty state** (#22).
- Meal detail already ramped in Phase 0; verify the calm-mode copy parity on the redesigned Progress cards while here.

### Phase 2 — Launch-critical growth & commerce (the viral + monetisation cluster)
Everything tied to the 2026-07-01 push. iOS-first; region-aware pricing throughout.
- **Unified detect-anything importer** (#3) + **MFP column-mapping/preview** (#7) + collection/multi-recipe phase. The import wedge.
- **Shareable WeeklyRecap card** (#4) + **web recap destination / streak pip** (#20) — built together.
- **Onboarding trial-decision step** (#15), flag-gated, StoreKit/Stripe.
- **Mobile in-app Billing screen** (#6); web in-app Billing/invoices follows as a fast-follow.
- **Per-recipe Report/DMCA sheet** (#19) — gates the import legal bundle.
- **Discover creator rail + featured hero + Following feed** (#14).

### Phase 3 — The two pre-v3 tabs (net-new builds, child-component-first)
- **Plan v3** behind `sloe_v3_plan`: mobile day-selector/de-carded/calorie-band/meal-filter (#12); web two-column grid + Smart/Shopping rail + stat strip (#13). Build as fresh child components; `planner.tsx` only loses lines.
- **Recipes editorial layer**: Cookbook shelves + featured hero (#18); **BatchCook** flow (#17).
- **Coach** destination (#9) — ranked suggestions + ask-the-coach chips, flag-gated, both platforms one change.

### Phase 4 — Structural conformance & editorial IA
Lower urgency, higher build cost; do after the launch cluster.
- ~~**Editorial Profile block** (streak/milestones/recipe grid) (#16)~~ — **DONE** (ENG-1246): shared `EditorialProfileBlock` behind `sloe_v3_profile`, default-on both platforms; the "More" hub / identity strip are the flag-off kill switch.
- **Two-pane WebSettings** behind `sloe_v3_settings` (#24); Settings/Profile IA reconciliation to v3's named groups.
- **Onboarding web `wob` shell**, body-stats granularity decision, motivation/referral/first-win steps, diet/allergens split — ratify-or-conform each; these are decisions as much as builds.
- **Daily Digest screen** (distinct from the weekly primitive) — decide in/out of v3 scope first.
- Polish tail: Daily-calories corridor band; barcode community-DB framing; ConfirmFood low-conf note; voice concentric-ring orb; Fasting 7-bar weekly strip; web styled date picker.

### Gate-removal sweep (continuous)
Once any flag holds 100% for two weeks with no regression, collapse it in a cleanup PR (per the feature-flag policy). Track: `sloe_v3_ring` (mobile+web), the 5 cook flags, `web_meal_nutrition_detail`, then `sloe_v3_plan`/`sloe_v3_settings` as they land.

---

## 4. Parity gaps (present on one platform, missing/different on the other)

**Mobile-only (web missing):**
- **Apple Health card** — `apps/mobile/components/AppleHealthCard.tsx`; web has legacy Steps + Body-Fat input cards instead (`ProgressDashboard.tsx`).
- **Meal-nutrition detail live** — mobile `app/meal-nutrition.tsx` ships unconditionally; web gates it behind `web_meal_nutrition_detail` (OFF) in `NutritionTracker.tsx`.
- **Styled month-grid date picker** — `apps/mobile/components/JournalDatePickerModal.tsx`; web falls back to the OS `<input type="date">`.
- **Weekly-recap destination** — mobile streak pip → `/weekly-recap`; web `StreakPip` has no `onStreakPress` and no recap route (dead pip).
- **Faithful create source-picker grid (4-up)** — `apps/mobile/components/recipe/CreateRecipeActionSheet*`; web's ENG-1197 retrofit exposes only 3 method tiles (no "Write it out").
- **Mobile-flagged multi-timer** — web `CookMode.tsx` appends timers unconditionally; mobile gates concurrent timers behind `cook_multi_timers_v1` (OFF) → web=many, mobile=one today.

**Web-only (mobile missing):**
- **Macro Rings layout** — `suppr/today-dashboard-macro-rings.tsx`; mobile selecting `rings` silently renders Bars.
- **Plan Smart/Shopping right rail + week-health stat strip** — web-only by design intent in v3, but unbuilt on web today (`MealPlanner.tsx`).
- **"What's new" entry** — web `Settings.tsx` → `/whats-new`; mobile route `app/whats-new.tsx` exists but is unlinked.
- **Discover Collections tiles + header Import** (web) vs **cuisine selector + Eating-out** (mobile) — each platform missing the other's blocks (`DiscoverFeed.tsx` / `app/(tabs)/discover.tsx`).
- **Energy-balance past-due/canceled handling** — web `SubscriptionCard.tsx` renders past_due/canceled banners; mobile renders none.

**Different-on-each (drift, not one-sided):**
- **Onboarding auth** — mobile signup is Apple-only; web is email/password; prototype wants Apple + email magic-link everywhere.
- **Onboarding progress idiom** — mobile continuous segmented bar vs web discrete segments vs prototype's 6-dot mobile / numbered `wob` web.
- **Go-public attestation** — web 1 checkbox (`GoPublicDialog.tsx`); mobile a menu-action prompt (no dialog); prototype wants a shared 3-attestation sheet (legally-loaded → must be identical).
- **Cook-this vs Log hierarchy** — web treats "Cook this" as primary; mobile demoted it to an outline pill with Log as the solid primary (defended 2026-06-09). Needs explicit ratification that the two intentionally differ, or alignment.
- **404** — web card shell + glyph + 2 CTAs vs mobile bare centred state + 1 CTA; copy also diverges.
- **Offline-banner copy** — web "Changes will sync when you reconnect" vs mobile "Offline · syncing when you reconnect"; align to one shared string.
- **Energy/surplus + weight-line colour roles** — web uses plum/carbs-amber where mobile + prototype use amber/protein-plum (token-role bugs, in Phase 0).
- **Mobile WeightChart Trend/Scale toggle** is cosmetic (always draws both) vs web honouring it.

**Key files to touch for the parity sweep:** `src/app/components/ProgressDashboard.tsx`, `src/app/components/NutritionTracker.tsx`, `src/app/components/suppr/streak-pip.tsx`, `apps/mobile/app/(tabs)/_today/TodayScreen.tsx`, `apps/mobile/components/charts/MacroRingSmall.tsx`, `apps/mobile/components/settings/SettingsBundleContent.tsx`, `src/app/components/DiscoverFeed.tsx`, `apps/mobile/app/(tabs)/discover.tsx`.
