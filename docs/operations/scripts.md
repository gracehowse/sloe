# Operations & Scripts

**Audience:** Internal

## Maintenance Scripts

All scripts run from the project root with `npx tsx scripts/<name>.ts`. They load `.env.local` automatically.

### Recipe Data

| Script | Purpose | Usage |
|--------|---------|-------|
| `delete-seeded-recipes.ts` | Remove demo UUID recipes, legacy SQL batch rows, recipes owned by the historical seed author, demo creators; optionally deletes rows whose `source_url` matches lines in `scripts/seed-recipe-urls.txt` if you create that file | `npx tsx scripts/delete-seeded-recipes.ts` (add `--dry-run` to preview) — or `npm run delete:seeded-recipes` |
| `fix-servings.ts` | Re-fetch servings from source URLs for recipes stuck at `servings=1` | `npx tsx scripts/fix-servings.ts [--dry-run]` |
| `fix-html-entities.ts` | Decode HTML entities in existing recipe data | `npx tsx scripts/fix-html-entities.ts [--dry-run]` |
| `classify-meals.ts` | Auto-classify `meal_type` for untagged recipes | `npx tsx scripts/classify-meals.ts [--dry-run]` |

**Requirements:**
- Supabase credentials in `.env.local` (`delete-seeded-recipes.ts` needs `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS)
- Scripts that call local APIs need the dev server on localhost:3000 (not required for `delete-seeded-recipes.ts`)

**Migrations:** One-off DB cleanup for seeded content is in `supabase/migrations/20260421180000_remove_all_seeded_recipes.sql`. Apply with `npx supabase db push` (after local/remote migration history matches) or run the SQL in the Supabase SQL editor.

### Production

| Script | Purpose | Usage |
|--------|---------|-------|
| `verify-production-env.ts` | Check Stripe / Supabase production vars (warns; exits 1 only with `VERIFY_STRICT=1` when Stripe is misconfigured) | `npm run verify:production-env` — on `main` CI sets `VERIFY_STRICT=1` |
| `production-smoke.ts` | HTTP smoke test against production URL | `npm run smoke:production` |

## Trusted recipe domains (import quality)

When importing or curating URLs, these sites tend to have reliable structure and photography:

- fitfoodiefinds.com
- downshiftology.com (Lisa Bryan)
- minimalistbaker.com
- pinchofyum.com
- halfbakedharvest.com

## Key User IDs

| User | ID | Notes |
|------|----|-------|
| Grace (primary) | `e9f85055-876b-4bde-9267-476567b16884` | Historical seed author ID (referenced in migrations and `delete-seeded-recipes.ts` for cleanup) |

## Debugging

### Recipe import fails
1. Check if the source site blocks scraping — try the URL in a browser
2. Check server logs for the specific error (502 = site blocked, 504 = timeout, 422 = no JSON-LD)
3. Try adding the site's UA requirements to the fetch headers in `parseRecipeFromHtml.ts`

### Nutrition data wrong
1. Check which source was used (USDA/OFF/FatSecret/Estimated) on the verify screen
2. For estimated ingredients (confidence 0.3), the staple table may not have the food — consider adding it
3. For USDA mismatches, check the name aliases in `verifyIngredients.ts`

### Planner generates poor plans
1. Check if recipes have `meal_type` tags set — untagged recipes fit any slot
2. Check if the user's profile has targets set — defaults to 2000 cal if not
3. More saved recipes = better plans (more combinations to try)

## Related Documents
- [Technical Architecture](../technical/architecture.md)
- [Product Overview](../product/overview.md)
