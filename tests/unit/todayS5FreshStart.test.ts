/**
 * ENG-889 S5 — Today empty / Fresh start frame (`360:2`) contract pins.
 *
 * Figma S5 · Today (empty): Fresh start chip, honest zero stats, cold-open
 * coach line. Visual proof lives in `docs/testing/figma-vs-simulator.md`
 * (screenshot wall checklist).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  todayColdOpenCoachLine,
  todayRoomForMeal,
  todayStatusChip,
} from "../../src/lib/copy/today";

const REPO = resolve(__dirname, "..", "..");

function read(rel: string): string {
  return readFileSync(resolve(REPO, rel), "utf8");
}

describe("ENG-889 S5 — Fresh start empty Today", () => {
  it("status chip uses Fresh start on an empty day", () => {
    expect(todayStatusChip("empty")).toBe("Fresh start");
  });

  it("cold-open coach line is food-forward (ENG-939) when all slots are open", () => {
    expect(todayRoomForMeal(2040, "Breakfast", [], 9)).toBe(
      "Fresh start — what's for breakfast?",
    );
    expect(todayColdOpenCoachLine(14)).toBe("Fresh start — what's for lunch?");
  });

  it("web hero chip de-tints Fresh start when today_tracker_tier_v1 is on", () => {
    const src = read("src/app/components/suppr/today-hero-ring.tsx");
    expect(src).toMatch(/today_tracker_tier_v1/);
    expect(src).toMatch(/state === "empty"[\s\S]*text-foreground-brand/);
    expect(src).not.toMatch(/state === "empty"[\s\S]*bg-ring-bg[\s\S]*today_tracker_tier_v1/);
  });

  it("mobile hero chip de-tints Fresh start when today_tracker_tier_v1 is on", () => {
    const src = read("apps/mobile/components/today/TodayHeroRing.tsx");
    expect(src).toMatch(/today_tracker_tier_v1/);
    expect(src).toMatch(/tierV1\s*\?\s*"transparent"/);
  });

  it("empty hero keeps honest Goal/Eaten/Bonus stats (Grace 2026-06-10)", () => {
    const mobile = read("apps/mobile/components/today/TodayHeroRing.tsx");
    expect(mobile).toMatch(/isEmpty[\s\S]*"empty"/);
    expect(mobile).toMatch(/label=\"Goal\"|Goal.*Eaten.*Bonus/);
    const web = read("src/app/components/suppr/today-hero-ring.tsx");
    expect(web).toMatch(/label=\"Goal\"/);
    expect(web).toMatch(/renders on EMPTY days too/i);
  });

  it("web + mobile render the under-ring coach via todayRoomForMeal", () => {
    expect(read("src/app/components/suppr/today-deficit-insight.tsx")).toMatch(/todayRoomForMeal/);
    expect(read("apps/mobile/components/today/TodayDeficitInsight.tsx")).toMatch(/todayRoomForMeal/);
  });
});
