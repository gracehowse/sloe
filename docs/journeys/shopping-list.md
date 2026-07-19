# User Journey: Shopping List

**Audience:** Product / Design / Engineering

## One-line purpose
Turn a meal plan (or a single recipe) into an aisle-ordered, real-time-synced shopping list that stays correct as the plan changes and clears items automatically the user already has on hand.

## Scope

**In scope:** generating a list from the plan, the shopping screen itself (grouping, check-off, progress, realtime), adding a single recipe to the list, keeping the list in sync as the plan is edited, the non-destructive "Update from plan" re-sync, household-shared lists + check attribution, pantry staples, and the web/mobile chrome differences.

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

Both platforms route through the **same shared generator** — `generateShoppingListFromRecipeEntries[Async]` (`src/lib/planning/generateShoppingList.ts`, re-used by mobile via `@suppr/shared/planning/generateShoppingList`) — so quantities and aisle placement match by construction. This closed a prior mobile under-buy bug where `portionMultiplier` was silently ignored.

**Web:** `src/context/AppDataContext.tsx:1622` (`generateShoppingListFromPlan`), `src/app/components/MealPlanner.tsx:665` (`handleShoppingList` → generate + `onNavigate("shopping")`).
**Mobile:** `apps/mobile/app/(tabs)/planner.tsx:2077` (`generateShoppingListFromPlan`), `apps/mobile/app/(tabs)/planner.tsx:2567` (auto-rebuild after regenerate).

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

**What happens next:** the user either finishes shopping (list stays as a record), or hits one of the update paths below (Steps 3–5) if the plan or a recipe changes mid-week.

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

## Known bug — batch-cook "scale to shopping" writes to a dead table

**This is broken today on both platforms — do not describe it as working until it's fixed.**

**What it's supposed to do:** on the batch-cook screen, scaling a recipe to N portions and hitting Save/Cook should add the scaled ingredients to the shopping list, the same way Step 3's single-recipe add does.

**What it actually does:** it generates the scaled rows correctly through the shared generator and pantry filter, but persists them via `upsertShoppingListJsonItems` — which writes to the **legacy JSON blob table** (`shopping_lists`, which migration `20260413100000_relational_user_data.sql` renamed to `shopping_lists_legacy`), **not** the relational `shopping_items` table the shopping screen actually reads.

The mismatch is visible on both sides of the code:
- `src/lib/supabase/shoppingJsonFallback.ts` — its own header comment says: *"After migration `20260413100000_relational_user_data.sql`, `shopping_lists` is renamed to `shopping_lists_legacy`; new data lives in `shopping_items`."* `upsertShoppingListJsonItems` still targets `SHOPPING_LIST_JSON_TABLES = ["shopping_lists", "shopping_lists_legacy"]`.
- `src/context/appData/useShoppingListState.ts` (web) and `apps/mobile/app/shopping.tsx` — both read `shopping_items` on the happy path, and only fall through to the JSON fallback **when the relational query errors** (missing-table detection). In production `shopping_items` exists and returns rows successfully, so the JSON fallback read path never executes.

**Net effect:**
- **Mobile** (`apps/mobile/app/batch-cook.tsx:44` `scaleToShopping`, `:92` the JSON-blob write): the scaled items are written to `shopping_lists_legacy` and never surface. Tapping "View list" opens `/shopping`, which reads `shopping_items` and shows nothing new — the items are silently absent.
- **Web** (`src/app/components/MealPlanner.tsx:1070` `scaleBatchCookToShopping`): additionally calls `setShoppingItems(filtered)` in memory, which **replaces** (does not merge into) the currently-rendered list with just the batch items for the rest of the session. So the batch items appear to work in the moment — but they've also silently hidden the rest of the list from view until the next fetch — and on reload, `useShoppingListState` re-reads the relational `shopping_items` table, which never got the batch write, so both the batch items and the illusion of success vanish.

**This reads as a bug, not a deliberate ephemeral design:** the surrounding code (pantry filtering, the shared generator, the "View list" CTA) is written as if this is meant to persist durably like every other path in this doc. There's no comment marking the JSON-blob write as intentional or ephemeral. It reads as a write path that was never migrated when `shopping_items` became canonical.

**Status:** open, unresolved. The likely fix is to swap `upsertShoppingListJsonItems` for the same delta-merge persistence Step 3 already uses (`appendRecipeToShoppingList`-style), on both platforms.

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
