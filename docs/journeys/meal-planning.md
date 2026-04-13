# User Journey: Meal Planning

**Audience:** Product / Design

## Overview
User generates a macro-aware meal plan from their saved recipes, with configurable slots, portion scaling, and the ability to swap, log, and generate a shopping list.

## Entry Points
- Plan tab on the bottom navigation

## Flow

### Step 1: Configure
```
Plan screen shows:
  → Number of saved recipes in library
  → Day selector: 1, 3, or 7 days
  → Meal slot toggles: Breakfast ✓, Lunch ✓, Snack ✓, Dinner ✓
    (toggle any off — e.g. exclude Snack)
  → "Generate Plan" button
```

### Step 2: Generate
```
Tapping Generate:
  → Fetches profile targets from Supabase (calories, protein, carbs, fat)
  → Runs generateSmartPlan() with:
    - Saved recipes + their meal_type tags
    - Enabled slots
    - Profile targets
  → Algorithm per day:
    1. Filter recipes by meal type per slot
    2. Sample 20K combinations with per-day unique seed
    3. Compute portion multipliers (0.5x-2x) per slot calorie target
    4. Score against macro targets (protein weighted 4x)
    5. Heavy recency penalty (40/recipe) for variety across days
  → Returns DayPlan[] with meals, multipliers, totals
  → Persists to Supabase meal_plans table
```

### Step 3: Review Plan
```
Each day shows:
  → Day title + total calories
  → Per-macro indicators: P/C/F with ✓ (within 15%), +N (over), -N (under)
  → Per-meal: slot name, recipe title, portion if != 1x, macros (kcal/P/C/F)
  → Tap meal → navigates to recipe with ?portion=X for adjusted quantities
  → + icon → logs meal directly to today's tracker
  → Long-press meal → swap with alternative from library
```

### Step 4: Generate Shopping List
```
"Generate Shopping List" button:
  → Fetches all recipe_ingredients for planned recipes
  → Merges quantities (2x chicken breast → combined weight)
  → Categorises by grocery section
  → Upserts to Supabase shopping_lists table
  → Navigates to /shopping
```

## Edge Cases
- No saved recipes → alert with instructions to save from Discover
- < 4 recipes → some slots may repeat; recency penalty minimises this
- Meal type not tagged → treated as fitting any slot (legacy data)
- Profile targets not set → falls back to 2000/150/200/65 defaults

## Related Documents
- [Journey: Food Tracking](food-tracking.md)
- [Product: Feature Map](../product/overview.md#meal-planning)
- [Technical: Meal Planning Algorithm](../technical/architecture.md#meal-planning)
