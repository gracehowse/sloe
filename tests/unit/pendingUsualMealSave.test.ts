import { describe, expect, it } from "vitest";
import {
  PENDING_USUAL_MEAL_SAVE_KEY,
  PENDING_USUAL_MEAL_SAVE_TTL_MS,
  parsePendingUsualMealSave,
  serializePendingUsualMealSave,
} from "@/lib/nutrition/pendingUsualMealSave";

/**
 * Post-ship #4 (2026-04-18) — cross-view bridge for the weekly-recap
 * deep-link. The Progress card serialises `{slot, items}` into
 * session/AsyncStorage; the Today host pops + parses it and opens the
 * SaveMealDialog pre-seeded. Coverage:
 *   - happy-path round-trip preserves every field
 *   - TTL-expired blobs return null
 *   - malformed JSON / wrong shape / bad slot fails safely
 *   - empty items fails the minimum count
 */

function mkItem(title: string, calories: number) {
  return {
    recipeTitle: title,
    calories,
    protein: 20,
    carbs: 30,
    fat: 10,
  };
}

describe("pendingUsualMealSave (deep-link bridge)", () => {
  it("uses the versioned storage key (do not rename without migration)", () => {
    expect(PENDING_USUAL_MEAL_SAVE_KEY).toBe("suppr-pending-usual-meal-save-v1");
  });

  it("serialises + parses a valid payload round-trip", () => {
    const items = [mkItem("Oats", 300), mkItem("Berries", 60)];
    const now = 1_700_000_000_000;
    const raw = serializePendingUsualMealSave("Breakfast", items, now);
    expect(raw).not.toBeNull();
    const parsed = parsePendingUsualMealSave(raw, now);
    expect(parsed).not.toBeNull();
    expect(parsed!.slot).toBe("Breakfast");
    expect(parsed!.items).toHaveLength(2);
    expect(parsed!.items[0].recipeTitle).toBe("Oats");
    expect(parsed!.items[0].calories).toBe(300);
    expect(parsed!.createdAt).toBe(now);
  });

  it("rejects an invalid slot at serialise time", () => {
    const raw = serializePendingUsualMealSave(
      "Brunch",
      [mkItem("Oats", 300), mkItem("Berries", 60)],
    );
    expect(raw).toBeNull();
  });

  it("rejects < 2 items at serialise time (guards empty dialog)", () => {
    expect(
      serializePendingUsualMealSave("Breakfast", [mkItem("Oats", 300)]),
    ).toBeNull();
    expect(serializePendingUsualMealSave("Breakfast", [])).toBeNull();
  });

  it("returns null for expired blobs (beyond TTL)", () => {
    const items = [mkItem("Oats", 300), mkItem("Berries", 60)];
    const createdAt = 1_700_000_000_000;
    const raw = serializePendingUsualMealSave("Breakfast", items, createdAt);
    const later = createdAt + PENDING_USUAL_MEAL_SAVE_TTL_MS + 1_000;
    expect(parsePendingUsualMealSave(raw, later)).toBeNull();
  });

  it("returns null for null / empty input", () => {
    expect(parsePendingUsualMealSave(null)).toBeNull();
    expect(parsePendingUsualMealSave(undefined)).toBeNull();
    expect(parsePendingUsualMealSave("")).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    expect(parsePendingUsualMealSave("{not json")).toBeNull();
  });

  it("returns null when the parsed slot is bogus", () => {
    const bad = JSON.stringify({
      slot: "Brunch",
      items: [mkItem("Oats", 300), mkItem("Berries", 60)],
      createdAt: Date.now(),
    });
    expect(parsePendingUsualMealSave(bad)).toBeNull();
  });

  it("returns null when items < 2 after narrowing", () => {
    const bad = JSON.stringify({
      slot: "Breakfast",
      items: [mkItem("Oats", 300), { calories: 10 }], // second row has no title
      createdAt: Date.now(),
    });
    expect(parsePendingUsualMealSave(bad)).toBeNull();
  });

  it("preserves optional fields (fiber, waterMl, portionMultiplier, source)", () => {
    const items = [
      { ...mkItem("Oats", 300), fiber: 8, portionMultiplier: 1, source: "quick_add" },
      { ...mkItem("Water", 0), waterMl: 250 },
    ];
    const raw = serializePendingUsualMealSave("Breakfast", items);
    const parsed = parsePendingUsualMealSave(raw);
    expect(parsed).not.toBeNull();
    expect(parsed!.items[0].fiber).toBe(8);
    expect(parsed!.items[0].portionMultiplier).toBe(1);
    expect(parsed!.items[0].source).toBe("quick_add");
    expect(parsed!.items[1].waterMl).toBe(250);
  });
});
