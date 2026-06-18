/**
 * ENG-889 L1 — Today-shaped web loading skeleton.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO = resolve(__dirname, "..", "..");

function read(rel: string): string {
  return readFileSync(resolve(REPO, rel), "utf8");
}

describe("ENG-889 Today loading skeleton", () => {
  it("web Today dynamic import uses TodayLoadingSkeleton, not AppLoadingSkeleton", () => {
    const src = read("src/app/App.tsx");
    expect(src).toContain("TodayLoadingSkeleton");
    expect(src).not.toMatch(/NutritionTracker[\s\S]*AppLoadingSkeleton label="Loading tracker/);
  });

  it("NutritionTracker gates on nutritionJournalHydrated with TodayLoadingSkeleton", () => {
    const src = read("src/app/components/NutritionTracker.tsx");
    expect(src).toContain("nutritionJournalHydrated");
    expect(src).toMatch(/!nutritionJournalHydrated[\s\S]*TodayLoadingSkeleton/);
  });

  it("journal hook exposes journalHydrated for AppDataContext", () => {
    const src = read("src/context/appData/useNutritionJournalState.ts");
    expect(src).toContain("journalHydrated");
    expect(src).toMatch(/setJournalHydrated\(true\)/);
  });
});
