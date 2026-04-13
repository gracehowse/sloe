# Product Overview

**Audience:** All

## What is Platemate?

Platemate is a recipe and nutrition tracking platform that helps users import recipes from the web, verify their nutritional content against USDA/FDA databases, plan meals to hit personal macro targets, and track daily food intake.

## Who is it for?

Health-conscious home cooks who want accurate nutrition data for the recipes they actually cook — not generic database entries. Primary personas:

- **Macro trackers** — people counting protein/carbs/fat for fitness goals
- **Meal preppers** — people who plan weekly meals in advance
- **Recipe collectors** — people who save recipes from food blogs and want them in one place with nutrition data

## Platforms

| Platform | Technology | Status |
|----------|-----------|--------|
| Web | Next.js 15 (App Router) | Production |
| iOS | React Native / Expo | Development |
| Android | React Native / Expo | Development |

## Core Value Proposition

1. **Import any recipe** — paste a URL, we extract ingredients and instructions automatically
2. **Real nutrition data** — verified against USDA FoodData Central, Open Food Facts, and FatSecret
3. **Smart meal planning** — macro-aware algorithm that respects meal type tags and portion-scales to hit targets
4. **Track everything** — daily/weekly food diary with barcode scanning and previous meal re-logging

## Feature Map

### Recipe Management
- Import from URL (JSON-LD extraction from any recipe site)
- Import from social (Instagram/TikTok via OpenAI caption parsing)
- Manual recipe creation with ingredient search
- Ingredient-level nutrition verification with USDA food search
- Barcode scanning for packaged foods
- Portion-adjusted recipe viewing
- Cook Mode (step-by-step fullscreen instructions)
- Recipe publishing and community feed

### Nutrition
- Multi-source verification pipeline (USDA -> OFF -> FatSecret -> local estimation)
- 60+ staple foods with fiber data for estimation fallback
- Per-ingredient macro display (calories, protein, carbs, fat, fiber, sugar, sodium)
- Confidence scoring and source attribution

### Meal Planning
- Configurable meal slots (Breakfast/Lunch/Dinner/Snack — toggle any on/off)
- Macro-aware scoring algorithm with portion scaling (0.5x to 2x)
- Profile-synced targets (calories, protein, carbs, fat)
- Per-macro over/under indicators per day
- Swap individual meals without regenerating entire plan
- Log planned meals directly to tracker
- Auto-generate shopping list from plan

### Food Tracking
- Daily view with meal slot sections (Breakfast/Lunch/Dinner/Snack)
- Weekly view with calorie bar chart and macro breakdown
- Quick-log manual entry
- Search USDA/OFF food database
- Barcode scanner
- Re-log from previous meals
- Delete entries (long-press)
- Profile-synced targets with over/under display

### Shopping List
- Auto-generated from meal plan
- Grouped by category
- Check off items
- Remove individual items (long-press)
- Clear checked / clear all
- Share via system share sheet (Apple Reminders compatible)

### User Profile
- 15-step onboarding with TDEE calculator
- Activity level, goal (cut/maintain/bulk), macro strategy
- Custom calorie/protein/carbs/fat/fiber/water targets
- Measurement system preference (metric/imperial)
- Apple Sign-In, email/password, magic link auth

### Monetisation
- Free / Base ($5/mo) / Pro ($12/mo) tiers
- Stripe integration (web)
- Mobile paywall UI (IAP integration pending)

## Related Documents
- [Technical Architecture](../technical/architecture.md)
- [User Journeys](../journeys/)
- [API Reference](../api/)
- [Data Schema](../data/schema.md)
