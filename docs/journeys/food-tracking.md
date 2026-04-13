# User Journey: Food Tracking

**Audience:** Product / Design

## Overview
User logs food throughout the day, tracks progress against their calorie and macro targets, and reviews weekly trends.

## Entry Points
- Track tab on the bottom navigation

## Day View

### Layout
```
┌─────────────────────────────┐
│  Day | Week  toggle         │
│  ‹  Today  ›  (date nav)   │
├─────────────────────────────┤
│  1,240 kcal left            │  ← hero number (red "+250 over" when exceeded)
│  ███████░░░░ Food / Goal    │  ← calorie bar (red when over)
├─────────────────────────────┤
│  PROTEIN  ███████░ 60g/93g  │
│  CARBS    █████░░░ 80g/124g │
│  FATS     ████░░░░ 30g/41g  │
├─────────────────────────────┤
│  Goal - Food = Remaining    │  ← calorie math (shows "Over" in red)
├─────────────────────────────┤
│  Breakfast                  │
│  ├─ Protein Oats  506 kcal  │  ← long-press to delete
│  └─ [ADD FOOD]              │  ← opens quick-log for Breakfast slot
│  Lunch                      │
│  └─ [ADD FOOD]              │
│  Dinner                     │
│  └─ [ADD FOOD]              │
│  Snack                      │
│  └─ [ADD FOOD]              │
├─────────────────────────────┤
│  [+ Quick Add] [Search]    │
│  [Scan]        [Previous]  │  ← action buttons
└─────────────────────────────┘
```

### Adding Food

**Quick Add** — manual entry form:
- Meal slot switcher (Breakfast/Lunch/Dinner/Snack tabs)
- Fields: food name, calories, protein, carbs, fat
- "Add to Today" button

**Search** — FoodSearchModal:
- Search USDA + Open Food Facts databases
- Select food → portion picker → Use this
- Logged to the active meal slot

**Scan** — BarcodeScannerModal:
- Camera barcode scanning
- Product lookup via Open Food Facts
- Auto-logs to active meal slot

**Previous** — recent meals panel:
- Shows up to 20 unique meals from journal history
- Tap to re-log to today under active slot

### Deleting Food
Long-press any logged entry → confirmation dialog → removes from journal.
Both web and mobile issue a `DELETE` against `nutrition_entries` so the removal persists across sessions and devices.

### Date Navigation
- `‹` and `›` arrows to move between days
- Tap date label to jump to today
- Shows "Today", "Yesterday", or "Mon 7 Apr" format

## Week View

### Layout
```
┌─────────────────────────────┐
│  Weekly Calories            │
│  Mon Tue Wed Thu Fri Sat Sun│
│  ▓▓▓ ▓▓▓ ▓   ▓▓            │  ← bar chart (red bars = over target)
│  Daily goal: 1,240 kcal    │
├─────────────────────────────┤
│  Weekly Summary             │
│  8,680 total  1,240 avg  0 │
│  Total kcal   Daily avg  Over│
├─────────────────────────────┤
│  Daily Averages             │
│  PROTEIN  ███████░ 85g/93g  │
│  CARBS    █████░░░ 95g/124g │
│  FATS     ████░░░░ 35g/41g  │
├─────────────────────────────┤
│  Macro Breakdown            │
│  Mon ████████████ 1,240     │  ← stacked P/C/F bar per day
│  Tue ████████████ 1,180     │
│  ...                        │
│  🔴 Protein  🔵 Carbs  🟡 Fat│
└─────────────────────────────┘
```

- Tap any day bar to drill into Day view for that date
- Week navigation with `‹` `›` arrows
- Weekly average calculated from days with logged food only

## Data Storage
- Primary: `nutrition_entries` relational table (one row per logged meal)
- Fallback: `nutrition_journals` legacy JSON blob keyed by date (`YYYY-MM-DD`)
- Each entry: `{ id, name (slot), recipeTitle, time, calories, protein, carbs, fat, fiberG, waterMl, portionMultiplier }`
- Additions: debounced upsert to Supabase (600ms delay)
- Deletions: immediate `DELETE` by entry ID on both web and mobile

## Related Documents
- [Journey: Meal Planning](meal-planning.md)
- [Product: Feature Map](../product/overview.md#food-tracking)
