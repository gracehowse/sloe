# Mob app — inspiration & observations (come back here)

Reference notes from **Mob** (meal planning / recipe app) for **look-and-feel** and **behaviors** we may want on Suppr. Not a spec—capture ideas and revisit when prioritizing design or features.

Session screenshots (if available locally) may live under the Cursor project `assets/` folder; this doc stands alone without them.

---

## Visual & UX (look and feel)

- **Typography:** Bold black headings, lighter grey secondary copy; lots of whitespace; calm, editorial feel.
- **Shape:** Generous **rounded corners** on cards, images, and chips; soft, modern iOS-ish aesthetic.
- **Imagery:** **Image-first** recipe cards (large hero photos), small square thumbs for list rows (e.g. shopping items).
- **Navigation:**
  - **Top tabs** on the plan screen: **Recipes | Shopping list** with a clear active underline.
  - **Bottom tab bar:** Discover, Search, Shopping list (with **badge count** for list items), Liked.
- **Plan header:** e.g. “Your first plan” with chevron—suggests **multiple named plans** over time.
- **Shopping list:** Grouped under **category headers** (e.g. Meat & Fish, Fruit & Veg); each row: **thumbnail + quantity + name + right-aligned checkbox**; “Add your own…” style affordance at top.

---

## Functionality we liked

- **Smart suggestions:** Section like **“Smart suggestions ✨”** — *dishes that share ingredients with recipes already in your plan*. Each suggestion shows **“Also uses …”** with overlapping staples (so users see **why** it’s suggested: less waste, fewer one-off buys).
- **Ingredient aggregation:** Shopping lines that **combine** contributions from multiple recipes in one readable quantity (e.g. **“300g + 2 Chicken Breast”** when different recipes express the same protein differently)—implies strong **merge/display** logic, not only blind summing.
- **Quick add:** **+** on recipe cards to add to plan / list without deep navigation.
- **Collections / hero rails:** Large “personalised” or themed carousels (e.g. meal prep lunches) with **View recipes** CTA—good pattern for **curated entry points** alongside algorithmic feed.

---

## Suppr today (rough parity)

- **Shopping:** We **merge** ingredients across recipes with **categories**; numeric amounts **scale** with **portion multipliers** on planner slots (see `portionMultiplier` / `generateShoppingList.ts`). **Display grouping** now merges rows that share a **normalized ingredient name** and shows **mixed units** as `amount unit + amount unit` (no false summing)—see `shoppingDisplayGroups.ts` + `ShoppingList.tsx`. We still do **not** show Mob-style **thumbnails per line**.
- **Discover / feed:** Strong scroll and save; different information architecture than Mob’s category grid + rails (both are valid).
- **Smart suggestions:** **Shipped (two surfaces)** —
  - Plan tab (ENG-1193): overlap with meals already on the plan (`smartSuggestions.ts`); save-to-library.
  - Shopping list (ENG-1634): overlap with the current list + remaining-macro fit annotation (`shoppingSmartSuggestions.ts`); one-tap Add to plan via ENG-957 list sync. Flag `smart_suggestions_v1` (default OFF).

---

## Backlog ideas (prioritize later)

1. **Smart suggestions — place on a plan day** — ENG-1634 Add to plan currently merges ingredients into the list; a day-picker that also inserts the meal onto the weekly grid is the follow-up.
2. **Shopping list UX pass** — Category headers polish, optional **recipe thumbnails** where we have images, **badge** on nav for unchecked count.
3. **Plan switcher** — Named plans (“Week of …”, “Your first plan”) if we outgrow a single `mealPlan`.
4. **Stronger merge heuristics** — Same-unit conversion (e.g. g ↔ kg) before summing, where safe.
5. **Themed collections / rails** — Editorial carousels on Discover (reuse feed data + manual collections).

---

## Related code (when implementing)

- Planner + portions: `MealPlanner.tsx`, `generateMealPlan.ts`, `portionMultiplier.ts`.
- List merge: `generateShoppingList.ts`, `guessGroceryCategory` / `category.ts`, `shoppingDisplayGroups.ts`, `ingredientNameKey.ts`.
- Ingredients source: Supabase `recipe_ingredients` (and saved/library recipe data in app state).

Update this file as you decide what to ship and what to drop.
