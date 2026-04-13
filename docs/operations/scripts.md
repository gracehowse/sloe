# Operations & Scripts

**Audience:** Internal

## Maintenance Scripts

All scripts run from the project root with `npx tsx scripts/<name>.ts`. They load `.env.local` automatically.

### Recipe Data

| Script | Purpose | Usage |
|--------|---------|-------|
| `seed-discover.ts` | Seed the Discover feed from URLs in `seed-recipe-urls.txt` | `PLATEMATE_SEED_AUTHOR_ID=<uuid> npx tsx scripts/seed-discover.ts` |
| `refresh-recipes.ts` | Re-fetch and re-verify ALL recipes with a `source_url` | `npx tsx scripts/refresh-recipes.ts [--dry-run]` |
| `fix-servings.ts` | Re-fetch servings from source URLs for recipes stuck at `servings=1` | `npx tsx scripts/fix-servings.ts [--dry-run]` |
| `fix-html-entities.ts` | Decode HTML entities in existing recipe data | `npx tsx scripts/fix-html-entities.ts [--dry-run]` |
| `classify-meals.ts` | Auto-classify `meal_type` for untagged recipes | `npx tsx scripts/classify-meals.ts [--dry-run]` |

**Requirements:**
- Dev server running on localhost:3000 (for `seed-discover.ts` and `refresh-recipes.ts` — they call the verify API)
- Supabase credentials in `.env.local`

### Production

| Script | Purpose | Usage |
|--------|---------|-------|
| `verify-production-env.ts` | Check Stripe / Supabase production vars (warns; exits 1 only with `VERIFY_STRICT=1` when Stripe is misconfigured) | `npm run verify:production-env` — on `main` CI sets `VERIFY_STRICT=1` |
| `production-smoke.ts` | HTTP smoke test against production URL | `npm run smoke:production` |

## Approved Recipe Sources

Only seed from these sites (high-quality photography):
- fitfoodiefinds.com
- downshiftology.com (Lisa Bryan)
- minimalistbaker.com
- pinchofyum.com
- halfbakedharvest.com

See `scripts/seed-recipe-urls.txt` for the full URL list.

## Key User IDs

| User | ID | Notes |
|------|----|-------|
| Grace (primary) | `e9f85055-876b-4bde-9267-476567b16884` | Used as `PLATEMATE_SEED_AUTHOR_ID` |

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
