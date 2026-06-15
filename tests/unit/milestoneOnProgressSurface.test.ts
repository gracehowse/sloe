import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");

describe("ENG-632 — 30-day milestone on Progress only", () => {
  it("web Today does not mount milestone gate or dialog", () => {
    const tracker = readFileSync(
      resolve(ROOT, "src/app/components/NutritionTracker.tsx"),
      "utf8",
    );
    expect(tracker).not.toMatch(/Milestone30DayDialog/);
    expect(tracker).not.toMatch(/shouldShowMilestone30Day/);
    expect(tracker).not.toMatch(/milestone30HandledRef/);
  });

  it("web Progress uses useMilestone30DayOnProgress", () => {
    const progress = readFileSync(
      resolve(ROOT, "src/app/components/ProgressDashboard.tsx"),
      "utf8",
    );
    expect(progress).toMatch(/useMilestone30DayOnProgress/);
    expect(progress).toMatch(/Milestone30DayDialog/);
    const hook = readFileSync(
      resolve(ROOT, "src/hooks/useMilestone30DayOnProgress.ts"),
      "utf8",
    );
    expect(hook).toMatch(/surface:\s*"progress"/);
  });

  it("mobile Today does not mount milestone modal", () => {
    const today = readFileSync(
      resolve(ROOT, "apps/mobile/app/(tabs)/index.tsx"),
      "utf8",
    );
    expect(today).not.toMatch(/Milestone30DayModal/);
    expect(today).not.toMatch(/shouldShowMilestone30Day/);
    expect(today).not.toMatch(/milestone30HandledRef/);
  });

  it("mobile Progress uses useMilestone30DayOnProgress", () => {
    const progress = readFileSync(
      resolve(ROOT, "apps/mobile/app/(tabs)/progress.tsx"),
      "utf8",
    );
    expect(progress).toMatch(/useMilestone30DayOnProgress/);
    expect(progress).toMatch(/Milestone30DayModal/);
  });
});

describe("ENG-633 — cookie consent clears Today FAB on product routes", () => {
  it("lifts banner above bottom nav on today/plan/shopping", () => {
    const cookie = readFileSync(
      resolve(ROOT, "src/app/components/CookieConsent.tsx"),
      "utf8",
    );
    // Helper renamed isProductFabRoute → isProductAppRoute (13952d62); the banner
    // still lifts above the bottom nav on product routes (the bottom-[calc(4.5rem…]
    // class below is the behaviour that actually matters).
    expect(cookie).toMatch(/isProductAppRoute/);
    expect(cookie).toMatch(/bottom-\[calc\(4\.5rem/);
    expect(cookie).toMatch(/usePathname/);
  });
});
