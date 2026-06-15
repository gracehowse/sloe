import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd());

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("ENG-1122 web logged-meal edit wiring", () => {
  it("threads updateLoggedMeal through AppDataContext", () => {
    expect(read("src/context/AppDataContext.tsx")).toMatch(/updateLoggedMeal/);
    expect(read("src/context/appData/useNutritionJournalState.ts")).toMatch(
      /buildNutritionEntryUpdatePayload/,
    );
  });

  it("gates edit affordance behind web_logged_meal_edit", () => {
    expect(read("src/app/components/NutritionTracker.tsx")).toMatch(
      /isFeatureEnabled\("web_logged_meal_edit"\)/,
    );
    expect(read("src/app/components/suppr/today-meals-section.tsx")).toMatch(/onEditMeal/);
  });
});
