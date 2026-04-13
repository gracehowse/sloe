# Technical Architecture

**Audience:** Developers

## System Overview

```
┌──────────────────────────────────────────────────┐
│                    Clients                        │
│  ┌──────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ Web App  │  │ iOS (Expo)   │  │ Android    │ │
│  │ Next.js  │  │ React Native │  │ (Expo)     │ │
│  └────┬─────┘  └──────┬───────┘  └─────┬──────┘ │
└───────┼────────────────┼────────────────┼────────┘
        │                │                │
        ▼                ▼                ▼
┌──────────────────────────────────────────────────┐
│              Next.js API Routes                   │
│  /api/recipe-import   /api/nutrition/verify-recipe│
│  /api/usda/search     /api/usda/food              │
│  /api/stripe/checkout /api/stripe/webhook         │
│  /api/off/barcode     /api/barcode-mapping        │
└───────┬──────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────┐
│              External Services                    │
│  ┌─────────┐ ┌─────┐ ┌──────────┐ ┌───────────┐│
│  │Supabase │ │USDA │ │Open Food │ │ FatSecret ││
│  │Auth + DB│ │ FDC │ │  Facts   │ │   API     ││
│  └─────────┘ └─────┘ └──────────┘ └───────────┘│
│  ┌─────────┐ ┌──────┐ ┌──────────┐             │
│  │ Stripe  │ │OpenAI│ │ Upstash  │             │
│  │Payments │ │ GPT  │ │  Redis   │             │
│  └─────────┘ └──────┘ └──────────┘             │
└──────────────────────────────────────────────────┘
```

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Web framework | Next.js (App Router) | 15.5.0 |
| UI library | React | 18.3.1 |
| Mobile framework | React Native / Expo | SDK 53 |
| Language | TypeScript | 6.0.2 |
| Database | Supabase (PostgreSQL) | Hosted |
| Auth | Supabase Auth | Via SDK |
| Styling (web) | Tailwind CSS + shadcn/ui | 4.1.12 |
| Styling (mobile) | React Native StyleSheet | N/A |
| Payments | Stripe | ^22 |
| Analytics | PostHog | posthog-js |
| Error tracking | Sentry | @sentry/nextjs |
| Rate limiting | Upstash Redis | With in-memory fallback |
| CI/CD | GitHub Actions | Node 20 |
| Hosting | Vercel (implicit) | Auto-detect |

## Repository Structure

```
/
├── app/                    # Next.js pages and API routes
│   ├── api/                # Server-side API endpoints
│   ├── login/              # Auth pages
│   ├── onboarding/         # Web onboarding
│   ├── pricing/            # Subscription tiers
│   └── recipe/             # Recipe pages
├── src/
│   ├── constants/          # Cross-platform constants (e.g. dietary preference ids)
│   ├── app/components/     # Web UI components
│   ├── context/            # React contexts (auth, app data)
│   ├── data/               # Static data (recipe catalog)
│   ├── lib/                # Shared business logic
│   │   ├── nutrition/      # Macro estimation, verification, TDEE (`tdee.ts`), USDA normalisation
│   │   ├── recipe-import/  # HTML parsing, social import, meal classification
│   │   ├── recipe-ingredients/ # Ingredient line parsing
│   │   ├── planning/       # Meal plan generation
│   │   ├── usda/           # USDA FDC API client
│   │   ├── fatsecret/      # FatSecret API client
│   │   ├── openFoodFacts/  # OFF API client
│   │   └── server/         # Rate limiting, env validation
│   └── types/              # TypeScript type definitions
├── apps/mobile/            # React Native / Expo app
│   ├── app/                # Expo Router screens
│   │   ├── (tabs)/         # Tab bar screens
│   │   └── recipe/         # Recipe detail + verify
│   ├── components/         # Mobile UI components
│   ├── lib/                # Mobile business logic
│   └── constants/          # Theme, colours
├── supabase/
│   ├── schema.sql          # Base database schema
│   └── migrations/         # Incremental schema changes
├── scripts/                # Maintenance scripts
├── tests/                  # Vitest + Playwright tests
└── docs/                   # This documentation
```

## Data Flow

### Recipe Import
```
User pastes URL
  → POST /api/recipe-import
    → Fetch HTML from source site
    → Extract JSON-LD (schema.org Recipe)
    → Decode HTML entities in text
    → Parse recipeYield (handle arrays, ranges)
    → Extract ingredients, instructions, image, nutrition
    → parseRawIngredients() — structured parsing
    → verifyIngredients() — USDA/OFF/FatSecret/estimation
    → classifyMealType() — auto-tag breakfast/lunch/dinner/snack
  ← Return parsed recipe + per-ingredient macros
  → Client shows review screen with MealTypePicker
  → saveImportedRecipe() writes to Supabase
```

### Nutrition Verification
```
Ingredient list + servings
  → verifyIngredients()
    → For each ingredient:
      1. Apply name aliases (UK→US: courgette→zucchini)
      2. Normalise query (strip prep words, extract paren hints)
      3. Search USDA FDC (Foundation/SR Legacy first, then Branded)
      4. Rank by confidenceForMatch() (recall + precision + first-word bonus)
      5. REJECT matches below MIN_MATCH_CONFIDENCE (0.25) — fall through
      6. Fetch top candidate's full food data
      7. Use USDA food portions for gram weight when available
      8. Fall back to OFF text search — requires MIN_OFF_CONFIDENCE (0.4)
      9. Fall back to FatSecret — requires MIN_MATCH_CONFIDENCE (0.25)
      10. Fall back to local estimation (60+ staples with fiber)
    → Sum per-ingredient macros for recipe total
    → Divide by servings for per-serving values
  ← Return verified[], totals, perServing, sourceCounts
```

#### Confidence Policy

All external nutrition sources must meet a minimum confidence threshold before their match is accepted. Matches below the threshold are silently skipped — the pipeline falls through to the next source or to local estimation.

| Source | Threshold | Rationale |
|--------|-----------|-----------|
| USDA FDC | `MIN_MATCH_CONFIDENCE` (0.25) | Foundation/SR Legacy names are standardised; low scores indicate genuine mismatch |
| Open Food Facts | `MIN_OFF_CONFIDENCE` (0.40) | Product names contain brand/variant noise that inflates false positives |
| FatSecret | `MIN_MATCH_CONFIDENCE` (0.25) | Similar to USDA — standardised food names |

Constants are exported from `src/lib/nutrition/verifyIngredients.ts`. Tests in `tests/unit/confidenceGating.test.ts`.

#### Pepper Disambiguation

Bare "pepper" in a recipe (e.g., "salt and pepper") is the spice black pepper (251 kcal/100g, ~3g per use). Colour-qualified peppers ("red pepper", "green pepper", "bell pepper") are vegetables (~31 kcal/100g, ~110g each). This distinction is enforced at three layers:

1. **Parsing** (`parseIngredientLine`): only colour-qualified peppers are treated as countable whole items (assigned `unit: "medium"`)
2. **Weight** (`measureToGrams`, `countableGrams`): colour-qualified peppers → 110g; bare "pepper" → 3g (spice)
3. **Macros** (`estimateIngredientMacros` STAPLES): `"red pepper"`, `"green pepper"`, etc. resolve to bell pepper profile; bare `"pepper"` resolves to black pepper

Tests in `tests/unit/pepperDisambiguation.test.ts`.

### Public recipe page (SEO)

The marketing-facing route `app/recipe/[id]/page.tsx` loads published recipes from Supabase (or static catalog) for JSON-LD and guest-readable content. It selects `fiber_g`, `sugar_g`, and `sodium_mg` on `recipes` and `recipe_ingredients`, and shows recipe-level cards plus per-ingredient micro lines when values are present (> 0). Logged-in recipe editing uses `RecipeDetail` in the app shell.

### Meal Planning
```
User's saved recipes + profile targets + slot config
  → generateSmartPlan()
    → For each day:
      1. Filter recipes by meal type tag per slot
      2. Sample 20K random combinations with per-day seed
      3. Compute portion multipliers (0.5x-2x) to hit slot calorie targets
      4. Score each combination against macro targets
      5. Penalise duplicates within day (80) and recent usage (40)
      6. Pick lowest-error combination
    → Return DayPlan[] with meals, multipliers, totals
```

## Authentication

- **Web:** Email/password, magic link (OTP) via Supabase Auth. No middleware — client-side redirect only.
- **Mobile:** Email/password, magic link, Apple Sign-In (expo-apple-authentication → Supabase signInWithIdToken)
- **API routes:** Most are public with rate limiting. Stripe checkout requires Authorization header.
- **Database:** Row-Level Security (RLS) on all tables. Users can only access their own data.

## External Service Dependencies

| Service | Required | Purpose | Fallback |
|---------|----------|---------|----------|
| Supabase | Yes | Auth, database, storage | None |
| USDA FDC | Yes | Nutrition data | Falls back to OFF/FatSecret/estimation |
| Open Food Facts | No | UK/EU product data, barcode lookup | Skipped |
| FatSecret | No | Additional nutrition source | Skipped |
| OpenAI | No | Social recipe import (IG/TikTok) | Returns 503 |
| Stripe | No* | Payments (web) | Paywall disabled |
| Upstash Redis | No | Distributed rate limiting | In-memory fallback |
| Sentry | No | Error tracking | Disabled |
| PostHog | No | Analytics | Disabled |

*Required for monetisation but app functions without it.

## Related Documents
- [Product Overview](../product/overview.md)
- [API Reference](../api/)
- [Data Schema](../data/schema.md)
- [Security](../security/auth.md)
