# ENG-1247 — v3 prototype conformance backlog (full audit, 2026-06-24)

> Generated from a 9-cluster parallel audit of all ~57 prototype surfaces (`docs/ux/redesign/v3/Sloe-App.html`) vs live web + mobile. 72 findings. The prototype is canonical (supersedes Figma). This doc is the canonical remaining-work tracker for ENG-1247.

## State of conformance

Across 72 surfaces the v3 reskin is in strong shape: the daily loop (Today ring + hero, MacroDetail, Nutrients, Hydration, VoiceLog), the Recipe/Cook spine (RecipeDetail, CookMode), Plan, Fasting, the import-detection grammar, and most danger/data flows (EraseEverything, Changelog) are conformed and web-mobile mirrored. The remaining work splits cleanly: ~18 mechanical conforms (serif kcal/overline headers, set-ic icon plates vs circles, single-primary-CTA + button-grammar fixes, community/legal copy, token snaps in PlanImport) that I can just implement, and ~29 structural calls for Grace where the live IA deliberately exceeds or diverges from the prototype. The two highest-stakes structural gaps are functional bugs, not aesthetics: the Plan header's Adjust glyph opens the wrong sheet (Templates) because no AdjustConstraints sheet exists, and How-maintenance-works to Why routes nowhere because AdaptiveTDEE has no UI. Five fully-designed prototype surfaces have no live equivalent at all (BatchCook, AdjustConstraints, AdaptiveTDEE, CalendarPicker, the morning Digest). A solid block of divergences is already decided and should not be re-litigated.

## Progress log (live)

Worked autonomously after the audit (PR #609):

- **A15 Profile serif name** — DONE (web, pixel-verified in browser).
- **A16 404/recipe-404 serif headline** — DONE (web; serif `.state__title`; kept the
  deliberate copy + two-CTA recovery, rejecting the audit's "single primary" over-reach).
- **A6 WhyNumber serif target headline** — DONE (web + mobile, pixel-verified in browser +
  sim). Serif numeral grammar; held at original size (combined headline string, not the
  prototype's isolated big number). The richer prototype WhyNumber (set-ic breakdown rows,
  adaptive "Keep this target" CTA) stays deferred — coupled to the AdaptiveTDEE decision +
  needs Apple Health activity data.
- **A2a ConfirmFood serving-chip green→plum** — DONE (web + mobile). Fixed a reserved-green
  rule violation (active chip was success-green) → brand-plum, flag-gated. Confirm-card
  pixel-SEE impractical locally (deep food-search flow); verified by typecheck + 8630 web +
  3170 mobile tests + parity-confirmed token. Flagged for a device glance.
- **A2b ConfirmFood 3-tile macro grid** — DECISION FOR GRACE. The prototype's P/C/F tile
  grid would regress the live card's richer micro table (Fibre/Sugar/Sodium). Held; options
  posted on ENG-1247 (recommend keep-richer or mix-and-match).

### Adversarial review rework (PR #609, verdict needs-rework, 2026-06-25)

A 4-lens skeptical review of the whole conform diff caught real debt — much from EARLIER
sessions' conforms marked "shipped". Do NOT merge PR #609 until M1/M2/M4 land. Full detail
on ENG-1247 + the review output.

- **M1 — onboarding welcome landed MOBILE-ONLY** (web twin untouched, oat/green + FloatingPreview
  tiles; mobile docstring falsely claims parity; orphaned `ONBOARDING_WELCOME_BODY_MOBILE`).
  **TODO — next must-fix.** Precise plan (inspected 2026-06-25):
  1. **Add web tokens first** (they don't exist yet — tokens-only): `--primary-deep` (#241733
     "Sloe-Deep") + `--accent-frost` (#c9c2d6) + a `--primary-light` for the bloom, in
     `src/styles/theme.css`. Fixed brand identity (same light/dark) — the screen doesn't theme-resolve.
  2. **Rewrite `src/app/components/onboarding/steps/welcome.tsx` render** (414→~150 lines) to mirror
     the mobile twin (`apps/mobile/components/onboarding/steps/welcome.tsx`, 162 lines) + prototype
     `.wob-brand`: deep-plum ground, radial bloom (primary-light .42 → primary .12 → deep 0),
     centered lowercase Fraunces "sloe" (`--font-brand`, ~56px, white) + italic serif tagline
     ("Cook what you love. Still reach your goals.", frost), white "Get started" CTA (deep-plum
     label), "I already have an account" → /login, trust footer (lock "Private by default" · clock
     "About a minute"). Drop the success/macro-fat washes + FloatingPreview + eyebrow/body/checklist.
     PRESERVE the contract: `useOnboarding()` go/displayIndex/displayTotal + the `onboarding_step_completed` track.
  3. **Clean up orphans**: the figmaCopy welcome exports (`ONBOARDING_WELCOME_BODY_WEB/MOBILE/EYEBROW/
     TDEE_*`) are now only consumed by the two welcome files — delete the ones the rewrite orphans.
  4. Fix the mobile docstring's "Web twin" claim (it's now accurate once web lands). SEE web (mobile-web
     + desktop viewports) + add S6's render test.
- **M2 — Today greeting→serif-date dead code** — ✅ DONE (commit 56dfc591). Deleted the 3 dead helpers
  + stale test + describe block; de-lied every comment. Verified zero refs, full gate green.
- **M3 — stale "Library" e2e** → "Your kitchen". ✅ DONE (ffb6e5ce).
- **M4 — DayStrip chevrons invented week-paging** (prototype chevrons open the calendar);
  lost jump-to-today; pages into empty weeks. Needs Grace steer (gated on B29 CalendarPicker).
  TODO.
- **M5 — DayStrip chevrons + Recipes pencil/link icons `IconSize.md`(14) → `.lg`(18)** — ✅ DONE
  (56dfc591, sim-verified both surfaces).
- **S1–S6** (should-fix): mobile selected day-letter 70% white; mobile Recipes header ink
  neutral-not-plum; mobile welcome tagline 17→on-ramp; 404 comment honesty (24px is right);
  overlines 700→600; mobile welcome render test. TODO.
- **A17 Billing Manage button → SupprButton** — DEFERRED. The card is gated on Stripe
  subscription status, which the Stripe-less local dev server can't produce, and Settings
  isn't in the CI visual suite — so the change is un-SEE-able anywhere available. Low value
  (one button). Revisit when billing UI is verifiable on a Stripe-connected env. (NOT a
  silent drop — implemented + reverted rather than ship blind.)
- **A18 Settings version footer disclaimer** — NOT A GAP. "Nutrition data are estimates.
  Not medical or dietetic advice." already renders on Today (`TodayAtAGlance:162`) and
  Progress (`ProgressDashboard:2449`), the higher-traffic surfaces; the mobile version
  string is internal-only by design. Conformed-by-equivalent.

Learning banked: run the FULL gate (incl. `check:screen-budget`) before every PR-feeding
push — a scoped `npm run lint` missed a pinned-file growth on A15 and reddened CI once.

## A. Cosmetic conforms — autonomous, decision-free (18)

Mechanical conforms I implement directly (web+mobile parity, SEE each, flag-gated where structural). Ranked high→low.

### A1. [HIGH · both] Plan header — Adjust glyph opens Templates (wrong sheet)
- **Divergence:** PlanHeaderV3 sliders/Adjust button is wired to open the PlanTemplates sheet on both platforms. Until the AdjustConstraints sheet exists, the glyph should not silently alias to Templates — relabel or point at the correct destination.
- **Files:** `src/app/components/MealPlanner.tsx:1072; apps/mobile/app/(tabs)/planner.tsx:2708`

### A2. [HIGH · both] ConfirmFood — portion/slot confirm card grammar
- **Divergence:** Adopt the ConfirmFood grammar: active unit-chip PRIMARY-filled (not success-green tint), a 3-tile coloured-dot P/C/F macro-tile grid (live shows a plain key/value table), and a serif kcal-line (26px). Highest-frequency logging surface.
- **Files:** `src/app/components/food-search/FoodSearchPanel.tsx:2144-2350; apps/mobile/components/food-search/FoodSearchPanel.tsx:2027-2160`

### A3. [MEDIUM · mobile] BurnDetail (mobile) — set-ic row icons + Done CTA
- **Divergence:** Breakdown row icons are 40px circles (radius 20) not the 36px set-ic rounded-square (radius 10); and no primary Done CTA (back-nav only). Snap both to the prototype.
- **Files:** `apps/mobile/app/burn-detail.tsx`

### A4. [MEDIUM · both] EntryDetail + MealDetail — serif kcal headline + overline meta + serif macro-total grid
- **Divergence:** Same grammar gap on two adjacent surfaces: lead with an uppercase overline meta line and a serif ed-cal (40px) calorie number; for MealDetail also render the 4-cell serif md-totalgrid (P/C/F/Fibre). Live renders sans extrabold kcal + split-bar.
- **Files:** `src/app/components/suppr/meal-nutrition-dialog.tsx:306-460; apps/mobile/app/meal-nutrition.tsx:348-604`

### A5. [MEDIUM · both] CompleteDay — restore 3-stat row + weight-projection trendline + coach quote
- **Divergence:** Live ships a leaner Day-logged modal. Add back the 3-stat row (kcal eaten / vs target / protein), the Weight-projection card with the SVG trendline + now-to-6wks endpoints, and the coach quote. projectWeight logic is already shared.
- **Files:** `src/app/components/suppr/today-complete-day-dialog.tsx; apps/mobile/components/today/TodayCompleteDayModal.tsx`

### A6. [MEDIUM · both] WhyNumber — set-ic breakdown rows + serif hero target + coach quote + Keep-this-target CTA
- **Divergence:** Live renders plain bordered rows + an overline bullet list. Conform: whyn-hero big serif target number with kcal/day caption, grey set-ic rounded-square row icons, whyn-sum Maintenance highlight + whyn-result row, and a primary Keep-this-target CTA. Shared buildWhyThisNumber provides content.
- **Files:** `src/app/components/suppr/why-this-number-dialog.tsx; apps/mobile/components/today/WhyThisNumberSheet.tsx`

### A7. [MEDIUM · mobile] Verify (mobile) — serif title, chevron back, dot-not-bar confidence, flush card
- **Divergence:** recipe/verify.tsx uses pre-v3 chrome: uppercase letter-spaced VERIFY (fontWeight 800/letterSpacing 3) not serif Verify-ingredients; a back text glyph not the chevron icon; per-row confidence as a coloured BAR not the ver-dot; bordered/tinted cards not the flush divided card; CTA Confirm-All/Save-Changes not Calculate-nutrition. Reskin only.
- **Files:** `apps/mobile/app/recipe/verify.tsx:654,696,818,977-997,1240`

### A8. [MEDIUM · mobile] MealEdit (mobile) — Full-nutrition expander + Swap/Copy rows + serif kcal-line
- **Divergence:** TodayEditMealModal matches the spine but is missing the me-expand Full-nutrition section, the me-swap Swap-for-another-food row, and the me-swap Copy-to-another-meal row (sheets exist elsewhere — surface them inline). Also swap editable macro inputs + sans portion read-out for the serif kcal-line.
- **Files:** `apps/mobile/components/today/TodayEditMealModal.tsx:350-423`

### A9. [MEDIUM · web] GoPublic (web) — add the 2 missing attestations
- **Divergence:** GoPublicDialog is a single-checkbox AlertDialog; conform to the 3-attestation ver-row checklist by adding the honest-nutrition-estimate + photo-rights attestations with the disabled-until-all-ticked Publish CTA.
- **Files:** `src/app/components/GoPublicDialog.tsx`

### A10. [MEDIUM · both] PlanImport — overline labels + set-ic + on-scale radius + theme success-soft token
- **Divergence:** Independent of the IA decision: replace hand-rolled labels with the overline token, snap off-scale radii (mobile 16, Radius.xl*2=24; web ad-hoc text-[11/13/28]) to the 4/6/8/12 scale + type ramp, and swap literal hex+opacity (Accent.success+18/40, accent.primary+12) for theme success-soft/primary-soft tokens.
- **Files:** `src/app/components/PlanImport.tsx:102-134; apps/mobile/app/plan-import.tsx:334-344,581-586`

### A11. [MEDIUM · both] Grocery — v3 sheet chrome (overline category headers + gr-tools/gr-progress + recipe-count subtitle)
- **Divergence:** Neither shopping list speaks the v3 Grocery grammar. Keep the richer live data/household logic but adopt overline category headers, the gr-tools share/clear icon cluster, a gr-progress Progress N/total row, gr-check tick checkboxes, and the from-N-recipes subtitle. Tesco/Ocado stays absent.
- **Files:** `src/app/components/ShoppingList.tsx; apps/mobile/app/shopping.tsx`

### A12. [LOW · both] Barcode — community-contribution copy + Saved confirmation state
- **Divergence:** Core scan/not-found/manual-entry exists; the gap is the crowdsource voice: not-found copy (add it once and it's saved for you and everyone after you), the Shared-anonymously note, and a success state (Thanks for improving Sloe for everyone) + Log-it-now CTA. Copy + one state.
- **Files:** `src/app/components/suppr/today-barcode-dialog.tsx:252-314; apps/mobile/app/(tabs)/barcode.tsx:954-989`

### A13. [LOW · web] ImportFlow input sheet (web) — bottom-sheet shape + detection-driven CTA copy
- **Divergence:** Web renders a centered Dialog titled Import-anything with a fixed CTA Import; conform to the prototype + mobile twin: bottom-sheet, title Import, and a detection-driven CTA label (Import {label} / disabled Paste-something-to-import).
- **Files:** `src/app/components/suppr/unified-import-sheet.tsx:51-86`

### A14. [LOW · both] Notifications — Today/Earlier overline grouping + toned notif-ic glyph plates
- **Divergence:** Both ship a flat inbox: add Today/Earlier overline grouping and a leading toned notif-ic glyph plate per item; web title should also be serif font-headline (currently plain h1).
- **Files:** `src/app/components/NotificationsCenter.tsx:27; apps/mobile/app/(tabs)/notifications.tsx:343-356`

### A15. [LOW · web] Profile (web) — serif identity name
- **Divergence:** Web Profile name renders text-base font-bold SANS; swap to font-headline serif to match the prototype + already-conformed mobile (identityName Type.title serif).
- **Files:** `src/app/components/Profile.tsx:448`

### A16. [LOW · web] NotFound (web) — serif H1 + single-primary CTA + matching title copy
- **Divergence:** Web 404 uses a sans bold H1, copy We-couldn't-find-that-page, and TWO CTAs; conform to the editorial serif H1, copy We-couldn't-find-that, and single primary Back-to-Today (same on recipe/[id]/not-found.tsx). Mobile already conforms.
- **Files:** `app/not-found.tsx:31,43-48; app/recipe/[id]/not-found.tsx`

### A17. [LOW · web] Billing (web) — Manage/Cancel button to SupprButton
- **Divergence:** The manage/cancel control is a raw bg-foreground near-black slab instead of a SupprButton primary (aubergine). Off the one-filled-primary button canon. Mechanical swap.
- **Files:** `src/app/components/settings/SubscriptionCard.tsx:278-285`

### A18. [LOW · both] Settings version footer — add nutrition-values-are-estimates line
- **Divergence:** Both omit the prototype's quiet set-ver footer pairing the version string with a nutrition-values-are-estimates disclaimer (web none; mobile only a bare v{version}/build{n} dev row). Add a one-line muted footer.
- **Files:** `src/app/components/Settings.tsx; apps/mobile/components/settings/SettingsBundleContent.tsx:2643-2666`

## B. Structural decisions for Grace (29)

Each is a real IA / feature / product call. Most carry a `[recommended]` option — usually "keep the live version" where it deliberately exceeds the prototype. Grace ratifies; I do not unilaterally restructure.

### B1. AdjustConstraints (Plan header sliders sheet)
- **Q:** The prototype's Adjust-constraints sheet (Plan-from segmented + calorie-floor slider + meals-per-day segmented + batch/leftovers toggle + Save & regenerate) has no live equivalent — the header's Adjust glyph opens Templates instead, and the constraints exist only scattered. Build the consolidated v3 sheet?
- **Options:** (A) Build the v3 sheet, wire the glyph to it, both platforms [recommended; the glyph misfires today]. (B) Keep constraints scattered, relabel/remove the glyph so it stops aliasing Templates. (C) Defer the sheet but ship the relabel now.

### B2. AdaptiveTDEE (Adaptive target screen)
- **Q:** The full-screen Adaptive-target explainer (old-to-new hero, four Why-it-changed set-ic rows, 6-week trendline, keep-adapting vs fixed CTAs) has no live UI — only the backend route exists, and How-maintenance-works to Why routes nowhere. Build it, or accept the inline explainer + recap check-in?
- **Options:** (A) Build the screen both platforms [recommended if adaptive-TDEE transparency is in scope]. (B) Accept the inline explainer + recap check-in as the substitute, and remove/relabel the dead Why affordance. (C) Build a leaner sheet (hero + reasons only, no trendline).

### B3. BatchCook
- **Q:** BatchCook (batch-hero Cook-once-eat-Nx + size stepper + per-slot portion assignment + fridge-life track + shopping-list scaling) has no live implementation, yet the web Cookbook header wires a Batch-cook button to a dead destination. Scope and build, or cut?
- **Options:** (A) Scope + build BatchCook [recommended to at least scope]. (B) Cut for launch and remove the dead web header button. (C) Ship a minimal v1 (batch scaling + shopping-list scale, no per-slot portion assignment).

### B4. LogHub Add-to-today sheet vs live search-first composition
- **Q:** The live LogSheet is the 2026-04-30 search-first design; the prototype LogHub is a different IA (readOnly search to SearchView, a 5-up rounded-square method-grid incl. Label/Describe tiles, and a Log-usual/Copy-yesterday/Duplicate-day trio). Keep search-first or adopt LogHub?
- **Options:** (A) Keep the search-first LogSheet, borrow only the rounded-square method-tile styling [recommended]. (B) Adopt the prototype LogHub IA wholesale. (C) Hybrid: keep search-first but add the Copy-yesterday/Duplicate-day shortcut row the live sheet lacks.

### B5. Targets — dashboard vs inline editor
- **Q:** Both platforms ship a MacroFactor-style READ dashboard and delegate editing out; the prototype Targets is a compact inline EDITOR (Auto/Manual + editable macro inputs + fibre stepper + Other-limits caffeine/alcohol card). Keep the split or fold editing inline?
- **Options:** (A) Keep dashboard-reads + delegated-edit (deliberate MacroFactor model) [recommended]. (B) Adopt the prototype's inline editor as the single Targets surface. (C) Keep the dashboard but add the Other-limits caffeine/alcohol card inline, since it has no other home.

### B6. Profile — editor vs read-showcase
- **Q:** Both platforms ship Profile as an EDITOR with a 2-stat strip; the prototype is a read SHOWCASE (3-stat row, streak card with freeze-token dots, Your-recipes grid, Milestones list). Which is canonical?
- **Options:** (A) Build the read-showcase Profile and move editing into Settings/sub-sheets [recommended if Profile is identity, not settings]. (B) Keep Profile-as-editor. (C) Hybrid: add the 3-stat row + Your-recipes grid above the existing editor.

### B7. Household — sharing-grid vs servings model
- **Q:** Both platforms ship a 7x4 per-meal sharing-grid with conformed v3 grammar; the prototype's model is entirely different (Shared/Just-me segmented + per-member Eating-in/Out toggle + Default-servings stepper + Shared-shopping toggle + Shared-this-week list). Keep the grid or adopt the prototype model?
- **Options:** (A) Keep the sharing-grid (richer, real-data, v3-grammar-conformed) and mark the servings model superseded [recommended]. (B) Adopt the prototype's segmented + per-member servings model. (C) Keep the grid but add the standalone Match-servings + Default-servings affordances it lacks.

### B8. Paywall — v3 prototype vs Figma 284:2
- **Q:** Both live paywalls are the elaborate Figma-284:2 design (photo hero + value-grid + FREE/PRO matrix + plan selector + storefront pricing); the v3 prototype Paywall is a compact regionalised single-screen sell. Adopting the prototype is an IA rewrite that drops the RevenueCat/Apple storefront-priced model on mobile. Which is canonical?
- **Options:** (A) Keep the 284:2 paywall; treat the v3 prototype Paywall as non-canonical here [recommended — adopting it loses Apple/RevenueCat pricing]. (B) Replace with the v3 prototype Paywall on web, keep 284:2 on mobile. (C) Adopt the prototype's region-chip + clarification-line grammar onto the 284:2 structure without dropping the storefront model.

### B9. Coach (unified pushed screen)
- **Q:** The prototype's standalone Your-coach screen doesn't exist live — its three pieces are distributed (What-to-eat-next to NorthStarBlock; digest to Digest on Progress; guide-line to inline TodayDeficitInsight), and no Ask-the-coach chat-chips surface exists. Build the unified Coach screen or keep distributed?
- **Options:** (A) Keep the distributed model and mark the unified Coach screen superseded [recommended]. (B) Build the unified Coach screen + Ask-the-coach chips. (C) Keep distributed but add the Ask-the-coach chips as a net-new entry on Today.

### B10. BurnDetail (web) — wire BurnDetailPanel or adopt inline-only
- **Q:** Mobile has a true pushed Activity-summary screen; web's BurnDetailPanel.tsx is orphaned (0 render sites) and web folds the breakdown inline into the Today activity card. Wire the web panel for parity, or formally adopt inline-only on web?
- **Options:** (A) Formally adopt inline-only on web and delete the orphaned BurnDetailPanel.tsx [recommended unless a pushed parity screen is wanted]. (B) Wire BurnDetailPanel as a pushed screen to match mobile. (C) Keep inline but extract the orphan into a reusable expandable section.

### B11. Provenance — full 5-row target-provenance screen
- **Q:** The prototype's Where-this-comes-from 5-row screen (each with a Learned/Estimated/Yours badge) is missing on web entirely and only partial on mobile (covers a SINGLE metric). Build the full per-value breakdown?
- **Options:** (A) Build the full 5-row Provenance screen both platforms, reached from WhyNumber [recommended if target-trust transparency is in scope]. (B) Keep the scoped per-metric mobile sheet + web inline trust-chips as the substitute. (C) Extend the mobile sheet to cover all 5 target inputs without a separate web screen.

### B12. CreateRecipe — source-picker IA
- **Q:** The prototype source grid is Write/Paste/Snap-photo/Scan-LABEL; live differs (mobile: Paste-link / Scan-photo(Pro) / From-PDF / Create-manually; web: unified Create|Import mode toggle). The downstream manual form is already v3-conformed. Reconcile the source set, or keep the live decision?
- **Options:** (A) Keep the live source set (carries real Pro-gating + PDF-import logic) [recommended]. (B) Re-align to the prototype's Write/Paste/Snap/Scan-Label grid. (C) Keep live sources but adopt the prototype's standalone pick-grid to form choreography.

### B13. ScanLabel — standalone OCR scanner vs custom-food fast-fill
- **Q:** The prototype has a first-class full-screen ScanLabel method (camera frame to Reading-label to review grid to Log-this-food); live folds label-OCR into Create-Custom-Food as a fast-fill button. Standalone scanner is tracked-deferred (ENG-1004). Build it or keep OCR-inside-custom-food?
- **Options:** (A) Build the standalone ScanLabel method + LogHub tile (ENG-1004) [recommended if label-scan is a headline logging path]. (B) Keep OCR-inside-custom-food and close ENG-1004 as won't-do. (C) Add the LogHub Label tile that routes into the existing custom-food OCR flow.

### B14. MealEdit (web) — parity edit sheet
- **Q:** On web there is no edit SHEET — meal-nutrition-dialog is read-only and editing happens on the Today host. Add a parity edit sheet (matching the conformed mobile one with Full-nutrition/Swap/Copy), or keep web's host-surface editing?
- **Options:** (A) Keep web's host-surface editing model (no sheet) [acceptable if intentional]. (B) Add a web edit sheet for parity with mobile's TodayEditMealModal. (C) Decide after the mobile MealEdit conform lands, to mirror the same blocks.

### B15. ImportFlow — example chips + file affordance + clear button
- **Q:** The prototype's import input is a single-line search with leading icon, inline clear (x), Or-try-an-example chips, and a Choose-a-file affordance; both live platforms use a multiline paste box with none of these. Add the discoverability affordances or keep the route-out architecture?
- **Options:** (A) Keep the multiline paste box but add a clear (x) button [low-cost discoverability win]. (B) Add example chips + a Choose-a-file affordance to the unified sheet. (C) Keep as-is — file/sample flows are intentionally in the destinations.

### B16. ImportFlow single-recipe preview — confidence-dot grammar
- **Q:** The prototype shows the single-recipe result as an in-sheet read-only preview with high/med/low confidence-dot ver-rows + an amber Quick-check-needed banner; the live single-recipe flow is a far richer editable screen. Should the live review adopt the confidence-dot + banner visual grammar?
- **Options:** (A) Keep the richer editable flow but adopt the confidence-dot + Quick-check-needed banner grammar on its review rows [recommended — it's the v3 trust language]. (B) Keep the live review grammar as-is. (C) Adopt the dot grammar only on low-confidence rows.

### B17. PlanImport — sheet-with-source-grid vs full paste pipeline
- **Q:** The prototype PlanImport is a lightweight seg-tabs + source-grid + pick-sheet; live is a full-screen paste-to-parse-to-review pipeline with nutrition-mode segments + auto-rebalance + activate. Keep the pipeline IA or adopt the prototype's pick-sheet?
- **Options:** (A) Keep the full pipeline (real /api/plan-import, richer) and apply only the token conforms [recommended]. (B) Adopt the prototype's seg-tabs + source-grid + pi-row pick-sheet shape. (C) Keep the pipeline but add the seg-tabs source picker as the entry step.

### B18. MfpImport — named-tracker source grid
- **Q:** The prototype opens with an 8-app brand source-grid (MFP/Lose It/Cronometer/MacroFactor/Carb Manager/Yazio/FatSecret/Fitbit) + Any-other-CSV; live auto-detects source server-side (single Choose-CSV button, no grid). Add the multi-app picker grid back?
- **Options:** (A) Add the named-tracker grid — the we-support-YOUR-app trust signal MFP refugees respond to [recommended for the MFP-exodus moment]. (B) Keep auto-detect (one fewer step). (C) Add a lightweight Supported: MFP, Lose It, Cronometer reassurance strip without the full grid.

### B19. MfpImport — interactive column-mapping screen
- **Q:** The prototype has a tap-to-change CSV-header-to-Sloe-field mapping step with per-column confidence dots; live maps columns server-side via the adapter alias table with no user-facing mapping UI. Surface a mapping step or keep it fully automated?
- **Options:** (A) Keep auto-mapping (removes a step, alias table is robust) [recommended]. (B) Add the interactive column-mapping screen with per-column confidence + tap-to-override for edge-case CSVs. (C) Add mapping override only as a fallback when auto-detect confidence is low.

### B20. GoPublic (mobile) — attestation sheet vs native Alert
- **Q:** Web GoPublic is a checklist dialog; mobile is a bare native Alert.alert with no per-item attestation, no disabled gating, no sheet. Build a real mobile attestation sheet matching the web 3-attestation checklist?
- **Options:** (A) Build a real mobile attestation sheet (3 ver-row attestations + disabled-until-all-ticked Publish) [recommended — the native Alert can't express the legal attestations]. (B) Keep the native Alert. (C) Reuse a shared attestation component across web+mobile to avoid divergence.

### B21. WeeklyRecap — The-detail rows + entry point + web/mobile asymmetry
- **Q:** The shareable brand-lacquer card conforms 1:1, but neither platform renders the prototype's The-detail set-ic rows (Weight/Best-streak/Most-cooked/Protein-average), web is a lean Dialog while mobile is a richer pushed screen, and entry differs (prototype: Progress Full-recap; live: Today StreakPip). Reconcile?
- **Options:** (A) Bring web up to the mobile pushed-screen richness + add the The-detail rows on both, keep the StreakPip entry [recommended for parity]. (B) Keep web lean / mobile rich. (C) Add The-detail rows on both but leave the host shells as-is.

### B22. Digest — standalone morning-narrative screen
- **Q:** The prototype's Daily-digest morning-narrative screen (serif Good-morning + narrative + action chips + One-thing-for-today coach card + delivery-settings CTA) has no live equivalent — the live Digest is a calmer WEEKLY at-a-glance card on Progress. Build the morning digest or mark it superseded?
- **Options:** (A) Mark the prototype's morning Digest superseded by the weekly Digest card [recommended if the weekly card is the intended replacement]. (B) Build the standalone morning-narrative Digest screen + delivery-timing settings. (C) Add just the morning greeting + action chips to the Today hero without a separate screen.

### B23. WeightTrends — Historical-import-depth control
- **Q:** The standalone Weight-and-trends screen was deliberately consolidated into Progress + sheets (2026-05-11) and the core grammar lives — but the prototype's Historical-import-depth control (months of past weights/steps to pull: 3/6/9/12/All) has no live equivalent anywhere. Add it?
- **Options:** (A) Add the import-depth control to the Apple Health / weight settings — a genuine missing affordance [recommended]. (B) Default the import depth and skip the control. (C) Add it only inside the HealthSync screen rather than the weight surface.

### B24. PlanTemplates — iconned single-list vs tabbed two-mode
- **Q:** Live PlanTemplates is a richer tabbed two-mode component (Save-as-template + My-templates list with Apply/Delete + real saved templates); the prototype is a single iconned read-list of 3 fixed templates + a persistent bottom Save-this-week CTA. Adopt the prototype's iconned single-list shape?
- **Options:** (A) Keep the live tabbed two-mode dialog (a functional superset) [recommended]. (B) Adopt the prototype's set-ic single-list + persistent bottom save CTA shape. (C) Keep two-mode but add set-ic row icons to the list for grammar parity.

### B25. DataExport — staged packaging sheet vs direct two-button export
- **Q:** Live export is two direct-action buttons (CSV-only, full-JSON); the prototype is a multi-step packaging sheet (per-category checkbox selection to Prepare-export to packaging spinner to ready state with file chip + Download-zip). Build the selectable scoped-export UI?
- **Options:** (A) Keep the two direct exports [recommended unless scoped export is a real ask]. (B) Build the prototype's selectable-category packaging sheet producing one .zip. (C) Add category selection to a single export action without the full staged-packaging choreography.

### B26. DeleteAccount — 3-step reason+ledger+typed-confirm sheet
- **Q:** Neither platform implements the prototype's 3-step in-sheet flow (reason radios to red data-ledger + Export-my-data-first hatch to type-DELETE). Web is two plain confirm modals; mobile is native Alert to Alert.prompt. The two-stage safety intent exists; reason-capture + export-first hatch + sheet grammar don't. Build the stepped sheet?
- **Options:** (A) Build the 3-step Sloe sheet on both (reason capture + data-ledger + export-first hatch + typed confirm) [recommended — the export-first hatch is a real retention/GDPR nicety]. (B) Keep the current confirm modals, add only a type-DELETE gate on web for parity. (C) Add the Export-my-data-first hatch to the existing modals without the full stepper.

### B27. Billing — full native billing screen
- **Q:** Neither platform has the prototype's native billing screen (status hero + plan-switch radios + payment-method line + restore + history); web routes mutation to the Stripe Customer Portal, mobile to the RevenueCat customer center — intentionally, for legal/AR reasons. Confirm storefront-owned billing is canonical, or build in-app billing?
- **Options:** (A) Confirm storefront-owned billing is canonical (Stripe portal / Apple IAP) [recommended — in-app plan-switch/payment-method on iOS risks AR/legal]. (B) Build the native billing screen where legally allowed (web only). (C) Build a richer in-app status hero that still hands mutation off to the storefront.

### B28. ResetPlan — explicit clear-and-start-fresh sheet
- **Q:** No dedicated Reset-this-weeks-plan sheet exists; the keep-path is covered by inline regenerate (Refresh-the-rest / keep-locked), but the explicit Clear-and-start-fresh destructive branch + warning note are not surfaced as a discrete keep/clear choice. Add the sheet?
- **Options:** (A) Add a small keep/clear confirm sheet to surface the explicit clear-everything-this-week option [recommended — the destructive branch is currently hidden]. (B) Keep the inline regenerate only. (C) Add a Clear-week menu item without a full sheet.

### B29. CalendarPicker — Jump-to-a-day month sheet
- **Q:** The prototype's month-grid Jump-to-a-day sheet has no live equivalent — live day-nav is the 7-cell week strip only, and there's no calendar glyph in any live Plan/Today header to call it. Add a month-jump entry point + sheet, or leave it as not-applicable-by-design?
- **Options:** (A) Leave it out — no live calling surface exists and the week strip covers normal navigation [recommended]. (B) Add a calendar glyph + the month-jump sheet for deep navigation. (C) Defer until a month-jump use case appears.

## C. Prototype surfaces with NO live equivalent (5)

- **BatchCook** — Yes — a designed canonical v3 surface (batch scaling + per-slot portion assignment + fridge-life + shopping-list scaling) and the web Cookbook header already wires a Batch-cook button to a dead destination. Needs scoping as a feature add, not a mechanical conform.
- **AdjustConstraints** — Yes — it's the Plan header's second action (sliders glyph) and the only single place to expose plan-source/calorie-floor/meals-per-day/leftovers under v3. Today the glyph mis-opens the Templates sheet, so its absence is also an active bug.
- **AdaptiveTDEE** — Yes if adaptive-TDEE transparency is in scope — only the backend route exists, no UI; the old-to-new hero, per-reason set-ic breakdown, 6-week trendline and adapt-on/fixed choice are missing, and the live How-maintenance-works to Why link routes nowhere.
- **Digest (morning-narrative screen)** — Conditional — if the daily morning digest is a planned surface, build it (serif greeting + narrative + action chips + One-thing-for-today coach card + delivery-timing settings); if the live weekly Digest card on Progress is the intended replacement, mark the prototype's morning Digest superseded.
- **CalendarPicker (Jump-to-a-day)** — Weakly / no — there is no live calling surface (no calendar glyph in any Plan/Today header) and the 7-cell week strip covers normal day-nav; treat as not-applicable-by-design unless a month-jump entry point is explicitly wanted.

## D. Intentional divergences — already decided, do NOT re-litigate (18)

1. WinMoment uses the GOLD/Accent.win celebration ring (three-role colour law: win = landmark gold), not the prototype's success-green ring, and is a transient one-shot player rather than a persistent win-card with streak-share CTAs — decided 2026-06-01 (redesign_winmoment flag).
2. Today calorie-ring hero: the tap-to-switch Remaining-Consumed toggle is retired, the cal-row is Goal/Eaten/Bonus (right cell always Bonus earned headroom, not a tappable Activity link), and a Show/Hide-macros multi-ring toggle replaces the separate MacroSection — decided 2026-06-10, web-mobile mirrored.
3. Today header drops the prototype's Day-12 day-chip (mock text, no honest data source) and the calendar+bell icon-buttons (calendar moved into the week strip, no notifications bell) — Grace's call, ENG-1247.
4. Search-first logging composition (LogSheet search row + method icons + browse pill-tabs; FoodSearchPanel inline not pushed) predates v3 (2026-04-30 refactor) and is the deliberate IA — push-vs-inline is not drift.
5. ReportRecipe uses a legal-reviewed reason set (copyright to /dmca, incorrect-nutrition, inappropriate-or-unsafe, something-else) in a two-step set-ic flow rather than the prototype's single-step radio sheet — deliberate legal/UX choice, web-mobile lock-step (ENG-1227).
6. ImportFlow input is a multiline paste box (no leading icon/clear/example-chips/file-picker) because the unified sheet routes long pasted text out to per-surface destinations — deliberate route-out architecture.
7. MFP/CSV import is intentionally Settings/onboarding-embedded (the unified sheet's csv route returns a Settings-to-Your-data hint, not a sheet) rather than a standalone Bring-your-history sheet — tracked posture, ENG-1245 follow-up.
8. Progress period control is the Apple-Health D/W/M/6M/Y range grammar + period-paging (ENG-1030/1031), a decided upgrade exceeding the prototype's simpler W/M/Y — ratified before the prototype became canonical.
9. WeightTrends was deliberately consolidated into the Progress Weight section + sheets (docs/decisions/2026-05-11), and range labels use Withings full-words (Week/Month/Quarter/Year/All, Grace TF decision 2026-05-12) rather than the prototype's 1W/1M/3M/1Y/All.
10. Settings (web) keeps the card + editorial-serif-header + lucide-section-icon IA (not the prototype's overline + 36px grey set-ic rows) and a two-line profile header — explicit ENG-1247 carve-out; mobile Settings is conformed to the set-ic/overline grammar.
11. HealthSync is iOS-only by design: web has no standalone screen (the Settings row opens an honest info-only explainer; HealthKit connects in the iOS app) — correct platform asymmetry, mobile screen conforms and exceeds the prototype.
12. Progress Energy-balance drops the prototype's 2,260-to-maintenance adapt-row because the formula-baseline value isn't available and inventing it would be a fabricated number — the explainer states adapt behaviour in words (sloe_v3_energy_equation collapse flag).
13. WebRecNotes/WebRecipeFull: live web ships ONE canonical RecipeDetail.tsx subsuming the prototype's separate web recipe views (notes block + ingredients/method/cook-this already present) — no separate WebRecipeFull component needed.
14. Fasting reskin deltas are intentional: the not-fasting landing (moon glyph + preset pills + quick-start chips vs the prototype's ring + window copy) and the Recent-fasts list replacing the prototype's 7-bar weekly chart; ring size 248 is a shared deliberate Figma-305:2 geometry.
15. Changelog entry-point asymmetry is by design: web links it from Settings-to-About; mobile auto-surfaces /whats-new once after a build-number bump with no Settings link (F-0 spec).
16. Plan This-week suggestions are honest real-data equivalents (web plan-derived InsightCard / mobile PlanSmartSuggestionsCard) rather than the prototype's two fixed canned nudges — an intentional honesty improvement, not a conform gap.
17. Tesco/Ocado grocer hand-off in the prototype Grocery sheet is a fiction with no live integration — correctly absent, not a gap.
18. EraseEverything/DeleteAccount present as centered dialogs on web rather than the prototype's bottom Sheets — consistent with web's documented dialog IA; the destructive type-confirm grammar conforms.
