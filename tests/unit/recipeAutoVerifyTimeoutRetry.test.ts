/**
 * ENG-1329 — the recipe-detail auto-verify fetch (`/api/nutrition/verify-recipe`)
 * had no timeout and a silent catch: a hung request (reproduces in any env
 * without provider keys configured) left "Matching…" showing forever with
 * no honest error/retry state (state-handling bar: no silent failure).
 *
 * Source-string pins (mirroring recipeIngredientVerifyAndAmountFixes.test.ts)
 * because both the mobile recipe-detail screen and the web RecipeDetail
 * component depend on render contexts (Expo Router / Next.js) the
 * vitest/jsdom env cannot host.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const WEB_RECIPE_DETAIL = resolve(__dirname, "../../src/app/components/RecipeDetail.tsx");
const MOBILE_RECIPE = resolve(__dirname, "../../apps/mobile/app/recipe/[id].tsx");

const SRC = {
  web: readFileSync(WEB_RECIPE_DETAIL, "utf8"),
  mobile: readFileSync(MOBILE_RECIPE, "utf8"),
};

describe("ENG-1329 — auto-verify fetch has a bounded timeout", () => {
  it("web fetch carries an AbortSignal.timeout", () => {
    expect(SRC.web).toMatch(/fetch\("\/api\/nutrition\/verify-recipe"[\s\S]{0,600}?AbortSignal\.timeout\(30_000\)/);
  });

  it("mobile fetch carries an AbortSignal.timeout", () => {
    expect(SRC.mobile).toMatch(
      /fetch\(`\${apiBase}\/api\/nutrition\/verify-recipe`[\s\S]{0,600}?AbortSignal\.timeout\(30_000\)/,
    );
  });
});

describe("ENG-1329 — auto-verify failure is no longer silent", () => {
  it("web sets an error state in the catch block instead of an empty catch", () => {
    expect(SRC.web).toContain("const [autoVerifyFailed, setAutoVerifyFailed] = useState(false);");
    expect(SRC.web).not.toMatch(/catch\s*{\s*\/\*\s*silent/);
    expect(SRC.web).toMatch(/catch\s*{[\s\S]{0,400}?setAutoVerifyFailed\(true\)/);
  });

  it("mobile sets an error state in the catch block instead of an empty catch", () => {
    expect(SRC.mobile).toContain("const [autoVerifyFailed, setAutoVerifyFailed] = useState(false);");
    expect(SRC.mobile).toMatch(/catch\s*{[\s\S]{0,400}?setAutoVerifyFailed\(true\)/);
  });
});

describe("ENG-1329 — a retry affordance exists on both platforms", () => {
  it("web has a retry token wired into the effect's dependency array and a Retry control", () => {
    expect(SRC.web).toContain("autoVerifyRetryToken");
    expect(SRC.web).toMatch(/setAutoVerifyRetryToken\(\(n\) => n \+ 1\)/);
    expect(SRC.web).toContain("Retry");
  });

  it("mobile has a retry token wired into the effect's dependency array and a Retry control", () => {
    expect(SRC.mobile).toContain("autoVerifyRetryToken");
    expect(SRC.mobile).toMatch(/setAutoVerifyRetryToken\(\(n\) => n \+ 1\)/);
    expect(SRC.mobile).toContain("Retry");
  });
});
