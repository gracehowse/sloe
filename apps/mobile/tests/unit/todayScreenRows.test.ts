import { describe, expect, it } from "vitest";

import { formatMealSourceLabelForRow } from "@/lib/todayScreenRows";

describe("Today meal-row source labels", () => {
  it("preserves nutrition-label provenance", () => {
    expect(formatMealSourceLabelForRow("Nutrition label")).toBe("Nutrition label");
  });
});
