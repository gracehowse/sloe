# Best-in-class roadmap (four pillars)

This document turns the product bar—**complete loop, nutrition truth, editorial craft, clear moat**—into phased work you can ship in order. It references real surfaces in this repo today.

---

## How to use this doc

- **Order matters:** Pillar 1 (loop) and Pillar 2 (truth) remove “prototype smell” faster than visual-only passes.
- **Pillar 3** runs in parallel once **tokens and layout rules** exist (so you don’t repaint twice).
- **Pillar 4** needs an explicit **wedge choice**; the plan assumes **workflow depth first** (planner → shop → log) because social graph work depends on publish/discover being trustworthy.

---

## Pillar 1 — One loop that is unmistakably complete

**Target journey:** Discover → save → plan → shop → **cook** → log → **see the day vs targets**.

| Hop | Today (rough) | Gaps to close | Primary files / systems |
| --- | --- | --- | --- |
| **Discover** | Feed, search, save | Loading/error states; first-run guidance; CTA into Library when empty saves | [`DiscoverFeed.tsx`](src/app/components/DiscoverFeed.tsx), [`App.tsx`](src/app/App.tsx) |
| **Save** | Toggle save, tier limit | Clear “why blocked”; post-save “Next: Plan” nudge; sync failure recovery copy | [`AppDataContext.tsx`](src/context/AppDataContext.tsx) |
| **Plan** | Generate, portions, swap, log to day | Ensure every success path explains what happened; free-tier limits obvious | [`MealPlanner.tsx`](src/app/components/MealPlanner.tsx) |
| **Shop** | From plan, merged lines, regen | **Staleness:** after portion changes, prompt “Regenerate from plan” or auto-regen with undo; empty state ties to planner | [`ShoppingList.tsx`](src/app/components/ShoppingList.tsx), [`AppDataContext.tsx`](src/context/AppDataContext.tsx) `generateShoppingListFromPlan`, [`generateShoppingList.ts`](src/lib/planning/generateShoppingList.ts) |
| **Cook** | Recipe detail / upload | **Weakest hop:** no dedicated “cook mode” (steps + timers + checkboxes). Add **Cook** from plan slot → recipe detail with sticky ingredients + steps | [`RecipeDetail.tsx`](src/app/components/RecipeDetail.tsx), planner slot actions |
| **Log** | Manual, barcode, planned meal log | Confirm **portion multiplier** is visible on logged rows; quick-edit portion; USDA/OFF flows labeled | [`NutritionTracker.tsx`](src/app/components/NutritionTracker.tsx), [`portionMultiplier.ts`](src/lib/nutrition/portionMultiplier.ts) |
| **Day vs targets** | Summary cards, streaks | Single **hero strip**: eaten vs goal (cal + P/C/F), optional net if activity on; fiber/water if claimed | [`NutritionTracker.tsx`](src/app/components/NutritionTracker.tsx), [`TrackerSummaryCard.tsx`](src/app/components/TrackerSummaryCard.tsx) |

### Phase 1A — Loop hardening (ship first)

1. **Shopping ↔ plan contract** — After `setMealPlan` / portion changes, either debounced auto-regenerate list (with toast + preference) or a **persistent banner** until user regenerates. Document behavior in UI copy.
2. **Cook hop** — From planner “Log” adjacent: **Open recipe** (deep link to `RecipeDetail` with `recipe` query) + optional **Cook** layout (full-width steps, ingredient checklist). Minimum: one obvious path from plan → instructions.
3. **End-of-loop confirmation** — On tracker, top-of-day **“Today at a glance”** (see Pillar 2) so the user never hunts for “did I hit protein?”

### Phase 1B — Empty and error states (same release train)

- Replace generic empties with **one next action** each (Discover, save, generate, regenerate list).
- Map Supabase/offline errors to **recoverable** messages (retry, work offline) in saves, journal, shopping sync — [`useShoppingListState.ts`](src/context/appData/useShoppingListState.ts), [`useNutritionJournalState.ts`](src/context/appData/useNutritionJournalState.ts), saves effects in [`AppDataContext.tsx`](src/context/AppDataContext.tsx).

---

## Pillar 2 — Nutrition truth and clarity

**Principle:** Never imply precision you don’t have. Labels beat trust lost.

### Phase 2A — Vocabulary (app-wide)

- **Verified** — Structured source (e.g. USDA, OFF barcode, verified recipe pipeline) with optional source chip.
- **Estimated** — Model/heuristic or user-entered without full verification.
- **Community** — User-published; treat as “unverified macros until reviewed.”

Apply consistently on: recipe cards, detail, upload preview, tracker add-food flows, import success.

### Phase 2B — One trustworthy daily view

- **Targets row:** Goal calories (and **net** if `preferActivityAdjustedCalories` + manual burn — already partially modeled in context).
- **Consumed row:** Sum of logged meals + explicit **remaining** P/C/F (and fiber/water if [`normalizeMacroTargets`](src/types/profile.ts) / UI already surface them).
- **Activity line:** “Manual activity burn (kcal)” until a native Health path exists — align with [`docs/health-platform-phase-b.md`](health-platform-phase-b.md).

### Phase 2C — Remove false signals

- Replace or clearly label **demo** UI (e.g. Profile weight chart copy: “Demo data…”) — [`Profile.tsx`](src/app/components/Profile.tsx) — with either real logging or hide until wired.

---

## Pillar 3 — Visual and interaction craft

**Screens that matter most:** Discover feed, Nutrition (day), Meal planner, Shopping list.

### Phase 3A — System (do once)

- **Type scale + spacing tokens** (limited set of text styles, 8px grid, card radius).
- **Motion:** 150–200ms, single easing; no gratuitous animation on lists.
- **Image treatment:** fixed aspect ratio, subtle gradient scrim for text on cards.

### Phase 3B — Per-surface

1. **Discover** — Editorial card: strong title lockup, macro chip row, save affordance that doesn’t fight the image — [`DiscoverFeed.tsx`](src/app/components/DiscoverFeed.tsx).
2. **Tracker** — Dense but readable day header; log list with clear meal boundaries; primary CTA for “Add food” — [`NutritionTracker.tsx`](src/app/components/NutritionTracker.tsx).
3. **Planner** — Tab or segmented control later for **Plan | Shopping** (Mob pattern) once shopping is trustworthy — [`MealPlanner.tsx`](src/app/components/MealPlanner.tsx) + [`ShoppingList.tsx`](src/app/components/ShoppingList.tsx) or shell in [`App.tsx`](src/app/App.tsx).
4. **Shopping** — Category headers + optional recipe thumb (when `from` resolves to one recipe) — extends current [`shoppingDisplayGroups.ts`](src/lib/planning/shoppingDisplayGroups.ts) / list UI.

### Phase 3C — Shell

- Bottom or side nav: **badge** for unchecked shopping count (when user has access) — [`App.tsx`](src/app/App.tsx).

---

## Pillar 4 — Moat or narrative

**Recommended wedge for this codebase:** **Workflow depth** — best-in-class **plan → accurate shop → honest log → day story**, before heavy social.

| Track | What “undeniable” looks like | Depends on |
| --- | --- | --- |
| **Workflow** | Portion-accurate list; cook mode; one daily truth view; optional named plans | Pillars 1–3 |
| **Data / social** | Follows, notifications, creator stats, feed ranking | Trust labels (Pillar 2), moderation, abuse limits |

### Phase 4A (after 1A–2B)

- **Named meal plans** or “Week of …” switcher — [`docs/mob-inspired-notes.md`](mob-inspired-notes.md) backlog.
- **Smart suggestions v2** — plan-tab overlap using **Supabase** ingredients — [`smartSuggestions.ts`](src/lib/planning/smartSuggestions.ts). Shopping-list overlap + remaining-macro fit (ENG-1634) — [`shoppingSmartSuggestions.ts`](src/lib/planning/shoppingSmartSuggestions.ts), flag `smart_suggestions_v1`.

### Phase 4B (later)

- Creator analytics (saves / adds-to-plan), follow graph — align with [`docs/product-roadmap.md`](product-roadmap.md) Phase D.

---

## Suggested sequencing (quarters as themes, not calendar commitments)

| Theme | Focus | Success looks like |
| --- | --- | --- |
| **Q1 theme** | Pillar 1A + 2B + 2C | User can complete the loop without confusion; day view matches trust bar; no demo masquerading as real |
| **Q2 theme** | Pillar 1B + 2A + 3A–3B | Cook path exists; verified/estimated/community chips; feed + tracker feel flagship |
| **Q3 theme** | Pillar 3C + 4A | Nav polish, shopping badge, plan/shopping IA; smarter suggestions / named plans |
| **Q4 theme** | Pillar 4B | Social moat only if workflow NPS is already strong |

---

## Related docs

- [Product roadmap](product-roadmap.md)
- [Mob-inspired UX notes](mob-inspired-notes.md)
- [Health / platform decision](health-platform-phase-b.md)
- [Observability](observability.md)

Update this file as phases ship; strike or check items in PR descriptions so the narrative stays honest.
