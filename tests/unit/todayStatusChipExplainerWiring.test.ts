/**
 * ENG-1184 — Fresh start / status chip opens the calorie-target explainer
 * on Today (web + mobile). Pins host wiring so the sheet/dialog can't
 * drift back to Targets-only without an intentional change.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("ENG-1184 — status chip → WhyThisNumber on Today", () => {
  it("web NutritionTracker hosts WhyThisNumberDialog and wires onPressStatusChip", () => {
    const tracker = read("src/app/components/NutritionTracker.tsx");
    expect(tracker).toMatch(/<WhyThisNumberDialog/);
    expect(tracker).toMatch(/onPressStatusChip=\{\(\) => setWhyThisNumberOpen\(true\)\}/);
    expect(tracker).toMatch(/whyThisNumberOpen/);
  });

  it("mobile Today hosts WhyThisNumberSheet and wires onPressStatusChip", () => {
    const today = read("apps/mobile/app/(tabs)/index.tsx");
    expect(today).toMatch(/<WhyThisNumberSheet/);
    expect(today).toMatch(/onPressStatusChip=\{\(\) => setWhySheetOpen\(true\)\}/);
    expect(today).toMatch(/whySheetOpen/);
  });

  it("web hero status chip is a button when onPressStatusChip is provided", () => {
    const ring = read("src/app/components/suppr/today-hero-ring.tsx");
    expect(ring).toMatch(/onPressStatusChip/);
    expect(ring).toMatch(/see how your calorie target was set/);
  });

  it("mobile hero status chip is pressable when onPressStatusChip is provided", () => {
    const ring = read("apps/mobile/components/today/TodayHeroRing.tsx");
    expect(ring).toMatch(/onPressStatusChip/);
    expect(ring).toMatch(/accessibilityRole="button"/);
    expect(ring).toMatch(/see how your calorie target was set/);
  });
});
