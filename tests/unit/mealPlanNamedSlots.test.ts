/**
 * Pure CRUD helpers for named meal-plan slots
 * (`src/lib/mealPlan/namedSlots.ts`). Shared between web
 * (`AppDataContext.tsx`) and mobile (`use-meal-plan-slots.ts`) so
 * both platforms can never drift on the data shape or rules.
 */

import { describe, expect, it } from "vitest";
import {
  DEFAULT_MEAL_PLAN_SLOT_ID,
  DEFAULT_MEAL_PLAN_SLOT_NAME,
  MAX_MEAL_PLAN_SLOTS,
  activePlanFromSlots,
  createSlot,
  deleteSlot,
  hydrateSlots,
  makeDefaultSlot,
  newMealPlanSlotId,
  normalizeMealPlanSlot,
  renameSlot,
  setActiveSlotPlan,
  type MealPlanNamedSlot,
} from "../../src/lib/mealPlan/namedSlots";
import type { DayPlan } from "../../src/types/recipe";

const dayPlan = (day: number): DayPlan => ({
  day,
  meals: [],
  totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
});

describe("makeDefaultSlot", () => {
  it("returns the canonical default id + name", () => {
    const s = makeDefaultSlot();
    expect(s.id).toBe(DEFAULT_MEAL_PLAN_SLOT_ID);
    expect(s.name).toBe(DEFAULT_MEAL_PLAN_SLOT_NAME);
    expect(s.plan).toBeNull();
  });

  it("hydrates the default slot with a legacy plan when provided", () => {
    const s = makeDefaultSlot([dayPlan(1)]);
    expect(s.plan?.length).toBe(1);
  });
});

describe("normalizeMealPlanSlot", () => {
  it("returns null for malformed rows (missing id, wrong type, etc.)", () => {
    expect(normalizeMealPlanSlot(null)).toBeNull();
    expect(normalizeMealPlanSlot({})).toBeNull();
    expect(normalizeMealPlanSlot({ id: "" })).toBeNull();
    expect(normalizeMealPlanSlot({ id: 42 })).toBeNull();
  });

  it("trims name and falls back to default when empty", () => {
    const s = normalizeMealPlanSlot({ id: "abc", name: "  Cut week  " });
    expect(s?.name).toBe("Cut week");
    const blank = normalizeMealPlanSlot({ id: "abc", name: "  " });
    expect(blank?.name).toBe(DEFAULT_MEAL_PLAN_SLOT_NAME);
  });

  it("preserves null plan and rejects non-array plan to null", () => {
    expect(normalizeMealPlanSlot({ id: "abc", plan: null })?.plan).toBeNull();
    expect(normalizeMealPlanSlot({ id: "abc", plan: "garbage" })?.plan).toBeNull();
  });
});

describe("newMealPlanSlotId", () => {
  it("returns a non-empty string", () => {
    const id = newMealPlanSlotId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("returns distinct ids on repeated calls", () => {
    const ids = new Set([newMealPlanSlotId(), newMealPlanSlotId(), newMealPlanSlotId()]);
    expect(ids.size).toBe(3);
  });
});

describe("createSlot", () => {
  it("appends a new slot and returns its id", () => {
    const start: MealPlanNamedSlot[] = [makeDefaultSlot()];
    const { slots, id } = createSlot(start, "Cut week");
    expect(slots).toHaveLength(2);
    expect(slots[1]!.name).toBe("Cut week");
    expect(slots[1]!.id).toBe(id);
    expect(slots[1]!.plan).toBeNull();
  });

  it("trims the name and falls back to 'New plan' when blank", () => {
    const start: MealPlanNamedSlot[] = [makeDefaultSlot()];
    const result = createSlot(start, "   ");
    expect(result.slots[1]!.name).toBe("New plan");
  });

  it("refuses to create more than MAX_MEAL_PLAN_SLOTS", () => {
    const start: MealPlanNamedSlot[] = Array.from({ length: MAX_MEAL_PLAN_SLOTS }, (_, i) => ({
      id: `s-${i}`,
      name: `S${i}`,
      plan: null,
    }));
    const before = start.length;
    const { slots } = createSlot(start, "Should not append");
    expect(slots).toHaveLength(before);
  });

  it("never mutates the input slots array", () => {
    const start: MealPlanNamedSlot[] = [makeDefaultSlot()];
    const snapshot = JSON.stringify(start);
    createSlot(start, "Cut week");
    expect(JSON.stringify(start)).toBe(snapshot);
  });
});

describe("renameSlot", () => {
  it("renames the matching slot and trims the new name", () => {
    const slots: MealPlanNamedSlot[] = [
      { id: "a", name: "Original", plan: null },
      { id: "b", name: "Other", plan: null },
    ];
    const result = renameSlot(slots, "a", "  Cut week  ");
    expect(result[0]!.name).toBe("Cut week");
    expect(result[1]!.name).toBe("Other");
  });

  it("is a no-op when name is empty after trim", () => {
    const slots: MealPlanNamedSlot[] = [{ id: "a", name: "Original", plan: null }];
    const result = renameSlot(slots, "a", "   ");
    expect(result[0]!.name).toBe("Original");
  });

  it("is a no-op when slotId doesn't exist", () => {
    const slots: MealPlanNamedSlot[] = [{ id: "a", name: "Original", plan: null }];
    const result = renameSlot(slots, "missing", "New");
    expect(result[0]!.name).toBe("Original");
  });
});

describe("deleteSlot", () => {
  it("removes the matching slot and keeps the existing active id when not deleted", () => {
    const slots: MealPlanNamedSlot[] = [
      { id: "a", name: "A", plan: null },
      { id: "b", name: "B", plan: null },
    ];
    const result = deleteSlot(slots, "b", "a");
    expect(result.slots.map((s) => s.id)).toEqual(["a"]);
    expect(result.activeId).toBe("a");
  });

  it("rolls active id over to the first remaining slot when deleting the active one", () => {
    const slots: MealPlanNamedSlot[] = [
      { id: "a", name: "A", plan: null },
      { id: "b", name: "B", plan: null },
      { id: "c", name: "C", plan: null },
    ];
    const result = deleteSlot(slots, "a", "a");
    expect(result.slots.map((s) => s.id)).toEqual(["b", "c"]);
    expect(result.activeId).toBe("b");
  });

  it("refuses to delete the last remaining slot (returns input as-is)", () => {
    const slots: MealPlanNamedSlot[] = [{ id: "only", name: "Only", plan: null }];
    const result = deleteSlot(slots, "only", "only");
    expect(result.slots).toHaveLength(1);
    expect(result.activeId).toBe("only");
  });

  it("is a no-op when slotId doesn't exist", () => {
    const slots: MealPlanNamedSlot[] = [
      { id: "a", name: "A", plan: null },
      { id: "b", name: "B", plan: null },
    ];
    const result = deleteSlot(slots, "missing", "a");
    expect(result.slots).toHaveLength(2);
    expect(result.activeId).toBe("a");
  });
});

describe("setActiveSlotPlan + activePlanFromSlots", () => {
  it("updates only the active slot's plan", () => {
    const slots: MealPlanNamedSlot[] = [
      { id: "a", name: "A", plan: null },
      { id: "b", name: "B", plan: [dayPlan(1)] },
    ];
    const next = setActiveSlotPlan(slots, "a", [dayPlan(2), dayPlan(3)]);
    expect(next[0]!.plan?.length).toBe(2);
    expect(next[1]!.plan?.length).toBe(1); // unchanged
  });

  it("activePlanFromSlots returns null when active id is stale", () => {
    const slots: MealPlanNamedSlot[] = [{ id: "a", name: "A", plan: [dayPlan(1)] }];
    expect(activePlanFromSlots(slots, "ghost")).toBeNull();
    expect(activePlanFromSlots(slots, "a")?.length).toBe(1);
  });
});

describe("hydrateSlots", () => {
  it("returns the default slot array when raw is empty / invalid", () => {
    expect(hydrateSlots(null)).toEqual([makeDefaultSlot()]);
    expect(hydrateSlots(undefined)).toEqual([makeDefaultSlot()]);
    expect(hydrateSlots([])).toEqual([makeDefaultSlot()]);
    expect(hydrateSlots("garbage")).toEqual([makeDefaultSlot()]);
  });

  it("normalises valid rows and drops malformed ones", () => {
    const result = hydrateSlots([
      { id: "a", name: "A", plan: null },
      { foo: "bar" },
      { id: "  ", name: "blank id" },
      { id: "b", name: "B", plan: [dayPlan(1)] },
    ]);
    expect(result.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("hydrates the default slot's plan from a legacy pre-slots payload when raw is empty", () => {
    const result = hydrateSlots(null, [dayPlan(1)]);
    expect(result).toHaveLength(1);
    expect(result[0]!.plan?.length).toBe(1);
  });
});
