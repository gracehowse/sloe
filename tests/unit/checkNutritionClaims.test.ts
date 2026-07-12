/**
 * ENG-1545 — self-test for the nutrition/health-claims CI checker.
 *
 * Exercises scripts/check-nutrition-claims.mjs's core matcher against fixture
 * strings so the two regressions the ticket names are pinned:
 *   1. The false-positive regex used to suppress the standalone health claim
 *      "cure"/"cures" itself (via a `cur(e|…)` alternative) — so "cures
 *      bloating" / "cure your cravings" silently passed. They must now FAIL.
 *   2. Common non-compliant claims (boost metabolism, fat-burning, burn fat,
 *      melt fat, torch calories, detox/detoxify) were missing from the ban.
 * And it guards the other direction: genuine false positives (secure, procure,
 * curated, cured meats, the FDA supplement disclaimer, code identifiers) must
 * NOT be flagged, and the ban must not be weakened to let a real claim pass.
 */
import { describe, it, expect } from "vitest";

import { findClaimViolationsInText, BANNED_PHRASES } from "../../scripts/check-nutrition-claims.mjs";

function phrasesFlagged(text: string): string[] {
  return (findClaimViolationsInText(text) as Array<{ phrase: string }>).map((v) => v.phrase);
}
function isFlagged(text: string): boolean {
  return phrasesFlagged(text).length > 0;
}

describe("check-nutrition-claims — the 'cure' health claim now fires (ENG-1545)", () => {
  it("flags 'cures bloating' (the exact false negative from the ticket)", () => {
    expect(isFlagged("Our tea cures bloating fast.")).toBe(true);
    expect(phrasesFlagged("Our tea cures bloating fast.")).toEqual(
      expect.arrayContaining(["cures"]),
    );
  });

  it("flags 'cure your cravings'", () => {
    expect(phrasesFlagged("This will cure your cravings.")).toEqual(
      expect.arrayContaining(["cure"]),
    );
  });
});

describe("check-nutrition-claims — newly banned claims (ENG-1545)", () => {
  it.each([
    ["boost metabolism", "Boost metabolism naturally."],
    ["metabolism boost", "Get a metabolism boost every morning."],
    ["fat-burning", "Our fat-burning blend melts pounds."],
    ["burn fat", "Burn fat while you sleep."],
    ["melt fat", "Melt fat in 7 days."],
    ["torch calories", "Torch calories with one sip."],
    ["detox", "Detox your body overnight."],
    ["detoxify", "Detoxify your liver."],
  ])("flags '%s'", (phrase, sentence) => {
    expect(phrasesFlagged(sentence)).toEqual(expect.arrayContaining([phrase]));
  });
});

describe("check-nutrition-claims — genuine false positives stay clean", () => {
  it.each([
    "secure the auth token before the request",
    "procure the supplies from the vendor",
    "read the current value from state",
    "move the cursor to the input",
    "curious users tap the info icon",
    "curated recipes for your goals",
    "accurate to the nearest gram",
    "slow-cured pork belly, sliced thin",
    "pancetta pork cured", // food alias form from verifyIngredients.ts
    "This product is not intended to diagnose, treat, cure, or prevent any disease.",
    "const treatServingAsTruth = false;", // camelCase identifier, not a claim
    "const curEmpty = value == null;", // camelCase identifier, not a claim
  ])("does NOT flag: %s", (line) => {
    expect(isFlagged(line)).toBe(false);
  });

  it("does NOT flag a comment line even when it contains a banned phrase", () => {
    expect(isFlagged("// this would cure everything")).toBe(false);
    expect(isFlagged("{/* Fed → Fat burning → Ketosis */}")).toBe(false);
  });

  it("still flags a REAL claim that merely sits near a false-positive word", () => {
    // The suppressors must not blanket-clear the line — "burn fat" is a claim
    // even on a line that also mentions a secure checkout.
    expect(phrasesFlagged("Secure checkout — burn fat guaranteed.")).toEqual(
      expect.arrayContaining(["burn fat"]),
    );
  });
});

describe("check-nutrition-claims — ban list integrity", () => {
  it("exports the banned phrases and includes cure + the ENG-1545 additions", () => {
    expect(BANNED_PHRASES).toEqual(
      expect.arrayContaining([
        "cure",
        "cures",
        "boost metabolism",
        "fat-burning",
        "burn fat",
        "detox",
        "torch calories",
      ]),
    );
  });
});
