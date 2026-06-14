# Product QA Audit - 2026-06-14

Scope: full-product launch audit pass across live iOS simulator surfaces, local
mobile web, static code inventory, Figma/design tracker, analytics inventory,
test inventory, and competitor/reference docs.

This is a real-user audit pass, not a completed exhaustive test matrix. The
highest-confidence issues below are backed by screenshots or direct code
evidence. Subscription purchase, destructive account flows, and clean-room
signup/onboarding were not executed against Grace's signed-in simulator account.

## Evidence

Screenshots captured:

- `apps/mobile/screenshots/agent/2026-06-14-audit-ios-baseline.png`
- `apps/mobile/screenshots/agent/2026-06-14-audit-ios-plan.png`
- `apps/mobile/screenshots/agent/2026-06-14-audit-ios-library.png`
- `apps/mobile/screenshots/agent/2026-06-14-audit-ios-progress.png`
- `apps/mobile/screenshots/agent/2026-06-14-audit-ios-settings.png`
- `apps/mobile/screenshots/agent/2026-06-14-audit-ios-import.png`
- `apps/mobile/screenshots/agent/2026-06-14-audit-ios-paywall.png`
- `apps/mobile/screenshots/agent/2026-06-14-audit-ios-log-sheet.png`
- `docs/audit/captures/2026-06-14-product-audit/web-public-home-mobile.png`
- `docs/audit/captures/2026-06-14-product-audit/web-login-mobile.png`
- `docs/audit/captures/2026-06-14-product-audit/web-pricing-mobile.png`
- `docs/audit/captures/2026-06-14-product-audit/web-today-auth-localhost-mobile.png`
- `docs/audit/captures/2026-06-14-product-audit/web-today-auth-localhost-mobile-delayed.png`

Checks run:

- `npm run typecheck` - passed
- `npm run mobile:typecheck` - passed

Checks not run:

- Full `npm run ci` was not run because this was an audit pass with no code
  changes and because the scoped web/mobile typechecks already covered the
  static risk introduced by the investigation.
- StoreKit/RevenueCat purchase, downgrade, cancellation, and restore were not
  executed against live billing.
- Clean-room sign-up/onboarding was not executed on the signed-in simulator
  account to avoid destructive account-state changes.

Current confidence: 8/10 for the top live-product findings; 6/10 for the
full competitive and Figma coverage surface because the Figma MCP was not
connected in this session and the report therefore relies on the existing
Figma migration tracker plus app screenshots.

## Critical

No confirmed Critical crash, security, data-loss, or payment-integrity blocker
was reproduced in this pass. The highest confirmed launch blockers are High.

## High

### H1 - Mobile paywall first viewport has no primary purchase CTA

Area: iOS subscription / monetisation

Reproduction:

1. Launch the installed iOS app in the simulator.
2. Open `suppr:///paywall?from=audit`.
3. Observe the first viewport.

Observed:

- The first viewport shows the hero image, headline, value cards, comparison
  table, and a bottom `Restore purchase` action.
- No visible `Start trial`, `Subscribe`, or purchase CTA appears above the
  fold.

Evidence:

- `apps/mobile/screenshots/agent/2026-06-14-audit-ios-paywall.png`

Root cause:

- The primary CTA and plan selector appear to sit below the first viewport or
  below the comparison section while `Restore purchase` receives sticky-footer
  prominence.
- This violates the one-filled-CTA-per-screen rule in the most commercially
  sensitive screen.

Proposed fix:

- Keep the primary purchase CTA visible in the first viewport and/or pinned
  above the safe area.
- Make restore secondary/tertiary.
- Add a first-viewport screenshot test for paywall CTA visibility.
- Verify VoiceOver order: value proposition, selected plan, primary CTA,
  restore.

### H2 - `suppr:///library` opens Discover instead of Library

Area: iOS navigation / recipes

Reproduction:

1. Launch the installed iOS app in the simulator.
2. Open `suppr:///library`.
3. Observe the selected top sub-tab.

Observed:

- The Recipes screen opens with the `Discover` sub-tab selected.
- The `Library` sub-tab is visible but unselected.
- This contradicts `sitemap.md`, where `/library` is documented as Library
  and `/discover` is documented as Discover.

Evidence:

- `apps/mobile/screenshots/agent/2026-06-14-audit-ios-library.png`
- `sitemap.md`

Root cause:

- The recipes top-tab state is likely persisted or defaulted separately from
  the route/deep-link path, so the selected sub-tab can disagree with the URL.

Proposed fix:

- Make `/library` and `/discover` route-driven sources of truth for the
  selected recipes sub-tab.
- Add an iOS E2E test that opens each deep link and asserts the selected tab.
- Add matching web mobile coverage if the same Recipes IA exists there.

### H3 - Mobile web Today stacks weekly check-in modal with cookie consent

Area: web mobile / returning-user activation

Reproduction:

1. Start the web app locally.
2. Load authenticated `http://localhost:3002/today` in a mobile viewport with
   no accepted cookie consent.
3. Wait for the authenticated Today content and weekly check-in state.

Observed:

- A weekly check-in modal appears.
- The cookie consent banner appears at the same time at the bottom.
- The bottom banner competes with the modal, bottom nav, and FAB.

Evidence:

- `docs/audit/captures/2026-06-14-product-audit/web-today-auth-localhost-mobile-delayed.png`

Root cause:

- Cookie consent and product modal systems appear to render independently
  without a shared modal/overlay priority manager.
- The cookie banner does not account for app safe areas and modal state.

Proposed fix:

- Queue consent behind blocking product modals or render it in a mode that
  cannot overlap nav and modal actions.
- Add a mobile-web E2E test for first authenticated Today load with cookie
  consent unset.

### H4 - Web authenticated QA helper has host/auth drift

Area: web testing infrastructure

Reproduction:

1. Use the existing auth fixture with `127.0.0.1`.
2. Load `/today`, `/plan`, `/library`, `/progress`, or `/settings`.

Observed:

- These routes redirect to `/login` under `127.0.0.1`.
- The same auth fixture works under `localhost`.

Root cause:

- `tests/e2e/.auth/user.json` is scoped to `localhost`, while some local
  QA commands and docs prefer `127.0.0.1`.

Proposed fix:

- Standardise web-drive authenticated URLs on `localhost`, or generate auth
  fixtures for both `localhost` and `127.0.0.1`.
- Update the Suppr web testing playbook so screenshots do not silently capture
  login redirects.

## Medium

### M1 - Log sheet sticky footer overlaps list content

Area: iOS Today / food logging

Reproduction:

1. Open `suppr:///?openLog=1`.
2. Inspect the bottom of the log sheet.

Observed:

- The sticky footer `Or add manually` overlaps or clips the next section
  header, `FEATURED THIS WEEK`.

Evidence:

- `apps/mobile/screenshots/agent/2026-06-14-audit-ios-log-sheet.png`

Root cause:

- The scroll content appears to lack bottom padding equal to the sticky footer
  height plus safe-area inset.

Proposed fix:

- Add measured footer/safe-area bottom inset to the scroll content container.
- Add a visual regression test for the open log sheet in a small iPhone
  viewport.

### M2 - Web pricing mobile wastes first-viewport space

Area: web pricing / conversion

Reproduction:

1. Load `/pricing` in a mobile viewport.
2. Inspect the first screenful.

Observed:

- The page has a large empty vertical gap before the `SLOE PRO` value content.

Evidence:

- `docs/audit/captures/2026-06-14-product-audit/web-pricing-mobile.png`

Root cause:

- Mobile responsive section spacing or min-height appears too large for the
  pricing hero.

Proposed fix:

- Reduce mobile top padding/min-height.
- Ensure the plan/value proposition and primary CTA appear without excessive
  scrolling.

### M3 - Today date strip appears to expose excessive dates to assistive tech

Area: web mobile / accessibility / performance

Reproduction:

1. Load authenticated mobile-web `/today`.
2. Inspect the body text/accessibility tree after the page hydrates.

Observed:

- The extracted body text includes an extremely long sequence of day/date
  labels, far beyond the visible date strip.

Evidence:

- Direct Playwright body text during the delayed mobile-web Today capture.

Root cause:

- The date strip likely renders too many date cells into the accessibility tree
  or fails to hide offscreen/virtualised dates from assistive technology.

Proposed fix:

- Virtualise or prune offscreen date cells.
- Mark non-visible decorative date cells `aria-hidden`.
- Keep only the visible/currently relevant dates keyboard and screen-reader
  reachable.

### M4 - Import screen still reads as a monolithic card flow

Area: iOS recipe import / design conformance

Reproduction:

1. Open `suppr:///import-shared`.
2. Inspect the first viewport.

Observed:

- Import is presented as a large boxed card containing logo, text input, CTA,
  clipboard/photo actions, and platform badges.

Evidence:

- `apps/mobile/screenshots/agent/2026-06-14-audit-ios-import.png`

Root cause:

- `apps/mobile/app/import-shared.tsx` remains a large legacy screen and only
  partially matches the newer app-first design direction.

Proposed fix:

- Align import with the current Figma/app-first spec: reduce the boxed-card
  feel, clarify paste vs photo vs clipboard priority, and keep trust/platform
  badges visually lighter.
- Maintain web/mobile parity for import states.

### M5 - Missing `apps/mobile/AGENTS.md` despite root instruction

Area: documentation / contributor workflow

Reproduction:

1. Follow root `AGENTS.md`, which says mobile-specific conventions live in
   `apps/mobile/AGENTS.md`.
2. Attempt to read `apps/mobile/AGENTS.md`.

Observed:

- The file is missing.

Root cause:

- Documentation drift after project restructuring.

Proposed fix:

- Restore `apps/mobile/AGENTS.md` or update the root reference to the actual
  canonical mobile instructions.

### M6 - Silent-deferral comments remain in live code

Area: engineering hygiene

Examples:

- `apps/mobile/app/recipe/[id].tsx` contains a `known gap` comment without an
  ENG reference.
- `apps/mobile/components/AiLogReviewSummary.tsx` contains `TODO: web parity
  lift`.
- `src/lib/export/nutritionLogToCsv.ts` documents JSON-only behaviour
  `for now`.
- `src/lib/nutrition/recipeTimers.ts` documents English-only parsing
  `for now`.

Root cause:

- Several older implementation notes predate the no-silent-deferrals rule.

Proposed fix:

- Either fix each bounded gap or open/reference Linear issues in the comments.
- Remove comments that describe permanent design choices as pending work.

## Low

### L1 - Broad design-token debt remains in older UI files

Area: design system conformance

Observed:

- Static scans still find literal `fontSize`, `borderRadius`, spacing values,
  and color values in older mobile/web surfaces.
- This is concentrated in large legacy files and screens predating the current
  token contract.

Root cause:

- Legacy code was not built under the current write-time design discipline.

Proposed fix:

- Do not run a blind token rewrite.
- Enforce token conformance opportunistically as each surface is touched, with
  the highest-traffic screens first: Today, log sheet, paywall, import,
  Recipes, Plan.

### L2 - Large-file debt slows safe iteration

Area: maintainability / performance risk

Largest files found:

- `apps/mobile/app/(tabs)/index.tsx` - 6613 lines
- `apps/mobile/app/(tabs)/planner.tsx` - 4407 lines
- `apps/mobile/components/settings/SettingsBundleContent.tsx` - 3778 lines
- `src/app/components/NutritionTracker.tsx` - 3720 lines
- `src/app/components/food-search/FoodSearchPanel.tsx` - 2830 lines
- `apps/mobile/components/food-search/FoodSearchPanel.tsx` - 2709 lines
- `src/app/components/RecipeDetail.tsx` - 2681 lines
- `src/app/components/ProgressDashboard.tsx` - 2571 lines
- `apps/mobile/app/import-shared.tsx` - 2372 lines

Root cause:

- Several central surfaces still combine orchestration, view state, business
  logic, analytics, and presentation in single files.

Proposed fix:

- Every future touch should extract a focused hook or child component and move
  toward the 400-line target.
- Start with files directly implicated by launch-blocking bugs: `paywall`,
  `import-shared`, `LogSheet`, and Recipes routing.

## Missing States

From the existing Figma migration tracker:

- Total tracked surfaces: 369
- Exact matches: 42 (11%)
- Partial matches: 143 (39%)
- App-only: 169 (46%)
- Figma-only: 15 (4%)
- Overall conformance: 21%
- Open blockers: 94

Important missing or incomplete states:

- Recipes: logged confirmation, favourites/go-tos tab, richer Discover rails.
- Import: web import-success frame, clearer macro-check reassurance state.
- Today: fasting explainer and several modal/empty/error states.
- Onboarding/auth: Google Sign-In and continue-email frames are not reflected
  as shipped flows.
- Paywall: mobile/web responsive and loading/error/restore edge states need
  stronger coverage.
- Tablet and web layouts remain underrepresented for Recipes, Plan, Recipe
  detail, Paywall, and several modals.

## Broken Flows And Navigation Issues

- `/library` deep link selects Discover on iOS.
- Mobile web authenticated Today can open with a weekly check-in modal and
  cookie consent banner at once.
- Web authenticated QA captures can silently redirect to login when the host
  does not match the auth fixture.
- Paywall restore is visible before purchase, weakening upgrade flow clarity.

## Crash Risks

No live crash was reproduced. Main risk clusters:

- Very large screen files increase regression risk and make state interactions
  hard to reason about.
- Independent overlay systems increase the chance of inaccessible or blocked
  flows on mobile web.
- Recipe import, food search, health sync, and planner surfaces have large
  async/network surfaces and need network-failure and interrupted-flow tests.

## End-To-End Journey Notes

### Sign up and onboarding

Not executed destructively in this pass. Static and tracker evidence show strong
coverage in code, but Figma conformance remains low and several designed auth
states are unimplemented or intentionally deferred.

Recommended next test:

- Fresh account signup through web and iOS.
- Onboarding interruption/resume.
- Goal setup edit after onboarding.
- Permission prompt denial/retry.

### Recipe import

Live iOS import loads successfully. Friction is visual and prioritisation-based:
paste, clipboard, photo, and platform badges compete in one large card.

Recommended next test:

- TikTok/Instagram/YouTube URL import.
- Bad URL, private URL, no-network, duplicate recipe, partial parse, and macro
  uncertainty.

### Recipe saving

Static inventory shows recipe detail, save, public/private, cook mode, import,
and library/discover coverage. The observed deep-link mismatch makes saved
recipe retrieval less trustworthy.

### Meal planning and grocery list

iOS Plan screen loads and looks production-quality. Test coverage should focus
on generated plan edits: swap, move, delete, leftovers, shopping list creation,
and stale ingredient data.

### Food logging

Today loads and log sheet opens. The log sheet footer overlap is the confirmed
daily-loop bug. Food logging remains one of the best-covered analytics and test
areas, but should be tested under race conditions: double-submit, no network,
search timeout, barcode miss, duplicate recent item, and macro uncertainty.

### Goal setup and progress tracking

Progress and Settings load. No live defect was reproduced, but goal setup after
onboarding and adaptive target changes need E2E coverage because they affect
nutrition correctness.

### Subscription purchase

The upgrade path has a confirmed first-viewport CTA issue. Purchase, restore,
downgrade, cancellation, entitlement refresh, and failed-payment handling still
need a dedicated StoreKit/RevenueCat pass.

### Settings management

Settings loads and includes profile, plan, subscription, targets, and household
surfaces. The file-size and bundle-content complexity make this a maintenance
risk even when the current screen renders cleanly.

## Feature Inventory

Implemented domains observed in code/docs:

- Auth: login, signup, password reset, session restore, authenticated web app.
- Onboarding: goals, targets, dietary preferences, app-choice/MFP positioning,
  completion and resume logic.
- Today: calorie ring, macros, meals, hydration, stimulants, activity, streaks,
  weekly check-in, insights, first-run checklist, daily logging entry points.
- Food logging: search, recent foods, library foods, manual entry, barcode,
  photo/voice/manual assist paths, copy-yesterday, meal assignment.
- Recipes: library, discover, import from links/photos/captions, recipe detail,
  save, verify, create, edit, public/private, cook mode, creator-facing pieces.
- Plan: weekly meal planning, generation, constraints, swaps, moves, leftovers,
  templates, grocery/shopping list.
- Progress: weight, adherence, macro trends, digest/recap surfaces, maintenance
  and adaptive goal signals.
- Settings: profile, subscription, targets, units, notifications, health sync,
  household, export/delete, billing, promo flows.
- Monetisation: mobile paywall/RevenueCat, web pricing/checkout, entitlement
  checks, premium feature flags.
- Analytics: event registry and tracking across activation, logging, import,
  planning, shopping, paywall, subscription, and retention surfaces.

Hidden or unfinished functionality:

- Figma-only Ask coach / coaching surfaces.
- Figma-only favourites/go-tos recipe tab.
- Several import success/reassurance states.
- Web parity note in `AiLogReviewSummary`.
- Label OCR/manual-entry follow-up around barcode flow.
- Recipe totals/calculation known gap comment.

## Design System Conformance

Strong current surfaces:

- iOS Today, Plan, Progress, and Settings screenshots are visually coherent and
  generally feel launch-grade.
- Web landing and login are polished in mobile viewport.

Debt:

- Figma tracker reports only 21% conformance across tracked surfaces.
- Large legacy screens still carry literal style values.
- Paywall and import are the most consequential visual/flow mismatches found
  live in this pass.

Recommended standardisation order:

1. Paywall CTA and layout.
2. Log sheet footer/inset and sheet state.
3. Recipes Library/Discover routing and selected-tab treatment.
4. Import first viewport and source-priority hierarchy.
5. Web Today overlay/cookie-safe-area behaviour.

## Accessibility

Confirmed issues:

- Mobile-web Today overlay stacking creates a likely screen-reader and focus
  management problem.
- Mobile-web Today date strip appears to expose too many dates to the
  accessibility tree.
- Paywall primary purchase CTA is not visible in first viewport, which also
  weakens switch-control and VoiceOver task completion.
- Log sheet footer overlap can obscure content and touch targets.

Recommended a11y tests:

- VoiceOver route through paywall, log sheet, Today modal, and import.
- Dynamic Type XL/XXL on paywall and log sheet.
- Touch-target audit for all sticky footers and top-tab controls.
- Color contrast pass on plan chips, macro tiles, muted captions, and disabled
  states.

## Analytics And Instrumentation

Coverage appears broad. The registry and call sites include events for logging,
meal-plan generation, shopping list generation, recipe import/verify/cook,
weekly check-in, hydration/stimulants, paywall views, and checkout.

Primary risk is not total absence of analytics; it is consistency and journey
verification.

Recommended events/tests:

- `library_deep_link_opened` with selected tab to catch `/library` vs Discover
  mismatches.
- `paywall_primary_cta_visible` or screenshot-derived checkout funnel guard in
  E2E, not necessarily a production event.
- Overlay conflict telemetry: modal shown while consent banner visible.
- Import failure taxonomy: private URL, unsupported source, low-confidence
  nutrition, duplicate recipe, network failure.
- Planner edit funnel: generated, adjusted constraints, swapped meal, grocery
  list created, grocery list used.

## Competitive Feature Matrix

Sources used:

- MyFitnessPal Premium official page:
  `https://www.myfitnesspal.com/premium`
- Paprika official feature page:
  `https://www.paprikaapp.com/`
- Samsung Food public coverage:
  `https://www.theverge.com/2024/10/21/24275282/samsung-food-app-ai-vision-meal-planning-subscription-price`
- Samsung/Instacart smart-fridge coverage:
  `https://www.theverge.com/news/621665/samsung-smart-fridges-instacart-grocery-delivery-ai-vision-inside`
- Internal docs: `docs/competitor-intelligence-report.md`,
  `docs/julienne-deep-dive-2026-06-02.md`,
  `docs/competitor-set-and-mfp-exodus-2026-05-03.md`,
  `docs/competitor_feature_catalog_sentiment.md`

Summary:

- MyFitnessPal is strongest on logging breadth, barcode/photo/voice logging,
  database scale, progress reports, fasting, grocery integration, and premium
  plan/grocery features.
- Paprika is strongest on recipe organisation, browser/web import, grocery
  aisle grouping, scale/conversion, timers, pinned active recipes, and
  cross-device sync.
- Samsung Food is strongest on AI meal planning, food-list-based recipe
  suggestions, appliance/fridge integrations, and grocery fulfilment.
- Recime is strongest as a social/discovery recipe catalogue and inspiration
  surface.
- Julienne is strongest on polished iOS recipe import/aesthetic positioning,
  but appears weaker on retention, distribution, cloud-sync trust, and breadth.

Sloe's current differentiators:

- Calorie/macros and recipe planning in one product.
- Recipe import tied directly to nutrition and meal planning.
- Today/Plan/Recipes loop is strategically stronger than a standalone recipe
  manager if the daily habit loop is made reliable.

Parity gaps:

- Paywall conversion polish lags competitors.
- Grocery fulfilment/integration depth trails MFP/Samsung.
- Recipe organisation depth trails Paprika.
- Discovery depth trails Recime/Samsung.
- Cross-platform design coverage is still incomplete.

## Retention Audit

Strong loops:

- Daily: Today logging, recents, calorie ring, macros, hydration/stimulants,
  copy-yesterday, planned meals.
- Weekly: meal plan generation, grocery list, weekly check-in, progress recap.
- Habit scaffolding: streaks, first-run checklist, adaptive targets, saved
  meals/recipes.

Churn risks:

- If the first returning web session shows stacked overlays, the product feels
  noisy before value is delivered.
- If paywall hides the purchase action, motivated users can fail to convert.
- If Library deep links open Discover, saved-value retrieval feels unreliable.
- If import is visually heavy or ambiguous, the viral recipe wedge loses speed.
- Missing/partial error states can make network/API failures feel like dead
  ends.

Highest-leverage retention improvements:

1. Make Today load cleanly with exactly one foreground task.
2. Fix Library/Discover route truth so saved value is instantly retrievable.
3. Make recipe import feel faster and less modal/card-bound.
4. Make paywall CTA visible and trustworthy.
5. Convert weekly check-in into a clear next-action loop, not just a modal.

## Technical Debt And Performance

Main risks:

- Large screen files make launch bugs harder to isolate and increase accidental
  web/mobile divergence.
- Independent overlay systems create mobile-web focus and layout conflicts.
- Date strip DOM/accessibility volume suggests avoidable render and
  screen-reader cost.
- Feature-flag debt requires cleanup once flags are stable at 100%.

Recommended refactor order:

1. `apps/mobile/app/paywall.tsx` / paywall components.
2. `apps/mobile/components/today/LogSheet.tsx`.
3. Recipes route/sub-tab controller.
4. `apps/mobile/app/import-shared.tsx`.
5. Web Today date strip and overlay manager.

## Automated Test Backlog

Add or update:

- iOS E2E: `suppr:///library` selects Library; `suppr:///discover` selects
  Discover.
- iOS visual: paywall first viewport contains one visible primary purchase CTA.
- iOS visual: log sheet footer does not overlap content at small viewport size.
- Web E2E: authenticated mobile Today with no cookie consent shows only one
  blocking overlay and keeps nav/action targets unobscured.
- Web a11y/unit: Today date strip exposes only visible/relevant dates to
  assistive technology.
- Web tooling: authenticated captures use host matching the auth fixture.
- RevenueCat/StoreKit: purchase, restore, failed purchase, entitlement refresh,
  cancellation/downgrade handling.
- Import: unsupported URL, private URL, duplicate recipe, low-confidence
  nutrition, network failure, interrupted import.
- Planner: generate, edit constraints, swap, move, delete, grocery list create.
- Food logging: search timeout, double-submit prevention, barcode miss, manual
  fallback, duplicate recent item.

## Recommendation

Do not treat all 15 audit prompts as one undifferentiated launch checklist.
The launch-critical path should start with five concrete fixes:

1. Paywall CTA visibility.
2. Library/Discover route correctness.
3. Mobile-web overlay queueing.
4. Log sheet sticky footer inset.
5. Web QA/auth host standardisation.

After those, run the dedicated destructive passes: fresh signup/onboarding,
StoreKit subscription lifecycle, import failure matrix, and network-failure
journeys.
