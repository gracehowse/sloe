import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const COOK = readFileSync(resolve(__dirname, "../../app/cook.tsx"), "utf8");
const STRIP = readFileSync(
  resolve(__dirname, "../../components/cook/CookRunningTimerStrip.tsx"),
  "utf8",
);
const PILLS = readFileSync(
  resolve(__dirname, "../../components/cook/CookStepTimerPills.tsx"),
  "utf8",
);

describe("ENG-948 cook multi-timers (mobile)", () => {
  it("cook screen gates multi-timer UI behind cook_multi_timers_v1", () => {
    expect(COOK).toContain('isFeatureEnabled("cook_multi_timers_v1")');
    expect(COOK).toContain("CookRunningTimerStrip");
    expect(COOK).toContain("CookStepTimerPills");
    expect(COOK).toContain("useCookRunningTimers");
  });

  it("timer pills render one button per parsed duration", () => {
    expect(PILLS).toMatch(/timers\.map\(/);
    expect(PILLS).toContain("timer.label");
  });

  it("running timer strip keeps concurrent timers visible", () => {
    expect(STRIP).toMatch(/timers\.map\(/);
    expect(STRIP).toContain("Reset");
  });

  it("applies Type.captionSmall at render time, not in StyleSheet.create (module-init safe)", () => {
    expect(STRIP).toContain("Type.captionSmall");
    expect(STRIP).not.toMatch(/StyleSheet\.create\([\s\S]*Type\.captionSmall\.fontFamily/);
  });
});
