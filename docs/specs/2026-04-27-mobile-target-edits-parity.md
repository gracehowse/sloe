# Spec: Mobile Target Edits — Parity with Web (#114)

**Date:** 2026-04-27
**Owner:** Journey-architect → Engineering hand-off
**Status:** Implementation-ready
**Scope:** Post-onboarding editing of daily calorie and macro targets on mobile, catch-up to web bar.
**Related:** Surfaced during B1 weekly fibre/hydration rollups review (`docs/specs/2026-04-27-b1-weekly-fiber-hydration-rollups.md`).

---

## Executive summary

1. **P0: Today ring stays stale after mobile target edit.** `apps/mobile/app/profile.tsx` saves to Supabase but never invalidates the in-memory target state used by the Today calorie ring. The user edits their target and sees no change until app restart. Web fixes this by calling `setNutritionTargets()` in `AppDataContext` immediately after save (`Profile.tsx:312`). Mobile must do the same — exact context API to use is an open question for engineering.

2. **P0 (partial): Zero-calorie input silently drops the `source='user'` provenance stamp on mobile.** If a user clears the calories field and saves, `Number(calories) || null` coerces to `null`, the `if (nextCalories != null)` block is skipped, and the DB retains the prior source value (`onboarding` or `recompute`). This means the 14-day Maintenance Recalibrate suppression (per `progress.md:251-253`) is unreliable. Fix: add a `canSave` guard matching web, and stamp provenance unconditionally when `canSave` passes.

3. **Mobile has a working 2-tap entry path; web's "Daily Targets" row is a broken dead-end.** More → "Daily targets" → `targets.tsx` → "Edit" → `profile.tsx` is a correct and working chain on mobile. On web, the "Daily Targets" settings row in `Profile.tsx` (line 497) has `cursor-pointer` styling and a chevron but no click handler — it does nothing. The web parity catch-up should include wiring `setActiveTab("targets")` to that row.

4. **Mobile edit form lacks validation and cancel/revert.** Web enforces `calories > 0` and all fields finite before enabling Save, and provides a Cancel button that reverts to prior values. Mobile has neither — any string input saves to the DB, and there is no undo. Add `canSave` logic and a Cancel → reset to loaded values pattern.

5. **B1 fields (fibre, hydration) are already present on both platforms.** `target_fiber_g` and `target_water_ml` are already in the mobile `profile.tsx` form and the web `Profile.tsx` form. No new fields are needed. The spec confirms this scope is complete; the open question is whether `target_water_ml` actually persists (the column existence needs confirmation per the note in `persist.ts`).

---

## 1. Current State Audit

### 1.1 Two-Column Comparison Table

| Question | Web | Mobile |
|---|---|---|
| **Where can a user edit calorie target?** | `Profile.tsx` — "Your Daily Targets" grid, inline edit mode toggled by "Edit Targets Manually" button. Reached via `/home?view=profile`, scroll to the "Macro Calculator" tab section. | `apps/mobile/app/profile.tsx` — dedicated form with `TextInput` fields. Reached from `More` tab → "Goals & targets" → "Daily targets" row → `targets.tsx` → "Edit" button. |
| **Where can a user edit macro targets (protein/carbs/fat)?** | Same `Profile.tsx` grid — all four macros are inline inputs in edit mode. | Same `profile.tsx` form — all four fields present. |
| **Fibre target** | `Profile.tsx` line 995–1007: `fiber` field in the targets grid. Also in `manualTargets`. | `profile.tsx` line 44: `fiber` state, line 298: `TextInput`. Present and functional. |
| **Hydration target (ml)** | `Profile.tsx` line 1008–1020: `waterMl` field. Writes `target_water_ml`. | `profile.tsx` line 45: `water` state, line 302: `TextInput`. Writes `target_water_ml`. |
| **Validation on edit** | `canSave` (line 257): all 6 fields must be `Number.isFinite` and `calories > 0`. Save button is disabled until valid. Inline inputs enforce numeric type. | No `canSave` guard. Any value accepted — `Number(protein) \|\| null` coerces empty string to null silently (line 205-212). Zero calories writes `null` with no error to the user. |
| **Manual edit sets `target_calories_source = 'user'`?** | Yes. `saveProfile()` (line 295-296) stamps `target_calories_source: "user"` and `target_calories_set_at` when `canSave` is true (which guards `calories > 0`). | Partially. `profile.tsx` line 217-219: stamps `target_calories_source: "user"` and `target_calories_set_at` only when `nextCalories != null`. BUT because there is no minimum-value guard, a user typing `0` coerces to `null`, skipping the stamp — the provenance is silently dropped. |
| **Manual edit pauses adaptive TDEE recompute?** | Yes, by effect. `target_calories_source = 'user'` with `set_at` within 14 days suppresses the Maintenance Recalibrate suggestion in the Digest (per `progress.md:251-253`). Adaptive TDEE (`computeAdaptiveTDEE`) still runs on food log writes — it updates `profiles.adaptive_tdee` — but the Digest does not surface a recalibration CTA for 14 days after a user-source write. | Same column is written when `nextCalories != null`, so semantically the same. Gap: the zero-coercion bug (above) can leave `source` as the prior value (`onboarding`/`recompute`) after a user attempts an edit, making the 14-day suppression unreliable. |
| **What confirmation / undo affordance exists?** | Cancel button reverts `manualTargets` to `displayTargets` and `activityAdjustPref` to prior value. `toast.success("Saved profile")` on success. Toast.error on failure. | `Alert.alert("Saved", "Your targets have been updated.")` on success. `Alert.alert("Error", "Couldn't save. Changes are kept locally.")` on failure. No cancel/revert affordance — once the user taps "Save Targets" there is no undo. |
| **Is the surface reachable in ≤2 taps from the home tab?** | No. Web requires: (1) tap "More" nav item → (2) no direct working tap — the "Daily Targets" row in the Settings section (`Profile.tsx` line 497) has NO `onClick` or `href` handler, it is styled `cursor-pointer` but does nothing. The user must manually scroll to the "Macro Calculator" tab at the bottom of the profile page. **3+ actions, the entry-point row is broken.** | Yes, from More tab. Tap "Daily targets" row (1) → `targets.tsx` read screen → tap "Edit" (2) → `profile.tsx` edit form. Two taps. But the edit form is titled "PROFILE" and mixes display name + dietary preferences with target editing — discoverability is weak. |
| **Does save update the Today ring in the same session?** | Yes. `setNutritionTargets(normalizeMacroTargets(manualTargets))` (line 312) updates `AppDataContext` immediately, which the Today ring reads. | No. `profile.tsx` calls `supabase.upsert()` and shows an Alert, but never updates any local context or state store. The Today ring only refreshes when the user returns to the tab via `useFocusEffect` on the More tab's `loadProfileData`. The Today tab itself has no focus-triggered re-read of targets — the ring shows stale values until app restart or a full cold-load. **P0.** |
| **`prefer_activity_adjusted_calories` updated on save?** | Yes. `Profile.tsx` line 300: `prefer_activity_adjusted_calories: activityAdjustPref` is part of the upsert. | No. `profile.tsx` does not touch `prefer_activity_adjusted_calories`. The toggle lives in `settings.tsx` (mobile) independently. The save path for targets does not accept or write this preference. |

### 1.2 Provenance Write Sites (per `progress.md:259`)

Documented write sites for `target_calories_source`:
- Mobile manual save: `apps/mobile/app/profile.tsx` (line 218-219) — present but gapped by zero-coercion bug.
- Web manual save: `src/app/components/Profile.tsx` (line 295-296) — correct.

---

## 2. Gap List

### P0 — Silent persistence or data integrity failures

**P0-1: Zero-coercion drops provenance stamp on mobile.**
`save()` in `profile.tsx` line 203: `const nextCalories = Number(calories) || null`. When the user types `0` or clears the field, `nextCalories` is `null`, the `if (nextCalories != null)` block (line 217) is skipped, and the previous `target_calories_source` value (`onboarding` or `recompute`) stays in the DB. The Maintenance Recalibrate 14-day suppression does not trigger. The user's intention to edit their targets is lost to provenance.
File: `apps/mobile/app/profile.tsx:203,217-219`

**P0-2: Today ring does not reflect target edits in the same session on mobile.**
`save()` never calls any local state update. The Today tab reads targets from `AppDataContext` / Supabase on initial mount, not on navigation. A user edits their calorie target, saves, returns to Today, and sees the old ring. This breaks the core "I changed my target, let me see how today looks" use case.
Files: `apps/mobile/app/profile.tsx:200-230`, `apps/mobile/app/(tabs)/index.tsx` (Today tab — does not refetch targets on focus).

### P1 — UI parity misses

**P1-1: No validation guard on mobile.**
Web has `canSave` preventing save with invalid values (`calories > 0`, all fields finite). Mobile accepts any numeric string including `0` and empty. A user clearing the calories field and tapping Save writes `null` to `target_calories` — the app then falls back to computed/default targets with no visible explanation.
File: `apps/mobile/app/profile.tsx:200-212` — no equivalent to `Profile.tsx:257-267`

**P1-2: No cancel/revert affordance on mobile.**
Web shows Cancel + Save side-by-side; Cancel restores the pre-edit values. Mobile shows one "Save Targets" button. Once the user taps, the change is irreversible from that screen (though they can re-edit manually).
File: `apps/mobile/app/profile.tsx:310-312`

**P1-3: Daily Targets row on web Profile.tsx is a dead-end.**
`Profile.tsx` line 497: the "Daily Targets" row inside the Settings card is styled as interactive (`cursor-pointer`, chevron icon) but has no `onClick` or `href`. It shows the current targets as a subtitle but tapping it does nothing. A user who taps expecting to edit is silently confused. The actual editor is at the bottom of the same page in the "Macro Calculator" tab.
File: `src/app/components/Profile.tsx:497-506`

**P1-4: Mobile profile screen is not titled as a target editor.**
`profile.tsx` displays "PROFILE" as the screen title (line 249) and leads with "Display Name" as the first editable field (line 268-275). A user navigating via "Daily targets → Edit" expects to land in a targets editor. Display name and dietary preferences are adjacent concerns; the combined form reduces target-edit discoverability.

**P1-5: `prefer_activity_adjusted_calories` not written during mobile target save.**
Web saves this preference alongside targets in a single upsert. Mobile's target save omits it. If a user edits targets on mobile and also wants to toggle activity adjustment, they must visit Settings separately.
File: `apps/mobile/app/profile.tsx:204` (missing key vs `Profile.tsx:300`)

### P2 — Polish / copy gaps

**P2-1: Mobile confirmation is a blocking Alert; web uses a non-blocking toast.**
`Alert.alert("Saved", ...)` pauses the user experience. Web's `toast.success("Saved profile")` is non-blocking and allows immediate continued navigation. Low severity but inconsistent with platform norms.

**P2-2: Mobile targets screen "Edit" button label is ambiguous.**
`targets.tsx` line 387: button label is "Edit" with accessibility label "Edit targets". It routes to `profile.tsx` which is a full-profile form. A label like "Edit targets" or "Change targets" is more accurate given the routing.

**P2-3: Mobile target form has no TDEE context / "why this number" caption.**
Web's `Profile.tsx` shows the BMR, TDEE, and "Using Mifflin-St Jeor equation" caption below the computed values before manual editing. Mobile `profile.tsx` shows a summary tile of current values but no formula context. Minor — but reduces trust in the defaults shown.

---

## 3. Target User Journey — Mobile

**Scenario:** User finishes onboarding, decides their calorie target is too aggressive, wants to lower it.

### Current journey (with friction marked)

1. Lands on Today tab. Sees ring tracking toward old target. [No in-context edit path from here]
2. Taps More tab (bottom nav). [1 tap]
3. Scrolls to "Goals & targets" section. [scroll — not immediately visible, below membership/household sections]
4. Taps "Daily targets" row. [2 taps total] Routes to `targets.tsx`.
5. Sees read-only screen: big calorie number, macro tiles, goal card. Taps "Edit" (top right). [3 taps total] Routes to `profile.tsx`.
6. Sees "PROFILE" header + display name field. Scrolls past it to the "Edit Targets" card. [scroll — friction: must scroll past display name]
7. Clears and re-types calories. Clears and re-types macros if needed.
8. Taps "Save Targets". [4 taps + typing]
9. Blocking Alert: "Saved. Your targets have been updated." Taps OK. [5 taps]
10. Taps back to More tab. Taps Today tab.
11. Today ring still shows old target. [P0-2 gap] User must kill and reopen app.

### Simplified journey (after this fix)

1. Taps More tab. [1 tap]
2. Taps "Daily targets" row → `targets.tsx`. [2 taps]
3. Taps "Edit targets" button → dedicated target edit sheet/screen. [3 taps]
4. Edits calorie (and optionally macro) fields. Validation runs inline.
5. Taps Save. Non-blocking confirmation. Context update fires immediately. [4 taps + typing]
6. Returns to Today tab. Ring reflects new target immediately.

**Time to value (current):** 5 taps + typing + blocking alert + app kill-reopen = ~90 seconds.
**Time to value (after fix):** 4 taps + typing + immediate ring update = ~30 seconds.

---

## 4. Recommended Mobile Surface

**Use `apps/mobile/app/profile.tsx` as the edit form, but scope it as the targets editor only.**

Rationale:
- `targets.tsx` already routes to `/profile` for editing. The routing chain is correct: More → Targets (read) → Edit → Profile (write).
- Creating a separate screen (`targets-edit.tsx` or similar) would duplicate the persistence logic and the `resolveTargets` load — unnecessary complexity.
- The fix is: (a) move display name and dietary preferences to a separate "Account" or "Profile details" screen reachable from a different entry point, OR (b) reorder the `profile.tsx` form so target fields come first and are clearly labelled as such, with display name/dietary as a collapsible secondary section.

Recommended: **option (b) reorder** — lower risk, preserves routing, no new screen needed. Title the screen "Edit Targets" not "PROFILE" when reached from `targets.tsx`.

The `targets.tsx` read screen is the right abstraction — keep it as the read layer, keep `/profile` as the write layer, and accept the two-tap chain as intentional (read surface → edit surface is a good pattern).

---

## 5. Edit Semantics — Pinned for Engineering

### 5.1 Fields

The editor must write all six fields below. This matches the web `Profile.tsx` `saveProfile()` call.

| Field | DB column | Type | Notes |
|---|---|---|---|
| Calories | `target_calories` | integer (kcal) | Required. Must be > 0 to write provenance stamp. |
| Protein | `target_protein` | integer (g) | Required. |
| Carbs | `target_carbs` | integer (g) | Required. |
| Fat | `target_fat` | integer (g) | Required. |
| Fibre | `target_fiber_g` | integer (g) | Required. Already in mobile form; "B1 adds" is satisfied. |
| Hydration | `target_water_ml` | integer (ml) | Required. Already in mobile form; "B1 adds" is satisfied. |

`prefer_activity_adjusted_calories` should NOT be moved into the target editor — it is a separate toggle. The web Profile.tsx coupling of this preference to the target save is itself a mild design smell; do not replicate it on mobile.

### 5.2 Validation Bounds

Match web `Profile.tsx` `canSave` logic precisely:

- All six fields must parse to a finite number (`Number.isFinite(value)`)
- `calories` must be `> 0`
- No upper-bound validation on web; do not add one on mobile (preserve forward-compatibility for edge-case users)
- Save button disabled until `canSave` passes

Implementation:

```typescript
const canSave =
  Number.isFinite(Number(calories)) &&
  Number.isFinite(Number(protein)) &&
  Number.isFinite(Number(carbs)) &&
  Number.isFinite(Number(fat)) &&
  Number.isFinite(Number(fiber)) &&
  Number.isFinite(Number(water)) &&
  Number(calories) > 0;
```

### 5.3 Source-Field Write Rule

Any manual save of targets (any single field changed) must write:
- `target_calories_source: "user"` — **always**, not gated on calories being non-null
- `target_calories_set_at: new Date().toISOString()` — **always**

The current mobile bug gates these stamps on `nextCalories != null`. Remove that gate. If `calories > 0` passes `canSave`, the stamps are honest. The `canSave` guard is the right place for the integrity check, not the stamp gate.

Scope: **global** — a single save of any field stamps both provenance columns. Per-field provenance is not implemented on web and is not required here. The `target_calories_source` column semantically refers to the entire target row's write path, not a single field.

### 5.4 Adaptive TDEE Interaction

Adaptive TDEE (`computeAdaptiveTDEE`) runs on food log writes regardless of `target_calories_source`. It updates `profiles.adaptive_tdee` and `adaptive_confidence`. This is independent of manual target edits — the two systems do not conflict.

The **suppression contract** (per `progress.md:251-253`):
- `target_calories_source = 'user'` AND `target_calories_set_at` within the last 14 days → Progress Digest suppresses the Maintenance Recalibrate CTA.
- No other "pause" mechanism exists or is needed. Adaptive TDEE computes silently; the Digest just does not surface the suggestion.
- Engineering does NOT need to add any "pause" flag or timer — writing `source = 'user'` is the complete contract.

**Forward-compatibility with period/pregnancy presets (roadmap `docs/product-roadmap.md:159`):**
The preset feature will override specific target fields via a structured flow. It will write `target_calories_source = 'user'` (or potentially a new enum value, subject to a DB migration) when the user applies a preset. Nothing in the current edit flow needs to change to support this — the source-field provenance pattern is already the correct hook. The only constraint: do not hard-code the `canSave` validator to reject values that a preset might produce (e.g., a high-calorie pregnancy target).

### 5.5 Today Ring Update (P0-2 fix)

After a successful save, the calorie and macro targets displayed in the Today tab must update in the same session without requiring app restart.

Mobile's Today tab reads targets via the `AppDataContext` or a similar context. The fix requires either:

a) **Emit a context update from `profile.tsx` after save.** If `AppDataContext` exposes a `setNutritionTargets` function (mirrors web `Profile.tsx` line 312), call it immediately after a successful upsert. This is the direct fix.

b) **Trigger a focused refetch on Today tab mount.** Add `useFocusEffect` to the Today tab that refetches `target_calories` / `target_protein` etc. from the profile. This is a broader fix that covers other update paths (e.g., activity-level recompute in Settings).

Option (a) is preferred — it is the exact pattern web uses and has no side effects. Option (b) adds a network round-trip on every Today tab focus.

The Supabase upsert in `profile.tsx` currently writes to the DB but does not invalidate any in-memory store. The fix is to call the context setter immediately after the upsert succeeds, before showing the confirmation alert.

### 5.6 Snapshot Semantics

Historical `daily_targets` rows are NOT retroactively changed when the user edits their targets. This is correct and intentional per `dailyTargetSnapshot.ts`:
- `snapshotDailyTargetIfMissing` uses `on conflict do nothing` — first write per `(user_id, date_key)` wins.
- Past days display using their frozen snapshot or fall back to the current profile target with an "approximate" chip.
- The executor must NOT call `snapshotDailyTargetIfMissing` from the target edit save path (same prohibition as `persist.ts:253-258`).
- Today's snapshot: if food has already been logged today, today's snapshot is already frozen. Editing targets after the first log of the day does NOT update today's snapshot — the Today ring uses the live `target_calories` from the profile, not the snapshot. The snapshot is only used by the Progress surface to render historical accuracy. This is correct behaviour.

---

## 6. Cross-Platform Parity Matrix (after fix)

| Feature | Web | Mobile (current) | Mobile (after fix) | Intentional divergence? |
|---|---|---|---|---|
| Edit calories | Profile.tsx inline grid | profile.tsx TextInput | profile.tsx TextInput (unchanged) | No |
| Edit protein/carbs/fat | Profile.tsx inline grid | profile.tsx TextInput | profile.tsx TextInput (unchanged) | No |
| Edit fibre | Profile.tsx inline grid | profile.tsx TextInput | profile.tsx TextInput (unchanged) | No |
| Edit hydration | Profile.tsx inline grid | profile.tsx TextInput | profile.tsx TextInput (unchanged) | No |
| Validation (calories > 0, all finite) | canSave guard | None | canSave guard (new) | No |
| Cancel/revert | Cancel button | None | Cancel button (new) | No |
| `source = 'user'` stamp | On save, when canSave | Partial (zero-coercion bug) | On save, when canSave (fixed) | No |
| `set_at` stamp | On save | Partial (same bug) | On save (fixed) | No |
| Today ring updates same session | Yes (context update) | No (stale) | Yes (context update, new) | No |
| Confirmation UX | toast (non-blocking) | Alert (blocking) | Alert (acceptable on mobile) | Yes — platform norm |
| `prefer_activity_adjusted_calories` written on target save | Yes (coupled) | No | No (intentionally decoupled) | Yes — the coupling on web is a design smell; mobile does not replicate it |
| Activity-level recompute path | Settings.tsx ActivityLevelPickerDialog | settings.tsx modal | Unchanged | No |
| Entry point depth from home tab | 3+ actions (broken row) | 2 taps (working) | 2 taps (unchanged) | Web P1-3 bug remains (separate fix) |

---

## 7. Test Plan Outline

Tests to add in `apps/mobile` vitest suite. Do not write the tests — this is the coverage map.

**Core save path:**
- `profile.tsx save()` with valid inputs: assert upsert is called with correct `target_calories`, `target_protein`, `target_carbs`, `target_fat`, `target_fiber_g`, `target_water_ml`.
- Assert `target_calories_source = "user"` is written when `calories > 0`.
- Assert `target_calories_set_at` is written (ISO string) when `calories > 0`.

**Validation guard:**
- `canSave` returns `false` when `calories = 0`.
- `canSave` returns `false` when any field is empty / NaN.
- `canSave` returns `true` when all fields are valid finite numbers and `calories > 0`.
- Save button is disabled when `canSave = false`.

**Provenance stamp edge cases:**
- User edits only protein (leaves calories unchanged): both `target_calories_source` and `target_calories_set_at` are still stamped.
- User clears the calories field (making it invalid): `canSave = false`, save is blocked, no upsert is called.

**Context update (P0-2):**
- After a successful save, the test mock for `AppDataContext.setNutritionTargets` (or equivalent) is called with the new targets.
- Verify the Today ring component re-renders with the new calorie value in the same session (integration-level test if feasible, else manual verification noted in PR checklist).

**Adaptive TDEE non-interference:**
- Editing targets does NOT call `snapshotDailyTargetIfMissing`.
- `target_calories_source = 'user'` does NOT modify `adaptive_tdee` or `adaptive_confidence` columns.

**Multi-field partial validation failure:**
- User fills calories and protein but clears carbs: `canSave = false`, all other valid fields are still displayed correctly (no unintended reset).

---

## 8. Component Delta

### Files to modify

**`apps/mobile/app/profile.tsx`** (primary change)

1. Add `canSave` computed value (mirrors `Profile.tsx:257-267`).
2. Fix provenance stamp: remove `if (nextCalories != null)` gate; stamp always when `canSave` passes.
3. Add Cancel button alongside Save: pressing Cancel resets all `useState` values to the last loaded profile values (requires storing a `loadedValues` ref or refetching).
4. After successful upsert, call context update to propagate new targets to the Today ring. The exact call depends on what context is available in the mobile app — likely `useAppData()` or a direct `AsyncStorage` write that the Today tab reads on focus. **Engineering must confirm the right invalidation mechanism for mobile.**
5. Disable the Save button (`opacity: 0.5`, `disabled={!canSave || saving}`) to match web behaviour.
6. Screen title: when this screen is pushed from `targets.tsx` → "Edit" button, the title should read "Edit Targets" not "PROFILE". Pass a navigation param or use a separate screen title prop. The existing `headerTitle` style at line 66 uses a generic "PROFILE" literal — change to a prop with default fallback.

**`src/app/components/Profile.tsx`** (web bug fix, P1-3)

7. Line 497-506: add `onClick={() => { setActiveTab("targets"); /* or scroll */ }}` to the Daily Targets row so it functions as an entry point. The simplest fix is `onClick={() => setIsEditingTargets(true)}` but that requires the component to scroll to the editor — alternatively, make the row an anchor to the `#targets-editor` section. Minimum fix: wire a click handler that calls `setActiveTab("targets")` so the row at least navigates to the right tab.

### Files NOT to change

- `apps/mobile/app/targets.tsx` — read-only surface is correct; the "Edit" button routing to `/profile` is correct.
- `apps/mobile/app/(tabs)/more.tsx` — "Daily targets" row routing to `/targets` is correct.
- `apps/mobile/app/(tabs)/settings.tsx` — activity-level recompute path is correct and separate.
- Persistence layer (`src/lib/onboarding/v2/persist.ts`) — no changes needed.
- `dailyTargetSnapshot.ts` — no changes needed.
- `recomputeTargetsForActivity.ts` — no changes needed.
- Any migration file — the `target_calories_source` enum already includes `'user'`; no new DB columns are needed.

### Entry point wiring (no new screens needed)

The existing chain is correct:
```
More tab → SettingsRow "Daily targets" → router.push("/targets")
targets.tsx → Pressable "Edit" → router.push("/profile")
profile.tsx → [edit form]
```

No new screen is required. The only structural change is to the `profile.tsx` form itself.

---

## 9. Risks and Open Questions

### Risks

**R1: Today ring invalidation mechanism is unknown.**
`profile.tsx` does not import any context that exposes target setters. The mobile `AppDataContext` equivalent (if one exists) may or may not have a setter for targets. Engineering must identify the correct invalidation path before implementing P0-2. If no context setter exists, a fallback is to add `useFocusEffect` to the Today tab that re-reads `target_calories` from Supabase — slower but always correct.

**R2: `target_water_ml` column existence.**
`src/lib/onboarding/v2/persist.ts` comments (line 134, 141) say "no `target_water_ml` write — column doesn't exist in any migration." However, both `apps/mobile/app/profile.tsx` (line 212) and `src/app/components/Profile.tsx` (line 301) actively write `target_water_ml` in production, and these saves are not failing. Either the column does exist (persist.ts comments are stale), or PostgREST silently drops unknown columns. Engineering should confirm the column's presence in the DB schema before relying on hydration writes. Do not add a migration without this confirmation.

**R3: `prefer_activity_adjusted_calories` decoupling on mobile.**
Web `Profile.tsx` writes `prefer_activity_adjusted_calories` as part of the target save (line 300). This spec intentionally decouples it on mobile (the toggle lives in `settings.tsx`). If a user changes targets on mobile and then changes the activity-adjust toggle, the two changes are separate writes — this is fine. The risk is if the web coupling is load-bearing in some flow that assumes they're atomic. Audit `Profile.tsx:saveProfile()` to confirm that decoupling does not break any downstream logic. Current assessment: no downstream logic depends on the atomicity.

### Open Questions

**OQ1:** What is the correct call to invalidate the in-memory target state on mobile after a save in `profile.tsx`? Does `AppDataContext` expose a `setNutritionTargets` setter, or should the Today tab re-read on focus? Engineering must confirm before implementing P0-2.

**OQ2:** Does `target_water_ml` exist in the production DB schema? `persist.ts:141` says it does not exist in any migration, but the active `profile.tsx` and `Profile.tsx` both write it without errors. Engineering must verify column existence before treating hydration as fully functional.

**OQ3:** Should mobile `profile.tsx` be structurally split (targets-only screen vs account-details screen) or just reordered (targets first)? This decision changes the routing chain and should be made before implementation to avoid a second restructure. Current recommendation: reorder only, scoped to screen title and field order.

---

## 10. Update 2026-05-25 — "Edit goal & pace" editor (goal/pace recompute path)

This spec covers the **manual targets editor** (`source = "user"`) and
references the **activity-level recompute path** (`source = "recompute"`).
A third edit path now exists: the post-onboarding **"Edit goal & pace"
editor**, which lets the user change goal type / pace / goal weight and
recomputes the target via the static formula. It is a `source =
"recompute"` write, NOT a `source = "user"` write — a goal change is
intent, not a manual override, so it must not trip the 14-day digest
cooldown.

- **Web:** `src/app/components/suppr/goal-pace-editor-dialog.tsx`,
  reached from `Targets.tsx` (`goEdit`).
- **Mobile:** `apps/mobile/components/recap/GoalPaceEditorSheet.tsx`,
  reached from `apps/mobile/app/targets.tsx`'s Edit button.
- Both call the shared compute helper `recomputeTargetsFromProfile`
  (alias of `recomputeTargetsForActivity`) and the shared write helper
  `src/lib/nutrition/persistRecomputedTargets.ts`.
- Gated behind `isFeatureEnabled("goal-editor")`. When off, the Edit
  action keeps the old behaviour (deep-link to the Profile manual editor).

This **resolves P1-3 / the "broken Daily Targets row" / weak-discoverability
gaps for the GOAL dimension specifically**: the Goal-card edit affordance,
previously a dead-end into a profile screen with no goal control, now opens
a real goal/pace editor. The manual calorie/macro editor (this spec's
primary subject) is unchanged.

Full decision + locked correctness rules:
`docs/decisions/2026-05-25-edit-goal-and-pace-editor.md`.

| Field | DB column | Recompute on change? |
|---|---|---|
| Goal type (cut/maintain/bulk) | `goal` | Yes — recompute calories + all 4 macros |
| Pace (relaxed…vigorous) | `plan_pace` | Yes — recompute calories + all 4 macros |
| Goal weight | `goal_weight_kg` | **No** — projection input only, never feeds TDEE |

---

## Appendix: File Cross-Reference

| File | Role | Key lines |
|---|---|---|
| `src/app/components/Profile.tsx` | Web target editor (source of truth for parity) | 257-267 (canSave), 269-321 (saveProfile), 940-1075 (targets grid UI), 497-506 (broken Daily Targets row) |
| `src/app/components/Settings.tsx` | Web activity-level recompute path | 217-293 (handleActivityLevelConfirm) |
| `apps/mobile/app/profile.tsx` | Mobile target editor (primary change target) | 200-230 (save function), 265-312 (form UI) |
| `apps/mobile/app/targets.tsx` | Mobile read surface / entry to editor | 384-388 (Edit button routing to /profile) |
| `apps/mobile/app/(tabs)/more.tsx` | Mobile More tab — "Daily targets" row | 727-732 (SettingsRow for Daily targets, routes to /targets) |
| `apps/mobile/app/(tabs)/settings.tsx` | Mobile Settings — activity-level recompute | 288-357 (saveActivityLevel) |
| `src/lib/onboarding/v2/persist.ts` | Onboarding persistence — source enum reference | 153-157 (ProfileUpsertRow type, source field), 207-212 (onboarding source write) |
| `src/lib/nutrition/recomputeTargetsForActivity.ts` | Shared recompute pipeline | entire file |
| `src/lib/nutrition/dailyTargetSnapshot.ts` | Snapshot write — must NOT be called from target edit | 50-126 |
| `src/lib/nutrition/dailyTargetRead.ts` | Snapshot read — Progress historical target display | entire file |
| `docs/journeys/progress.md` | Source-field provenance contract | lines 238-259 |
| `docs/product-roadmap.md` | Period/pregnancy presets roadmap item | line 159 |
