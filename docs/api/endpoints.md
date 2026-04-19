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
      "carbs": 0,
      "servingSize": 230,
      "servingSizeUnit": "g",
      "householdServingFullText": "1 SANDWICH",
      "foodPortions": [
        { "gramWeight": 120, "amount": 1, "portionDescription": "1 cup, sliced" }
      ]
    }
  ]
}
```

`servingSize` / `servingSizeUnit` / `householdServingFullText` are present on Branded foods; `foodPortions[]` is present on Foundation / Survey / SR Legacy. Both are optional. The display layer uses them to show a per-portion primary line alongside the /100g reference (TestFlight `APo0qS9vcFvmBJEJJ_-61YA`, 2026-04-19).

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

## Push — Weekly recap fan-out

### `POST /api/push/weekly-recap`

Server-to-server cron endpoint that fans out the weekly recap push to
every opted-in user whose `profiles.expo_push_token` is non-null. Calls
the Expo push API, which delivers via APNs (iOS) / FCM (Android). Shipped
2026-04-19 — see `docs/testflight-feedback/resolved.md` entry "Server-side
weekly recap push fan-out" for rationale.

**Auth:** shared-secret header, NOT user auth.

- Header: `X-Cron-Secret: <SUPPR_CRON_SECRET>` — must match
  `process.env.SUPPR_CRON_SECRET` exactly. `401` on missing/wrong.
- No Supabase session needed. Vercel crons are configured in
  `vercel.json` at the repo root; each cron invocation must carry the
  secret header.

**Query parameters:**

- `weekStartDay` *(optional)* — `monday` | `sunday`. When present, the
  fan-out is filtered to profiles matching that cohort. Any other value
  is ignored and the route fans out to both cohorts. The shipped Vercel
  config runs one cron per cohort at 18:00 UTC on their respective
  end-of-week days (Sunday for Monday-start, Saturday for Sunday-start).

**Behaviour:**

- Selects `profiles` where `weekly_recap_push_enabled = true` and
  `expo_push_token IS NOT NULL`, capped at 5000 rows per invocation.
- Skips rows whose `last_weekly_recap_push_sent_at` is within the last
  6 days (dedupe across back-to-back cron runs).
- Fans out via Expo push API in batches of 100, with a single retry on
  5xx / network failure. No retry on 4xx.
- For every successfully-ticketed user, stamps
  `last_weekly_recap_push_sent_at = now()`.
- For every ticket returned with `details.error === "DeviceNotRegistered"`
  the route nulls the offending `profiles.expo_push_token` so we stop
  pushing to dead installs.
- Copy is aligned with the mobile local-push fallback in
  `apps/mobile/lib/weeklyRecapPush.ts` — title `"Your week in Suppr"`,
  body `"Tap to see your weekly recap — avg calories, protein, streak,
  and weight trend."`, deep link `/progress`.

**Response (success):**

```json
{
  "ok": true,
  "attempted": 128,
  "succeeded": 124,
  "deregistered": 3
}
```

(`attempted - succeeded - deregistered` covers rows that came back with
other `status: "error"` tickets — e.g. `MessageTooBig` — which are not
stamped so the next cron re-tries them.)

**Error responses:**

- `401` — missing/wrong `X-Cron-Secret`
- `503` — `SUPPR_CRON_SECRET` or `SUPABASE_SERVICE_ROLE_KEY` unset on
  the server
- `500` — Supabase select failed
- `502` — Expo push API failed after the single retry

**Env vars (production):**

- `SUPPR_CRON_SECRET` — 32-byte random value, shared with Vercel cron
  config. Generate with `openssl rand -hex 32`.
- `SUPABASE_SERVICE_ROLE_KEY` — existing server-only key. The route
  uses service-role access because the fan-out needs to read every
  opted-in profile (RLS would hide other users' rows) and to write
  back to `profiles` without a user session.

---

## Related Documents
- [Technical Architecture](../technical/architecture.md)
- [Data Schema](../data/schema.md)
- [Security](../security/auth.md)
