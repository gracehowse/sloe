# Decision log: social/screenshot recipe import — already shipped (P2-25, 2026-04-25)

**Date:** 2026-04-25
**Status:** Resolved — was already shipped before P2-25 surveyed it
**Trigger:** P2-25 in [Opus 4.7 codebase review](./2026-04-25-opus47-codebase-review.md). Audit said "URL recipe import wired; no screenshot/social import path observed in audit scope."

---

## Decision

**No code change required.** Both flavours of import the audit asked for are already shipped:

1. **URL-based social import** — `src/lib/recipe-import/extractSocialRecipe.ts` resolves Instagram / TikTok / YouTube URLs via oEmbed, fetches the post metadata, parses the caption for ingredient lines and per-serving nutrition claims (`extractCaptionNutrition.ts`). Wired through `app/api/recipe-import/route.ts` and consumed on both web (`src/app/components/RecipeUpload.tsx`) and mobile (`apps/mobile/app/create-recipe.tsx`).
2. **Screenshot / image OCR import** — `app/api/recipe-import/image/route.ts` ships an OpenAI GPT-4o-mini vision pipeline that reads ingredient lines from a posted image, then runs them through the existing `verifyIngredients` flow. Pro-tier gated (image OCR is not free-tier). Consumed on web (`RecipeUpload.tsx:435`) and mobile (`create-recipe.tsx:347` + `import-shared.tsx:344`).
3. **iOS share-extension target** — `apps/mobile/app.json` configures `expo-share-intent` with the bundle identifier `com.supprclub.supprapp.share-extension`. Intent filters for Instagram / TikTok URLs are wired. The user can long-press an Instagram post → Share → Suppr; the share-target lands in `apps/mobile/app/import-shared.tsx`, which calls the URL importer (or the image importer when the share carries an image rather than a URL).

The audit's verifier missed all three because the relevant filenames don't include the strings "social" or "screenshot" as standalone tokens. The implementation lives under `recipe-import/` and ships under "Recipe import — image" / "Recipe import — URL" in the user-facing product copy.

## Audit correction

`docs/audits/2026-04-25-opus47-codebase-review.md` §6.3 row "URL + social import both required" is stale. Both flavours are live. Updating the audit to reflect actual state.

## Rationale

This is an audit correction. Per the existing decision logs (recipe-import work was a Batch 4 / Batch 5 deliverable across early 2026), the import surface is mature: parsing for two-line ingredient blocks, per-serving nutrition claims, three social platforms, image OCR via GPT-4o, intent-filter share extension on iOS, all gated by the existing rate limit (P0-6) and Pro-tier check (image only).

## Implementation

No code change. P2-25 closes as a documentation / audit-correction deliverable.

## Platforms affected

- None — surveying existing shipped state.

## Verification

- Confirmed `app/api/recipe-import/route.ts` + `app/api/recipe-import/image/route.ts` exist and are wired into the rate-limit + tier-gate machinery (P0-6).
- Confirmed `apps/mobile/app/import-shared.tsx` exists as the iOS share-sheet target.
- Confirmed `apps/mobile/app.json` configures `expo-share-intent` with the share-extension bundle id and Instagram / TikTok intent filters.
- Confirmed three consumer call sites (`RecipeUpload.tsx`, `create-recipe.tsx`, `import-shared.tsx`) all hit `/api/recipe-import/image`.

## Related artefacts

- [`src/lib/recipe-import/extractSocialRecipe.ts`](../../src/lib/recipe-import/extractSocialRecipe.ts) — URL → caption + handle resolver.
- [`src/lib/recipe-import/extractCaptionNutrition.ts`](../../src/lib/recipe-import/extractCaptionNutrition.ts) — caption → nutrition claim parser.
- [`app/api/recipe-import/image/route.ts`](../../app/api/recipe-import/image/route.ts) — GPT-4o Vision OCR.
- [`apps/mobile/app/import-shared.tsx`](../../apps/mobile/app/import-shared.tsx) — iOS share-sheet target.
- [Opus 4.7 codebase review §6.3](../audits/2026-04-25-opus47-codebase-review.md) — corrected row.

## Revisit when

- A new social platform becomes a notable share-source (e.g. Threads). Add a `SocialPlatform` enum entry + oEmbed handler in `extractSocialRecipe.ts`.
- The image OCR cost becomes prohibitive. Consider gating per-day count on Pro tier (currently `15/min/user` per P0-6 rate limit, but no daily cap).
- Apple changes share-extension entitlement requirements. Re-test the intent filter set in `app.json`.
