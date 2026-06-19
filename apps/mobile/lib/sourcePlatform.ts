/**
 * Mobile-side re-export of the shared source-platform detector.
 *
 * Pattern matches `apps/mobile/lib/tdee.ts` etc. — single source of truth
 * lives in `src/lib/recipes/resolveImportUrl.ts` and the mobile alias
 * (`@/*` → `apps/mobile/*`) means we have to bridge via a relative
 * re-export rather than the path alias used on the web side.
 */

export {
  detectSourcePlatform,
  extractCreatorHandleFromImportUrl,
  isCaptionTextPlatform,
  type RecipeSourcePlatform,
} from "@suppr/shared/recipes/resolveImportUrl";
