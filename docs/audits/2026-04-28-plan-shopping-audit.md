# Plan + Shopping comprehensive audit — 3 platforms

**Phase 6 comprehensive scope.** 47 findings.
**Source:** customer-lens, 2026-04-28.

---

## Top 5

### F1 [P0] — "Generate Shopping List" unreachable on mobile after regenerate

`apps/mobile/app/(tabs)/planner.tsx:2391` (`{false && plan && (...)}` dead code) + `:1535` (summary card button just navigates).

After regenerate, planner purges `shopping_items` (`:1108, 1274`) but never repopulates. Summary card "Shopping list" button only navigates. Empty Shopping screen says "Generate a meal plan first" — user already has one. **Loop. Stuck.**

**Fix:** Hoist ingredient-merge logic out of dead block into `generateShoppingListFromPlan(plan)`; call at end of `generatePlan` and when summary "Shopping list" tapped if `shoppingItemCount === 0`.

### F2 [P0] — Web Planner is ~30% of mobile's surface

`src/app/components/MealPlanner.tsx`. Missing:
- No day-count picker (1/3/7)
- No start-from chips (Today/Tomorrow/Next week)
- No snacks slot (only breakfast/lunch/dinner)
- No `Plan setup` accordion
- No named-plan-slot pills with rename/delete
- No `HouseholdSummaryRow`
- No portion adjust modal
- No move-meal sheet (deferred per memo)
- No `PlanTemplatesDialog` wired
- No leftover badges
- No Free lock — free users see all 7 days
- No estimated-fiber, protein-gap hint, per-day macro pills
- No "Add slot back" affordance

Returning user moving phone → laptop loses most of the product.

**Fix:** Treat `MealPlanner.tsx` as feature-incomplete. Either ship missing surfaces or document carve-outs explicitly.

### F3 [P0] — Web Shopping list missing baseline interactions

`src/app/components/ShoppingList.tsx`. Toggle checked-state only. No share, no export, no progress bar, no per-row remove, no Clear-all trash, no Clear-checked link. Empty state is single muted "No items" sentence with no CTA.

**Fix:** Port mobile header (Share + Trash) and "Remove N checked items" to web. Empty state needs "Generate from your plan" CTA.

### F4 [P0] — "Base and above" upsell refers to non-existent SKU

`apps/mobile/app/(tabs)/planner.tsx:1604, 1740`. Alert says *"Available on Base and above."* SKUs today are Free + Pro. There is no Base. User taps "See plans", lands on paywall, finds no Base.

**Fix:** Replace "Base and above" with "Pro" (verify against `/pricing` web copy).

### F5 [P0] — Free-lock divergence between platforms

Mobile gates 3-day and 7-day at `:1597, 1733`; web `MealPlanner.tsx` has no gate. Free user on web gets full 7-day; same user on iOS only 1 day. Cross-platform monetisation contradiction.

**Fix:** Decide where the gate lives. Mobile-decisions-apply-to-web — symmetric.

---

## Other notable findings (32 more in agent transcript)

- F6 [P1]: Summary card button labelled "Shopping list" regardless of state — no verb-form when empty
- F7 [P1]: Long-press is the only entry to Move/Adjust portion/Remove slot — no visible affordance
- F9-F10 [P1]: "Estimated · verify" chip on both platforms is non-interactive (says "verify" but doesn't open)
- F11 [P2]: Empty days vs no-recipe pool — confusing copy split
- F12 [P1]: Plan-slot rename uses `Alert.prompt` (iOS-only) — broken on Android
- F15 [P1]: Day-progress strip uses red for over-target — violates project carryover rule (over-budget = amber, never red)
- F16 [P2]: Web shopping `aria-label` doesn't include quantity — VO reads "Check protein powder" not "Check protein powder, 60 g"
- F25 [P1]: Web regenerate silently rebuilds shopping list, destroying checked-state progress
- F26 [P1]: Web swap modal lacks slot-target kcal hint (mobile has `Target ~600 kcal`)
- F30 [P1]: Mobile "Log today" persists `portion_multiplier: currentMult` while `meal.calories` already baked it in — **double-application risk** (data correctness)
- F35 [P1]: Web Planner has no "no recipes" empty state — pads to 7 days of "Empty slot"
- F37 [P1]: Mobile household summary doesn't surface "Shared with household" or "Private" plan badge
- F46 [P1]: Shopping list shows no "Generated from plan of {date}" timestamp — user could buy ingredients for last week's plan after a roll-over
- F39 [P2]: No plan-share affordance anywhere
- F40 [P2]: Fasting integration not surfaced in plan
- F44 [P2]: Date math hard-coded `en-US` regardless of user locale (UK testers see "April 27" not "27 April")

---

## Trust concerns

- F4: "Base and above" upsell to non-existent SKU
- F25 + F46: Shopping list with no timestamp + auto-purge on mobile / auto-rebuild on web — user could buy wrong groceries
- F5: Free-lock divergence — same user gets different access by platform
- F30: portion_multiplier double-application could silently inflate logged macros
- F9 + F10: "Estimated · verify" pretends to invite an action

---

## Net web vs mobile

Web Plan + Shopping is **~30% of mobile's surface area**. The CLAUDE.md non-negotiable "Web and mobile must stay in sync at all times" is **materially violated** on this surface.
