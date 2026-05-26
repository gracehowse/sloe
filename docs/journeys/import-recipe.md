# User Journey: Import a Recipe

**Audience:** Product / Design

## Overview
User finds a recipe online and imports it into their Suppr library with verified nutrition data.

## Related journeys

- **[Import a cookbook (PDF)](import-cookbook.md)** — batch digitise a scanned book into Library (Pro); build the week in Plan separately.

## Entry Points

### Mobile (iOS)
1. **Share sheet** (iOS) — share a recipe URL from Safari/Instagram/TikTok to Suppr
2. **Clipboard auto-detect** — open the Import screen, app detects a recipe URL on clipboard
3. **Manual paste** — paste a URL into the import screen input field
4. **Deep link** — `suppr://import?url=...`

### Web
- **Canonical route:** `/import` (`app/(product)/import/page.tsx`). Like
  every `(product)` route, the page component returns `null` on purpose —
  the shared shell at `app/(product)/layout.tsx` mounts `HomePageClient`
  (→ `src/app/App.tsx`), which derives the active view from the path and
  renders `<RecipeUpload mode="import" />` for the `import` view. The
  import surface offers: a "Import from" source grid (TikTok / Instagram /
  YouTube / Website), a "Paste a recipe link" URL field, and a photo
  "Extract from image" affordance.
- **In-app navigation:** the desktop sidebar / "Import instead" toggle on
  `/create` route to `/import` via `navigateToView("import")`.
- **ENG-669 (launch-blocker, fixed):** `/import` once rendered a blank
  white page because the `pathDerivedView` map in `App.tsx` did not list
  the `import` (or `create`) segment, so the URL never switched the view
  to the already-built import UI. The fix adds those segments to the
  path→view map. Pinned by `tests/unit/webRouteCompletion.test.ts`
  (route wiring) and `tests/unit/recipeImportSurface.test.tsx` (rendered
  import UI). The web import flow reuses the same `/api/recipe-import`
  (URL/social) and `/api/recipe-import/image` (photo OCR) routes as
  mobile — no platform-specific parse logic.

## Flow

### Step 1: URL Detection
```
User opens Import screen
  → App checks: router params → deep link → clipboard (3 retry attempts at 450ms/600ms/1100ms)
  → If URL found, auto-start import
  → If no URL, show manual paste input
```

### Step 2: Recipe Extraction
```
POST /api/recipe-import with URL
  → App shows "Pulling recipe..." spinner
  → API fetches HTML, extracts JSON-LD
  → Returns parsed recipe with ingredients, instructions, macros
```

### Step 3: Review & Tag (NEW)
```
App shows review screen:
  → Recipe title and per-serving macros
  → MealTypePicker pre-populated with auto-classified tags
  → User can toggle Breakfast/Lunch/Dinner/Snack tags
  → Tap "Save to Library"
```

### Step 4: Save
```
saveImportedRecipe() writes to Supabase:
  → Creates recipe row with macros, servings, meal_type array
  → Creates recipe_ingredients rows with per-ingredient macros
  → Creates saves row (auto-saves to library)
```

### Step 5: Post-Save
```
Success screen with two CTAs:
  → "View recipe" → navigates to recipe detail
  → "Review ingredients" → navigates to verify screen
```

## Edge Cases
- **Pinterest URLs** — resolved to actual recipe source via redirect following
- **Instagram/TikTok** — parsed via OpenAI caption extraction (requires API key)
- **Sites that block scraping** — UA spoofing with Chrome UA string
- **No JSON-LD** — error with clear message: "No Recipe JSON-LD found"
- **Rate limited** — 20 imports per minute per IP
- **Not signed in** — shows sign-in prompt, preserves URL

## Related Documents
- [API: Recipe Import](../api/endpoints.md#post-apirecipe-import)
- [Technical: Recipe Import Pipeline](../technical/architecture.md#recipe-import)
- [Journey: Verify Ingredients](verify-ingredients.md)
