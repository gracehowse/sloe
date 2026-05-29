import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(resolve(__dirname, rel), "utf8");

describe("ENG-742 — import screens respect launch flags", () => {
  it("plan-import redirects when plan_import_enabled is off", () => {
    const src = read("../../app/plan-import.tsx");
    expect(src).toMatch(/isFeatureEnabled\("plan_import_enabled"\)/);
    expect(src).toMatch(/router\.replace\("\/\(tabs\)\/planner"\)/);
  });

  it("cookbook-import backs out when cookbook_import_enabled is off", () => {
    const src = read("../../app/cookbook-import.tsx");
    expect(src).toMatch(/isFeatureEnabled\("cookbook_import_enabled"\)/);
    expect(src).toMatch(/router\.back\(\)/);
  });
});
