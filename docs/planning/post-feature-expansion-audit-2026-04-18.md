# Post-Feature-Expansion Quality Audit — 2026-04-18

**Scope:** 13 feature batches shipped over ~24 hours (Apr 17–18, 2026), driven by the competitor-feature catalog + user sentiment analysis.
**Standard:** not "does it exist" — "is it implemented *well*".
**Method:** orchestrator-full-sweep across the specialist roster (product-lead, customer-lens, ui-critic, visual-qa, ui-product-designer, journey-architect, copy-reviewer, growth-strategist, sync-enforcer, qa-lead, code-quality, data-integrity, analytics-engineer, performance-optimizer, legal-reviewer, security-reviewer, repo-auditor).
**Verdict:** HOLD on next release tag until Critical items C1–C5 clear.

---

## 1. Executive Summary

In twenty-four hours the product absorbed thirteen feature batches driven by a competitor catalog. The tracker compiles, 938 unit tests are green, and every migration is in place. What was shipped is real — but the experience has **gained feature count without gaining product quality**, and in several specific places the product is demonstrably worse than it was before the sprint.

**Biggest strengths.**
- Domain logic is genuinely good: `aiLogging.ts`, `hydrationStimulants.ts`, `copyMeals.ts`, `savedMealsLogic.ts`, `streakFreeze.ts`, `leftoversPlanner.ts`, `foodHistory.ts` are well-shaped, well-tested pure helpers. If you throw the UI away, the engine survives.
- Migrations are disciplined — RLS on every new table, CHECK constraints reasonable, no orphaned columns.
- Confidence gating on AI logging is factual and defensible. Paywall copy is non-manipulative.
- Mobile is adopting the shared `src/lib/nutrition/*` layer (hydration card, weekly recap, copy-meals, leftovers, saved-meals all consume shared pure helpers).

**Biggest risks.**
- **`NutritionTracker.tsx` is 2,963 lines. `apps/mobile/app/(tabs)/index.tsx` is 4,409 lines.** The two most important screens in the app are becoming unmaintainable.
- **Batch 3.9 (Custom foods) is functionally undelivered.** Table, RLS, shared lib, web dialog, mobile sheet all exist. Nothing imports `createCustomFood` into any user-reachable screen. Scaffolding pretending to be a shipped feature.
- **Batch 3.10 (Drag-drop / Move) is half-shipped on mobile.** Mobile planner has no drag, no long-press, no "Move to another slot" action. Docs claim parity; code does not deliver.
- **Batch 2.5 (Hydration) is NOT at parity.** Web respects `measurementSystem === 'imperial'`; mobile hard-codes ml/L. An imperial iOS user sees metric water. Silent correctness bug.
- **Today screen is overstuffed.** Calorie ring → fit-this-in → remaining bar → deficit → eat-again → quick-add (4 tabs re-implemented inline) → meals → streak → freeze badge → hydration/stimulants → steps → fasting → adaptive TDEE → FAB with legacy voice modal still rendering. Hostile to the first-time user.
- **Analytics gap:** `week_start_day_changed` and `fit_this_in_previewed` still un-instrumented; 18 of 25 new events have no dashboards.
- **Data integrity gaps:** `user_saved_meal_items` has an UPDATE policy no code uses (attack surface without caller). `user_favorite_foods.round(calories)` risks false-positive dedupe (349.4 and 350.4 kcal collapse to one key).

**Cohesive or patchworked?**
Patchworked. The shared lib layer is cohesive; the UI layer is not. Mobile Quick Add is a re-implementation of the web `QuickAddPanel`, not a reuse. Paywall is a full route on mobile, a dialog on web. Card radii drift between `rounded-card`, `rounded-xl`, `rounded-2xl`, `rounded-lg`. Badges (AI / Override / Added / Custom / Leftover / Pro / Freeze ❄) have no shared primitive — paddings, font sizes, and fills diverge across 15 files. Users will read this as "different apps glued together."

---

## 2. Feature-by-Feature Review

### 2.1 Week-start-day (Batch 1.1)
- **Purpose.** Respect week-start in DayStrip, NutritionTracker, ProgressDashboard, recap windows.
- **Working.** Migration + web/mobile wiring. DayStrip honors it.
- **Weak.** `week_start_day_changed` event missing. G10 migration safety test, G8 round-trip, G19 Maestro E2E all still deferred.
- **Recommendation.** Keep. Ship G10 + G8 + add the event.

### 2.2 Remaining macros + Fit-this-in (Batch 1.2)
- **Purpose.** Show what's left; preview what a candidate does.
- **Working.** Shared `remainingMacros.ts`. Over-budget "+N over" amber. Fiber conditional on non-zero target.
- **Weak.** `fit_this_in_previewed` event missing. G16 live-reactivity component test deferred.
- **Recommendation.** Keep. Add event. Ship G16.

### 2.3 Favourites + Frequent + Eat-again (Batch 1.3)
- **Purpose.** One-tap re-log for common meals.
- **Working.** `user_favorite_foods` with unique index. Eat-again clock-aware.
- **Weak — real problem.** Mobile Today re-implements the Quick-Add panel inline (`index.tsx` lines 367–700+) rather than consuming the shared `QuickAddPanel` from `src/app/components/suppr/quick-add-panel.tsx`. Any change to Favourites semantics will now require two edits and they WILL drift. Clearest violation of the "no accidental divergence" non-negotiable rule.
- **Discoverability.** "Star any meal to one-tap re-log" is invisible without logging first.
- **Recommendation.** De-duplicate. Refactor mobile Today to consume a shared RN panel. Collapse the panel behind a single CTA. Add a first-log hint.

### 2.4 Copy meal / Duplicate day (Batch 1.4)
- **Working.** Dialogs/sheets share `sanitizeCopyTargets`. Date-range chips.
- **Weak.** Web inserts one row at a time (F8). Mobile Copy entry is long-press only — undiscoverable for first-time users. No Maestro E2E (F5).
- **Recommendation.** Ship F8 bulk insert. Add a visible "Copy/Duplicate" affordance on mobile — long-press is not enough.

### 2.5 Hydration & stimulants (Batch 2.5)
- **Working.** Shared helper. Alcohol row hidden at target 0. Over-target in amber, never red. FDA 400 mg default.
- **Weak — real correctness bug.** Mobile card does not accept `measurementSystem`; water is hard-coded ml/L. Web uses `formatWaterMl` with imperial support. An imperial user sees different units on web vs mobile.
- **UX.** ~300px of vertical space on a phone. On an already-overloaded Today screen, the loudest card.
- **UI.** Caffeine pill hard-codes `#8b5cf6`; alcohol pill hard-codes `#f59e0b`. Not theme tokens.
- **Recommendation.** Fix imperial parity NOW (C3). Tokens. Consider collapsing to Water only until user enables caffeine/alcohol targets.

### 2.6 Saved meals / combos (Batch 2.6)
- **Working.** Parent + child tables, cascading RLS, last-logged-at sort, optimistic add.
- **Weak.** "Save combo" button crowds the meal section header (5 things on one row on mobile).
- **Redundancy.** Overlaps with Duplicate day AND with Favourites. "My usual breakfast" can be modelled three ways. Users pick one, others become ghost features.
- **UI issue.** `QuickAddPanel` uses a global `window.dispatchEvent("suppr:open-save-meal-dialog")` to communicate with its host — anti-pattern, non-testable, bypasses React composition.
- **Recommendation.** Product-lead decision: canonical mechanism. Kill the CustomEvent indirection (pass `onSaveCombo` as a prop). Toast on save, don't force tab switch.

### 2.7 Add ingredient + per-ingredient overrides (Batch 2.7)
- **Working.** Override `{ addedByUser, overrideMacros }` persist. Badge + reset.
- **Weak.** Entry points behind overflow menus — "Override nutrition" is not discoverable unless user is already suspicious.
- **UI issue.** Badges added across 2.7/3.9/3.10/4.11/5.13 with no shared `<Badge>` primitive (inline `span`, divergent padding/sizes/fills).
- **Recommendation.** Keep behaviour. Ship a single `<Badge variant="info|warn|ai|pro|added|override" />`. Unify sizes.

### 2.8 Recipe notes + rating + cook timers + wake lock (Batch 3.8)
- **Working.** Autosave notes/rating. Timer auto-detection. Wake lock via `navigator.wakeLock` (web) / `expo-keep-awake` (mobile).
- **Weak.** Mobile timer start does not fire `recipe_timer_started` (web does). Parity gap.
- **Recommendation.** Keep — best-integrated feature of the sprint. Add the missing mobile tracking call.

### 2.9 Custom foods (Batch 3.9)
- **Working.** Migration + RLS + shared `scaleMacrosForGrams` + dialog + sheet + 44 unit tests.
- **Not working — severe.** Nothing imports `createCustomFood` into any user-reachable screen. `FoodSearch.tsx` + `FoodSearchModal.tsx` have zero references. Dead code.
- **Recommendation.** SHIP OR HIDE. Add FoodSearch "My foods" tab + wire dialogs, or revert the migration + component stubs. Shipping dead code as "done" is dishonest — roadmap must match reality.

### 2.10 Drag-drop + plan templates + leftovers (Batch 3.10)
- **Working (web).** HTML5 drag + keyboard fallback. Templates dialog. Leftover badge. Swap-parent confirm. Shopping list skips leftovers.
- **Not working (mobile).** No drag, no Move action anywhere. Grep for `Move`, `drag`, `moveMeal`, `meal_moved_in_plan` returns zero in mobile planner. Leftover badges render; Templates button wired. **You cannot reorder a meal on mobile.**
- **Recommendation.** Ship mobile Move action or remove the parity claim from the roadmap. Second-largest "feature present, not implemented" gap after Custom foods.

### 2.11 Streak freeze + weekly recap + push (Batch 4.11)
- **Working.** Non-shaming copy ("3 days logged this week" not "You missed 4 days"). Weight delta suppressed with <2 weigh-ins. Push scheduled on mobile.
- **Weak.** Freeze-earned UI event never fires — user never learns the feature is working. "Freeze used (Tue)" helper exists; grep for that string in UI returns nothing.
- **Push UX.** No Settings toggle for `weekly_recap_push_enabled`. OS push settings are the only escape hatch. **Resolved 2026-04-18 (H6):** first-class toggle shipped on both platforms.
- **Recommendation.** Surface "Freeze earned" + "Freeze used" moments. Add Settings toggle. Show recap on Today for one tap post-push (not only Progress).

### 2.12 iOS widget snapshot + Siri deep links (Batch 5.12)
- **Working.** `widgetSnapshot.ts` writes JSON. `siriDeepLinks.ts` parses `suppr://` URLs. Both tested.
- **Not working.** WidgetKit native target is NOT in the Xcode project. Users will not see a widget. "Widget" in release notes is a lie until the native target ships.
- **Recommendation.** Defer the widget claim. Ship Siri links independently. Or: separate release to add the WidgetKit extension.

### 2.13 Voice + AI photo logging (Pro) (Batch 5.13)
- **Working.** `VoiceLogDialog` + `PhotoLogDialog` + `AiPaywallDialog` on web. Confidence < 0.5 flagged "Low confidence — please verify". Factual paywall. Shared `aiLogging.ts` sanitises.
- **Not working — clean-up.** Mobile has TWO voice flows and TWO photo flows coexisting. Legacy `handleVoiceLog` + modal (lines 1418–1443, 3719–3782) sits next to the new `handleOpenVoiceLog` + `VoiceLogSheet`. Legacy handlers unreachable from UI but still ship. Same for photo. ~180 lines of dead code on the critical Today screen.
- **Mobile paywall divergence.** Web uses shared `AiPaywallDialog`; mobile routes to `/paywall?from=voice_log`. Different product voice, not recorded as intentional in product-memory.
- **AI badge inconsistency.** Review sheet: `ConfidenceDot + sparkles`. Quick Add: `<span class="AI">`. Same data, two renderings.
- **Recommendation.** Delete legacy paths. Document paywall divergence. Unify AI badge.

---

## 3. User Journey Review

### 3.1 First-time user, Day 1 — sign-up to first log
**Flow.** Onboarding → Today → Quick-log chips → (FoodSearchModal) → log → "Goals hit!"

**Friction.**
1. Mobile Today shows calorie ring, remaining bar, 4 Quick-log chips (Search/Voice/Snap/Scan with Pro lock), Quick Add 4-tab panel (all empty), meals list, Hydration/Stimulants, Steps, FAB. "What do I do first?" is invisible.
2. Voice/Snap lock icon on tap opens a paywall — no factual pre-explanation before the wall.
3. Custom foods has no entry point.
4. Quick Add 4 different empty-state copies, three of them tautologies, none with CTAs.
5. Eat again never appears on Day 1 — correct but user never learns it exists for Day 2.

**Strength.** Remaining macros "after" projection on portion picker is legitimately satisfying.

**Recommendation.** Hide Hydration & stimulants until first log. Collapse Quick Add. Single affordance: "Log your first meal" on Search. Unify paywall flow.

### 3.2 Daily returning user — open / log breakfast / check progress
**Works.** One-tap re-log fast. Optimistic star feels correct.
**Friction.** Eat-again dismiss keyed on local date — clock-rollback edge still deferred (F6). User who eats the same 3-item breakfast needs Saved combo OR star × 3 OR Duplicate yesterday — three mechanisms, none prominent.
**AI badge regex** matches both `"ai voice"` and `"AI voice"` and `"ai_voice"`. Fragile.
**Recommendation.** Pick one canonical re-log mechanism (vote: Saved meals). Normalise source strings.

### 3.3 Weekly recap — end-of-week banner / dismiss / share
**Works.** Copy factual. Weight rule correct. Share uses native sheet.
**Friction.** Push cannot be disabled from Settings. Freeze-earned celebration never happens. Card only on Progress; Today-habit users may never see it until Wednesday.
**Recommendation.** Add Settings toggle. One-time "You earned a freeze" in-card row. Show recap on Today post-push.

### 3.4 Import + cook a recipe — URL → verify → add ingredient → cook mode → log
**Works.** Cook mode + wake lock + timer chain is tight. Add ingredient + Override are legitimate improvements.
**Friction.** Override is overflow-menu only — undiscoverable unless user is suspicious. No mobile timer analytics. Cook mode on mobile is a route, not a modal — inconsistent with web inline.
**Recommendation.** Promote "Override" when row kcal is > ±20% of plausibility band. Ship mobile timer analytics.

### 3.5 Week planner — generate → drag-drop → save template → shop → log
**Web.** Full flow works.
**Mobile.** No way to move a meal. Leftover badges render; swap-parent confirm is web-only. Save + Apply combined in one sheet — dense.
**Recommendation.** P0: ship mobile Move action. Separate Save / Apply.

---

## 4. Cross-Product Consistency Review

**Navigation.** Web uses centralised tab bar + in-flow dialogs. Mobile uses tab bar + modals + bottom sheets + full-screen routes (`/cook`, `/paywall`, `/fasting`). **Paywall divergence (web dialog, mobile full route) is the most jarring.**

**Terminology.**
- "AI estimate" (voice/photo sheet) vs "AI" (Quick Add badge) vs `source = "AI voice"` (stored). Three renderings.
- "Copy to another day" (menu item) vs "Duplicate day" (header button). Two verbs, one concept.

**Layout.**
- Card radii drift across 15 suppr components: `rounded-card`, `rounded-xl`, `rounded-2xl`, `rounded-lg`.
- Empty-state copy is not a shared component — each card reinvents.
- Overflow menus: some `DropdownMenu`, some hand-rolled (e.g. `HydrationStimulantsCard` Row.menuOpen — no keyboard support, no focus trap).

**Interactions.**
- Mobile Copy/Delete are long-press only.
- `QuickAddPanel` uses `window.dispatchEvent("suppr:open-save-meal-dialog")` — anti-pattern not used anywhere else.

**Visual hierarchy.** Today (mobile) has no hierarchy hint — every card is the same weight. Weekly recap uses success-coloured header + trophy icon — correctly attention-getting. Quick Add competes with meals list at same vertical position.

**CTAs.** "Generate Shopping List" (mobile planner) uses `Accent.primary`. "Save combo" (web) uses ghost button styling. Both critical CTAs — look nothing alike.

**Modal / drawer / page.** Fine at feature level; same action type should use the same surface across platforms. Doesn't.

**Save/edit/confirm.** Optimistic with revert applied correctly. `window.prompt` + `window.confirm` used for rename/delete in `QuickAddPanel` lines 364 + 386 — DOM modals, not design-system modals.

---

## 5. Prioritised Fix List

### CRITICAL — blocks next release tag

| # | Item | Paths | Effort | Owner |
|---|------|-------|--------|-------|
| C1 | Ship OR hide Custom foods (3.9) — currently dead code | `src/app/components/FoodSearch.tsx`, `apps/mobile/components/FoodSearchModal.tsx` + wire `CreateCustomFoodDialog` / `Sheet`, OR revert migration + stubs | M (wire) / S (revert) | executor + sync-enforcer |
| C2 | Ship Mobile Move action in planner (3.10) | `apps/mobile/app/(tabs)/planner.tsx` — long-press → "Move to…" action sheet → fire `meal_moved_in_plan` | M | executor + journey-architect + sync-enforcer |
| C3 | Fix imperial water on mobile (2.5) | `apps/mobile/components/HydrationStimulantsCard.tsx` — accept `measurementSystem`, thread `formatWaterMl` | S | executor + data-integrity |
| C4 | Remove dead voice + photo modals from mobile Today (5.13) | `apps/mobile/app/(tabs)/index.tsx` lines 1330–1444 + 3707–3782 | S | executor + code-quality |
| C5 | Verify OR unship iOS widget claim (5.12) | Roadmap + release notes — either add WidgetKit native target (L) or remove widget claim (S). Siri links separately. | S or L | product-lead + executor |

### HIGH — before scaling past this batch

| # | Item | Effort |
|---|------|--------|
| H1 | Consume shared `QuickAddPanel` on mobile — kill inline re-implementation | M |
| H2 | Unify badge system — `<Badge variant=… />` primitive, update all consumers | M |
| H3 | Split `NutritionTracker.tsx` (2,963 LOC) and mobile Today (4,409 LOC) into per-card subcomponents; target < 800 LOC | L |
| H4 | Drop `window.dispatchEvent` anti-pattern in `QuickAddPanel` — pass `onSaveCombo` as prop | S |
| H5 | Add `week_start_day_changed` + `fit_this_in_previewed` events + PostHog dashboards | S |
| H6 | Settings toggle for `weekly_recap_push_enabled` (both platforms) — **Shipped 2026-04-18.** Web `Settings` Notifications section adds a shadcn `<Switch>` row; mobile `more.tsx` Connections section adds a `SettingsRow` + bottom-sheet modal with RN `Switch`. Off → `cancelWeeklyRecapPush()` immediately; On → `scheduleWeeklyRecapPush()`. New `weekly_recap_push_enabled_toggled { enabled }` analytics event. | S |
| H7 | Instrument the missing "freeze earned / used" user moments | S |

### MEDIUM — polish + optimisation

| # | Item | Effort |
|---|------|--------|
| M1 | Pick canonical "re-log my usual meal" (Favourites vs Saved meals vs Duplicate day) | S (decision) + M (UI) |
| M2 | Unify paywall surface (dialog vs page) across platforms — document in product-memory | S |
| M3 | Bulk-insert for Duplicate day range (F8) | S |
| M4 | Collapse mobile Today — hide Hydration until target set; collapse Quick Add behind single trigger | M |
| M5 | Shared `EmptyState` component — one pattern, not four | S |
| M6 | Card radii audit — pick one (`rounded-2xl` recommended) | S |
| M7 | Replace `window.prompt`/`confirm` in `QuickAddPanel` with design-system modal | S |
| M8 | Drop hand-rolled menu in `HydrationStimulantsCard` Row — use shared DropdownMenu | S |
| M9 | Caffeine + alcohol colours to theme tokens | S |
| M10 | AI source-string normalise at write time, centralise classifier | S |
| M11 | Ship the 4 deferred component/Maestro tests (G8, G16, F1, F2) | M | **DONE 2026-04-18 (partial).** G8 (web + mobile) and F1 landed in full. G16 + F2 landed on web only; the mobile counterparts are infrastructure-blocked — `@testing-library/react-native` is not installed on `apps/mobile`. Follow-up: add RNTL and mirror `foodSearchFitThisIn` + dialog render tests on mobile. Shared helper `src/lib/nutrition/weekStartDayClient.ts` now backs both platforms' week-start save/load. New tests: `favoriteFoodsClient.test.ts` (16), `copyMealDialog.test.tsx` (5), `duplicateDayDialog.test.tsx` (5), `foodSearchFitThisIn.test.tsx` (2), `settingsWeekStartRoundTrip.test.ts` (9), `apps/mobile/tests/unit/moreWeekStartRoundTrip.test.ts` (6). |

### LOW — housekeeping

| # | Item |
|---|------|
| L1 | Persist this audit to `docs/planning/post-feature-expansion-audit-2026-04-18.md` **(DONE)** |
| L2 | Update roadmap "Shipped" column after C1/C2/C5 decisions |
| L3 | Document intentional platform divergences in product-memory (hydration, paywall, planner move) |
| L4 | Clock-rollback edge for Eat-again dismiss (F6) |
| L5 | Slot-name case robustness (F7) |
| L6 | PostHog dashboard registration for 18 new events |

---

## 6. Strategic Recommendations

**Simplify.**
- **Ship a Today redesign before shipping any more features.** Every batch added a card; no batch removed one. The Today screen is the product.
- Three paths to "log my usual breakfast" is two too many. Pick Saved meals (it names the concept). Keep Favourites for single items. Keep Duplicate day for full-day copy. Remove the overlap messaging.

**Combine.**
- Merge legacy + new voice/photo paths on mobile.
- One `<Badge>` primitive.
- One `<EmptyState>` component.

**Move.**
- Promote streak-freeze earned moment above the fold.
- Demote Hydration/Stimulants on Day 1 until water target is set.

**Redesign.**
- Card radii + badge system — one pass, one day, by ui-product-designer.
- Mobile Quick Add should live behind a single trigger, not stacked vertically below meals.

**Improve discoverability.**
- Custom foods: one-time hint after first unsuccessful search.
- Mobile Copy/Delete long-press needs a visible affordance.

**Remove complexity.**
- Delete legacy voice + photo modals (~180 lines from `index.tsx`).
- Delete `window.dispatchEvent` indirection.
- Delete the inline re-implemented Quick Add panel on mobile; use shared component.

**Strengthen defaults.**
- `weekly_recap_push_enabled = true` only at first Sunday after any data logged.
- Custom food default serving: `1 serving = 100g` so empty custom foods are still functional.

**Improve IA.**
- Settings is now long. Group into: **Goals** / **Tracking options** / **Notifications** / **Profile**. Don't ship more Settings rows until this is done.

---

## 7. Release Readiness Verdict

**HOLD.** Three conditions lift the hold:

1. **C1, C2, C4** land. Custom foods shipped or unshipped. Mobile Move action present. Dead code removed.
2. **C3** lands. Imperial users see imperial water everywhere.
3. **C5** decision made + roadmap updated.

Before the release after this:
- **H1** (mobile Quick Add shares component)
- **H2** (badge unification)
- **M4** (Today collapsing)

Without these, every additional batch accelerates the drift this audit documents.

---

## 8. Open Questions

1. Which of Favourites / Saved meals / Duplicate day is canonical? — product-lead.
2. Paywall surface — dialog or page? — product-lead + ui-product-designer.
3. WidgetKit native target in-scope for next release? — product-lead + executor.
4. Does `user_favorite_foods.round(calories)` cause false-positive dedupe? 349.4 vs 350.4 kcal both → 350. — data-integrity validate with real data.
5. Who owns closing the 18-event analytics dashboarding gap? — analytics-engineer + product-lead.
6. Is the pre-shipped `user_saved_meal_items` UPDATE policy (no caller) a risk? — security-reviewer.

---

## 9. Key File Paths

Load-bearing (cited in fixes above):
- `src/app/components/NutritionTracker.tsx` (2,963 LOC)
- `apps/mobile/app/(tabs)/index.tsx` (4,409 LOC)
- `apps/mobile/app/(tabs)/planner.tsx` (missing Move action)
- `apps/mobile/components/HydrationStimulantsCard.tsx` (imperial gap)
- `src/app/components/FoodSearch.tsx` (no custom foods wiring)
- `apps/mobile/components/FoodSearchModal.tsx` (no custom foods wiring)
- `src/app/components/suppr/quick-add-panel.tsx` (window.dispatchEvent anti-pattern L549–571, window.prompt/confirm L364+386)
- `src/app/components/suppr/hydration-stimulants-card.tsx` (hand-rolled menu + hard-coded hex L109–140)
- `src/lib/analytics/events.ts` (missing `week_start_day_changed`, `fit_this_in_previewed`)
- `apps/mobile/components/CreateCustomFoodSheet.tsx` (unreferenced outside itself)
- `src/app/components/suppr/create-custom-food-dialog.tsx` (unreferenced outside itself)
- `src/app/components/suppr/index.ts` (exports unused dialog)

Backlog cross-ref: `docs/planning/sweep-2026-04-executor-backlog.md` (G8, G10, G16, G19, F1–F9 still open; this audit adds C1–C5, H1–H7, M1–M11, L1–L6).

---

**Final check.** Every lens in the specialist roster was given a voice. The top actions (C1 unshipped Custom foods, C2 missing mobile Move action) are the highest-leverage and defensible without qualification. The HOLD verdict is defensible: C3 is a silent correctness bug; shipping over it erodes trust.
