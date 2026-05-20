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

describe("ENG-90 · Landing footer upgrade", () => {
  it("has a pre-footer CTA section", () => {
    expect(landingTsx).toContain("PreFooterCta");
    expect(landingTsx).toContain("Ready to start cooking?");
  });

  it("renders three footer link columns (Product, Account, Legal)", () => {
    expect(landingTsx).toContain("<h4>Product</h4>");
    expect(landingTsx).toContain("<h4>Account</h4>");
    expect(landingTsx).toContain("<h4>Legal</h4>");
  });

  it("includes What's new link in footer", () => {
    expect(landingTsx).toContain("What&apos;s new");
  });

  it("shows region note in footer", () => {
    expect(landingTsx).toContain("Built in London");
    expect(landingTsx).toContain("lp-f-region");
  });

  it("has a 4-column footer grid in CSS", () => {
    expect(landingCss).toContain("2.5fr 1fr 1fr 1fr");
  });

  it("uses 24px brand wordmark in footer", () => {
    expect(landingCss).toContain("font-size: 24px");
    expect(landingTsx).toContain("lp-brand-footer");
  });

  it("has pre-footer CTA CSS", () => {
    expect(landingCss).toContain("lp-pre-footer-cta");
  });

  it("footer bottom bar links have hover state", () => {
    expect(landingCss).toContain(".lp-f-bottom .lp-legal a:hover");
  });
});
