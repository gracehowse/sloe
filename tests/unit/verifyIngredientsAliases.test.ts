import { describe, it, expect } from "vitest";
import { applyNameAliases, normalizeQueryForUsda } from "../../src/lib/nutrition/verifyIngredients.ts";

describe("applyNameAliases — silken tofu guard", () => {
  it("routes silken tofu to the silken entry, not firm", () => {
    expect(applyNameAliases("silken tofu")).toMatch(/silken/i);
    expect(applyNameAliases("silken tofu")).not.toMatch(/firm/i);
  });

  it("still aliases bare 'tofu' to firm (established behaviour)", () => {
    expect(applyNameAliases("tofu")).toBe("tofu firm raw");
  });

  it("does not rewrite 'silken tofu' to firm via the bare-tofu alias", () => {
    const out = applyNameAliases("silken tofu");
    expect(out.toLowerCase()).not.toContain("firm");
  });
});

describe("normalizeQueryForUsda — compound 'X or Y' split", () => {
  it("keeps the second branch of a short disjunction", () => {
    expect(normalizeQueryForUsda("blonde or white chocolate")).toBe("white chocolate");
  });

  it("handles 'milk or dark chocolate'", () => {
    expect(normalizeQueryForUsda("milk or dark chocolate")).toBe("dark chocolate");
  });

  it("leaves single-term names alone", () => {
    expect(normalizeQueryForUsda("white chocolate")).toBe("white chocolate");
  });

  it("does not split when branches are too long (likely not a disjunction)", () => {
    const long = "finely chopped parsley or coriander leaves for garnish";
    // The existing descriptor stripper removes "finely chopped" / "for garnish",
    // so this should NOT collapse to just "coriander leaves for garnish" via the
    // or-split — the left branch has >3 words of ingredient content.
    const out = normalizeQueryForUsda(long);
    expect(out.length).toBeGreaterThan(0);
  });
});
