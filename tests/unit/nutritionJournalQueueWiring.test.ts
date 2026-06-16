import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd());

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("ENG-1125 web nutrition journal queue wiring", () => {
  const src = read("src/context/appData/useNutritionJournalState.ts");

  it("queues failed single-meal inserts via enqueueFailedUpsert", () => {
    expect(src).toMatch(/enqueueFailedUpsert/);
    expect(src).toMatch(/Saved on this device — we'll sync when you're back online/);
  });

  it("queues failed bulk copy/duplicate inserts instead of rolling back", () => {
    expect(src).toMatch(/const addLoggedMealsForDate = useCallback/);
    const idx = src.indexOf("const addLoggedMealsForDate");
    const slice = src.slice(idx, idx + 2500);
    expect(slice).toMatch(/enqueueFailedUpsert/);
    expect(slice).not.toMatch(/setNutritionByDay\(prevSnapshot\)/);
  });

  it("queues failed meal updates instead of rolling back", () => {
    expect(src).toMatch(/const updateLoggedMeal = useCallback/);
    const idx = src.indexOf("const updateLoggedMeal");
    const slice = src.slice(idx, idx + 2000);
    expect(slice).toMatch(/enqueueFailedUpsert/);
    expect(slice).not.toMatch(/setNutritionByDay\(prevSnapshot\)/);
  });
});
