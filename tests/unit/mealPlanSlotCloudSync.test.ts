import { describe, expect, it } from "vitest";

import {
  CLOUD_DEFAULT_SLOT_ID,
  cloudSlotIdFromLocal,
  localSlotIdFromCloud,
  mergeCloudMetadataIntoSlots,
  metadataFromSlots,
  parseMealPlanSlotsMetadata,
} from "../../src/lib/mealPlan/slotCloudSync";
import {
  DEFAULT_MEAL_PLAN_SLOT_ID,
  makeDefaultSlot,
  type MealPlanNamedSlot,
} from "../../src/lib/mealPlan/namedSlots";

describe("cloudSlotIdFromLocal", () => {
  it("maps the canonical default local id to cloud default", () => {
    expect(cloudSlotIdFromLocal(DEFAULT_MEAL_PLAN_SLOT_ID)).toBe(CLOUD_DEFAULT_SLOT_ID);
  });

  it("passes through other local ids unchanged", () => {
    const id = "abc-123";
    expect(cloudSlotIdFromLocal(id)).toBe(id);
  });
});

describe("localSlotIdFromCloud", () => {
  it("maps cloud default back to the canonical local id", () => {
    expect(localSlotIdFromCloud(CLOUD_DEFAULT_SLOT_ID)).toBe(DEFAULT_MEAL_PLAN_SLOT_ID);
  });
});

describe("metadataFromSlots + parseMealPlanSlotsMetadata", () => {
  it("round-trips slot names and active id", () => {
    const slots: MealPlanNamedSlot[] = [
      makeDefaultSlot(),
      { id: "cut", name: "Cut", plan: null },
    ];
    const payload = metadataFromSlots(slots, "cut");
    const parsed = parseMealPlanSlotsMetadata(payload);
    expect(parsed?.active_slot_id).toBe("cut");
    expect(parsed?.slots.map((s) => s.name)).toEqual(["This week", "Cut"]);
  });

  it("returns null for malformed profile JSON", () => {
    expect(parseMealPlanSlotsMetadata(null)).toBeNull();
    expect(parseMealPlanSlotsMetadata({ slots: "nope" })).toBeNull();
    expect(parseMealPlanSlotsMetadata({ slots: [] })).toBeNull();
  });
});

describe("mergeCloudMetadataIntoSlots", () => {
  it("adds cloud-only slots with null plans and preserves local plans", () => {
    const local: MealPlanNamedSlot[] = [
      { id: DEFAULT_MEAL_PLAN_SLOT_ID, name: "This week", plan: null },
    ];
    const merged = mergeCloudMetadataIntoSlots(local, {
      slots: [
        { id: DEFAULT_MEAL_PLAN_SLOT_ID, name: "This week" },
        { id: "vacation", name: "Vacation" },
      ],
      active_slot_id: "vacation",
    });
    expect(merged.slots).toHaveLength(2);
    expect(merged.slots[1]?.name).toBe("Vacation");
    expect(merged.slots[1]?.plan).toBeNull();
    expect(merged.activeSlotId).toBe("vacation");
  });

  it("updates renamed slots from cloud metadata", () => {
    const local: MealPlanNamedSlot[] = [{ id: "a", name: "Old", plan: null }];
    const merged = mergeCloudMetadataIntoSlots(local, {
      slots: [{ id: "a", name: "Family" }],
      active_slot_id: "a",
    });
    expect(merged.slots[0]?.name).toBe("Family");
  });
});
