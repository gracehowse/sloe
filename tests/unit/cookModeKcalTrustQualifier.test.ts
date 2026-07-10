/**
 * Cook Mode — kcal trust qualifier (ENG-1417 slice E).
 *
 * The Done-state summary ("Recipe · N servings — X kcal · Yg protein") is a
 * decision-driving surface per the ENG-1417 docstring (alongside meal-planner
 * totals and the north-star card): the user just finished cooking and the
 * number becomes part of their logged intake. Pins that it renders through
 * `formatQualifiedKcal` behind `kcal_trust_qualifier_v1`, matching every
 * other slice's flag-gated "~" convention, rather than a bare
 * `Math.round(...)`.
 *
 * Mobile's cook.tsx has no kcal render site on its completion card (verified
 * during slice E research — it only shows duration/rating/notes), so there
 * is nothing to qualify there; this pin is web-only by design.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO = resolve(__dirname, "..", "..");
const WEB_COOK = readFileSync(resolve(REPO, "src/app/components/CookMode.tsx"), "utf8");

describe("CookMode (web) — Done-state kcal trust qualifier (ENG-1417)", () => {
  it("imports formatQualifiedKcal from the shared nutrition helper", () => {
    expect(WEB_COOK).toMatch(
      /import\s*\{\s*formatQualifiedKcal\s*\}\s*from\s*["']\.\.\/\.\.\/lib\/nutrition\/formatMacro["']/,
    );
  });

  it("gates the Done-card kcal render behind kcal_trust_qualifier_v1", () => {
    expect(WEB_COOK).toMatch(/isFeatureEnabled\("kcal_trust_qualifier_v1"\)/);
    expect(WEB_COOK).toMatch(
      /formatQualifiedKcal\(recipe\.calories \* scaleFactor, recipe\.isVerified\)/,
    );
  });

  it("still renders the plain rounded value when the flag is off (kill switch)", () => {
    expect(WEB_COOK).toMatch(/Math\.round\(recipe\.calories \* scaleFactor\)/);
  });
});
