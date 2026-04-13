# Platemate Test Plan

**Audience:** QA / Developers

## Test Inventory

### Unit Tests (17 files, 141 tests)

| ID | File | Tests | Area | Priority |
|----|------|-------|------|----------|
| U01 | `calculateTargets.test.ts` | 1 | TDEE → macro targets | Critical |
| U02 | `generateMealPlan.test.ts` | 1 | Web meal plan algorithm | Critical |
| U03 | `mealPlanAlgo.test.ts` | 9 | Mobile meal plan algorithm | Critical |
| U04 | `parseIngredientLine.test.ts` | 8 | Ingredient text parsing | Critical |
| U05 | `estimateIngredientMacros.test.ts` | 25 | Local nutrition estimation | Critical |
| U06 | `measureToGrams.test.ts` | 28 | Unit → gram conversion | Critical |
| U07 | `classifyMealType.test.ts` | 18 | Meal type classification | High |
| U08 | `parseRecipeFromHtml.test.ts` | 15 | HTML recipe extraction | Critical |
| U09 | `persistence.test.ts` | 4 | localStorage snapshots | Medium |
| U10 | `portionMultiplier.test.ts` | 3 | Serving scaling | High |
| U11 | `shoppingDisplayGroups.test.ts` | 5 | Shopping list grouping | Medium |
| U12 | `smartSuggestions.test.ts` | 2 | Recipe suggestions | Low |
| U13 | `stripeTier.test.ts` | 3 | Stripe → tier mapping | High |
| U14 | `trackerStats.test.ts` | 3 | Tracker aggregation | High |
| U15 | `imperial.test.ts` | 3 | Unit conversion | Medium |

### Integration Tests (2 files)

| ID | File | Tests | Area | Priority |
|----|------|-------|------|----------|
| I01 | `stripe-webhook-process.test.ts` | 3 | Stripe webhook handling | Critical |
| I02 | `verify-recipe-route.test.ts` | 2 | Verify API error cases | High |

### E2E Tests (4 files)

| ID | File | Area | Priority |
|----|------|------|----------|
| E01 | `auth-and-public.spec.ts` | Login, public pages | Critical |
| E02 | `authenticated-views.spec.ts` | App shell views | High |
| E03 | `platemate-natural-language.spec.ts` | AI-driven tests | Low |
| E04 | `views-placeholder.spec.ts` | View placeholders | Low |

---

## Human-Style Test Cases

### TC-001: Import Recipe from URL
**Area:** Recipe Import | **Priority:** Critical | **Role:** Authenticated user

**Preconditions:** User is logged in, dev server running

**Steps:**
1. I open the Import screen from the More tab
2. I paste "https://downshiftology.com/recipes/chicken-stir-fry/" into the URL field
3. I tap "Import"
4. I wait for the recipe to load
5. I see the review screen with recipe title and macros
6. I select "Dinner" and "Lunch" in the meal type picker
7. I tap "Save to Library"

**Expected:**
- Recipe title shows "Chicken Stir Fry"
- Per-serving macros are displayed (calories, protein, etc.)
- After save, success screen shows with "View recipe" and "Review ingredients" buttons
- Recipe appears in my Library tab
- Recipe has meal_type = ["dinner", "lunch"] in the database

**Edge cases:**
- Pinterest URL → should resolve to actual recipe source
- URL with no JSON-LD → should show clear error message
- Rate limited → should show "Too many requests" message
- Not signed in → should show sign-in prompt

---

### TC-002: Verify Ingredient Nutrition
**Area:** Nutrition Verification | **Priority:** Critical | **Role:** Authenticated user

**Preconditions:** User has an imported recipe in their library

**Steps:**
1. I open a recipe from my Library
2. I tap "Edit" on the Ingredients section
3. I see the verify screen with all ingredients listed
4. I tap on "chicken breast" to expand it
5. I see the full macro breakdown (cal, protein, carbs, fat, fiber)
6. I tap "Search alternative"
7. I see the search modal with "boneless skinless chicken breast" pre-filled
8. I see "Recipe calls for: 1 lb chicken breast" in italic
9. The portion is pre-set to "lb" with quantity "1"
10. I tap "Use this" on the top USDA result
11. I tap "Save Changes"

**Expected:**
- Search results show USDA data with kcal/P/C/F per 100g
- Portion pill shows "lb" selected (matching original recipe unit)
- After using a result, ingredient macros update in the list
- Per-serving totals at bottom update in real-time
- After save, recipe detail shows updated macros

**Edge cases:**
- USDA search returns no results → should show "Tap for nutrition info"
- Barcode scan returns no match → should show alert
- Very long ingredient name → should truncate with ellipsis

---

### TC-003: Daily Food Tracking
**Area:** Tracker | **Priority:** Critical | **Role:** Authenticated user

**Preconditions:** User is logged in with profile targets set

**Steps:**
1. I open the Track tab
2. I see today's date with "Day" view selected
3. I see my calorie target from my profile (not 2000 default)
4. I see four meal sections: Breakfast, Lunch, Dinner, Snack
5. I tap "ADD FOOD" under Breakfast
6. I see the quick-log form with "Log to Breakfast" title
7. I switch to "Lunch" using the slot picker tabs
8. I enter "Chicken salad", 350 calories, 30 protein, 20 carbs, 15 fat
9. I tap "Add to Today"
10. I see the entry appear under the Lunch section
11. I long-press the entry
12. I see "Delete entry" confirmation
13. I tap "Delete"

**Expected:**
- Calorie hero shows remaining (or "+X over" in red if exceeded)
- Macro progress bars show actual vs target
- Meal sections show per-slot totals
- Entry appears under the correct meal slot
- After deletion, totals update immediately
- Data persists after closing and reopening the app

**Edge cases:**
- Over budget → hero number turns red, shows "+250 kcal over"
- All four add methods work: Quick Add, Search, Scan, Previous
- Week view shows 7-day bar chart
- Navigate to previous/next day with arrows

---

### TC-004: Generate Meal Plan
**Area:** Planner | **Priority:** Critical | **Role:** Authenticated user with saved recipes

**Preconditions:** User has 5+ saved recipes with meal_type tags

**Steps:**
1. I open the Plan tab
2. I see my recipe count and day picker
3. I toggle off "Snack" in the meal slot selector
4. I select "3 days"
5. I tap "Generate Plan"
6. I see 3 days, each with Breakfast, Lunch, Dinner (no Snack)
7. Each day shows total calories and per-macro indicators (✓, +N, -N)
8. I long-press a dinner meal
9. I see alternative recipe options
10. I tap a different recipe
11. The day totals recalculate
12. I tap the "+" icon on a meal
13. I see "Logged" confirmation

**Expected:**
- Macros targets come from my profile, not hardcoded 2000
- Breakfast-tagged recipes appear only in Breakfast slot
- Days have different meals (not identical)
- Portion multiplier shows when recipe is scaled (e.g. "0.75x")
- Swap updates totals immediately
- Log button writes to today's nutrition journal

---

### TC-005: Shopping List Management
**Area:** Shopping | **Priority:** High | **Role:** Authenticated user with a meal plan

**Preconditions:** User has generated a meal plan and shopping list

**Steps:**
1. I open Shopping from the More menu
2. I see items grouped by category with a progress bar
3. I tap an item to check it off
4. I see the strikethrough and progress bar update
5. I long-press an item
6. I see "Remove item" confirmation
7. I tap "Remove"
8. I tap the trash icon in the header
9. I see "Clear shopping list" confirmation
10. I tap the share icon
11. System share sheet opens

**Expected:**
- Items grouped by category (Produce, Meat, Dairy, etc.)
- Check/uncheck toggles correctly
- "Remove X checked items" button appears when items are checked
- Clear all removes everything with confirmation
- Share opens system share sheet with unchecked items as text

---

### TC-006: Onboarding Flow
**Area:** Onboarding | **Priority:** Critical | **Role:** New user

**Steps:**
1. I create a new account
2. I am redirected to onboarding
3. I select "Lose weight" as my goal
4. I enter my stats: female, age 28, 165cm, 70kg, goal 60kg
5. I select "Moderate" activity
6. I select "Steady" pace
7. I see my calculated calorie budget
8. I select "High protein" strategy
9. I complete remaining steps
10. I see the summary screen
11. I tap "Start"

**Expected:**
- TDEE is calculated correctly from stats
- Calorie budget reflects goal (deficit for "lose")
- Profile is saved to Supabase with correct targets
- `onboarding_completed` is set to true
- Goal saved as "cut" (not "lose") in the database
- After finishing, I see the main app (not onboarding again)

---

### TC-007: Save/Bookmark Recipe
**Area:** Discover + Library | **Priority:** High | **Role:** Authenticated user

**Steps:**
1. I open the Discover tab
2. I see recipe cards with bookmark icons
3. I tap the bookmark icon on a recipe
4. The icon fills in (solid bookmark)
5. I switch to the Library tab
6. The recipe appears in my library
7. I go back to Discover and tap the bookmark again
8. The icon unfills (outline)
9. The recipe disappears from my Library

**Expected:**
- Bookmark toggle is instant (optimistic UI)
- If save fails (network error), bookmark reverts
- Console shows error message on failure
- Both bookmark icons are Ionicons "bookmark" (not stars)

---

### TC-008: Recipe Detail with Portion Adjustment
**Area:** Recipe Detail | **Priority:** High | **Role:** Authenticated user

**Preconditions:** User has a meal plan with a portion-scaled meal

**Steps:**
1. I open the Plan tab
2. I tap a meal that shows "(0.75x)"
3. Recipe detail opens with a purple banner: "Planned portion: 0.75x"
4. Ingredient amounts are scaled (e.g. "1 lb" → "0.75 lb")
5. Macro rings reflect the scaled values

**Expected:**
- Banner only shows when `?portion=` param is present
- Ingredient amounts are multiplied by the portion
- Without the param, recipe shows at 1x
- Instructions text is visible (not border-coloured)

---

## Smoke Tests (run before every release)

1. Can sign in with email/password
2. Discover feed loads with recipes
3. Can import a recipe from URL
4. Verify screen opens and shows ingredients
5. Can generate a 1-day meal plan
6. Tracker loads and shows meal slots
7. Can quick-log a meal
8. Shopping list loads (or shows empty state)

## Regression Tests (run weekly)

All unit tests (141) + integration tests (5) + E2E auth tests + all 8 smoke tests above.

---

## Related Documents
- [Testing Overview](overview.md)
- [Technical Architecture](../technical/architecture.md)
