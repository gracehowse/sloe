import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Source-level guard on the landing footer.
 *
 * Reads EVERY `.tsx`/`.ts` source in the `app/(landing)` route group rather
 * than `LandingPage.tsx` alone: the design-consistency pass (2026-07-24) split
 * the nav + footer out into `LandingChrome.tsx` to keep `LandingPage.tsx`
 * under its line budget, which silently emptied these assertions of their
 * subject. Scanning the group keeps them pinned to the rendered page wherever
 * a future extraction moves the markup.
 */
const LANDING_DIR = path.resolve("app/(landing)");

const landingTsx = fs
  .readdirSync(LANDING_DIR)
  .filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"))
  .sort()
  .map((f) => fs.readFileSync(path.join(LANDING_DIR, f), "utf-8"))
  .join("\n");

const landingCss = fs.readFileSync(
  path.join(LANDING_DIR, "landing.css"),
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
