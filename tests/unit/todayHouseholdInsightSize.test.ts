/**
 * ENG-849 — AppDataContext exposes householdMemberCount for Today insight copy.
 * ENG-1364 (phase 2) — household state now lives in `HouseholdContext`;
 * `AppDataContext` re-exposes the two fields via a backward-compat
 * passthrough (see the comment above `useHousehold()` in AppDataContext.tsx)
 * so this test now checks the field is still on `AppDataContextValue` (the
 * passthrough) AND that the real fetch/effect lives in `HouseholdContext`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");

describe("ENG-849 household member count on Today", () => {
  it("AppDataContext still exposes householdMemberCount on its value type (backward-compat passthrough)", () => {
    const src = readFileSync(resolve(ROOT, "src/context/AppDataContext.tsx"), "utf8");
    expect(src).toMatch(/householdMemberCount: number/);
  });

  it("HouseholdContext owns the getMyHousehold fetch (ENG-1364 phase 2 split)", () => {
    const src = readFileSync(resolve(ROOT, "src/context/HouseholdContext.tsx"), "utf8");
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
