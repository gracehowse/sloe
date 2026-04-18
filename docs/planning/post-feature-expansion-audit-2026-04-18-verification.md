# Post-Fix Cohesion Audit — Belts and Braces Verification — 2026-04-18

**Scope:** Verify the "Biggest Structural Risk" from `docs/planning/post-feature-expansion-audit-2026-04-18.md` ("shared lib layer coherent; UI layer is not; Today screen hostile to first-time users") is resolved after C1–C5 / H1–H7 / M1–M11 / L4–L5 remediations.
**Method:** spot-check via repo-auditor, ui-critic, customer-lens, sync-enforcer, code-quality, qa-lead lenses.

---

## 1. Structural-risk verdict

**RESOLVED with small residuals.**

Concrete evidence:

- Shared `<Badge>` primitive ships on both platforms (`src/app/components/suppr/badge.tsx` + `apps/mobile/components/Badge.tsx`) — grep for inline `>AI< / >PRO< / >OVERRIDE< / >FREEZE< / >LEFTOVER<` pill spans returns **zero** survivors.
- Shared `<EmptyState />` primitive ships on both platforms with mirrored prop contracts.
- `window.dispatchEvent("suppr:open-save-meal-dialog")` anti-pattern: grep returns zero.
- `window.prompt` / `window.confirm` swept in all load-bearing paths (FoodSearch, MealPlanner, Settings, QuickAddPanel, RecipeDetail, today-meals-section, plan-templates-dialog). Zero on mobile.
- Mobile `QuickAddPanel.tsx` consumes shared `foodHistory.ts` / `favoriteFoods.ts` / `savedMeals.ts` / `savedMealsLogic.ts`. No accidental divergence.
- Mobile `HydrationStimulantsCard.tsx` threads `measurementSystem` → imperial parity real.
- Custom foods wired: `FoodSearch.tsx` + `FoodSearchModal.tsx` import `CreateCustomFood{Dialog|Sheet}`. C1 closed.
- Mobile planner Move action: `MoveMealSheet` + `moveMealInPlan` + `meal_moved_in_plan`. C2 closed.
- Dead voice/photo modals on mobile Today: grep returns zero. C4 closed.
- Today composition: `NutritionTracker.tsx` 1647 LOC (from 2963), `(tabs)/index.tsx` 2850 LOC (from 4409). 32 new subcomponents.
- Today progressive disclosure via shared `todayProgressiveDisclosure.ts` — hydration / steps / adaptive TDEE gated; Quick Add collapsed.
- L4 eat-again dismiss v2 `{dateKey, dismissedAt}` + 12h rollback + v1→v2 migration.
- L5 shared `mealSlots.ts` + `normaliseMealSlot` — every comparison site swept.

The biggest structural risk is no longer a fair characterisation of the codebase today.

---

## 2. Remaining residuals

### MEDIUM

**R1 — Dual EmptyState on web.** ~~Legacy `src/app/components/EmptyState.tsx` still exists alongside new `suppr/empty-state.tsx`. Only `ShoppingList.tsx` imports legacy. ~15 min fix.~~ **DONE 2026-04-18.** Legacy `src/app/components/EmptyState.tsx` deleted. `ShoppingList.tsx` migrated to `suppr/empty-state.tsx` with the CTA preserved in the new `action` slot via `<Button variant="outline" />`; `empty_state_cta_clicked` analytics + `{ title, ctaLabel }` payload preserved. Test: `tests/unit/shoppingListEmptyState.test.tsx` (3 cases: renders primitive shape, fires analytics + `onNavigate("planner")` on click, hides when items exist). Grep `"components/EmptyState"` on `src/` returns zero.

**R2 — Mobile `recipe_timer_started` parity gap.** ~~Web `CookMode.tsx:226` fires it; no occurrence in `apps/mobile`. ~15 min fix.~~ **DONE 2026-04-18.** `apps/mobile/app/cook.tsx` now fires `cook_mode_opened { recipeId, stepCount }` on mount and `recipe_timer_started { recipeId }` on timer start, mirroring the web events. `recipe_timer_completed` is intentionally omitted — the mobile timer is a count-up stopwatch with no natural completion event (the user always presses Stop); firing on Stop would conflate "user cancelled" with web's "countdown hit zero". Mobile `recipe_timer_started` payload omits `seconds` for the same reason (no pre-set duration at start time — emitting a fake value would poison the dashboard). Divergence documented inline in `cook.tsx` and pinned by `apps/mobile/tests/unit/cookAnalyticsParity.test.ts` (5 cases) so a future "add the missing event" PR must re-read the reasoning.

**R3 — Paywall surface divergence (M2).** Mobile `router.push("/paywall?from=voice_log")`; web opens `AiPaywallDialog`. User decision pending.

### LOW

**R4 — HydrationStimulantsCard parity test gap.** Component-level render test missing on web + mobile (RNTL infra-blocked on mobile).

**R5 — NutritionTracker at 1647 LOC with 69 `useState` hooks.** Not a correctness issue; ceiling for future growth.

**R6 — C1a deferred: NutritionTracker inline web search.** Known deferred; backlog.

**R7 — Mobile RNTL infra gap.** G16 mobile + F2 mobile + HydrationStimulantsCard mobile render tests all blocked on `@testing-library/react-native` install.

**R8 — L4 clock-rollback edge.** L4 covers legit cases; >12h manual rollback resets dismiss — probably intentional.

### Informational

- LOC drift vs earlier numbers: NutritionTracker 1647 (was 1619), mobile Today 2850 (was 2771) — natural evolution, not regression.
- Test count ~1118 vs claimed 1083 — actual higher.
- Research docs reference legacy handler names — low-value cleanup.

---

## 3. What's materially better (user-visible)

1. Today screen does less on first run — hydration / steps / adaptive-TDEE hidden behind state gates; Quick Add collapsed.
2. Delete / rename / confirm flows themed everywhere on web.
3. Imperial users see imperial water on both platforms.
4. One shared Badge shape — AI / Override / Leftover / Pro / Custom / Freeze / Added pill sizes unified.
5. Mobile planner has a Move action (previously impossible).
6. Mobile Today −687 LOC total (287 dead modals + 400 Quick Add inline).
7. Custom foods reachable via FoodSearch top-of-results.
8. Duplicate-day range ~4× faster (7 inserts vs 28).
9. Caffeine + alcohol colours respect theme tokens / dark mode.
10. Freeze earned/used moments actually surface (one-time row + DayStrip ❄ glyph).

---

## 4. Guardrails needed to prevent regression

1. **Delete legacy `src/app/components/EmptyState.tsx`.** Single most likely regression vector.
2. **Lint rule banning new `window.prompt` / `window.confirm` / `window.dispatchEvent("suppr:…")`.**
3. **Cap Today file LOC in CI** — NutritionTracker.tsx ≤ 2000, `(tabs)/index.tsx` ≤ 3500.
4. **Install `@testing-library/react-native` on `apps/mobile`.**
5. **M1 and M2 decisions before next feature batch.** Leaving undecided re-opens the drift just closed.
6. **PR template: mobile analytics parity check.** Mobile missed `recipe_timer_started` for an entire sprint.
7. **Ban new top-level cards on Today without a progressive-disclosure gate.** Pattern is established via `todayProgressiveDisclosure.ts`.
8. **Register ~30 new analytics events in PostHog dashboards (L6).** Events without dashboards are fire-and-forget.

---

## 5. Release-gate verdict

**CONDITIONAL GO → GO (pending M1 + M2 ownership).**

The original HOLD's three conditions cleared:
- C1/C2/C4 landed.
- C3 landed.
- C5 decision made.

Ship conditions (three small items):

1. ~~Delete `src/app/components/EmptyState.tsx` legacy + migrate `ShoppingList.tsx` to `suppr/empty-state`.~~ **DONE 2026-04-18** (see R1 above).
2. ~~Instrument `recipe_timer_started` on mobile cook-mode.~~ **DONE 2026-04-18** (see R2 above). `cook_mode_opened` also added; `recipe_timer_completed` intentionally skipped with documented reasoning.
3. Name an owner for M1 + M2 decisions with a deadline before the next feature batch. **OPEN.**

None block the current build. They prevent next release from sliding back into drift.

**After these three:** GO.  Items 1 + 2 landed 2026-04-18; item 3 is a product-ownership call, not an implementation task.

**Before the release after:** install RNTL on mobile + write 3 missing mobile render tests.
