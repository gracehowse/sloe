/**
 * Web ↔ mobile parity pins for the two silent drifts the 2026-06-12
 * launch-readiness audit flagged in §21 (P2 #4):
 *
 *   A. Verify-affordance label — mobile recipe-verify rows expose a
 *      "Swap" pill (apps/mobile/app/recipe/verify.tsx) with an
 *      accessibilityLabel of `Swap match for ${displayName}`. Web
 *      RecipeUpload previously said "Change match" on both the
 *      match-picker panel header and the per-row button — same action,
 *      different copy, on the import critical path. Restored to "Swap"
 *      with an `aria-label` of `Swap match for ${name}` so the
 *      accessible name matches mobile's accessibilityLabel.
 *
 *   B. Leftover badge — mobile planner renders the leftover badge with
 *      a Lucide `Package` icon in the warning/amber accent
 *      (apps/mobile/app/(tabs)/planner.tsx, ENG-808). Web MealPlanner
 *      previously rendered text-only "Leftover" in bg-success/text-success
 *      (green — wrong semantics: a leftover is a "caution, this is a
 *      repeat" note, not a "good" state). Restored to a `Package` icon in
 *      the warning token.
 *
 * These are SOURCE-LEVEL parity pins (asset / copy swaps), mirroring the
 * mobile pin in apps/mobile/tests/unit/journeyFixes20260427.test.ts and
 * the web source-pin block in tests/unit/mealPlanWebMobileParity.test.ts.
 * They are NOT behavioural coverage — the rendered swap affordance only
 * appears once an import populates ingredients, and the leftover badge
 * only renders when the plan JSON tags a slot as a leftover. They guard
 * against the copy/colour/icon silently drifting back out of parity.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const RECIPE_UPLOAD = resolve(
  __dirname,
  "../../src/app/components/RecipeUpload.tsx",
);
const MEAL_PLANNER = resolve(
  __dirname,
  "../../src/app/components/MealPlanner.tsx",
);

const SRC = {
  recipeUpload: readFileSync(RECIPE_UPLOAD, "utf8"),
  mealPlanner: readFileSync(MEAL_PLANNER, "utf8"),
};

// ── Task A — verify-affordance label is "Swap" (parity with mobile) ──

describe("RecipeUpload swap affordance — parity with mobile verify 'Swap' pill", () => {
  it("the match-picker panel header reads 'Swap' (not 'Change match')", () => {
    expect(SRC.recipeUpload).toMatch(
      /<h4 className="text-sm font-semibold text-foreground">Swap<\/h4>/,
    );
  });

  it("the per-row affordance button reads 'Swap' (not 'Change match')", () => {
    // The visible label on the per-ingredient button — the import
    // critical path the audit called out.
    expect(SRC.recipeUpload).toMatch(/>\s*Swap\s*<\/button>/);
  });

  it("the old 'Change match' copy is gone from both web sites", () => {
    expect(SRC.recipeUpload).not.toContain("Change match");
  });

  it("the per-row button exposes an accessible name 'Swap match for {name}' (mobile accessibilityLabel parity)", () => {
    // Mobile: accessibilityLabel={`Swap match for ${displayName}`}
    // (apps/mobile/app/recipe/verify.tsx). Web mirrors it as an
    // aria-label derived from the resolved/display ingredient name.
    expect(SRC.recipeUpload).toMatch(
      /aria-label=\{`Swap match for \$\{[\s\S]{0,120}?\}`\}/,
    );
  });
});

// ── Task B — leftover badge: Package icon + warning/amber token ──────

describe("MealPlanner leftover badge — parity with mobile Package + amber (ENG-808)", () => {
  it("imports the Lucide Package icon", () => {
    expect(SRC.mealPlanner).toMatch(
      /import\s*\{[\s\S]*?\bPackage\b[\s\S]*?\}\s*from\s*["']lucide-react["']/,
    );
  });

  it("the leftover badge uses the warning token, not success green", () => {
    // Find the leftover badge block by its stable aria-label and assert
    // the warning token tints it (bg-warning + text-warning), mirroring
    // mobile's Accent.warning amber.
    const badgeBlock = SRC.mealPlanner.match(
      /data-testid="meal-planner-leftover-badge"[\s\S]{0,900}?\/>\s*Leftover/,
    );
    expect(badgeBlock).not.toBeNull();
    const block = badgeBlock?.[0] ?? "";
    expect(block).toMatch(/bg-warning\/15/);
    expect(block).toMatch(/text-warning/);
    // The wrong-semantics success green must be gone from the badge.
    expect(block).not.toMatch(/bg-success/);
    expect(block).not.toMatch(/text-success/);
  });

  it("the leftover badge renders the Package icon glyph (~10px) inside the badge", () => {
    const badgeBlock = SRC.mealPlanner.match(
      /data-testid="meal-planner-leftover-badge"[\s\S]{0,900}?\/>\s*Leftover/,
    );
    const block = badgeBlock?.[0] ?? "";
    // h-2.5/w-2.5 = 10px, matching mobile's `<Package size={10} />`.
    expect(block).toMatch(/<Package className="h-2\.5 w-2\.5"/);
  });

  it("accessible label names the recipe — parity with mobile's `Leftover of \${title}`", () => {
    // Parity review 2c (2026-06-12): web's static "Leftover portion" was
    // less specific than mobile's recipe-named label. Both now read
    // "Leftover of {recipe}".
    expect(SRC.mealPlanner).toMatch(/aria-label=\{`Leftover of \$\{meal\.recipeTitle/);
  });
});
