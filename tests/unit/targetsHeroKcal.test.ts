import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const webTargets = fs.readFileSync(
  path.resolve("src/app/components/Targets.tsx"),
  "utf-8",
);
const mobileTargets = fs.readFileSync(
  path.resolve("apps/mobile/app/targets.tsx"),
  "utf-8",
);

describe("ENG-63 · Targets daily kcal hero display", () => {
  it("web uses 48px for the hero kcal number", () => {
    expect(webTargets).toContain("text-[48px]");
  });

  it("web uses extrabold weight", () => {
    expect(webTargets).toContain("font-extrabold");
  });

  it("web uses tabular-nums", () => {
    expect(webTargets).toContain("tabular-nums");
  });

  it("web uses tight tracking (-0.03em)", () => {
    expect(webTargets).toContain("-tracking-[0.03em]");
  });

  it("mobile uses fontSize 48", () => {
    expect(mobileTargets).toContain("fontSize: 48");
  });

  it("mobile uses fontWeight 800", () => {
    expect(mobileTargets).toContain('fontWeight: "800"');
  });

  it("mobile uses tabular-nums", () => {
    expect(mobileTargets).toContain("tabular-nums");
  });
});
