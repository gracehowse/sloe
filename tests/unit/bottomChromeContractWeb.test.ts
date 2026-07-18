import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const APP = readFileSync(resolve(__dirname, "../../src/app/App.tsx"), "utf8");

describe("bottom_chrome_contract_v1 — mobile web", () => {
  it("limits root bottom chrome to the five root destinations", () => {
    expect(APP).toContain('isFeatureEnabled("bottom_chrome_contract_v1")');
    expect(APP).toContain('["today", "plan", "library", "discover", "progress"].includes(currentView)');
    expect(APP).toContain("showMobileBottomChrome ? <nav");
  });

  it("removes the duplicate legacy Plan chrome on the v3 path", () => {
    expect(APP).toContain('isFeatureEnabled("sloe_v3_plan")');
    expect(APP).toContain("{sloeV3Plan ? null : <PlanTabChrome");
  });

  it("gives pushed Settings a mobile-web back action", () => {
    expect(APP).toContain('onBack={() => navigateToView("today")}');
  });
});
