# User Journey: Shopping List

**Audience:** Product / Design / Engineering

## One-line purpose
Turn a meal plan (or a single recipe) into an aisle-ordered, real-time-synced shopping list that stays correct as the plan changes and clears items automatically the user already has on hand.

## Scope

**In scope:** generating a list from the plan, the shopping screen itself (grouping, check-off, progress, realtime), smart suggestions that reuse list ingredients, adding a single recipe to the list, keeping the list in sync as the plan is edited, the non-destructive "Update from plan" re-sync, household-shared lists + check attribution, pantry staples, and the web/mobile chrome differences.

**Out of scope (see linked docs instead):**
- Building/adjusting the meal plan itself → [meal-planning.md](./meal-planning.md) (the step immediately before this one)
- Cooking the planned recipe (Cook Mode, batch cook UI) → `docs/journeys/discover-and-library.md` (not yet written — see Known limitations below)
- Setting up a household / configuring sharing (presets, the 7×4 grid, invites, the privacy boundary) → [`household-sharing.md`](./household-sharing.md); the schema and privacy design for shopping specifically is recorded in [`docs/decisions/2026-04-30-household-aware-shopping-list.md`](../decisions/2026-04-30-household-aware-shopping-list.md)

## Where this sits in the loop

This is the **Shop** stage of the **Plan the Week → Shop → Cook** loop:

```
Choose plan source → Generate plan → Adjust (lock/swap/move) → SHOP (this doc) → Cook → Log
```

Two things feed the list besides the plan-level generate: a single recipe's "Add to shopping list" action, and a batch-cook "scale to shopping" action (the last one is broken — see the Known bug section below).

## Entry points

| Entry point | Web | Mobile |
|---|---|---|
| Generate from plan | Plan tab → "Shopping list" ghost button in `MealPlanner.tsx`, or auto-rebuild after a plan regenerate | Plan header / `PlanToolsV3` row, or auto-rebuild after regenerate (`planner.tsx:2567`) |
| Open the list | Plan sub-tab pill "Shopping" (`navigateToView("shopping")`) | `PlanSubTabHeader` "Shopping" sub-tab → `/shopping` stack screen (also deep-linkable) |
| From a recipe | "Add to shopping list" pill on `RecipeDetail`, below the ingredient grid | Same pill on `recipe/[id]` |
| From batch cook | Batch-cook screen → Save/Cook → "Shopping list scaled to your batch" | Same |

## Step 1 — Generate from the plan (the core entry)

**Why this exists:** the macro-tracker spine's payoff line is "plan a week to fit macros, then shop for it in one trip." This is the moment that closes plan → shop.

**What the user does:** taps "Shopping list" (web) or the equivalent Plan-tab action (mobile) after generating or editing a plan.

**What happens:**
1. Resolves every planned meal's recipe ingredients.
2. Scales each ingredient by `portionMultiplier ÷ recipeServings` (`shoppingListIngredientMultiplier` — a recipe's ingredient rows are stored for the full yield, so a 1-portion planned meal buys `1/servings` of each line, not the whole batch).
3. Merges duplicates by normalised ingredient identity + unit (`shoppingMergeKey` — identity-based, not raw label text).
4. Filters out pantry staples (Step 7).
5. Categorises by grocery aisle.
6. Does a **full DELETE-and-REPLACE** of `shopping_items` for the scope (solo `user_id` or `household_id`) — this is the one write path in this journey that is NOT a delta merge; every other path below is.

Both platforms route through the **same shared generator** — `generateShoppingListFromRecipeEntries[Async]` (`src/lib/planning/generateShoppingList.ts`, re-used by mobile via `@suppr/shared/planning/generateShoppingList`) — so quantities and aisle placement match by construction. This closed a prior mobile under-buy bug where `portionMultiplier` was silently ignored. Ingredient load goes through `fetchShoppingListIngredientsByRecipeId` (`shoppingListIngredientFetch.ts`): UUID recipes from `recipe_ingredients`, Discover `seed-v2-*` catalogue rows from the in-app seed data (seed slugs must never hit the uuid `recipe_id` column — ENG-1668 follow-up).

**Web:** `src/context/AppDataContext.tsx` (`generateShoppingListFromPlan`), `src/app/components/MealPlanner.tsx` (`handleShoppingList` → generate + `onNavigate("shopping")`).
**Mobile:** `apps/mobile/app/(tabs)/planner.tsx` — `generateShoppingListFromPlan` + `openShoppingList` (ENG-1668: Plan Shopping CTAs generate then navigate — web parity). Also auto-rebuilds after plan regenerate.

**Tier gating:** there is no dedicated shopping-list gate. The real paywall is the existing multi-day-plan gate (`MealPlanner.tsx:878` web, `planner.tsx:1044` mobile) — a 1-day Free list is intentionally allowed. Decision: [`docs/decisions/2026-04-19-shopping-list-tier-gating.md`](../decisions/2026-04-19-shopping-list-tier-gating.md).

**Analytics gap (parity — needs a decision):** web fires `shopping_list_generated`. **Mobile does not emit this event at all.** This is the primary (iOS) surface, so the tier-gating decision's own revisit trigger — "PostHog shows >15% of Free WAU generating 1-day shopping lists… segmented by `user_tier`" — is currently blind on the platform that matters most. `shopping_list_generated` appears only in `src/lib/analytics/events.ts`, `src/context/AppDataContext.tsx`, and the tier-gating decision doc — there's no mobile call site. This is not a documented intentional divergence; it's an open gap (see Known limitations below).

**What happens next:** navigates to the shopping screen (Step 2).

## Step 2 — The shopping screen: aisle groups, check-off, progress

**Why this exists:** a list only helps in-aisle if it's ordered the way a shop is laid out. Aisle ordering follows the pattern set by AnyList and OurGroceries — shoppers now expect any list in this category to group by store layout, not just by recipe.

**What the user does:** scrolls the list top-to-bottom in supermarket walk order, taps a row (or its checkbox) to check it off.

**What happens:**
- Rows render grouped by grocery aisle in walk order (`sortShoppingCategories`, `src/lib/planning/shoppingAisleOrder.ts`), with same-ingredient lines collapsed into display groups (`groupShoppingItemsByIngredientName`, `src/lib/planning/shoppingDisplayGroups.ts`).
- A slim progress bar (`role="progressbar"`, `aria-valuenow`) counts **checked GROUPS ÷ total GROUPS, not raw rows** — this is deliberate so the web and mobile denominators match even though display grouping can differ subtly between the two clients. Per-section progress counts are also shown.
- Checking a row persists to `shopping_items.checked` + `checked_by` + `checked_at` and propagates to every other device/household member via a scope-filtered Supabase realtime subscription (~1s latency).
- Both platforms use a **unique per-effect realtime channel topic** (a monotonic counter appended to the topic name) to avoid a class of bug where a fast effect re-fire finds a same-topic channel still subscribed and throws on `.on()`.

**Web:** `src/app/components/ShoppingList.tsx`, `src/context/appData/useShoppingListState.ts`.
**Mobile:** `apps/mobile/app/shopping.tsx`, `apps/mobile/components/shopping/ShoppingLoadingSkeleton.tsx`.

**Web ↔ mobile parity:** identical on core view/check/group/progress. Loading state differs slightly — mobile has a skeleton (`deeplink_skeletons` flag) plus a spinner fallback for a native cold-open deep link; web has a dynamic-import skeleton. Not a behaviour gap.

**What happens next:** the user either finishes shopping (list stays as a record), acts on a smart suggestion (Step 2b), or hits one of the update paths below (Steps 3–5) if the plan or a recipe changes mid-week.

## Step 2b — Smart suggestions (reuse what's already on the list)

**Why this exists:** Mob's most-loved planning mechanic — recipes that share ingredients already in the list — reduces waste and raises meals-per-shop. Sloe adds a remaining-macro fit annotation so suggestions also respect today's calorie/macro budget (neither Mob nor ZOE ranks overlap by nutrition).

**What the user does:** with a non-empty list and a saved library that overlaps it (≥2 shared ingredients), sees a "Smart suggestions" section under the progress card. Taps **Add to plan** on a row.

**What happens:**
1. Ranks saved-library recipes by **ingredient overlap** (primary), then **remaining-macro fit** (secondary tie-break + row annotation).
2. Shows "Also uses Garlic Clove, Fish Sauce, Jasmine Rice…" for shared items.
3. **Add to plan** reuses the ENG-957 list sync (`kind: "add"`) — merges the recipe's ingredients into the shopping list without a full delete-and-replace. It does **not** place the recipe onto a specific day of the week grid yet (no day picker on this surface).

**Flag:** `smart_suggestions_v1` — default ON (2026-07-22). Off → section hidden (kill switch).

**Web:** `src/app/components/shopping/ShoppingSmartSuggestions.tsx` + `useShoppingSmartSuggestions.ts`, ranker `src/lib/planning/shoppingSmartSuggestions.ts`.
**Mobile:** `apps/mobile/components/shopping/ShoppingSmartSuggestions.tsx` + `hooks/useShoppingSmartSuggestions.ts` (same shared ranker).

**Distinct from** Plan-tab "Smart suggestions" (`smartSuggestions.ts` / ENG-1193) — that ranks recipes sharing ingredients with meals already *on the plan* and saves to library. This ranks against the *shopping list* and adds via list sync.

**Analytics:** `shopping_smart_suggestion_add_to_plan` `{ recipeId, overlapCount, hasMacroFit, platform }` — same name both platforms; no ingredient-name PII.

## Step 3 — Add to list from a single recipe

**Why this exists:** closes the save → cook loop without a new screen, the way Paprika / Recime / Samsung Food do — except Suppr **merges duplicates across recipes**, a gap competing apps like Recime are criticised for not closing.

**What the user does:** on a recipe detail page, taps "Add to shopping list" below the ingredient grid (scaled by whatever the servings stepper is currently set to).

**What happens:** reads the user's **live** `shopping_items` for their scope, merges in memory, and persists **only the delta** — `UPDATE` on merged rows (preserving `checked`), `INSERT` on new rows. It never does a delete-and-replace, so it can't clobber a checked-off list or a household-mate's items. Count↔weight lines (e.g. "2 eggs" vs "120g egg") fold into one grams row **only** at high `measureToGramsConfidence`; otherwise they stay as separate rows — never a guessed weight on a low-confidence conversion.

**Flag:** `recipe_shopping_list_v1` — default-ON. Off → the action is hidden; list stays plan-only.

**Web:** `src/app/components/recipe/AddToShoppingListAction.tsx`, `src/lib/planning/appendRecipeToShoppingList.ts` + `appendRecipeToShoppingListClient.ts`.
**Mobile:** `apps/mobile/components/recipe/AddToShoppingListButton.tsx` (imports the same shared aggregator).

**Web ↔ mobile parity:** identical — shared aggregator + persistence client + same flag. Web confirms with a toast; mobile with an `Alert` (platform-idiomatic, not a gap).

**Analytics:** `recipe_shopping_list_added` `{ recipeId, ingredientCount, addedCount, mergedCount, platform }` — fires on both platforms.

Full detail: [`docs/decisions/2026-06-30-recipe-to-shopping-list.md`](../decisions/2026-06-30-recipe-to-shopping-list.md) and the [`meal-planning.md`](./meal-planning.md#add-to-shopping-list-from-a-recipe-eng-943) section this doc supersedes as the shopping-specific home.

## Step 4 — Keep the list in sync as the plan is edited

**Why this exists:** closes the loop from the *other* direction to Step 3 — the plan changes, and the list should track it, without wiping checked-off progress on every dinner swap. Decision: [`docs/decisions/2026-07-01-plan-to-shopping-list-sync.md`](../decisions/2026-07-01-plan-to-shopping-list-sync.md).

**What the user does:** adds, removes, or swaps a meal on the Plan tab.

**What happens:** reads the live list, applies the edit in memory, and persists only the delta:
- **add** → append/merge the recipe (reuses Step 3's aggregator)
- **remove** → decrement only that recipe's contribution; drop the row at ~zero if no other recipe still sources it
- **swap** → remove the outgoing recipe then append the incoming, around one read, so a shared ingredient nets correctly rather than double-counting

Provenance uses the existing `shopping_items.source` field (comma-separated recipe titles) — **no schema change** was needed.

**Flag:** `plan_shopping_sync_v1` — default-ON. Off → the legacy one-off list (explicit "Generate Shopping List" only). Parity guard: `tests/unit/planShoppingSyncFlagParity.test.ts`.

**Web:** `src/context/AppDataContext.tsx:1762` (`syncShoppingListForPlanEdit`), `src/lib/planning/syncPlanEditToShoppingList.ts`, `planShoppingSyncHost.ts`, `shoppingMergePrimitives.ts`.
**Mobile:** `apps/mobile/lib/planShoppingSync.ts`, `apps/mobile/app/(tabs)/planner.tsx:1357` (`syncPlanSwapToShoppingList`).

**Web ↔ mobile parity — documented pre-existing divergence, not new drift:** web only wires the **swap** path, because web's meal-edit surface is swap-only — there is no per-meal "remove" affordance on web today. Mobile wires **swap + "Remove from plan."** The shared engine already accepts `{ kind: "remove" }`; the remove path is dark on web purely because there's no web UI trigger for it, not because the engine doesn't support it. This has been true since the plan-to-list sync feature shipped on 2026-07-01, and is not a regression introduced by any later change. If a web "remove" affordance ships, it should call the same shared engine and the remove-sync path will start firing there for free.

**Analytics:** `plan_shopping_synced` `{ editKind, addedCount, mergedCount, decrementedCount, removedCount, platform }` — same name both platforms, no PII/ingredient names.

## Step 5 — "Update from plan": non-destructive re-sync

**Why this exists:** before this shipped, a stale-list subtitle ("plan changed since…") dead-ended — the header only offered Share or Trash. This gives an in-place, non-destructive way to catch the list back up.

**What the user does:** when the plan has changed since the list was generated, the shopping screen shows a subtitle like "plan changed since" plus an "Update from plan" affordance. The user taps it.

**What happens:** re-runs the generator, but reconciles the current plan against the **live** list and persists only the delta:
- `INSERT` new rows
- `UPDATE` rows whose quantity changed, **preserving `checked`**
- `DELETE` rows for recipes no longer in the plan

Checked rows, manual additions, and household-mate additions are left untouched. Re-fingerprints the plan afterward so the stale banner clears (`fingerprintMealPlanForShopping`). This also fixed an earlier bug where scaled meals (portion ≠ 1) produced a fingerprint that could never match, so the stale banner never cleared.

**Flag:** `shopping_update_from_plan_v1`. Shown only when the list is out-of-sync **and** non-empty.

**Web:** `src/app/components/ShoppingUpdateFromPlanButton.tsx`, `src/lib/planning/regenerateShoppingListFromPlan.ts`, `src/context/AppDataContext.tsx:1788` (`resyncShoppingListFromPlan`).
**Mobile:** `apps/mobile/components/shopping/ShoppingUpdateFromPlanBanner.tsx`.

**Web ↔ mobile parity:** identical — shared `regenerateShoppingListFromPlan` host + reconcile logic, same flag gate.

**Docs note:** no dedicated decision doc exists for this feature; behaviour is documented inline in `regenerateShoppingListFromPlan.ts`'s header comment and in `ShoppingList.tsx`. This journey doc is the canonical narrative home for it.

## Step 6 — Household-aware shared list + per-row check attribution

**Why this exists:** an extended competitor audit flagged per-user (non-shared) shopping as the single biggest conversion blocker for the family-planner persona against Honeydew, which syncs across spouses in seconds with checks propagating live.

**What the user does:** nothing extra — this activates automatically for any user in a household.

**What happens:** `shopping_items` rows are scoped by a nullable `household_id` FK; reads and writes go through the shared `shoppingScope` helper (`src/lib/household/shoppingScope.ts`), and edits propagate live via the same realtime subscription as Step 2. A "Shared with Sarah & Tom" banner (Lucide `Users`, taps through to household settings) appears above the list, and fully-checked groups where a single member did the checking get a per-row attribution chip (initials + first name, reading `checked_by`). `INSERT ... WITH CHECK` pins `user_id = auth.uid()` so the attribution audit trail can't be spoofed by another household member. Solo users still get cross-device realtime sync (iPhone + iPad) — the scope helper isn't household-only.

**Web:** `src/app/components/ShoppingList.tsx:200` (banner + chip), `src/lib/household/shoppingScope.ts`, `src/lib/household/memberAccents.ts`, `supabase/migrations/20260504100100_household_shopping.sql`.
**Mobile:** `apps/mobile/app/shopping.tsx:818` (banner), `apps/mobile/app/shopping.tsx:1120` (attribution chip).

**Web ↔ mobile parity:** identical — same scope helper, same testIDs, same strings and attribution rules, pinned by `apps/mobile/tests/unit/shoppingHouseholdParity.test.ts`. One intentional carve-out: the Step 5 stale-plan reconciliation runs on **solo** lists only — pruning a shared list isn't one member's call to make unilaterally.

**Household setup itself** (invites, sharing presets, the day/slot grid) is out of scope for this doc — see [`household-sharing.md`](./household-sharing.md) for the full setup/config/privacy walkthrough (including the known device-local grid-sync gap), and [`docs/decisions/2026-04-30-household-aware-shopping-list.md`](../decisions/2026-04-30-household-aware-shopping-list.md) for the shopping-side schema/RLS decision record.

## Step 7 — Pantry staples (suppress-list, not an inventory tracker)

**Why this exists:** stops the list re-adding salt, oil, or pepper every single week.

**What the user does:** marks an ingredient row as "always on hand" — mobile via swipe-left "Staple" or long-press "Always on hand"; web via a hover `Package` button on the row.

**What happens:** the ingredient name is added to `profiles.pantry_staples` (a plain string array), matched word-boundary-aware against future generated rows, with longer staples winning over shorter ones ("olive oil" wins over a bare "oil" match). Every generate/append/sync path in Steps 1, 3, 4, and 5 runs its output through `filterShoppingItemsByPantry` before persisting, so a staple disappears from the current list **and** every future one until removed.

**This is explicitly a filter, not an inventory tracker** — there's no "how much oil do I have left" tracking, just a suppress-list.

**Web:** `src/app/components/ShoppingList.tsx:178` (`markGroupAsStaple`), `src/lib/planning/pantryStaples.ts`.
**Mobile:** `apps/mobile/app/shopping.tsx:468` (`markGroupAsStaple`), `apps/mobile/app/shopping.tsx:1019` (swipe Staple action).

**Web ↔ mobile parity — platform-idiomatic, not a gap:** shared filter + persistence logic; only the *affordance* differs (swipe/long-press on mobile touch vs hover button on web desktop pointer), matched to each platform's input model.

## Step 8 — Web-only chrome gaps (deliberate, not a bug)

Web intentionally ships a **stripped set** of list chrome relative to mobile:

| Action | Mobile | Web |
|---|---|---|
| Per-item remove | swipe-to-delete / long-press | per-row X (parity) |
| Remove N checked | ✓ | ✓ (parity) |
| Clear-all (Trash) | header Trash, household-aware confirm | **not shipped** |
| Share / export | `Share2` → Alert → copy-to-clipboard / system share sheet (Apple Reminders compatible) | **not shipped** |
| Mark staple | ✓ | ✓ (parity) |

This is a documented, deliberate hybrid — not silent drift. Web ports the mobile **lifecycle interactions** (remove, clear-checked, progress bar) but not the **chrome**: clear-all is dropped because it's a destructive no-undo action that's redundant with clear-checked + a plan re-sync; share/export is dropped because the format (mailto vs plain text vs PDF) is an undesigned product call, not because sharing itself is undesirable.

Decision + reconsider-on triggers: [`docs/decisions/2026-04-28-shopping-list-web-parity-hybrid.md`](../decisions/2026-04-28-shopping-list-web-parity-hybrid.md) — flips if a user (including Grace) asks for web share, or if telemetry shows a meaningful share of web sessions ending with items checked but never cleared.

Neither platform ships an "add custom item" free-text input — both explicitly strip that chrome per the same decision (web) and simply never built it (mobile). See Open product questions.

---

## Fixed bug (ENG-1600) — batch-cook "scale to shopping" used to write to a dead table

**Status: fixed.** This section previously documented an open bug (found during the 2026-07-19 documentation sweep, filed as ENG-1600) where batch-cook's "scale to shopping" action persisted through `upsertShoppingListJsonItems` — the **legacy JSON blob table** (`shopping_lists`, renamed to `shopping_lists_legacy` by migration `20260413100000_relational_user_data.sql`) — instead of the relational `shopping_items` table both platforms' Shopping screens actually read. Net effect: items added via batch-cook never surfaced on mobile `/shopping`, and on web they replaced (rather than merged into) the in-memory list for the rest of the session, then vanished entirely on reload once `useShoppingListState` re-read `shopping_items` and found nothing new there.

**The fix:** both platforms now route through a new shared module, `src/lib/planning/scaleBatchCookToShoppingList.ts` — pantry-staple filtering, then the batch multiplier, then a delegate to `appendRecipeToShoppingListClient` (ENG-943's delta-merge appender, the exact pattern Step 3's single-recipe "Add to shopping list" action already uses). This persists only the delta (INSERT new rows / UPDATE changed quantities, preserving `checked` on existing rows) into `shopping_items`, resolved to the caller's household-or-solo scope exactly like every other shopping-list write in this doc:
- **Mobile** (`apps/mobile/app/batch-cook.tsx` `scaleToShopping`): resolves household scope via `getMyHousehold` (matching `AddToShoppingListButton.tsx`), then calls the shared module.
- **Web** (`src/app/components/MealPlanner.tsx` `scaleBatchCookToShopping`): resolves scope from the already-loaded `activeHouseholdId` (`AppDataContext`), calls the shared module, and reflects the returned *merged* list via `setShoppingItems(res.items)` — fixing the "replaces the visible list" side effect noted in the original bug write-up, not just the persistence.

Tests: `tests/unit/scaleBatchCookToShoppingList.test.ts` proves the shared module inserts into a `shopping_items`-shaped client (never touches a `shopping_lists`/JSON-blob-shaped client), excludes pantry staples before persisting, and stamps `household_id` for household scope.

---

## Empty state, stale-plan subtitle, and resilience

- **Empty state:** "Your shopping list builds itself." + "Generate a week's plan and we'll line up everything you need by aisle." + a `ShoppingBasket`-icon primary CTA "Build this week" → routes to Plan. No card chrome on mobile. Spec: [`docs/specs/2026-04-28-shopping-empty-state-redesign.md`](../specs/2026-04-28-shopping-empty-state-redesign.md).
- **Stale-plan subtitle:** formats as "N items · from `<plan start>`" and appends a "plan changed since" marker when the list is out of sync with the current plan (`formatShoppingListSubtitle`, `src/lib/planning/shoppingListMeta.ts`) — this is what triggers Step 5's "Update from plan" affordance.
- **Defensive layers:** a per-user JSONB fallback when the relational table is missing entirely (solo only — household lists require the relational schema, since there's no household-aware JSON shape); scope-aware realtime with the monotonic channel-topic fix from Step 2; query timeouts (28s items / 18s aux on mobile — `raceShoppingQuery`) so a hung read degrades to an empty state instead of a frozen screen on a native cold-open deep link.

**Web ↔ mobile parity:** copy is deliberately synced word-for-word across platforms; mobile adds query timeouts web doesn't need (native deep-link cold-open is a mobile-specific risk).

---

## Analytics summary

| Event | Fires on | Platforms | Notes |
|---|---|---|---|
| `shopping_list_generated` | Step 1 (generate from plan) | **Web only** | Mobile gap — see Step 1 and Known limitations |
| `shopping_smart_suggestion_add_to_plan` | Step 2b (smart suggestions) | Both | Flag `smart_suggestions_v1` (default ON) |
| `recipe_shopping_list_added` | Step 3 (add from recipe) | Web + mobile | `{ recipeId, ingredientCount, addedCount, mergedCount, platform }` |
| `plan_shopping_synced` | Step 4 (plan-edit sync) | Web + mobile | `{ editKind, addedCount, mergedCount, decrementedCount, removedCount, platform }` |
| `shopping_item_attribution_seen` | Step 6 (household chip first render) | Planned as a follow-up per the household-sharing decision record; not yet confirmed live. | |

## Web ↔ mobile parity — quick reference

| Area | Status |
|---|---|
| Generate from plan (Step 1) | Identical logic, shared generator. **Analytics gap: mobile emits nothing.** |
| Shopping screen (Step 2) | Identical |
| Add from recipe (Step 3) | Identical |
| Plan-edit sync (Step 4) | **Documented divergence** — web wires swap only (no web remove UI); mobile wires swap + remove |
| Update from plan (Step 5) | Identical |
| Household sharing (Step 6) | Identical |
| Pantry staples (Step 7) | Platform-idiomatic affordance, identical outcome |
| Chrome — clear-all, share/export (Step 8) | **Deliberate web omission**, decision-backed |
| Batch-cook → shopping (Known bug) | **Broken on both** — worse on mobile (never appears at all) |

## Automated coverage

- Unit (web): `tests/unit/generateShoppingList.test.ts`, `shoppingAisleOrder.test.ts`, `shoppingDisplayGroups.test.ts`, `shoppingListMeta.test.ts`, `shoppingListPortionParity.test.ts`, `shoppingListPrototypePort.test.tsx`, `shoppingListInteractionParity.test.tsx`, `appendRecipeToShoppingList.test.ts` / `appendRecipeToShoppingListClient.test.ts`, `syncPlanEditToShoppingList.test.ts` / `syncPlanEditToShoppingListClient.test.ts`, `planShoppingSyncFlagParity.test.ts`, `regenerateShoppingListFromPlan.test.ts`, `pantryStaplesShoppingWiring.test.ts`, `shoppingScope.test.ts`, `householdShoppingMigration.test.ts`, `shoppingHouseholdScopeBackwardCompat.test.ts`, `useShoppingListStateHouseholdScope.test.tsx`, `shoppingListHouseholdSurfacing.test.tsx`, `shoppingListEmptyState.test.ts(x)`.
- Unit (mobile): `apps/mobile/tests/unit/shoppingHouseholdParity.test.ts`, `apps/mobile/tests/unit/deeplinkLoadingSkeletons.test.tsx`.
- Maestro: `16_shopping.yaml`, `00e4_shopping_populated.yaml`, plus the shopping tab in the sweep flows (`00z_sweep_tabs.yaml`, `00_screenshot_tour.yaml`).
- Playwright visual: `tabs-shopping-desktop.png` / `tabs-shopping-mobile.png` snapshots in `tests/e2e/__snapshots__`.
- **There is no automated coverage for the batch-cook → shopping bug.** A regression test would need to assert that a batch-cook write is visible in a subsequent `shopping_items` read — which is exactly the assertion that fails today.

## Known limitations

- **Mobile doesn't emit `shopping_list_generated`.** Web fires this event every time a list is generated from the plan; mobile never does. Because iOS is the primary surface, this leaves the tier-gating decision's own revisit trigger — "PostHog shows >15% of Free WAU generating 1-day shopping lists… segmented by `user_tier`" — blind on the platform that matters most. This isn't a documented, intentional divergence; it's a gap.
- **`docs/product/overview.md`'s Shopping List section is out of date.** It lists only auto-generate, group-by-category, check-off, long-press-remove, clear-checked-or-all, and share, and omits aisle ordering, household sync, pantry staples, add-from-recipe, and plan-edit sync entirely. This journey doc is the detailed, current source; `overview.md` should eventually be trimmed to a short pointer here rather than maintained as a second, drifting feature list.
- **Cook Mode and batch cook have no dedicated journey doc.** This doc links forward to `docs/journeys/discover-and-library.md` for that flow, but the file doesn't exist yet. The flow has Maestro coverage (see Automated coverage above) but no written narrative home.

## Open product questions

- **Should the batch-cook → shopping bug be fixed before it's relied on or marketed?** The write path is broken on both platforms today (see Known bug above); until it's fixed, batch-cook → shopping should not be described as working.
- **Should web gain a per-meal "remove from plan" affordance?** The shared plan-edit sync engine already supports a remove path (`{ kind: "remove" }`) — mobile uses it — but web has no UI trigger for it, so the engine's remove branch never fires there. Adding one would close the parity gap in Step 4 for free, but whether that's worth doing before launch, versus accepting it as a lasting platform difference, hasn't been decided.
- **Should either platform support a manual "add custom item" entry?** Neither web nor mobile has a free-text add today — web strips it deliberately (see Step 8's decision record), mobile simply never built it. Shoppers routinely need to add non-recipe items (bin bags, milk) to a generated list, so this is worth revisiting even though nothing is currently planned.

## Related documents

- [meal-planning.md](./meal-planning.md) — the step immediately before this one (plan generation, editing, locking); its Step 4 and its add-from-recipe / keep-in-sync sections are the plan-side mirror of Steps 1–4 here
- `docs/journeys/discover-and-library.md` — forward link for Cook Mode / batch cook (**not yet written** — see Known limitations above)
- [`docs/decisions/2026-04-19-shopping-list-tier-gating.md`](../decisions/2026-04-19-shopping-list-tier-gating.md) — why there's no dedicated shopping paywall
- [`docs/decisions/2026-04-28-shopping-list-web-parity-hybrid.md`](../decisions/2026-04-28-shopping-list-web-parity-hybrid.md) — why web omits clear-all + share/export
- [`household-sharing.md`](./household-sharing.md) — household setup, sharing presets/grid, and the privacy boundary this doc's Step 6 assumes
- [`docs/decisions/2026-04-30-household-aware-shopping-list.md`](../decisions/2026-04-30-household-aware-shopping-list.md) — household-shared list + attribution schema/RLS decision
- [`docs/decisions/2026-06-30-recipe-to-shopping-list.md`](../decisions/2026-06-30-recipe-to-shopping-list.md) — the add-from-recipe design decision
- [`docs/decisions/2026-07-01-plan-to-shopping-list-sync.md`](../decisions/2026-07-01-plan-to-shopping-list-sync.md) — the keep-in-sync design decision
- [`docs/specs/2026-04-28-shopping-empty-state-redesign.md`](../specs/2026-04-28-shopping-empty-state-redesign.md) — empty-state copy/icon spec
- `docs/planning/shopping-list-display-quality-2026-05-11.md` — deferred display-quality issues (duplicate-ingredient rows, aggregate-quantity readability) not covered in this doc's happy path
