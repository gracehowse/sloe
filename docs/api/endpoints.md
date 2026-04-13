# API Reference

**Audience:** Developers

All API routes are Next.js Route Handlers at `app/api/`.

## Recipe Import

### `POST /api/recipe-import`

Import a recipe from any URL (recipe site, Instagram, TikTok, Pinterest).

**Rate limit:** 20 requests/minute per IP

**Request:**
```json
{
  "url": "https://downshiftology.com/recipes/chicken-stir-fry/"
}
```

**Response (success):**
```json
{
  "ok": true,
  "recipe": {
    "title": "Chicken Stir Fry",
    "description": "...",
    "ingredients": ["1 lb chicken breast", "2 tbsp soy sauce", ...],
    "instructions": ["Step 1...", "Step 2..."],
    "servings": 4,
    "imageUrl": "https://...",
    "sourceUrl": "https://...",
    "sourceName": "Downshiftology",
    "calories": 350,
    "protein": 35,
    "carbs": 20,
    "fat": 14,
    "fiberG": 3.2,
    "sugarG": 5.1,
    "sodiumMg": 680,
    "siteNutrition": { ... },
    "ingredientMacros": [
      {
        "name": "chicken breast",
        "amount": "1",
        "unit": "lb",
        "calories": 445,
        "protein": 93,
        "carbs": 0,
        "fat": 6,
        "fiberG": 0,
        "source": "USDA"
      },
      ...
    ],
    "primarySource": "USDA"
  }
}
```

**Error responses:**
- `400` — Missing URL
- `422` — URL didn't return HTML or no Recipe JSON-LD found
- `429` — Rate limited
- `502` — Fetch failed (site blocked/down)
- `504` — Timeout (20s limit)

**Behaviour:**
- Pinterest URLs are resolved to the actual recipe source
- Instagram/TikTok URLs use OpenAI to parse captions (requires `OPENAI_API_KEY`)
- HTML entities are decoded in all text fields
- `recipeYield` handles arrays and ranges (e.g. `["4 servings"]`, `"4-6"`)
- Site-declared nutrition is preserved when available; API estimates are used only as fallback
- Meal type is auto-classified from title/ingredients/calories

---

## Nutrition Verification

### `POST /api/nutrition/verify-recipe`

Verify ingredient macros against USDA, OFF, and FatSecret databases.

**Rate limit:** 10 requests/minute per IP

**Request:**
```json
{
  "ingredients": [
    { "name": "chicken breast", "amount": "2", "unit": "breast" },
    { "name": "broccoli", "amount": "200", "unit": "g" }
  ],
  "servings": 4,
  "provider": "auto"
}
```

**Response:**
```json
{
  "ok": true,
  "verified": [
    {
      "input": { "name": "chicken breast", "amount": "2", "unit": "breast" },
      "resolved": { "name": "chicken breast meat raw", "amount": "2", "unit": "breast" },
      "matchedName": "Chicken, breast, boneless, skinless, raw",
      "confidence": 0.85,
      "source": "USDA",
      "macros": { "calories": 660, "protein": 124, "carbs": 0, "fat": 14, "fiberG": 0, "sugarG": 0, "sodiumMg": 152 }
    },
    ...
  ],
  "totals": { ... },
  "perServing": { ... },
  "primarySource": "USDA",
  "sourceCounts": { "USDA": 2 }
}
```

---

## USDA Food Search

### `GET /api/usda/search?q={query}`

Search USDA FoodData Central.

**Rate limit:** 60 requests/minute per IP

**Response:**
```json
{
  "ok": true,
  "hits": [
    {
      "fdcId": 171077,
      "description": "Chicken, breast, boneless, skinless, raw",
      "dataType": "SR Legacy",
      "calories": 120,
      "protein": 22.5,
      "fat": 2.6,
      "carbs": 0
    }
  ]
}
```

---

## USDA Food Detail

### `GET /api/usda/food?fdcId={id}`

Get full nutrition data and portion options for a specific USDA food.

**Rate limit:** 60 requests/minute per IP

**Response:**
```json
{
  "ok": true,
  "fdcId": 171077,
  "description": "Chicken, breast, boneless, skinless, raw",
  "macrosPer100g": {
    "calories": 120,
    "protein": 22.5,
    "carbs": 0,
    "fat": 2.6,
    "fiberG": 0,
    "sugarG": 0,
    "sodiumMg": 54
  },
  "portions": [
    { "label": "1 breast", "gramWeight": 174, "amount": 1 },
    { "label": "1 RACC", "gramWeight": 114, "amount": 1 }
  ]
}
```

---

## Stripe

### `POST /api/stripe/checkout`

Create a Stripe Checkout session for subscription.

**Auth required:** Yes (Bearer token in Authorization header)

**Request:**
```json
{
  "plan": "base"
}
```

### `POST /api/stripe/webhook`

Handle Stripe webhook events (subscription created/updated/deleted).

**Auth:** Stripe webhook signature verification

---

## Barcode

### `GET /api/off/barcode?code={barcode}`

Look up a product by barcode via Open Food Facts.

### `GET/POST /api/barcode-mapping`

Community barcode correction mapping.

---

## Related Documents
- [Technical Architecture](../technical/architecture.md)
- [Data Schema](../data/schema.md)
- [Security](../security/auth.md)
