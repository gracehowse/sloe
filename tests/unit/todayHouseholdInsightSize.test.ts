/**
 * ENG-849 — AppDataContext exposes householdMemberCount for Today insight copy.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");

describe("ENG-849 household member count on Today", () => {
  it("AppDataContext exposes householdMemberCount from getMyHousehold", () => {
    const src = readFileSync(resolve(ROOT, "src/context/AppDataContext.tsx"), "utf8");
    expect(src).toMatch(/householdMemberCount: number/);
    expect(src).toMatch(/setHouseholdMemberCount/);
    expect(src).toMatch(/members\?\.length/);
  });

  it("web NutritionTracker passes householdMemberCount to the mobile weekly insight card", () => {
    const src = readFileSync(
      resolve(ROOT, "src/app/components/NutritionTracker.tsx"),
      "utf8",
    );
    expect(src).toMatch(/householdMemberCount/);
    expect(src).toMatch(/householdSize=\{householdMemberCount\}/);
  });

  it("mobile TodayScreen uses useHouseholdMemberCount for WeeklyInsightCard", () => {
    const src = readFileSync(
      resolve(ROOT, "apps/mobile/app/(tabs)/_today/TodayScreen.tsx"),
      "utf8",
    );
    expect(src).toMatch(/useHouseholdMemberCount/);
    expect(src).toMatch(/householdSize=\{householdMemberCount\}/);
  });
});
