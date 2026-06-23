/**
 * deriveQuickWeeknight (ENG-1225 Block 6) — the shared Discover "Quick weeknight"
 * derivation. Pins the ≤30-min threshold, the real-calorie + non-imported gates,
 * and the 6-card cap.
 */
import { describe, expect, it } from "vitest";
import {
  deriveQuickWeeknight,
  type QuickWeeknightRecipe,
} from "../../src/lib/discover/quickWeeknight";

const r = (
  id: string,
  o: Partial<QuickWeeknightRecipe> = {},
): QuickWeeknightRecipe & { id: string } => ({
  id,
  title: id,
  calories: 450,
  prepTimeMin: 10,
  cookTimeMin: 12,
  ...o,
});

describe("deriveQuickWeeknight", () => {
  it("keeps quick (<=30 min) recipes with real calories", () => {
    const out = deriveQuickWeeknight([
      r("quick", { prepTimeMin: 5, cookTimeMin: 10 }),
      r("slow", { prepTimeMin: 20, cookTimeMin: 30 }),
      r("no-cal", { calories: 0 }),
    ]);
    expect(out.map((x) => x.id)).toEqual(["quick"]);
  });

  it("excludes imported stubs", () => {
    const out = deriveQuickWeeknight([
      r("ok"),
      r("imported", { contentOrigin: "imported_stub" }),
    ]);
    expect(out.map((x) => x.id)).toEqual(["ok"]);
  });

  it("excludes recipes with no time signal (not quick)", () => {
    const out = deriveQuickWeeknight([r("notime", { prepTimeMin: null, cookTimeMin: null })]);
    expect(out).toHaveLength(0);
  });

  it("caps at 6", () => {
    const many = Array.from({ length: 9 }, (_, i) => r(`m${i}`, { prepTimeMin: 5, cookTimeMin: 5 }));
    expect(deriveQuickWeeknight(many)).toHaveLength(6);
  });
});
