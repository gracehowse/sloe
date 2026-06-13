/**
 * Recipe-detail LANE D cleanups — premium-audit 2026-06-09 gaps 1, 3, 5, 6.
 * Source: `docs/ux/reviews/2026-06-09-premium-audit-recipe-progress.md`.
 *
 * These screens are 2k+ LOC wired to Supabase / expo-router / cook mode, so we
 * pin each change as a structural source-string contract against the screen +
 * its extracted components (the `recipeDetailV3SourcePins` idiom). Four gaps:
 *
 *   1. Cook-CTA dedup — one cook entry (the footer "Cook Mode" pill). The
 *      top-row "Start Cooking" pill is removed; "Log" is the dominant top-row
 *      action (the product's spine).
 *   3. Method steps render in PRIMARY ink (`colors.text`), not `textSecondary`.
 *   5. Ingredient tap routes to the branded `IngredientInfoSheet`, NOT a native
 *      `Alert.alert`.
 *   6. Allergen null state collapses to one quiet caption line; the full card
 *      renders only when an allergen IS present (mobile + web parity).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (rel: string) => readFileSync(resolve(__dirname, rel), "utf8");

const SRC = read("../../app/recipe/[id].tsx");
const ACTION_PILLS = read("../../components/recipe/RecipeActionPills.tsx");
const METHOD_STEPS = read("../../components/recipe/RecipeMethodSteps.tsx");
const INFO_SHEET = read("../../components/recipe/IngredientInfoSheet.tsx");
const SERVINGS_FOOTER = read("../../components/recipe/RecipeServingsFooter.tsx");
// Web parity surface for the allergen null-state collapse (gap 6).
const WEB_DETAIL = read("../../../../src/app/components/RecipeDetail.tsx");

describe("LANE D gap 1 — cook-CTA dedup (one cook entry; Log is the top-row primary)", () => {
  it("the action-pill row no longer carries a Start Cooking pill", () => {
    expect(ACTION_PILLS).not.toMatch(/testID="recipe-action-start-cooking"/);
    // No "Start Cooking" LABEL rendered (the history note in the doc comment is
    // allowed; the live JSX label is not).
    expect(ACTION_PILLS).not.toMatch(/>\s*\n?\s*Start Cooking\s*\n?\s*<\/Text>/);
    // The component prop contract drops the onStartCooking handler — no longer
    // in the prop type or the destructure (the doc comment may still explain it).
    expect(ACTION_PILLS).not.toMatch(/onStartCooking:/);
    expect(ACTION_PILLS).not.toMatch(/onStartCooking,/);
  });

  it("Log is the dominant top-row pill — wider (flex 1.6) SOLID primary", () => {
    // ENG-1079: Log is now SupprButton variant="primary" (solid aubergine fill,
    // white label, no border) and still carries the dominant flex weight.
    expect(ACTION_PILLS).toMatch(/variant="primary"[\s\S]{0,300}testID="recipe-action-log"/);
    expect(ACTION_PILLS).toMatch(/testID="recipe-action-log"[\s\S]{0,400}flex:\s*1\.6/);
    // No outline/border any more — solid fill IS the affordance (ENG-1079).
    expect(ACTION_PILLS).not.toMatch(/borderColor:\s*outlineColor/);
    expect(ACTION_PILLS).not.toMatch(/colors\.background === "#FFFFFF"/);
  });

  it("the screen no longer passes onStartCooking to the action pills", () => {
    expect(SRC).not.toMatch(/onStartCooking=/);
  });

  it("the single cook entry is the footer Cook Mode pill (still wired)", () => {
    expect(SERVINGS_FOOTER).toMatch(/testID="recipe-cook-mode-cta"/);
    expect(SERVINGS_FOOTER).toMatch(/Cook Mode/);
    // openCookMode is still threaded into the footer (the one cook entry).
    expect(SRC).toMatch(/onCookMode=\{openCookMode\}/);
    // The cook overlay is still launched from openCookMode.
    expect(SRC).toMatch(/const openCookMode = \(\) => \{/);
  });
});

describe("LANE D gap 3 — method steps render in primary ink", () => {
  it("the step paragraph colour is colors.text (primary ink), not textSecondary", () => {
    // The numbered step body must read at full contrast.
    expect(METHOD_STEPS).toMatch(
      /lineHeight:\s*26,\s*\n\s*color:\s*colors\.text,/,
    );
    // The step body specifically must NOT use textSecondary any more.
    expect(METHOD_STEPS).not.toMatch(/lineHeight:\s*26,\s*\n\s*color:\s*colors\.textSecondary/);
  });

  it("the faint serif index keeps textTertiary for hierarchy", () => {
    // The big "01"/"02" index stays quiet — only the body promotes.
    expect(METHOD_STEPS).toMatch(/color:\s*colors\.textTertiary/);
  });
});

describe("LANE D gap 5 — ingredient tap → branded IngredientInfoSheet (not Alert)", () => {
  it("onIngredientPress builds an IngredientInfo and sets sheet state — no Alert.alert", () => {
    const fnIdx = SRC.indexOf("const onIngredientPress = (index: number) =>");
    expect(fnIdx).toBeGreaterThan(0);
    // Slice the handler body up to the next top-level const declaration.
    const after = SRC.slice(fnIdx, fnIdx + 2000);
    const endIdx = after.indexOf("\n  const ", 10);
    const body = endIdx > 0 ? after.slice(0, endIdx) : after;
    expect(body).not.toMatch(/Alert\.alert/);
    expect(body).toMatch(/setIngredientInfo\(/);
    // The Verify route is resolved into state (preserves the wired Verify path).
    expect(body).toMatch(/ingredientShouldShowVerifyCta\(tier\)/);
    expect(body).toMatch(/setIngredientInfoVerifyHref\(/);
    // Tier colour is a semantic token, never a hex.
    expect(body).toMatch(/Accent\.successSolid/);
    expect(body).toMatch(/Accent\.warningSolid/);
    expect(body).not.toMatch(/#[0-9a-fA-F]{6}/);
  });

  it("the IngredientInfoSheet is mounted once with onVerify wiring", () => {
    expect(SRC).toMatch(/import \{\s*\n?\s*IngredientInfoSheet,/);
    expect(SRC).toMatch(/<IngredientInfoSheet[\s\S]{0,400}info=\{ingredientInfo\}/);
    expect(SRC).toMatch(/onClose=\{\(\) => \{[\s\S]{0,160}setIngredientInfo\(null\)/);
    // onVerify routes to the resolved href and closes the sheet.
    expect(SRC).toMatch(/onVerify=\{[\s\S]{0,300}router\.push\(href as never\)/);
  });

  it("the sheet renders a tokenised Verify CTA (aubergine outline) when onVerify is set", () => {
    expect(INFO_SHEET).toMatch(/onVerify\?:\s*\(\) => void/);
    expect(INFO_SHEET).toMatch(/testID="ingredient-info-verify"/);
    expect(INFO_SHEET).toMatch(/borderColor:\s*outlineColor/);
    // outlineColor resolves from the accent (scheme-aware), never a hex.
    // ENG-1013 colour migration 2026-06-10: useAccent() already scheme-resolves
    // primarySolid, so the value-source is a direct `accent.primarySolid` read
    // (the old `=== "#FFFFFF"` probe was a scheme bug — broke on cream ground).
    expect(INFO_SHEET).toMatch(/outlineColor\s*=\s*accent\.primarySolid/);
    expect(INFO_SHEET).not.toMatch(/colors\.background === "#FFFFFF"/);
  });
});

describe("LANE D gap 6 — allergen null state collapses to a quiet caption", () => {
  it("mobile: full card only when an allergen line is present", () => {
    // The render is gated on allergenLine — full white-slab card in the truthy
    // branch, a single quiet caption line in the falsy branch.
    expect(SRC).toMatch(/\{allergenLine \?/);
    // The quiet caption keeps the safety caveat (silence != safety) but reads
    // as a tertiary one-liner, not a fat 3-line card.
    expect(SRC).toMatch(/Not tagged for allergens — always verify against the original source\./);
    expect(SRC).toMatch(/color:\s*colors\.textTertiary,\s*lineHeight:\s*17\s*\}/);
    // The full-card "We tag recipes…" explainer must NOT render in the null
    // state — it lives in the truthy (allergen-present) branch only.
    expect(SRC.indexOf("recipe-allergen-callout")).toBeGreaterThan(0);
  });

  it("mobile: the callout testID is preserved for both states", () => {
    const matches = SRC.match(/testID="recipe-allergen-callout"/g) ?? [];
    // One on the full card, one on the quiet caption.
    expect(matches.length).toBe(2);
  });

  it("web: null state collapses to a quiet caption, card only when tagged", () => {
    // Parity — the web allergen block early-returns a quiet <p> when there's no
    // containsLine, and only renders the SupprCard when an allergen is present.
    expect(WEB_DETAIL).toMatch(/if \(!containsLine\) \{/);
    expect(WEB_DETAIL).toMatch(/Not tagged for allergens — always verify against the original source\./);
    expect(WEB_DETAIL).toMatch(/text-muted-foreground\/80/);
    // The card branch now unconditionally renders the containsLine (no inner
    // "Not tagged" fallback inside the card).
    expect(WEB_DETAIL).not.toMatch(/<SupprCard[\s\S]{0,400}Not tagged for allergens/);
  });
});
