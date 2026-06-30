import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  RESET_PLAN_CONFIRM_FLAG,
  RESET_PLAN_SHEET_COPY,
} from "@/lib/planning/resetPlanSheet";

const ROOT = resolve(__dirname, "../..");

describe("resetPlanSheet (ENG-1261 / B28)", () => {
  it("exports stable copy + flag id", () => {
    expect(RESET_PLAN_CONFIRM_FLAG).toBe("reset_plan_confirm_v1");
    expect(RESET_PLAN_SHEET_COPY.title).toBe("Reset this week's plan");
    expect(RESET_PLAN_SHEET_COPY.keep.title).toContain("logged");
    expect(RESET_PLAN_SHEET_COPY.clearWarning).toMatch(/uncooked/i);
  });

  it("is wired on web MealPlanner behind the flag", () => {
    const mealPlanner = readFileSync(
      resolve(ROOT, "src/app/components/MealPlanner.tsx"),
      "utf8",
    );
    expect(mealPlanner).toContain("ResetPlanSheet");
    expect(mealPlanner).toContain("useMealPlanRegenerate");
    expect(mealPlanner).toContain("requestRegenerate");
  });

  it("is wired on mobile planner behind the flag", () => {
    const planner = readFileSync(
      resolve(ROOT, "apps/mobile/app/(tabs)/planner.tsx"),
      "utf8",
    );
    expect(planner).toContain("ResetPlanSheet");
    expect(planner).toContain("useResetPlanGate");
    expect(planner).toContain("requestLibraryGenerate");
  });
});
