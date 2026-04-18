# Executor backlog — orchestrator-full-sweep (2026-04)

**Source:** `orchestrator-full-sweep` consolidation (whole product: web + Expo + Supabase).  
**Handoff:** `executor` implements in order below; `qa-lead` aligns tests; `docs-keeper` updates legal/env docs where noted.

**Supabase migration drift (resolved 2026-04-18):** linked prod is caught up through **`20260421180000`** (`supabase db push --linked` + migration-file hardening). Ongoing process: [`supabase-migration-drift-inventory.md`](./supabase-migration-drift-inventory.md).

---

## 1. Top 5 actions (execution order)

**Status:** items 1–5 shipped in `main` (2026-04); see commit history for `getUserTier`, mobile journal, privacy, legal links, voice paywall + web tracker polish.

| # | Title | Severity | Owner | Why now |
|---|--------|----------|-------|---------|
| 1 | Fix `getUserTier` under RLS | P0 | executor (+ security-reviewer review) | Paid users incorrectly get free-tier API limits (`photo-log`, `voice-log`, etc.). |
| 2 | Mobile journal parity with web legacy `nutrition_journals` | P0 | executor (+ sync-enforcer review) | Subset of users see food on web, empty log on mobile. |
| 3 | Privacy policy: AI, photo, voice, subprocessors | P0 | executor (+ legal-reviewer review) | Store / EU-style scrutiny; policy must match processing. |
| 4 | Mobile in-app Privacy + Terms links | P0 | executor (+ legal-reviewer review) | Ship checklist / store parity with web. |
| 5 | Mobile voice paywall error framing (`upgrade_required`) | P1 | executor | Trust: stop showing “parse” errors for billing. |

---

## 2. Full backlog (sequenced by dependency)

### P0 — Ship blockers (legal + entitlements + parity)

| ID | Title | Problem | Goal | Effort | Deps | Platforms | Validation | Owner | Review |
|----|--------|---------|------|--------|------|-----------|------------|-------|--------|
| T1 | Tier lookup with RLS | `getUserTier` uses anon `createClient` without user JWT; `profiles` RLS hides rows → always `free`. | Tier read uses service role after `userId` is verified, or `SECURITY DEFINER` RPC `get_user_tier(uid)` granted to authenticated. | S | — | API | Pro user gets pro limits on photo/voice; unit or integration test with mock JWT + profile row. | executor | security-reviewer |
| T2 | Mobile `nutrition_journals` fallback | Web `useNutritionJournalState` falls back to legacy JSONB; mobile tracker only reads `nutrition_entries`. | Mobile loads same fallback path as web when entries empty / legacy only. | M | — | mobile | Legacy fixture: web and mobile show same day totals. | executor | sync-enforcer |
| T3 | Privacy policy completeness | `/privacy` thin on OpenAI (photo/voice), Web Speech, image import, named subprocessors. | Single updated policy page + terms cross-check. | M | — | web | Privacy expanded; **terms** link AI optional features → `/privacy`. | executor | legal-reviewer |
| T4 | Mobile legal links | No privacy/terms in mobile app surfaces. | Settings or More → open `/privacy` and `/terms` (WebView or `Linking`). | S | T3 optional copy | mobile | Manual: links work, match production URLs. | executor | legal-reviewer |

### P1 — Trust, product, correctness

| ID | Title | Problem | Goal | Effort | Deps | Platforms | Validation | Owner | Review |
|----|--------|---------|------|--------|------|-----------|------------|-------|--------|
| T5 | Voice upgrade UX (mobile) | 403 `upgrade_required` surfaced as parse failure. | Branch on `error` / status; title “Upgrade required”, body from API `message`. | S | — | mobile | Free user: clear paywall path copy. | executor | customer-lens |
| T6 | In-product AI disclosure | Photo/voice UI lacks third-party / transfer disclosure. | Short pre-action copy + link to privacy. | S | T3 | web (+ mobile if mirrored) | **Web + mobile:** tracker sheet + voice modal copy points to Privacy (More). | executor | legal-reviewer |
| T7 | Adaptive TDEE persistence | `computeAdaptiveTDEE` tested but nothing writes `profiles.adaptive_*`. | Job or post-save hook persists when confidence rules pass. | M | T1 if tier affects feature | both | **Done:** `refreshAdaptiveTdeeForUser` after web journal insert/delete + mobile `nutrition_entries` upsert; 6h throttle; medium/high only. Types synced. | executor | nutrition-engine |
| T8 | Dedupe `classifyMealType` | Two copies: `apps/mobile/lib` vs `src/lib/recipe-import`. | Single implementation in `src`; mobile re-export. | S | — | both | **Done:** `apps/mobile/lib/classifyMealType.ts` re-exports `src/lib/recipe-import/classifyMealType.ts`; `metro.config.js` watches monorepo root. | executor | code-quality |
| T9 | CI: mobile | No lint/tsc for `apps/mobile` in CI. | Add job step: `npm ci` in `apps/mobile` + `expo lint` or `tsc --noEmit` if configured. | M | — | CI | **Done:** `npm run lint` + `npm run typecheck` (`tsc --noEmit`) in CI after mobile install. | executor | release-gate |
| T10 | FAB sheet a11y | Absolute `Pressable` stack vs `Modal`; FAB no label. | `Modal` or RN sheet + `accessibilityLabel` / focus. | M | — | mobile | **Done:** `Modal` + FAB / action `accessibilityLabel`; Android `onRequestClose`. | executor | ui-product-designer |
| T11 | Web date nav `aria-label` | ← → buttons unlabeled. | `aria-label="Previous day"` / `Next day`. | S | — | web | **Done** on `NutritionTracker`. | executor | qa-lead |
| T12 | `VERIFY_STRICT` on release | `verify:production-env` always exits 0 in CI. | Enable `VERIFY_STRICT=1` on `main` or release workflow only. | S | — | CI | **Done:** `VERIFY_STRICT=1` when `github.event_name == push` and `ref == refs/heads/main`. | executor | release-gate |
| T13 | Fasting cross-platform | Fasting UI mobile-only; onboarding may capture intent. | Minimal web surface or honest “use mobile” copy. | L | product call | both | **Done (MVP):** Help → fasting section + decision log `docs/decisions/2026-04-fasting-web-scope.md` (mobile-only timer). | planner → executor | journey-architect |
| D1 | **Supabase migration drift vs prod** | Local repo migrations ahead of remote; prod missing objects some migrations assume (`creator_publish_notifications`, etc.) → **silent app failures**. | **Reconcile:** follow [`supabase-migration-drift-inventory.md`](./supabase-migration-drift-inventory.md) — optional `ensure_*` SQL in dashboard, then `supabase db push --linked` (or consolidated catch-up SQL); align `migration repair` with what actually ran. | L | — | supabase | **Done 2026-04-18:** `db push --linked` through `20260421180000`; migration list shows full Remote column; idempotent fixes in `19100000`, `20100000`, guarded realtime in `18120000`. | executor | data-integrity |
| T14 | Brand token pass | Violet / purple / pink / rose drift. | Single accent system in theme + App shell. | M | — | both | **Done:** `docs/ux/brand-tokens.md` (roles + code pointers); mobile theme header links to it. | executor | ui-product-designer |
| T15 | Docs: FatSecret + Sentry | `docs/environment.md` wrong FatSecret names; `.env.example` missing `NEXT_PUBLIC_SENTRY_DSN`. | Align names; document both DSNs. | S | — | docs | **Done:** FatSecret consumer keys; `NEXT_PUBLIC_SENTRY_DSN` + `SENTRY_DSN` in docs and `.env.example`. | executor | docs-keeper |

### P2 — Hygiene

- Subscription narrative doc + in-app copy (Stripe vs IAP): **Done** — `docs/product/subscriptions-stripe-and-iap.md` (web Stripe vs mobile IAP; Supabase tier as shared truth).
- Rate limit / Upstash production confirmation: **Done** — production/preview note in `docs/environment.md` (Upstash section).
- Package manager story: **Done** — `docs/operations/package-manager.md` (npm + lockfiles as source of truth).

---

## 3. Critical path (minimum to unblock next production ship)

```text
T1 (tier RLS) → T2 (journal parity)  } parallel where possible
T3 (privacy)   → T4 (mobile links)  } T4 can start after T3 draft
```

**Gate:** Do not tag App Store / Play production until **T1–T4** validated.

---

## 4. Quick wins (parallel opportunistic)

- T5, T8, T11, T15 (all **S** effort).
- T6 after T3 text is stable (avoid double edits).

---

## 5. Open decisions (need product-lead before build)

- Recipe `/recipe/[id]` auth-gated in middleware: **documented default** — keep auth-gated until SEO/share is prioritized; see `docs/decisions/2026-04-recipe-routes-auth-middleware.md`.
- RevenueCat empty offerings: **documented** — env required for real IAP; paywall shows user-visible fallback when packages are empty; see `docs/decisions/2026-04-revenuecat-offerings-empty.md`.
- Fasting on web: **resolved for MVP** — mobile-only timer; see `docs/decisions/2026-04-fasting-web-scope.md` (revisit if web parity is prioritized).

---

## 6. Reference paths (known)

- Tier: `src/lib/supabase/serverAnonClient.ts` (`getUserTier`), `app/api/nutrition/photo-log/route.ts`, `voice-log/route.ts`
- Journal web: `src/context/appData/useNutritionJournalState.ts`
- Journal mobile: `apps/mobile/app/(tabs)/index.tsx`, `apps/mobile/lib/nutritionJournal.ts`
- Privacy: `app/privacy/page.tsx`
- Mobile voice errors: `apps/mobile/app/(tabs)/index.tsx` (`submitVoiceTranscript`)

---

## 7. Deferred test + doc debt — Batch 1.1 / 1.2 (qa-lead, 2026-04-17)

**Source:** qa-lead deferred-test report 2026-04-17. Batch 1.1 = week-start-day work; Batch 1.2 = remaining macros + fit-this-in. Cheap fixes already landed; the items below are the heavier deferred work.

### P1 — Correctness gates on shipped features

| ID | Title | Description | Severity | Effort | Platforms | Owner | Review | Dependencies | Acceptance criteria |
|----|-------|-------------|----------|--------|-----------|-------|--------|--------------|---------------------|
| G8 | Settings week-start-day round-trip integration test | No integration test verifies that tapping Monday/Sunday fires the correct Supabase `profiles.update` payload, that a subsequent `select` returns the stored value, and that the UI hydrates from it. | P1 | S (~30 min per platform) | both | executor | qa-lead | — | Web + mobile: Monday tap → update called with `{week_start_day:'monday'}`; Sunday tap → same with `'sunday'`; mock select returns stored value → UI reflects it. Both tests in CI on `main`. **DONE 2026-04-18 via M11 audit fix.** Shared helper `src/lib/nutrition/weekStartDayClient.ts` (`loadWeekStartDay` / `saveWeekStartDay`) now backs both `Settings.tsx` (web) and `apps/mobile/app/(tabs)/more.tsx` (mobile). Tests: `tests/unit/settingsWeekStartRoundTrip.test.ts` (9 cases) and `apps/mobile/tests/unit/moreWeekStartRoundTrip.test.ts` (6 cases). |
| G10 | Migration safety test for `add_week_start_day_to_profiles` | `20260414210000` ships NOT NULL column with CHECK. No automated test verifies (a) pre-existing rows receive `'monday'` default, (b) `insert … week_start_day='tuesday'` is CHECK-rejected, (c) column is genuinely NOT NULL. | P1 | S (~45 min) | supabase local | data-integrity | qa-lead | — | Supabase local-DB integration test: seed without column → reads `'monday'`; insert bad value → DB error; insert NULL → NOT NULL violation. All three pass in CI. |
| G16 | Fit-this-in live reactivity component test | `FoodSearch.tsx` (web) / `FoodSearchModal.tsx` (mobile) accept `macroTargets` + `macroConsumed`; no component-level test verifies portion-slider changes update the "after" values. | P1 | M (~1 h per platform) | both | executor | qa-lead | — | Web (RTL) + mobile (RNTL): render with props + candidate; simulate slider change; assert RemainingMacrosBar "after" row matches `projectRemaining()` for new portion. Both pass; `candidate` reactivity confirmed. **WEB DONE 2026-04-18 via M11 audit fix.** `tests/unit/foodSearchFitThisIn.test.tsx` mounts `FoodSearch` with seeded custom food, asserts "If you log this" hint updates as quantity changes (100 g → 50 g → 200 g) and flips to "+N over" when the kcal budget is exceeded. **MOBILE DEFERRED — infrastructure-blocked:** `@testing-library/react-native` is not installed on `apps/mobile`. Install RNTL (+ optional `jest-expo` preset) before writing the mobile counterpart. |

### P2 — Quality + parity

| ID | Title | Description | Severity | Effort | Platforms | Owner | Review | Dependencies | Acceptance criteria |
|----|-------|-------------|----------|--------|-----------|-------|--------|--------------|---------------------|
| G15 | Accessibility aria / accessibilityLabel render tests for RemainingMacrosBar | Over/under states have visual-only colour cues; no test queries by `aria-label` (web) / `accessibilityLabel` (mobile). | P2 | S (~1 h total) | both | executor | qa-lead | G17 (run together) | Web (RTL) + mobile (RNTL): query by label; assert label text present and non-empty in both under and over states. |
| G17 | Cross-platform RemainingMacrosBar label parity snapshot | No shared test enforces parity of label strings between web and mobile components. | P2 | XS (~20 min) | both | executor | qa-lead | G15 | Extract label map into shared constant + deep-equal test, OR shared snapshot with identical inputs. Passes in CI. |
| G19 | Maestro E2E for week-start-day change | Existing More-menu flow taps but doesn't change the value. | P2 | S (~45 min) | mobile | executor | qa-lead | — | New `apps/mobile/.maestro/flows/settings-week-start.yaml`: launch → login → More → Week Starts On → Sunday → Today → assert first DayStrip tile labeled `Sun`. Added to default suite. |
| DOC-DEBT | Reconcile unit test inventory in test-plan.md | Header says 23 files tracked but `tests/unit/` has 40+ files; gap note lists the missing ones by name. | P2 | XS (~30 min) | docs | docs-keeper | qa-lead | — | `docs/testing/test-plan.md` updated to include all files currently in `tests/unit/`; count matches. Docs-only change. |
| JOURNEY-DOC | Add "Log a meal" step-by-step journey doc | `docs/journeys/food-tracking.md` describes UI layout but has no step-by-step walkthrough of the log flow (search → select → portion → fit-this-in → log). | P2 | S (~1 h) | docs | journey-architect | docs-keeper | G16 shipped | New section / file in `docs/journeys/` "Log a meal": 6 numbered steps covering search → results → portion → fit-this-in preview → log → confirmation. Both web and mobile covered. |

### P3 — Low-severity / needs decision first

| ID | Title | Description | Severity | Effort | Platforms | Owner | Review | Dependencies | Acceptance criteria |
|----|-------|-------------|----------|--------|-----------|-------|--------|--------------|---------------------|
| G9 | Last-writer-wins rapid-tap settings test | Rapid Mon → Sun → Mon could theoretically race; no test asserts final state matches final write payload. | P3 | XS (~30 min) | both | executor | qa-lead | G8 | RTL: simulate rapid taps; assert final Supabase payload and no impossible intermediate state visible > 1 frame. |
| G-ANALYTICS | Instrument `week_start_day_changed` and `fit_this_in_previewed` events | Both platforms silent on two meaningful user interactions; no event properties defined. Product call required before build. | P3 | S (once decided) | both | analytics-engineer | product-lead | Product decision on schema | Product-lead documents event names, trigger conditions, required properties. Analytics-engineer then implements on both platforms. Events fire in manual smoke test. **Status (2026-04-18, audit H5): event-name + firing-point portion DONE.** Both events added to `src/lib/analytics/events.ts`. `week_start_day_changed { from, to }` fires from web `Settings.tsx` and mobile `app/(tabs)/more.tsx` on committed change only (guarded against hydration + no-op re-taps). `fit_this_in_previewed { overCalories, kcalDelta }` (plus optional `fromSlot`) fires from web `FoodSearch.tsx` and mobile `FoodSearchModal.tsx` once per distinct `(food, quantity, unit)` preview via a ref-keyed last-emitted guard — no spam during slider drag / stepper holds. Test: `tests/unit/analyticsEvents.test.ts`. **CLOSED 2026-04-18 (Ship L6 G1-G9).** The larger PostHog instrumentation gap — every April-sprint feature measurable — shipped in L6. `food_logged.source` enum (G1) + assertion test; `first_log_at` person property (G2); `savedMealId` on `saved_meal_*` (G3); `confidence_bucket` on recipe-ingredient override events (G4); `surface` on `empty_state_cta_clicked` (G5); `amount_ml` / `kind` / `via` on hydration/stimulant events (G6); `trigger` on `widget_snapshot_updated` (G7); new `streak_reset` event (G8); `paywall_viewed.from` enum with URL-param guard (G9). Dashboard build still open (analytics-engineer). |

### Batch 1.1/1.2 critical path

```text
G10 (migration safety)  — no deps; run immediately against supabase local
G8  (settings round-trip) — no deps; parallelisable with G10
G16 (fit-this-in reactivity) — no deps; parallelisable
    └─► G17 (parity snapshot) — after G15 labels confirmed
G15 (aria render tests) — no deps; leads into G17
G19 (Maestro E2E week-start) — after G8 confirms DB contract is stable
DOC-DEBT — opportunistic, no deps
JOURNEY-DOC — after G16 lands
G9  (rapid-tap) — after G8
G-ANALYTICS — CLOSED 2026-04-18 (Ship L6 G1-G9). Dashboards still open for analytics-engineer.
```

**Quick wins:** G17, DOC-DEBT (both XS; one sitting). G9 is also XS but depends on G8.

**Open decision:** ~~G-ANALYTICS blocked on product-lead event-schema call.~~ Resolved 2026-04-18: event names + payload shape decided (`week_start_day_changed { from, to }`; `fit_this_in_previewed { fromSlot?, overCalories, kcalDelta }`) and instrumented on both platforms. **Closed 2026-04-18 (Ship L6 G1-G9)** — the broader instrumentation-gap suite shipped: `food_logged.source` enum, `first_log_at` person property, `savedMealId` on saved_meal_*, `confidence_bucket` on recipe-ingredient overrides, `surface` on empty_state_cta_clicked, `amount_ml`/`kind`/`via` on hydration/stimulant, `trigger` on widget_snapshot_updated, new `streak_reset` event, `paywall_viewed.from` enum. PostHog dashboard wiring remains open for `analytics-engineer`.

---

## 9. Audit 2026-04-18 — Critical items status

Cross-reference: `docs/planning/post-feature-expansion-audit-2026-04-18.md`.

| ID | Title | Status | Notes |
|----|-------|--------|-------|
| C1 | Custom foods dead code | **DONE 2026-04-18** | Wired into `FoodSearch.tsx` + `FoodSearchModal.tsx`. Two shared helpers added (`customFoodToMacrosPer100g`, `buildCustomFoodPortions`). 10 new unit tests. 948 tests green. |
| C1a | NutritionTracker inline web search not rewired to `FoodSearch` | **DONE 2026-04-18 (Post-ship #5)** | `NutritionTracker.tsx` now mounts shared `<FoodSearch>` on Today. `TodayAddMealDialog` drops the inline "Search" tab + hand-rolled search view; a single "Search foods" CTA hands off to the standalone search modal (parity with mobile's Add-meal → FoodSearchModal pattern). QuickLogStrip's Search chip opens `<FoodSearch>` directly. Custom foods surface at top with "Custom" badge on the primary web Today log path. `food_logged.source` fires `custom_food` / `manual` to match mobile. `todayAddMealDialog.test.tsx` (4 cases) + existing `foodSearchFitThisIn.test.tsx` guard the rewire. 1135 vitest green. |
| C2 | Mobile planner Move action | **DONE 2026-04-18** | `MoveMealSheet` bottom sheet + long-press action sheet + shared `moveMealInPlan` / `markLeftoversOnSwap` wired. 957 tests green. |
| C3 | Imperial water on mobile | **DONE 2026-04-18** | Shared `formatWaterAmount` + `imperialWaterQuickAdds` helpers; mobile card now accepts `measurementSystem`; metric storage unchanged. Product-memory logged. |
| C4 | Dead voice/photo modals on mobile Today | **DONE 2026-04-18** | −287 LOC from `(tabs)/index.tsx` (4,419 → 4,132). Only unreachable paths deleted; `apps/mobile/lib/voiceLog.ts` preserved because `VoiceLogSheet` still imports `isSpeechAvailable` / `listenForSpeech`. |
| C5 | iOS widget claim on roadmap | **RESOLVED 2026-04-18 — PRODUCT DECISION** | User decision: widgets not critical for launch. `widgetSnapshot.ts` infra kept ready; no WidgetKit extension work until post-launch widget track opens. DOCUMENTATION_HUB + roadmap updated to reflect "Siri deep links shipped, widget deferred". **Do not re-raise widget scope until post-launch track begins.** |
| R1 | Legacy EmptyState on web | **DONE 2026-04-18** | `src/app/components/EmptyState.tsx` deleted. `ShoppingList.tsx` (the only remaining consumer) migrated to `src/app/components/suppr/empty-state.tsx`; CTA preserved as `<Button variant="outline" />` in the primitive's `action` slot; `empty_state_cta_clicked` analytics + `{ title, ctaLabel }` payload preserved. Test: `tests/unit/shoppingListEmptyState.test.tsx` (3 cases). Grep of `src/` for `components/EmptyState` returns zero. |
| R2 | Mobile cook-timer analytics parity | **DONE 2026-04-18** | `apps/mobile/app/cook.tsx` now fires `cook_mode_opened { recipeId, stepCount }` on mount and `recipe_timer_started { recipeId }` on timer start. `recipe_timer_completed` intentionally skipped — mobile timer is a count-up stopwatch with no natural completion event (user always presses Stop); firing on Stop would conflate "user cancelled" with web's "countdown hit zero". Mobile `recipe_timer_started` payload omits `seconds` for the same reason (no pre-set duration at start time). Divergence documented inline in `cook.tsx` and pinned by `apps/mobile/tests/unit/cookAnalyticsParity.test.ts` (5 cases). |

### Follow-up ledger (2026-04-18)

- ~~**C1a** above — rewire web NutritionTracker inline search to `<FoodSearch>`.~~ **Closed 2026-04-18 (Post-ship #5).**
- ~~**Post-ship #4** — weekly recap "Save your usual" prompt CTA deep-links to `SaveMealDialog` / `SaveMealSheet` pre-seeded with the user's most-frequent items from history.~~ **Closed 2026-04-18 (Post-ship #4).** New shared helper `selectMostFrequentSlotSeed(byDay, slotPreference?)` in `src/lib/nutrition/usualMealHint.ts`; cross-view bridge `src/lib/nutrition/pendingUsualMealSave.ts` (sessionStorage on web, AsyncStorage on mobile, versioned key `suppr-pending-usual-meal-save-v1`, 5-minute TTL); new analytics event `weekly_recap_save_prompt_tapped { slot, seedCount }`. `buildUsualMealRecapInsight` prompt-show gate untouched. Tests: +12 `selectMostFrequentSlotSeed` cases in `tests/unit/usualMealHint.test.ts`; new `tests/unit/pendingUsualMealSave.test.ts` (10 cases). 1169/1169 vitest green.
- Mobile planner: the old `swapMeal` + "Adjust portion" paths mutate state without persisting (pre-existing bug, flagged during C2 — route through new `persistPlan` helper). Owner: `code-quality` / `executor` when touched.
- `VOICE_LOG_NATIVE_BUILD_HINT` export in `apps/mobile/lib/voiceLog.ts` is unused in code (only in docs). Two-line cleanup when convenient. Owner: `executor`.

---

## 8. Deferred test debt — Batch 1.3 / 1.4 (2026-04-17)

**Source:** manual verification pass (qa-lead/docs-keeper/sync-enforcer agents hit daily rate limit). Cheap checks already confirmed; items below are the heavier deferred work.

### P1

| ID | Title | Description | Severity | Effort | Platforms | Owner | Acceptance criteria |
|----|-------|-------------|----------|--------|-----------|-------|---------------------|
| F1 | Favourites CRUD integration test | `listFavorites` / `addFavorite` (unique-violation path) / `removeFavorite` have no Supabase-level integration test. Risk: silent regression on shipped persistence. | P1 | M (~1h per flow) | web + mobile | executor | Vitest + mocked `supabase.from('user_favorite_foods').insert/select/delete/eq()` chain. Happy path, unique-violation treated as success, RLS-rejected rows hidden, ordering by `created_at desc`. Both platforms. **DONE 2026-04-18 via M11 audit fix.** `tests/unit/favoriteFoodsClient.test.ts` (16 cases) exercises `listFavorites`, `addFavorite` (happy + PG 23505 unique-violation recovery + propagated errors), `removeFavorite`, `isFavorite`. The file is platform-shared — the same module powers web and mobile favourites, so a single suite covers both. |
| F2 | Copy-meal / Duplicate-day component render test | `CopyMealDialog`, `DuplicateDayDialog` (web) and `CopyMealSheet`, `DuplicateDaySheet` (mobile) have no render-level test. Date-range flow is the riskiest UX. | P1 | M (~1h per platform) | both | executor | RTL (web) + RNTL (mobile): render each dialog/sheet, simulate date selection + quick-range chips, assert `onConfirm` called with the expected target list (deduped, source excluded). **WEB DONE 2026-04-18 via M11 audit fix.** `tests/unit/copyMealDialog.test.tsx` (5 cases) and `tests/unit/duplicateDayDialog.test.tsx` (5 cases) cover default target, custom date, quick-range chips, reversed ranges, zero-meal source, and source-day exclusion. **MOBILE DEFERRED — infrastructure-blocked:** `@testing-library/react-native` is not installed on `apps/mobile`. Install RNTL before writing the mobile counterpart. |
| F3 | `user_favorite_foods` migration safety | `20260421100000` ships RLS + unique index + no UPDATE policy. No automated test verifies. | P1 | S (~45 min) | supabase local | data-integrity | Supabase local-DB test: (a) insert duplicate of same user+title+cal fails on unique, (b) another user's row is invisible under RLS, (c) UPDATE is denied. |

### P2

| ID | Title | Description | Severity | Effort | Platforms | Owner | Acceptance criteria |
|----|-------|-------------|----------|--------|-----------|-------|---------------------|
| F4 | Maestro E2E — Quick add star toggle | No flow exercises the star toggle end-to-end on mobile. | P2 | S (~45 min) | mobile | executor | `apps/mobile/.maestro/flows/tracker-favourites.yaml`: launch → login → Today → open Quick add → tap Favourites empty state copy visible → switch to Recent → tap star on a row → switch to Favourites → assert row visible. |
| F5 | Maestro E2E — Copy meal to another day | No E2E for the long-press → Copy flow. | P2 | S (~45 min) | mobile | executor | `apps/mobile/.maestro/flows/tracker-copy-meal.yaml`: long-press logged meal → tap "Copy to another day" → pick tomorrow → back to Today → swipe to tomorrow → assert meal present. |
| F6 | Eat-again clock-rollback edge | Dismiss key is today's local date. Clock rollback (travel, device wobble) could resurrect dismissed banner on the same real-world day. | P2 | XS (~20 min) | both | executor | Unit test: set dismiss key to future date, rollback system time, assert banner stays hidden on same real-world day. Or document as known acceptable behaviour. **DONE 2026-04-18 (audit L4):** new shared helper `src/lib/nutrition/eatAgainDismiss.ts` stores `{ dateKey, dismissedAt }` under v2 key `"suppr-eat-again-dismissed-v2"`. `shouldShowEatAgain(stored, now)` hides the banner when `dateKey === today` OR `|now - dismissedAt| < 12h` (belt-and-braces rollback window). v1 → v2 migration (`migrateLegacyDismiss`) lifts the pre-L4 bare-dateKey blob forward so existing dismisses aren't lost. Web (localStorage in `NutritionTracker.tsx`) + mobile (AsyncStorage in `app/(tabs)/index.tsx`) both consume the shared helper; mobile also performs an opportunistic v1 → v2 background migration write on first read. 27 vitest cases in `tests/unit/eatAgainDismiss.test.ts`. |
| F7 | Slot-name case robustness | `computeEatAgainForSlot` has case-insensitive slot match tested. Verify the production code path (`currentSlotFromTime` result) actually uses the same casing. | P2 | XS | both | executor | Grep the codebase for slot literals, confirm they're consistent, add a lint rule or a single constant `MealSlotName` if not. **DONE 2026-04-18 (audit L5):** new shared helper `src/lib/nutrition/mealSlots.ts` exports `MEAL_SLOTS` + `MealSlot` + `isMealSlot(s)` + `normaliseMealSlot(raw)` (case-insensitive, trims whitespace, maps legacy `"Snack"` → canonical `"Snacks"`). Comparison sites swept: `computeEatAgainForSlot` in `foodHistory.ts`; `normaliseSlot` in `savedMeals.ts`; save-combo slot guards in `NutritionTracker.tsx` (web) + `(tabs)/index.tsx` (mobile); `swapMeal` slot-ratio branch + recipe-fit filter in mobile `planner.tsx`; `journalSlotFromMealTypes` in mobile `recipe/[id].tsx`. UI rendering literals left untouched per spec. 11 vitest cases in `tests/unit/mealSlots.test.ts`. |
| F8 | Bulk insert fast path for Duplicate day range | Current web path inserts each row individually; a 7-day duplicate with 4 meals is 28 sequential inserts. Works but not optimal at scale. | P2 | S | web | code-quality | Single `nutrition_entries` bulk insert in `addLoggedMealForDate` — accept an array. Mobile can follow. Add telemetry on batch size. |

### P3

| ID | Title | Description | Severity | Effort | Platforms | Owner | Acceptance criteria |
|----|-------|-------------|----------|--------|-----------|-------|---------------------|
| F9 | Analytics schema registration | `meal_copied` / `day_duplicated` fire with `{ source, batchSize, targetDayCount }` but no PostHog dashboard / funnel exists. `food_logged.source=quick_add` likewise. | P3 | S (once specced) | analytics | analytics-engineer | Product-lead signs off event schemas; analytics-engineer adds PostHog dashboards for Quick add usage funnel, Copy/Duplicate adoption rate, Eat again dismissal rate. |

---

## 10. Open cross-cutting post-ship items (2026-04-18)

Surfaced from the post-feature-expansion audit + the three user-decision items (M1 / M2 / L6). Kept persistently here so they survive session boundaries.

| ID | Title | Status | Owner | Notes |
|----|-------|--------|-------|-------|
| PS#2 | **PostHog dashboard build** — needs PostHog admin access | **OPEN (user action)** | analytics-engineer + product-lead | All ~30 April-sprint events fire with canonical properties (L6 G1–G9 shipped) and the 8-rename dual-emit cycle is in flight (PS#1, retire 2026-05-18). Nobody is watching the events. Full spec at [`docs/planning/analytics-dashboards-plan-2026-04-18.md`](./analytics-dashboards-plan-2026-04-18.md) covers **6 dashboards** (Core Logging Health / Quick Add & Habits / Activation & Retention / Recipes & Cooking / Planner & Plans / AI Pro & Monetisation), **3 funnels** (activation, AI-Pro conversion, habit loop), **11 stop-firing alerts**. Hand the plan to whoever owns PostHog. Blocker: no code change — PostHog UI configuration. |
| PS#6 | **iOS Widget native extension (Xcode)** | **DEFERRED post-launch (user decision 2026-04-18)** | integration-manager + iOS developer | User explicitly scoped widgets out of launch. `apps/mobile/lib/widgetSnapshot.ts` writes `{ kcalConsumed, kcalTarget, proteinLeftG, carbsLeftG, fatLeftG, fastActive, fastStartsAt, fastTargetHours }` JSON to an App Group-accessible path on every totals / fast change (debounced 500 ms, `widget_snapshot_updated` event with `trigger`). When the track is reopened, add a WidgetKit extension target to the Xcode project that reads the JSON via the App Group and renders the calorie ring + remaining macros. **Do not re-raise widget scope until the post-launch widget track is opened.** |

**Calendar reminder:** 2026-05-18 — close the 30-day dual-emit cycle from PS#1. Grep `RENAME-CYCLE-RETIRE-2026-05-18` in `src/lib/analytics/events.ts` for the full retirement checklist.
