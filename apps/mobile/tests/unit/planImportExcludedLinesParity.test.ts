/**
 * ENG-1422 — Plan Import excluded-line cap + count surfacing, mobile parity.
 *
 * Two guarantees, one per platform concern:
 *
 *  1. The tier CAP is shared logic. Mobile reaches the SAME
 *     `recipeConfidenceTierWithExclusions` the web parse route uses, via the
 *     `@suppr/nutrition-core/verifyConfidencePolicy` alias — importing through
 *     it here proves the alias resolves and the cap behaves identically on
 *     mobile (a more-incomplete recipe can never read at a higher tier).
 *
 *  2. The count SURFACING must exist on the mobile review screen too. Web and
 *     mobile both render the advisory behind `plan_import_excluded_lines_v1`
 *     off `stats.excludedLineCount`, with matching copy — pinned by source
 *     assertion so a regression that drops the surfacing on either platform
 *     fails (mirror of `screenAuditFixesParity` / `planSourceParity`).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { recipeConfidenceTierWithExclusions } from "@suppr/nutrition-core/verifyConfidencePolicy";

const ROOT = resolve(__dirname, "../../../..");
const MOBILE_SCREEN = readFileSync(
  resolve(ROOT, "apps/mobile/app/plan-import.tsx"),
  "utf8",
);
const WEB_REVIEW = readFileSync(
  resolve(ROOT, "src/app/components/plan-import/PlanImportReview.tsx"),
  "utf8",
);

describe("ENG-1422 — cap helper reachable + identical on mobile", () => {
  it("caps a high accepted-average to medium once any line is excluded", () => {
    expect(recipeConfidenceTierWithExclusions(0.9, 0, 5)).toBe("high");
    expect(recipeConfidenceTierWithExclusions(0.9, 1, 4)).toBe("medium");
  });

  it("drops to low when half or more of the recipe was excluded", () => {
    expect(recipeConfidenceTierWithExclusions(0.95, 3, 3)).toBe("low");
  });

  it("more excluded lines never read higher than fewer (no inversion)", () => {
    const order = { low: 0, medium: 1, high: 2 } as const;
    const zero = order[recipeConfidenceTierWithExclusions(0.9, 0, 5)];
    const one = order[recipeConfidenceTierWithExclusions(0.9, 1, 5)];
    expect(one).toBeLessThan(zero);
  });
});

describe("ENG-1422 — mobile review screen surfaces the excluded-line count", () => {
  it("gates the advisory behind the shared flag", () => {
    expect(MOBILE_SCREEN).toMatch(/isFeatureEnabled\("plan_import_excluded_lines_v1"\)/);
  });

  it("reads the count from stats.excludedLineCount and renders it in a testable node", () => {
    expect(MOBILE_SCREEN).toMatch(/parseResult\.stats\.excludedLineCount\s*>\s*0/);
    expect(MOBILE_SCREEN).toMatch(/testID="plan-import-excluded-note"/);
  });

  it("uses the same copy voice as web (low-confidence · left out · review before importing)", () => {
    for (const token of [/low-confidence/, /left out/, /review before importing/]) {
      expect(MOBILE_SCREEN, `mobile copy: ${token}`).toMatch(token);
      expect(WEB_REVIEW, `web copy: ${token}`).toMatch(token);
    }
  });

  it("pluralises line/lines the same way on both platforms", () => {
    expect(MOBILE_SCREEN).toMatch(/=== 1 \? "line" : "lines"/);
    expect(WEB_REVIEW).toMatch(/=== 1 \? "line" : "lines"/);
  });
});
