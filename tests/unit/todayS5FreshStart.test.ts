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

  it("cold-open coach line is food-forward (ENG-939), no duplicate 'Fresh start' (ENG-1549)", () => {
    // The status chip already carries "Fresh start"; the coach line must NOT
    // repeat it (it rendered twice in the same hero card before ENG-1549).
    expect(todayRoomForMeal(2040, "Breakfast", [], 9)).toBe("What's for breakfast?");
    expect(todayColdOpenCoachLine(14)).toBe("What's for lunch?");
    expect(todayColdOpenCoachLine(9)).not.toMatch(/Fresh start/);
  });

  it("web hero chip de-tints Fresh start (today_tracker_tier_v1 collapsed ENG-1356, always-on tint)", () => {
    // `today_tracker_tier_v1` was always-on in production (REDESIGN_DEFAULT_ON)
    // and was collapsed in ENG-1356 — no flag check remains, only the
    // de-tinted (tier-on) "Fresh start" chip.
    const ring = read("src/app/components/suppr/today-hero-ring.tsx");
    const parts = read("src/app/components/suppr/today-hero-ring-parts.tsx");
    expect(ring).not.toMatch(/today_tracker_tier_v1/);
    expect(parts).not.toMatch(/today_tracker_tier_v1/);
    expect(parts).toMatch(/state === "empty"[\s\S]*text-foreground-brand/);
    expect(parts).not.toMatch(/state === "empty"[\s\S]*bg-ring-bg/);
  });

  it("mobile hero chip de-tints Fresh start (today_tracker_tier_v1 collapsed ENG-1356, always-on tint)", () => {
    const src = read("apps/mobile/components/today/TodayHeroChips.tsx");
    expect(src).not.toMatch(/today_tracker_tier_v1/);
    expect(src).not.toMatch(/tierV1/);
    expect(src).toMatch(/bg:\s*"transparent"/);
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
