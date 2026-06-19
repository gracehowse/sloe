import { describe, expect, it } from "vitest";

import {
  foodSearchSourceLabel,
  mergeFoodSearchRows,
  type MergeableFoodSearchRow,
} from "@/lib/nutrition/foodSearchMerge";

const row = (
  partial: Partial<MergeableFoodSearchRow> & Pick<MergeableFoodSearchRow, "key" | "name" | "_source">,
): MergeableFoodSearchRow => ({ ...partial });

describe("foodSearchMerge", () => {
  it("orders deterministically, dedupes within source, and keeps cross-source duplicates", () => {
    const rows = [
      row({ key: "usda-branded", name: "EGGS", _source: "USDA", verified: false }),
      row({ key: "fs-1", name: "McDonald's · Big Mac", _source: "FatSecret" }),
      row({ key: "fs-duplicate", name: "Mcdonalds Big Mac", _source: "FatSecret" }),
      row({ key: "usda-verified", name: "McDonald's, Big Mac", _source: "USDA", verified: true }),
      row({ key: "off-1", name: "McDonald's · Big Mac", _source: "OFF" }),
    ];

    const merged = mergeFoodSearchRows({ query: "big mac", rows, limit: 10 });

    expect(merged.map((r) => r.key)).toEqual(["fs-1", "off-1", "usda-verified"]);
    expect(merged.every((r) => r.confidenceTier)).toBe(true);
    expect(merged.map((r) => r._source)).toEqual(["FatSecret", "OFF", "USDA"]);
  });

  it("supports shell-supplied custom and generic dedupe keys", () => {
    const rows = [
      row({ key: "custom-temp-a", name: "Porridge", _source: "CUSTOM" }),
      row({ key: "custom-temp-b", name: "Porridge", _source: "CUSTOM" }),
      row({ key: "generic-oats", name: "Oats", _source: "GenericFood", verified: true }),
    ];

    const merged = mergeFoodSearchRows({
      query: "porridge",
      rows,
      dedupeKey: (r) => (r._source === "CUSTOM" ? "custom:real-id" : `generic:${r.key}`),
    });

    expect(merged.map((r) => r.key)).toEqual(["custom-temp-a"]);
  });

  it("has one exhaustive source label map for both shells", () => {
    expect(foodSearchSourceLabel("USDA")).toBe("USDA");
    expect(foodSearchSourceLabel("OFF")).toBe("Open Food Facts");
    expect(foodSearchSourceLabel("Edamam")).toBe("Edamam");
    expect(foodSearchSourceLabel("FatSecret")).toBe("FatSecret");
    expect(foodSearchSourceLabel("CUSTOM")).toBe("Custom");
    expect(foodSearchSourceLabel("GenericFood")).toBe("Sloe");
    expect(foodSearchSourceLabel("GenericBeverage")).toBe("Sloe");
  });
});
