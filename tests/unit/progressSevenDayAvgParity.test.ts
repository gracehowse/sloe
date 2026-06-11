/**
 * ENG-1053 — Journey + Trajectory must share `avgCaloriesOverRecentLoggedDays`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MOBILE_PROGRESS = resolve(__dirname, "../../apps/mobile/app/(tabs)/progress.tsx");
const WEB_PROGRESS = resolve(__dirname, "../../src/app/components/ProgressDashboard.tsx");

describe("ENG-1053 — Progress seven-day average parity", () => {
  it("mobile Journey imports the shared helper", () => {
    const src = readFileSync(MOBILE_PROGRESS, "utf8");
    expect(src).toMatch(/avgCaloriesOverRecentLoggedDays/);
    expect(src).not.toMatch(/daysWithFood\.slice\(-7\)/);
  });

  it("web Journey imports the shared helper", () => {
    const src = readFileSync(WEB_PROGRESS, "utf8");
    expect(src).toMatch(/avgCaloriesOverRecentLoggedDays/);
    expect(src).not.toMatch(/recentKeys\.filter\(\(k\) => \(nutritionByDay\[k\]/);
  });
});
