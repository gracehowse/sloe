/**
 * Pin tests for the 2026-05-02 recipe-ingredient bug fix:
 *   1. "Partial match" persists after user manually verifies.
 *   2. Amount renders "1 1 breast" (duplicated tokens).
 *
 * Tests are source-string pins (mirroring the existing parity test
 * pattern at `apps/mobile/tests/unit/journeyFixes20260427.test.ts`)
 * because the mobile recipe-detail screen and the web RecipeDetail
 * component depend on render contexts (Expo Router / Next.js) that
 * the vitest/jsdom env cannot host. The pins protect the call-site
 * wiring of the shared helpers; behaviour of the helpers themselves
 * is covered by `formatIngredientAmountUnit.test.ts` and
 * `ingredientVerificationStatus.test.ts`.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MOBILE_RECIPE = resolve(__dirname, "../../apps/mobile/app/recipe/[id].tsx");
const MOBILE_VERIFY_LIB = resolve(__dirname, "../../apps/mobile/lib/verifyRecipe.ts");
const WEB_RECIPE_DETAIL = resolve(__dirname, "../../src/app/components/RecipeDetail.tsx");
// RecipeIngredientGrid now hosts the formatIngredientAmountUnit call-site
// (extracted from [id].tsx as part of the Figma 332:2 grid refactor).
const MOBILE_INGREDIENT_GRID = resolve(
  __dirname,
  "../../apps/mobile/components/recipe/RecipeIngredientGrid.tsx",
);
// IngredientInfoSheet hosts the tierColor dot now that ingredient-tap
// was upgraded from a raw Alert to the branded bottom-sheet (ENG-821).
const MOBILE_INGREDIENT_INFO_SHEET = resolve(
  __dirname,
  "../../apps/mobile/components/recipe/IngredientInfoSheet.tsx",
);

const SRC = {
  mobileRecipe: readFileSync(MOBILE_RECIPE, "utf8"),
  mobileVerifyLib: readFileSync(MOBILE_VERIFY_LIB, "utf8"),
  webRecipe: readFileSync(WEB_RECIPE_DETAIL, "utf8"),
  mobileIngredientGrid: readFileSync(MOBILE_INGREDIENT_GRID, "utf8"),
  mobileIngredientInfoSheet: readFileSync(MOBILE_INGREDIENT_INFO_SHEET, "utf8"),
};

describe("Bug 1 — verified state persists past manual verify", () => {
  it("mobile recipe-detail row reads is_verified from the DB SELECT", () => {
    // Pre-fix the SELECT only pulled `confidence, source` — leaving
    // the row UI to derive its label from the stale numeric column.
    expect(SRC.mobileRecipe).toMatch(
      /\.select\("name, amount, unit, calories, protein, carbs, fat, fiber_g, sugar_g, sodium_mg, confidence, source, is_verified[^"]*"\)/,
    );
  });

  it("mobile recipe-detail row routes through the shared verification-tier helper", () => {
    expect(SRC.mobileRecipe).toMatch(
      /import\s*\{[\s\S]*?deriveIngredientVerificationTier[\s\S]*?\}\s*from[\s\S]*?recipe-ingredients\/ingredientVerificationStatus/,
    );
    expect(SRC.mobileRecipe).toMatch(/deriveIngredientVerificationTier\(\s*\{/);
    expect(SRC.mobileRecipe).toMatch(/isVerified:\s*ing\.is_verified\s*\?\?\s*null/);
  });

  it("mobile recipe-detail Verify → CTA gating uses ingredientShouldShowVerifyCta", () => {
    expect(SRC.mobileRecipe).toMatch(
      /ingredientShouldShowVerifyCta\b/,
    );
    // The helper is called inline (not via a local boolean variable) and
    // guarded by recipeId — both must be present in the same if-condition.
    expect(SRC.mobileRecipe).toMatch(/ingredientShouldShowVerifyCta\(tier\)\s*&&\s*recipeId/);
    // Pre-fix gating used `confPct < 75` directly; that path is gone.
    expect(SRC.mobileRecipe).not.toMatch(/\(confPct\s*==\s*null\s*\|\|\s*confPct\s*<\s*75\)\s*&&\s*recipeId/);
  });

  it("mobile saveVerifiedIngredients persists confidence on the per-row update", () => {
    // Pre-fix the per-row update wrote is_verified + source but NOT
    // confidence, so a re-verified row landed back in the DB with
    // the original AI score (e.g. 0.69) and the recipe-detail UI
    // kept rendering "69% · Partial match".
    expect(SRC.mobileVerifyLib).toMatch(
      /confidence:\s*\n?\s*typeof ing\.confidence === "number"[\s\S]*?:\s*null,?\s*\n[\s\S]*?override_macros/,
    );
  });

  it("mobile saveVerifiedIngredients uses atomic save_verified_ingredients RPC", () => {
    expect(SRC.mobileVerifyLib).toMatch(/supabase\.rpc\("save_verified_ingredients"/);
  });

  it("save_verified_ingredients migration exists for atomic verify writes (ENG-662)", () => {
    const migration = readFileSync(
      resolve(__dirname, "../../supabase/migrations/20260527100000_save_verified_ingredients_rpc.sql"),
      "utf8",
    );
    expect(migration).toMatch(/create or replace function public\.save_verified_ingredients/);
    expect(migration).toMatch(/p_ingredient_updates/);
  });

  it("web recipe-detail row routes through the shared verification-tier helper", () => {
    expect(SRC.webRecipe).toMatch(
      /import\s*\{[\s\S]*?deriveIngredientVerificationTier[\s\S]*?\}\s*from[\s\S]*?recipe-ingredients\/ingredientVerificationStatus/,
    );
    expect(SRC.webRecipe).toMatch(/deriveIngredientVerificationTier\(\s*\{/);
  });

  it("web recipe-detail Verify → CTA gating uses ingredientShouldShowVerifyCta", () => {
    expect(SRC.webRecipe).toMatch(/ingredientShouldShowVerifyCta\b/);
    // Pre-fix gating used `!ingredient.isVerified` directly; that
    // form is replaced with the shared helper so any future change
    // to the verified-tier policy ripples to web automatically.
    expect(SRC.webRecipe).toMatch(
      /dbIngredientIds\[index\]\s*&&\s*showVerifyCta/,
    );
  });

  it("web inline-verify update also persists confidence: 1.0", () => {
    // Symmetry with the mobile fix — once the user re-verifies a row
    // through the web FoodSearch picker, the persisted confidence
    // should agree with the new is_verified flag.
    expect(SRC.webRecipe).toMatch(
      /is_verified:\s*true,\s*\n\s*source:\s*selection\.source,\s*\n[\s\S]{0,400}?confidence:\s*1\.0,/,
    );
    // Local state mirror — keep in-memory row in sync with DB row.
    expect(SRC.webRecipe).toMatch(
      /isVerified:\s*true,\s*source:\s*selection\.source,\s*confidence:\s*1\.0/,
    );
  });

  it("mobile dot colour now follows verification tier rather than raw confidence", () => {
    // The ingredient-tap flow was upgraded from a raw Alert to the branded
    // IngredientInfoSheet (ENG-821). The tier dot colour is now owned by that
    // sheet component — the host ([id].tsx) derives `tier` + resolves the colour
    // and passes it in; the sheet renders `backgroundColor: info.tierColor`.
    // Pre-fix the dot was conditional on `confPct != null`, hiding it for
    // unscored rows. The new path always renders with a tier colour.
    expect(SRC.mobileIngredientInfoSheet).toMatch(/backgroundColor:\s*info\.tierColor/);
    // The host must still derive the tier and pass tierColor into the sheet.
    expect(SRC.mobileRecipe).toMatch(/deriveIngredientVerificationTier\(\s*\{/);
  });

  it("auto-verify sends structured amount/unit rows to verify-recipe (not name-only)", () => {
    // `snap` is a closure-safe alias for the `ingredients` state at call time
    // (`const snap = ingredients`). The single call site is `snap`.
    expect(SRC.mobileRecipe).toMatch(/structuredIngredientsForVerify\(snap\)/);
    // `snap` is captured directly from `ingredients` state — verify that link.
    expect(SRC.mobileRecipe).toMatch(/const\s+snap\s*=\s*ingredients/);
    expect(SRC.mobileRecipe).not.toMatch(
      /parseRawIngredients\(snap\.map\(\(ing\) => ing\.name\)\)/,
    );
  });

  it("web recipe-detail auto-verify matches mobile (structured rows + merge)", () => {
    expect(SRC.webRecipe).toMatch(/structuredIngredientsForVerify\(snap\)/);
    expect(SRC.webRecipe).toMatch(/mergeVerifiedMacroRows\(snap[\s\S]*?rows\)/);
    expect(SRC.webRecipe).toMatch(/autoVerifyingIngredients/);
  });
});

describe("Bug 2 — amount renders without duplicated tokens", () => {
  it("mobile recipe-detail row routes amount/unit through formatIngredientAmountUnit", () => {
    // The ingredient grid was extracted to RecipeIngredientGrid (Figma 332:2
    // §6 grid refactor). formatIngredientAmountUnit is imported and called
    // there; [id].tsx imports RecipeIngredientGrid and passes viewMultiplier
    // down — the call-site wiring is protected in the grid component.
    expect(SRC.mobileIngredientGrid).toMatch(
      /import\s*\{\s*formatIngredientAmountUnit\s*\}\s*from\s*"[^"]*recipe-ingredients\/formatIngredientAmount"/,
    );
    // PR1 (2026-05-02): the multiplier identifier moved from
    // `portionMultiplier` (deep-link only) to `viewMultiplier`
    // (stepper-driven, deep-link-seeded). The behaviour this test
    // protects (route through `formatIngredientAmountUnit` with
    // 2-decimal rounding) is unchanged.
    expect(SRC.mobileIngredientGrid).toMatch(
      /formatIngredientAmountUnit\(\s*\n?\s*scaledAmount,\s*\n?\s*ing\.unit\s*\)/,
    );
    // The grid receives `viewMultiplier` as a prop from [id].tsx — verify
    // the parent still passes it through.
    expect(SRC.mobileRecipe).toMatch(/viewMultiplier=\{viewMultiplier\}/);
    // Pre-fix the row used a bare template string `${amount} ${unit}`
    // — that line is gone now that we route through the helper.
    expect(SRC.mobileIngredientGrid).not.toMatch(
      /\$\{Math\.round\(ing\.amount \* viewMultiplier \* 100\) \/ 100\} \$\{ing\.unit \?\? ""\}/,
    );
  });

  it("web recipe-detail row routes amount/unit through formatIngredientAmountUnit", () => {
    expect(SRC.webRecipe).toMatch(
      /import\s*\{\s*formatIngredientAmountUnit\s*\}\s*from\s*"[^"]*recipe-ingredients\/formatIngredientAmount(?:\.ts)?"/,
    );
    expect(SRC.webRecipe).toMatch(/formatIngredientAmountUnit\(/);
  });
});
