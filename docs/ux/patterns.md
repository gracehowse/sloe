# UX/UI Patterns

**Audience:** Design / Product

## Design System

### Colours (Mobile)

```typescript
Neon = {
  purple: "#7c3aed",  // Primary brand
  pink: "#ec4899",    // Accents, saved state
  green: "#22c55e",   // Success, verified, within target
  red: "#ef4444",     // Error, over target, destructive
  yellow: "#f59e0b",  // Warning, under target, needs review
  blue: "#3b82f6",    // Carbs macro
  cyan: "#06b6d4",    // Remaining, water
  orange: "#f97316",  // Sodium
}

MacroColors = {
  calories: purple,
  protein: red,
  carbs: blue,
  fat: yellow,
  fiber: green,
  sugar: purple,
  sodium: orange,
  water: cyan,
}
```

### Spacing / Radius
- `Spacing: xs(4) sm(8) md(12) lg(16) xl(20) xxl(24) xxxl(32)`
- `Radius: sm(8) md(12) lg(16) xl(20) full(9999)`

## Interaction Patterns

### Long-press Actions
Used throughout for destructive/secondary actions:
- **Tracker**: long-press logged meal → delete with confirmation
- **Planner**: long-press planned meal → swap from library
- **Shopping**: long-press item → remove with confirmation

### Meal Slot Picker
Horizontal row of togglable chips (Breakfast / Lunch / Dinner / Snack):
- Used in: tracker quick-log, import review, create-recipe, planner config
- Active state: purple background, white text, checkmark icon
- Inactive: border only, secondary text

### Calorie/Macro Display
Two patterns:
1. **Hero number** — large central number for the primary metric (calories remaining)
2. **Progress bars** — horizontal bars with label/value for each macro

Over-budget indicator: number turns red, shows "+" prefix, label changes to "kcal over"

### Recipe Cards (Discover)
```
┌──────────────────┐
│  [Recipe Image]  │
│        254 kcal  │  ← top-right badge
├──────────────────┤
│  Recipe Title    │
│  P 25g C 7g F 13│  ← macro chips (coloured borders)
│  Source   [🔖]   │  ← creator name + bookmark toggle
└──────────────────┘
```

### Save/Bookmark
Consistent across all screens: Ionicons `bookmark` (filled) / `bookmark-outline` (empty), pink when saved.

### Food Search Modal
Full-screen modal with:
- Search input with auto-search on 400ms debounce
- Results list with per-100g macros (kcal, P, C, F)
- Tap result → preview card with:
  - Food name
  - Original recipe context in italic ("Recipe calls for: 1 lb chicken breast")
  - Portion pills (g, oz, lb, tbsp, tsp, cup, ml + USDA portions)
  - Quantity input with ± buttons
  - Live-updating nutrition display
  - "Use this" / "Back to results" buttons

### Weekly Bar Chart
Vertical bars for Mon-Sun:
- Height proportional to calories (scaled to max of target or highest day)
- Purple bars for normal, red for over-target
- Small calorie number above each bar
- Today's label in bold purple
- Tap any bar to drill into Day view

## Empty States
- **No recipes**: plate emoji + "No recipes yet" + pull-to-refresh hint
- **No search results**: magnifying glass + "No results for X" + try different term
- **No meals logged**: "No meals logged yet today" + ADD FOOD button
- **No shopping list**: cart emoji + "No shopping list yet" + link to planner

## Related Documents
- [Component Reference](../technical/components.md)
- [Product Overview](../product/overview.md)
