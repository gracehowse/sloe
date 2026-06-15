import { describe, expect, it } from "vitest";

import { formatShoppingListSubtitle } from "@/lib/planning/shoppingListMeta";

describe("formatShoppingListSubtitle", () => {
  it("includes plan anchor date and staleness hint", () => {
    const text = formatShoppingListSubtitle({
      itemCount: 12,
      planStartDate: "2026-06-14",
      outOfSync: true,
    });
    expect(text).toContain("12 items");
    expect(text).toContain("from plan of");
    expect(text).toContain("plan changed since");
  });

  it("falls back when no plan anchor is stored", () => {
    expect(
      formatShoppingListSubtitle({ itemCount: 1, planStartDate: null }),
    ).toBe("1 item · from this week's plan");
  });
});
