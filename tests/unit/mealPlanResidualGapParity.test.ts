/**
 * F-15 — residual-protein-gap hint parity pin.
 *
 * Both the web `MealPlanner.tsx` day card and the mobile `planner.tsx`
 * day card must:
 *   - Read `dp.residualProteinGap` (single source of truth from the
 *     joint-fit scaler in `src/lib/nutrition/mealPlanAlgo.ts`).
 *   - Render the hint ONLY when `residualProteinGap < -10`. No hint
 *     for a ≤10g gap (the "don't nag" rule from the product-lead
 *     consult, 2026-04-19).
 *   - Use the same user-facing string ("Protein Xg under target — try
 *     scaling {slot} up or swap to a higher-protein recipe.") and
 *     select {slot} as the lowest-protein slot.
 *
 * When this test fails: the platforms have drifted. Re-align both files
 * before shipping — parity is non-negotiable (see .claude/CLAUDE.md).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO = process.cwd();
const WEB = readFileSync(join(REPO, "src/app/components/MealPlanner.tsx"), "utf8");
const MOBILE = readFileSync(join(REPO, "apps/mobile/app/(tabs)/planner.tsx"), "utf8");

describe("F-15 residual-protein-gap hint parity", () => {
  it("both platforms read dp.residualProteinGap on the day card", () => {
    expect(WEB).toMatch(/const\s+gap\s*=\s*dp\.residualProteinGap/);
    expect(MOBILE).toMatch(/const\s+gap\s*=\s*dp\.residualProteinGap/);
  });

  it("both platforms gate the hint on the same threshold (gap < -10, inclusive of -10)", () => {
    expect(WEB).toMatch(/gap\s*>=\s*-10/);
    expect(MOBILE).toMatch(/gap\s*>=\s*-10/);
  });

  it("both platforms render the same user-facing string (leading clause)", () => {
    const clause = /Protein \{under\}g under target — try scaling \{[^}]+\} up or swap to a higher-protein recipe\./;
    expect(WEB).toMatch(clause);
    expect(MOBILE).toMatch(clause);
  });

  it("both platforms select the lowest-protein slot (so the hint is actionable)", () => {
    const lowestLogic = /reduce\(\(low, m\) => /;
    expect(WEB).toMatch(lowestLogic);
    expect(MOBILE).toMatch(lowestLogic);
  });

  it("both platforms no-op when there are no scorable meals (empty / all-placeholder day)", () => {
    expect(WEB).toMatch(/scorable\.length === 0\) return null/);
    expect(MOBILE).toMatch(/scorable\.length === 0\) return null/);
  });

  it("web exposes a stable test hook on the hint element", () => {
    expect(WEB).toMatch(/data-testid="residual-protein-gap-hint"/);
    expect(MOBILE).toMatch(/testID="residual-protein-gap-hint"/);
  });
});
