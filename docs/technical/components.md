# Component Reference

**Audience:** Developers

## Web Components (`src/app/components/`)

### Feature Components

| Component | Purpose |
|-----------|---------|
| `RecipeDetail` | Full recipe view — nutrition rings, ingredients with macros, cook mode, serving scaler, verify, publish |
| `DiscoverFeed` | Masonry grid of public community recipes with search/filter |
| `Library` | Personal saved recipe grid with sort/filter |
| `MealPlanner` | Drag-and-drop weekly meal planner calendar |
| `NutritionTracker` | Daily macro diary with food logging, progress rings, and water/hydration tracking card |
| `FoodSearch` | USDA/OFF food search panel for ingredient verification |
| `Profile` | User profile editor — body stats, goals, macro targets |
| `RecipeUpload` | Create/import recipe wizard (manual, URL, image) |
| `CookMode` | Step-by-step fullscreen cooking instructions with timer |
| `ShoppingList` | Shopping list with category grouping and check-off |
| `Settings` | App settings — theme, activity-adjusted goals, dashboard widget picker, week start, measurement system, dietary restrictions, notifications, data export |
| `TodayAtAGlance` | Dashboard widget showing today's macro progress |
| `GoPublicDialog` | Dialog to publish a private recipe to community |
| `NotificationsCenter` | Full notifications panel |
| `NotificationsBell` | Header bell icon with unread badge |
| `UpgradePrompt` | Inline banner prompting upgrade |
| `FirstRunChecklist` | Post-onboarding getting-started checklist |

### UI Primitives (shadcn/ui)

42 Radix-based primitives: accordion, alert-dialog, avatar, badge, button, calendar, card, carousel, chart, checkbox, collapsible, command, context-menu, dialog, drawer, dropdown-menu, form, hover-card, input, input-otp, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner (toasts), switch, table, tabs, textarea, toggle, toggle-group, tooltip.

## Mobile Components (`apps/mobile/components/`)

| Component | Purpose |
|-----------|---------|
| `FoodSearchModal` | Bottom-sheet food search — USDA + OFF results, portion picker, original recipe context |
| `BarcodeScannerModal` | Camera overlay for barcode scanning with product lookup |
| `MealTypePicker` | Multi-select chips for meal type tagging (Breakfast/Lunch/Dinner/Snack) |
| `FirstRunChecklist` | Mobile onboarding checklist |
| `haptic-tab` | Tab bar button with haptic feedback |
| `parallax-scroll-view` | ScrollView with parallax header image |

## Mobile Screens (`apps/mobile/app/`)

### Tab Bar (5 visible tabs)

| Tab | Screen | Purpose |
|-----|--------|---------|
| Discover | `(tabs)/index.tsx` | Community recipe feed with search, save, macro chips |
| Library | `(tabs)/library.tsx` | Personal saved recipes |
| Plan | `(tabs)/planner.tsx` | Meal planner with slot toggles, macro indicators, swap, log |
| Track | `(tabs)/tracker.tsx` | Daily/weekly food diary with meal slots, barcode, previous meals |
| More | `(tabs)/more.tsx` | Menu: create, shopping, import, profile, barcode, settings |

### Stack Screens

| Screen | Purpose |
|--------|---------|
| `login.tsx` | Auth — email/password, magic link, Apple Sign-In |
| `onboarding.tsx` | 15-step profile setup with TDEE calculator |
| `recipe/[id].tsx` | Recipe detail with portion-adjusted view, macro rings, ingredients |
| `recipe/verify.tsx` | Ingredient-level nutrition verification with USDA search |
| `create-recipe.tsx` | Manual recipe creation with food search, meal type picker |
| `import-shared.tsx` | URL import with review screen and meal type picker |
| `shopping.tsx` | Shopping list with clear/remove/share |
| `cook.tsx` | Cook mode (step-by-step fullscreen) |
| `paywall.tsx` | Subscription paywall (IAP pending) |
| `profile.tsx` | Profile & macro target editor |

## Related Documents
- [Technical Architecture](architecture.md)
- [UX/UI Patterns](../ux/patterns.md)
