import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));
vi.mock("@/lib/refreshAdaptiveTdee", () => ({
  refreshAdaptiveTdeeForUser: vi.fn(),
}));

import {
  MAX_WEIGHT_JSONB_DAYS,
  newestWeightDateKey,
  parseWeightKgByDay,
  pruneWeightKgByDay,
} from "../../hooks/useWeightData";

describe("useWeightData helpers", () => {
  it("parses only finite positive weights from profiles.weight_kg_by_day", () => {
    expect(
      parseWeightKgByDay({ "2026-06-01": "72.4", "2026-06-02": 0, nope: "x" }),
    ).toEqual({
      "2026-06-01": 72.4,
    });
  });

  it("caps the JSONB weight log to the newest 400 days", () => {
    const map: Record<string, number> = {};
    for (let i = 1; i <= MAX_WEIGHT_JSONB_DAYS + 5; i += 1) {
      map[`2026-01-${String(i).padStart(3, "0")}`] = i;
    }
    const pruned = pruneWeightKgByDay(map);
    expect(Object.keys(pruned)).toHaveLength(MAX_WEIGHT_JSONB_DAYS);
    expect(pruned["2026-01-405"]).toBe(405);
    expect(pruned["2026-01-001"]).toBeUndefined();
  });

  it("resolves the latest dated weigh-in as the scalar source", () => {
    expect(newestWeightDateKey({ "2026-05-01": 72, "2026-06-01": 71 })).toBe(
      "2026-06-01",
    );
  });
});
