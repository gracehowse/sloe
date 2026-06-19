import { describe, expect, it, vi } from "vitest";

import { clearStructuredMealPlans } from "../../src/lib/account/nukeAccountData";

function chainable(result: { data: unknown; error: unknown }) {
  const p: any = Promise.resolve(result);
  p.eq = () => chainable(result);
  p.in = () => chainable(result);
  return p;
}

describe("clearStructuredMealPlans", () => {
  it("clears live meal plan day/meals tables without touching dropped legacy plan tables", async () => {
    const touchedTables: string[] = [];
    const supabase = {
      from: vi.fn((table: string) => {
        touchedTables.push(table);
        if (table === "meal_plan_days") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() =>
                chainable({ data: [{ id: "day-1" }, { id: "day-2" }], error: null }),
              ),
            })),
            delete: vi.fn(() => ({ eq: vi.fn(() => chainable({ data: null, error: null })) })),
          };
        }
        return {
          delete: vi.fn(() => ({ in: vi.fn(() => chainable({ data: null, error: null })) })),
        };
      }),
    };

    const result = await clearStructuredMealPlans(supabase as never, "user-123");

    expect(result).toEqual({ ok: true });
    expect(touchedTables).toEqual(["meal_plan_days", "meal_plan_meals", "meal_plan_days"]);
    expect(touchedTables).not.toContain("meal_plans");
    expect(touchedTables).not.toContain("meal_plans_legacy");
  });
});
