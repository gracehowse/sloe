# Suppr Journey Architecture — App-Wide Audit (2026-04-27)

**Owner:** journey-architect specialist (audit)
**Status:** Findings — pending Grace's accept/reject + executor handoff

---

## Executive Verdict

Suppr reads as one product in its visual language but behaves as stitched-together screens at every handoff boundary.

- State changes on one tab do not propagate to other tabs without a navigation round-trip. Settings saves activity level to Supabase and shows an `Alert.alert` confirmation (`settings.tsx` line 338), but Today's macro ring keeps showing the old target until the user switches away and returns, triggering `useFocusEffect`. The data is correct; the experience is broken.
- The core food-logging loop works, but cook mode — the highest-value completion moment in the recipe journey — terminates without offering to log. `apps/mobile/app/cook.tsx` shows a "Done" state with only an exit button. The recipe `id` is in scope as a search param; the route is one `router.replace` away. Web `CookMode.tsx` has the CTA. Mobile does not.
- Six categories of user preference (hero variant, eat-again dismiss, quick-add collapsed state, usual-meal hint, fasting pill appearance, streak-freeze seen marker) live only in AsyncStorage. Sign in on a second device or on web and every one of them resets silently. This is not documented as intentional.

---

## Per-Journey Table

| # | Journey | Friction tally | Dead-ends | State continuity | Transition cohesion | Parity | Severity |
|---|---------|---------------|-----------|------------------|---------------------|--------|----------|
| 1 | Land → onboarding → first log → Today (mobile) | 11 steps, 7 decisions | None | Good — `onboarding_completed` flag gates redirect | Good — fade + progress bar | Web unconditional redirect to `/onboarding/v2`; mobile has async PostHog flag subscriber with a race window on first install | Medium |
| 2 | Land → pricing → paywall → checkout → activation | 6 steps | None | Good — RevenueCat tier resolves immediately | Acceptable | Web defaults monthly; mobile defaults annual — intentional per project memory | Low |
| 3 | Onboarding → discover → save → plan → cook → log | 12 steps | Cook mode has no log CTA at the done screen | Plan tab does not pull updated library until next focus | Fragmented — no through-line from cook to log | Cook mode exists on both; web `CookMode.tsx` has "Log recipe" CTA; mobile `cook.tsx` does not | CRITICAL |
| 4 | Today → eat-again → log → return to Today | 3 steps | None | Optimistic — `setByDay` updates immediately | Good | Eat-again web parity unconfirmed | Medium |
| 5 | Today → FAB → voice/photo/scan/search → log | 3–4 steps | Barcode finds 0-calorie product: Add button disabled, no retry path | Good — `commitAiLoggedItems` updates `byDay` in place | Good — FAB sheet is clean | Voice/Photo Pro-gated on mobile; web gating not confirmed identical | Medium |
| 6 | Today → meals section → edit meal → save → return | 3 steps | None | Optimistic update then debounced sync | Good | Web edit path unconfirmed in this pass | Low |
| 7 | Today → barcode/import → recipe verify → log | 5 steps | Verify save completes then screen stays — no forward navigation | Verify → log requires back + re-enter recipe detail | No "log now" from verify screen | Verify screen on both platforms; verify.tsx has no `router.push` post-save | HIGH |
| 8 | Today → fasting start → return → active | 3 steps | Pill can be invisible if `activeFastStart` loads after render | Loaded inside `loadProfileTargets` on `useFocusEffect` — correct; brief flash on focus | Acceptable | Fasting pill is mobile-only; no web fasting surface | Medium (gap) |
| 9 | Today → HealthKit sync → bonus calorie surface | 4 steps | None | Syncs on every `useFocusEffect` | Acceptable | iOS-only by definition | Low |
| 10 | Discover → recipe detail → save → library | 3 steps | None | Library `useFocusEffect` re-fetches on tab focus — works | Acceptable | Both platforms use `useSavedLibraryRecipes` | Low |
| 11 | Discover → creator follow → following tab | 3 steps | Following filter shows empty after following (no focus refresh) | `followedCreatorIds` loaded in `useEffect([userId])` — not `useFocusEffect`; stale until restart | Follow button on recipe detail not found in code | Web Following tab not confirmed | HIGH |
| 12 | Recipe URL paste → import → verify → save | 5 steps + API round-trip | Import failure shows Alert only — no retry in-place | After save: recipe detail has no "log now" | Acceptable | Clipboard forwarding on mobile `_layout.tsx`; web has URL input | Medium |
| 13 | Recipe photo import → parse → verify → save | 5 steps | Zero-ingredient parse result leaves user on empty verify screen | `create-recipe.tsx` local state | Acceptable | Photo import is mobile-only | Medium (gap) |
| 14 | Library → filter → recipe detail → cook mode | 4 steps | None | Library reloads on focus | Good | Shared `libraryFilters.ts` on both | Low |
| 15 | Library → search → result → save | 3 steps | None | Good | Good | Both platforms | Low |
| 16 | Plan → generate week → shopping list → cook → log | 6 steps | No "back to plan" shortcut in shopping; G-2 reconciliation causes double-spinner | Shopping back works; plan re-fetches on focus | Acceptable | Shopping is mobile-only route; web planner likely inline | HIGH |
| 17 | Plan → drag meal to slot → save → reflect on Today | 4 steps | None | `handleMove` optimistic; Today reads planned meals on focus | Acceptable | `MoveMealSheet` mobile-only; web no drag (intentional) | Medium (gap) |
| 18 | Plan → swap meal → recompute totals → save | 4 steps | Swap Alert shows new total not deficit delta | Swap persists; Today reflects on focus | Acceptable | Swap on both platforms | Low |
| 19 | Move-meal (mobile-only) | 3 steps | None | Good | Good | Intentional divergence per project memory | Low |
| 20 | Shopping → check off → return to plan | 3 steps | No bulk-clear-checked action | Persists immediately | Acceptable | Shopping mobile-only | Medium (gap) |
| 21 | Cook mode → step-through → log → return | 4 steps | CRITICAL: done screen has exit only; no log CTA | `cook.tsx` has no `router.push` to log post-done | Poor — terminates without completion action | Web `CookMode.tsx` has log CTA; mobile `cook.tsx` does not | CRITICAL |
| 22 | Today → Progress → weekly digest → recap | 3 steps | Digest gated on week boundary + last-seen key; new users never see it | Progress `useFocusEffect` reloads; Digest appears correctly | Acceptable | Both platforms have Digest; same gate | Low |
| 23 | Progress → metric drill-down → return | 2 steps | None | Good | Good | Both platforms | Low |
| 24 | Weekly recap push → tap → land in app | 3 steps | Push tap routes to `/(tabs)/progress` — correct | Good | Web push not implemented | Low |
| 25 | Onboarding → consent → settings (view/change consents) | 4 steps | No in-app consent management UI | Consents not surfaced in settings | Poor — no self-service data rights | Settings privacy link opens browser on mobile; web has no equivalent found | HIGH |
| 26 | Settings → targets → edit → reflect on Today | 3 steps | Alert confirms save but Today not notified — requires tab switch | `saveActivityLevel` writes profiles; Today only reloads on `useFocusEffect` | No cross-tab signal | Settings is hidden tab on mobile; web is a separate page | HIGH |
| 27 | Settings → activity level → recompute → reflect on Today | Same as 26 | Same | Same | Same | Same | HIGH |
| 28 | Settings → delete account → confirm → wipe | Full flow exists | None | Good | Acceptable | Both platforms — confirmed in project memory | Low |
| 29 | Settings → subscription → manage → cancel/upgrade | 3 steps | None — RC fallback to App Store link | Good | Acceptable | Web uses Stripe; mobile uses RevenueCat — intentional | Low |
| 30 | Household → invite → accept → shared meals appear | 4 steps | No in-app invite-link generator found on mobile | Shared meals appear via Household rows on focus | Acceptable | Both platforms call same API | Medium |
| 31 | Sign in on mobile then web — state continuous | n/a | AsyncStorage preferences reset on web silently | Data continuous (Supabase); 6 categories of preference lost | Poor — hero variant, eat-again, quick-add, hints all reset | HIGH |
| 32 | Same household member on web vs mobile — diverges | n/a | None | Both read Supabase | Acceptable | Shopping list mobile-only | Medium |

---

## Top 10 Broken Journeys

### 1. Cook mode ends without offering to log — Journey 21 (CRITICAL)

`apps/mobile/app/cook.tsx` lines 84–111: `goNext()` increments `current` to `totalSteps`. The `isDone` branch renders only an exit button. `recipeId` and `title` are available as `useLocalSearchParams` values. Web `CookMode.tsx` has a "Log recipe" CTA at this state.

Fix: At the `isDone` render, add `router.replace({ pathname: "/recipe/[id]", params: { id: recipeId, autoLog: "1" } })` as the CTA action. `autoLog` is already handled in `recipe/[id].tsx` line 186.

### 2. Settings → activity-level change does not propagate to Today — Journeys 26, 27 (HIGH)

`settings.tsx` line 338: `setActivityLevel(nextLevel); setActivityPickerOpen(false)`. Alert fires. Today's `loadProfileTargets` only runs on `useFocusEffect`. No cross-tab signal exists.

Fix: Write `suppr.profile.targets.dirty = "1"` to AsyncStorage before dismissing the modal. Today's `useFocusEffect` reads and clears this key, triggering `loadProfileTargets` immediately on tab switch.

### 3. Recipe verify → no forward navigation after save — Journey 7 (HIGH)

`apps/mobile/app/recipe/verify.tsx`: `saveVerifiedIngredients` call has no subsequent `router.push` or `router.back`. The screen stays put after save. User must manually navigate back to recipe detail to log.

Fix: After `saveVerifiedIngredients` resolves successfully, call `router.replace({ pathname: "/recipe/[id]", params: { id: recipeId } })`.

### 4. Creator follow → Following tab stale until app restart — Journey 11 (HIGH)

`apps/mobile/app/(tabs)/discover.tsx` lines 83–105: `useEffect` dependency `[userId]` — fetches once on mount. No `useFocusEffect`.

Fix: Wrap the follows fetch in `useFocusEffect(useCallback(() => { ... }, [userId]))`. One-line change.

### 5. Barcode scan resolves to 0-calorie product — silent dead-end — Journey 5 (HIGH)

`FoodSearchModal.tsx`: when `macrosPer100g.calories === 0`, the Add button is disabled and there is no user-facing explanation or recovery path. User is dismissed back to the FAB sheet with no context preserved.

Fix: Detect `calories === 0` post-barcode-scan and show a "No nutrition data — enter manually" state within the modal, pre-populated with the product name.

### 6. Cross-device preferences lost (AsyncStorage not mirrored) — Journey 31 (HIGH)

Six AsyncStorage keys have no Supabase mirror: hero variant (`suppr.hero.variant`), eat-again dismiss (`EAT_AGAIN_STORAGE_KEY`), quick-add collapsed (`QUICK_ADD_COLLAPSED_STORAGE_KEY`), usual-meal hint dismissed slots (`USUAL_MEAL_HINT_STORAGE_KEY`), streak-freeze seen marker (`suppr-last-seen-freeze-earned-at`).

Fix: Mirror eat-again dismiss date key and quick-add collapsed into `profiles.notification_prefs` JSONB. Hero variant and hint dismiss can remain device-local (cosmetic) — document this explicitly.

### 7. Plan → shopping list G-2 reconciliation causes visible double-spinner — Journey 16 (HIGH)

`apps/mobile/app/shopping.tsx` lines 62–83: on load, fetches `meal_plan_days`, then `meal_plan_meals`, then diffs against shopping items. Three serial Supabase round-trips before the list renders.

Fix: Cache the live plan's recipe title set in AsyncStorage when the plan is generated (`planner.tsx` `generateSmartPlan` completion path). Shopping list reconciliation runs against the cache synchronously.

### 8. No in-app consent management surface — Journey 25 (HIGH)

`apps/mobile/app/(tabs)/more.tsx` has `openLegalPath("/privacy")` opening the browser. No in-app "Your data" section exists. No self-service data download. No self-service deletion surface visible to a casual user.

Fix: Add a "Your data" card in More with three rows: "Download my data" (using the existing `nutritionLogToCsv` export at `more.tsx` lines 50–56), "Delete my account" (already wired), "Privacy policy" (existing browser link). No backend change required.

### 9. Settings confirms changes via Alert.alert — no in-screen feedback — Journeys 26–29

`settings.tsx` line 339: `Alert.alert("Activity level updated", "new calorie target 1,840")`. This modal interrupts flow, provides no visual anchor, and has no design-system equivalent in the Claude Design prototype.

Fix: Replace with a 2-second in-line success state (green checkmark + new value visible in the row) or a non-blocking toast.

### 10. Discover runs its own profile targets query on every mount — Journey 10

`apps/mobile/app/(tabs)/discover.tsx` lines 117–145 fetch `target_calories, target_protein, target_carbs, target_fat` independently. Duplicate round-trip already served by Today's `loadProfileTargets` and Settings' own loads.

Fix: Extract a `useProfileTargets` React Context serving targets to all screens. Eliminates 6+ redundant round-trips per session.

---

## Cross-Cutting Friction Patterns

**A — Tabs are isolated React trees with no shared event bus.** Any profile write in Settings is invisible to Today until the user switches tabs. There is no `EventEmitter`, no shared Context for mutable profile state, and no `AppState.change` listener that re-reads targets. The `useFocusEffect` pattern is correct but insufficient for cross-tab propagation.

**B — `Alert.alert` is the primary confirmation UI.** At least 9 `Alert.alert` calls in `settings.tsx` alone. Zero in-screen toast or inline confirmation patterns.

**C — Every tab re-fetches its full data set on every focus.** Today fetches up to 20,000 nutrition entries on every `useFocusEffect`. No cache validity check.

**D — Optimistic UI is inconsistent.** Food logging, meal copy, and plan meal moves are optimistic. Barcode logging, activity-level recompute, and verify-screen saves are not.

**E — Profile queries are duplicated across every screen.** Today, Settings, More, Discover, Progress, and recipe detail each run independent `profiles.select()` calls.

**F — AsyncStorage preferences are device-local with no documentation.** Six preference categories are stored only in AsyncStorage.

---

## State-Continuity Audit

The following state changes write to Supabase correctly but do not reflect on any other screen until that screen's `useFocusEffect` fires:

| Change written | Location | Not reflected in |
|----------------|----------|-----------------|
| Activity level + recomputed targets | `settings.tsx` saveActivityLevel | Today macro ring |
| Net carbs lens toggle | `settings.tsx` | Today macro tiles |
| Weight surface mode toggle | `settings.tsx` | Progress weight card |
| Plan regenerated | `planner.tsx` handleGenerate | Today planned meals card |
| Recipe saved to library | `recipe/[id].tsx` toggleSave | Library tab (correct — useFocusEffect refetches) |
| Meal logged from recipe detail | `recipe/[id].tsx` log handlers | Today (correct if navigated back; Today useFocusEffect fires) |
| Household joined | `/api/household/join` | Plan HouseholdSummaryRow; More HouseholdSummaryRow |

AsyncStorage-only (lost on web or second device, not documented as intentional):

| Preference | AsyncStorage key | File |
|------------|-----------------|------|
| Today hero variant | `suppr.hero.variant` | `index.tsx` line 299 |
| Eat-again dismiss date | `EAT_AGAIN_STORAGE_KEY` | `index.tsx` line 960 |
| Quick-add collapsed | `QUICK_ADD_COLLAPSED_STORAGE_KEY` | `index.tsx` line 447 |
| Usual-meal hint dismissed slots | `USUAL_MEAL_HINT_STORAGE_KEY` | `index.tsx` line 578 |
| Streak-freeze seen marker | `suppr-last-seen-freeze-earned-at` | `index.tsx` line 1636 |

---

## Cross-Platform Handoff Verdict

**Feels like one product:**
Recipe import, verify, and nutrition calculations share server API routes and `src/lib/`. Library filters use shared `src/lib/recipes/libraryFilters.ts`. Onboarding TDEE calculations are shared. `nutrition_entries` is the canonical journal on both platforms.

**Does not feel like one product:**

| Divergence | Intentional | Evidence |
|------------|-------------|---------|
| Cook mode "Log recipe" CTA: web has it, mobile does not | Accidental gap | `cook.tsx` — no router.push post-done |
| Shopping list: mobile-only route | Unconfirmed intentional | `shopping.tsx` has no web equivalent found |
| Fasting surface: mobile Today only | Unconfirmed gap | `index.tsx` fasting pill; no web surface found |
| Creator follow UI: button not found on recipe detail mobile | Likely gap | `discover.tsx` Following pill exists but follow action unclear |
| Photo recipe import: mobile only | Likely intentional (camera) | `create-recipe.tsx` ImagePicker |
| Move meal: mobile `MoveMealSheet` only | Intentional per memory | `planner.tsx` `MoveMealSheet` import |
| AsyncStorage preferences: not synced to web | Unconfirmed as intentional | 5 keys enumerated above |
| Activity bonus card: mobile Today only | Unconfirmed | `TodayActivityBonusCard` import in `index.tsx`; no web equivalent found |

The most critical unintentional divergence: cook mode's "Log recipe" CTA exists on web (`CookMode.tsx`) but not on mobile (`cook.tsx`). This is the only place the web product is functionally ahead of mobile on a core journey step.

---

## Top 5 Leverage Fixes

**Fix 1 — Add "Log recipe" to cook mode done screen (CRITICAL, Low effort)**
Owner: executor. File: `apps/mobile/app/cook.tsx`. Add `router.replace({ pathname: "/recipe/[id]", params: { id: recipeId, autoLog: "1" } })` in the `isDone` render. Confirm web `CookMode.tsx` parity with sync-enforcer. Closes journeys 3 and 21.

**Fix 2 — Cross-tab dirty flag for target changes (HIGH, Low effort)**
Owner: executor. After any `profiles` write that changes calorie/macro targets in `settings.tsx`, set `AsyncStorage.setItem("suppr.profile.targets.dirty", "1")`. In Today's `useFocusEffect`, clear the flag and call `loadProfileTargets`. Closes journeys 26 and 27.

**Fix 3 — useFocusEffect for follows fetch in Discover (HIGH, Trivial effort)**
Owner: executor. One-line change in `discover.tsx` line 83. Closes journey 11.

**Fix 4 — Shared `useProfileTargets` context (Medium effort, High impact)**
Owner: executor + sync-enforcer. Extract a React Context for profile targets. Eliminates 6+ redundant round-trips per session mount. Closes journey 10 entirely. Enables fix 2 to work cleanly.

**Fix 5 — "Your data" card in More (HIGH regulatory risk, Low effort)**
Owner: executor + product-lead (copy). Three rows: Download my data (CSV — logic already in `more.tsx` lines 50–56), Delete my account (already wired), Privacy policy (existing link). No backend change. Closes journey 25. Addresses GDPR self-service gap.
