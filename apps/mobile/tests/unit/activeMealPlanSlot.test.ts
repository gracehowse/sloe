import { describe, expect, it, vi, beforeEach } from "vitest";

import { DEFAULT_MEAL_PLAN_SLOT_ID } from "@suppr/shared/mealPlan/namedSlots";
import { CLOUD_DEFAULT_SLOT_ID } from "@suppr/shared/mealPlan/slotCloudSync";

const getItem = vi.fn();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem, setItem: vi.fn() },
}));

describe("readActiveCloudMealPlanSlotId", () => {
  beforeEach(() => {
    getItem.mockReset();
  });

  it("maps the default local slot id to cloud default", async () => {
    getItem.mockResolvedValue(null);
    const { readActiveCloudMealPlanSlotId } = await import("@/lib/activeMealPlanSlot");
    await expect(readActiveCloudMealPlanSlotId()).resolves.toBe(CLOUD_DEFAULT_SLOT_ID);
  });

  it("passes through custom local slot ids", async () => {
    getItem.mockResolvedValue("vacation-plan");
    const { readActiveCloudMealPlanSlotId } = await import("@/lib/activeMealPlanSlot");
    await expect(readActiveCloudMealPlanSlotId()).resolves.toBe("vacation-plan");
  });

  it("falls back to default when storage throws", async () => {
    getItem.mockRejectedValue(new Error("storage down"));
    const { readActiveCloudMealPlanSlotId } = await import("@/lib/activeMealPlanSlot");
    await expect(readActiveCloudMealPlanSlotId()).resolves.toBe(
      CLOUD_DEFAULT_SLOT_ID,
    );
    expect(DEFAULT_MEAL_PLAN_SLOT_ID).toBeTruthy();
  });
});
