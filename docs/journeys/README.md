# User journeys

Narrative **entry → action → result** docs for QA, PM, and engineering. Each file is self-contained; cross-links go to Maestro / Playwright where automation exists.

| Journey | Doc | Automated coverage |
|---------|-----|--------------------|
| Food tracking (Today, quick add, logging) | [food-tracking.md](./food-tracking.md) | Maestro `02_today_screen`, `33_meal_journal`, `32_food_search_modal`; Playwright `journeys/today-authenticated.spec.ts` (Today shell) |
| Meal planning | [meal-planning.md](./meal-planning.md) | Maestro `03_meal_plan` |
| Recipe import | [import-recipe.md](./import-recipe.md) | Maestro `25_import_shared` |
| Ingredient verify | [verify-ingredients.md](./verify-ingredients.md) | Maestro `26_recipe_verify` (manual suite — gated) |
| Progress / recap | [progress.md](./progress.md) | Maestro `07_progress`, `27_progress_metric` |
| Shortcuts & widgets | [shortcuts-and-widgets.md](./shortcuts-and-widgets.md) | Partial — see doc |

**Gaps (no dedicated journey doc yet — track in Maestro / matrix):** household (`household-settings`, Maestro flows under settings), Health Sync (`24_health_sync`), weight tracker (`14_weight_tracker`), create recipe (`21_create_recipe`). See [`docs/qa/SCREEN_TEST_MATRIX.md`](../qa/SCREEN_TEST_MATRIX.md) for screen ↔ flow traceability.
