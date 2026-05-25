import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const grid = fs.readFileSync(
  path.resolve("app/pricing/PricingTiersGrid.tsx"),
  "utf-8",
);
const page = fs.readFileSync(
  path.resolve("app/pricing/page.tsx"),
  "utf-8",
);

describe("ENG-63 · Pricing card tightening", () => {
  it("uses p-6 for regular card padding (not p-8)", () => {
    expect(grid).toContain("shadow-sm p-6");
    expect(grid).toContain("px-6");
    expect(grid).not.toContain("p-8");
  });

  it("uses gap-5 between cards (not gap-6)", () => {
    expect(grid).toContain("gap-5");
  });

  it("tighter feature list spacing (space-y-2)", () => {
    expect(grid).toContain("space-y-2 mb-5");
  });

  it("tighter billing toggle bottom margin (mb-8)", () => {
    expect(grid).toContain("mb-8 gap-2");
  });

  it("tighter trust signals margin (mt-10)", () => {
    expect(page).toContain("mt-10");
    expect(page).toContain("gap-6");
  });

  it("tighter FAQ spacing", () => {
    expect(page).toContain("mt-14");
    expect(page).toContain("mb-6");
    expect(page).toContain("px-5");
  });
});
