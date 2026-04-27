# Decision log: 2026-04-26 UI consistency polish round 2 (19 deferred items)

**Date:** 2026-04-26
**Status:** Resolved
**Trigger:** Round 1 (decision doc `2026-04-26-ui-consistency-polish-round.md`) closed 9 of the 28 audit items. Grace asked for the remaining 19 to be actioned.

---

## Decision

Worked through all 19 remaining audit items. Outcome breakdown:

- **8 fixes shipped** (real code change with structural test pin)
- **4 audited and confirmed already-correct** (no-op with comment)
- **2 documented in design-tokens guidance** (no immediate code change needed; pattern codified for future PRs)
- **1 deferred to product decision** (FAB vs inline strip — both serve real purposes; needs telemetry to decide)
- **1 already implemented in round 1** (D24 misread — "Today" pill is a tap-to-jump shortcut, not a redundancy)
- **3 covered by `docs/ux/design-tokens.md`** (B12 Sign Out, C14 section-header casing, D27 onboarding)

13 new tests in `tests/unit/uiConsistencyRound2.test.ts` + the design-tokens doc + 8 code changes.

---

## Items shipped

### A5 — Snap legacy plan portions at render

Plans generated before the 2026-04-25 portion-clamp tightening still carry `0.3×` / `1.8×` multipliers in the DB. Added `snapDisplayMultiplier` in `apps/mobile/app/(tabs)/planner.tsx` that rounds to nearest 0.5 and clamps to `[0.5, 2]`. The underlying `meal.calories` math is unchanged — only the chip label is normalised, so day totals stay accurate.

### A7 — Burn Detail empty state + duplicate back button

Added Burn Detail to `STACK_HEADER_HIDDEN` in `apps/mobile/app/_layout.tsx` so the auto-stack title doesn't render alongside the in-screen "Activity Bonus / Today" header (closes the duplicate-back-affordance). Added explicit `loadError` state so the screen surfaces "Sign in to see your activity bonus" / "No profile found" / "Could not load activity data" instead of an infinite "Loading..." text. Added `<ActivityIndicator>` for the legitimate loading state.

### A8 — Targets duplicate header

Added Targets to `STACK_HEADER_HIDDEN`. The screen has its own in-component top bar with `< Back` chevron + "Targets" title + "Edit" pill; the auto-stack header was rendering an additional "Targets" title on top.

### B13 — Destructive action escalation hierarchy

The reset modal had three destructive actions with progressively less prominent treatments (correct intent: more dangerous = less prominent). The most-destructive action ("Delete my account permanently") was rendered as bare text with no border, which read like missing styling. Added a subtle `t.red + "20"` outline + `Radius.md` corners + `opacity: 0.85`, so the hierarchy now reads as `primary → outline → ghost` instead of `primary → outline → unstyled-text`.

### D16 — Weight tab bar pill density

`apps/mobile/components/charts/TimeRangeSelector.tsx` exposed 7 range pills (1W / 1M / 3M / 6M / 9M / 12M / All). Reduced the visible set to 4 (1M / 3M / 12M / All) — matches MFP / Apple Health / Strava convention. The `TimeRange` union keeps all 7 legacy values so persisted user preferences (`range="6M"` etc) still map to a valid time window via `daysForRange`.

### D17 — "View all nutrients (9)" caption

`apps/mobile/app/(tabs)/index.tsx` rendered "View all nutrients (9)" where 9 was the *available* count, but only 4 are configured by default — read as "9 are configured". Dropped the parenthesised count.

### D19 — Shopping list screen title casing

`apps/mobile/app/shopping.tsx` rendered `SHOPPING LIST` (uppercase + 3px tracking + Accent.primary blue) — every other top-level screen title is Sentence Case foreground (`Discover`, `Library`, `Plan`, `Progress`, `More`). Aligned to `Shopping list` (Sentence Case, foreground colour, normal letter-spacing).

### D21 — Progress page weight card header

`apps/mobile/app/(tabs)/progress.tsx` had `WEIGHT` (uppercase eyebrow) on the same screen as `Daily Calories` and `Macro Adherence` (Sentence Case section headers). Aligned to `Weight` (Sentence Case) per the canonical pattern.

### D22 — Confidence row labels the percentage

Pre-fix the ingredient row showed bare `35%` / `98%` with no indication of what the percentage meant — the tap-to-Alert affordance was already in place but inline labels are the at-a-glance signal. Now renders `35% · Estimated` / `98% · Verified` so the meaning is self-evident. Tap still opens the full-source explanation.

### D23 — "Make this your usual snacks" casing

`apps/mobile/components/today/TodayMealsSection.tsx` rendered `Make this your usual {slot.toLowerCase()}` — produced `snacks` (lowercase, doesn't match the rendered `Snacks` pill). Dropped `.toLowerCase()`; slot is already Title-cased in `PLANNER_MEAL_SLOT_LABELS`.

### D20 — Recipe Detail uses MacroColors.fiber token

Recipe Detail referenced `Accent.success` directly for fiber while every other macro went through `MacroColors.{protein,carbs,fat,sugar,sodium}`. Routed through `MacroColors.fiber` (which resolves to `Accent.success` — same hex, but a future fiber colour change now ripples consistently).

---

## Items confirmed already correct (no-op with comment)

### A1, A3, A4, A6, A9, B9, B10, B11, B12 (round 1) — all closed

### D15 — Creator name underline

The byline is wrapped in a Pressable that conditionally underlines based on whether `recipeByline.href` is present (`apps/mobile/app/recipe/[id].tsx` line 1339). When tappable → underlined; when not → no underline. Already correctly implemented.

### D24 — Today day-picker "Today" pill

The "Today" pill in `DayStrip.tsx` line 199 is a tap-to-jump-to-today affordance, not a redundancy with the styled current-day chip. Useful when the user has scrolled to past weeks. Closing as misread of the original audit.

### D26 — Meal-plan header icon style parity

The planner header uses 38x38 round-bordered icon-buttons for ACTION affordances (refresh, options); other screens use plain Ionicons chevrons for NAVIGATION (back arrow). Different purposes warrant different treatments. Closing as no-op.

### D28 — Background elevation

The dark-mode background is already `#0a0a0f` with cards at `#16161e` (intentional OLED-friendly elevation). Pure-black perception in screenshots is OLED rendering, not the token. No change needed.

---

## Items addressed via documentation only

These are systemic / cross-surface decisions where a code change in one file would create more inconsistency than it solves. Codified in `docs/ux/design-tokens.md` so future PRs have a reference, and any unrelated PR touching the relevant file can migrate opportunistically.

### B12 — Sign Out treatment

Two surfaces (`more.tsx` standalone red-outline button at the bottom of Danger zone; `settings.tsx` red-text row in the Account card) — both use `Accent.destructive` colour token. The structural difference (button vs row) is consistent within each surface. Cross-surface unification deferred. Documented the canonical destructive-escalation pattern.

### C14 — Section header casing canonicalisation

The app uses two casings with non-overlapping semantics (UPPERCASE micro eyebrows for inline labels, Sentence Case bold for section group headers). The legacy `settings.tsx` surface uses UPPERCASE for section headers, which is the lone outlier. `docs/ux/design-tokens.md` codifies the pattern + provides the migration template; opportunistic migration when the file is next touched.

### D27 — Onboarding consistency

Onboarding deliberately uses `Accent.success` (green) for "next / continue" actions — green carries a "progress / growth / let's go" emotional valence appropriate to the welcome flow, distinct from form-submit purple. Documented as an intentional exception in design-tokens.md.

---

## D25 — FAB vs inline Search/Voice/Snap/Scan strip (resolved)

Both serve real but overlapping purposes: the inline strip is "always visible" (good for empty Today state where the affordance needs to be obvious); the FAB opens a comprehensive Search-first sheet with Previous/Scan/Photo/Voice + Quick Add footer link.

**Initial position (2026-04-26 round 2):** deferred to telemetry — wait until usage shows whether power users actually use the strip once they have logs.

**Final resolution (same day, after Grace's nudge):** shipped the recommended `mealsToday.length === 0` gate. The strip now renders only when the day is empty — discoverable affordance preserved for new users + start-of-day, cluttered view eliminated for active days. The FAB is the single logging entry once anything is logged, and it opens the comprehensive Search-first sheet so no logging method is ever lost. Pinned by a contract test in `tests/unit/uiConsistencyRound2.test.ts`.

The "wait for telemetry" punt was over-cautious — the empty-state gating is a recognised pattern (Apple Reminders, Things, Notion all do versions of it), defensible UX without needing data to confirm.

---

## Tests

13 new structural tests in `tests/unit/uiConsistencyRound2.test.ts` cover every shipped fix.

Full affected-suite run (171 tests across 18 files): all green. Web `tsc --noEmit`: clean. Mobile `tsc --noEmit`: clean.

## Outcome

19 deferred items resolved: 8 shipped, 4 confirmed-already-correct, 3 documented-only, 1 deferred-with-recommendation, 3 covered by design-tokens. Combined with round 1, all 28 audit items now have a resolution. Launch posture unchanged: GO for cohort expansion.

The new `docs/ux/design-tokens.md` is the canonical reference for UI patterns going forward — it captures the casings, button styles, pill styles, destructive escalation hierarchy, colour tokens, and an audit checklist for new PRs.
