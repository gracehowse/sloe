import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const landingTsx = fs.readFileSync(
  path.resolve("app/(landing)/LandingPage.tsx"),
  "utf-8",
);
const landingCss = fs.readFileSync(
  path.resolve("app/(landing)/landing.css"),
  "utf-8",
);

describe("Sloe landing footer", () => {
  it("renders Sloe wordmark in footer", () => {
    expect(landingTsx).toContain("SloeWordmark");
    expect(landingTsx).toContain("lp-wordmark-footer");
  });

  it("renders three footer link columns (Product, Company, Legal)", () => {
    expect(landingTsx).toContain("<h4>Product</h4>");
    expect(landingTsx).toContain("<h4>Company</h4>");
    expect(landingTsx).toContain("<h4>Legal</h4>");
  });

  it("includes What's new link in Company column", () => {
    expect(landingTsx).toContain("What&apos;s new");
  });

  it("uses ink footer background token", () => {
    expect(landingCss).toContain("--lp-footer-bg: var(--foreground)");
  });

  it("has reduced-motion CSS block", () => {
    expect(landingCss).toMatch(/@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/);
  });
});
