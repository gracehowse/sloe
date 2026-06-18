import { describe, expect, it } from "vitest";

import { mergeJournalByDay } from "@/lib/nutrition/mergeJournalByDay";

describe("mergeJournalByDay", () => {
  it("keeps optimistic local meals missing from the server snapshot", () => {
    const server = {
      "2026-06-18": [{ id: "a", name: "Breakfast" }],
    };
    const local = {
      "2026-06-18": [
        { id: "a", name: "Breakfast" },
        { id: "b", name: "Breakfast" },
      ],
    };

    const merged = mergeJournalByDay(server, local);
    expect(merged["2026-06-18"]).toHaveLength(2);
    expect(merged["2026-06-18"]?.map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("prefers server rows when ids overlap", () => {
    const server = {
      "2026-06-18": [{ id: "a", calories: 100 }],
    };
    const local = {
      "2026-06-18": [{ id: "a", calories: 50 }],
    };

    const merged = mergeJournalByDay(server, local);
    expect(merged["2026-06-18"]?.[0]?.calories).toBe(100);
  });

  it("retains local-only days", () => {
    const merged = mergeJournalByDay({}, { "2026-06-18": [{ id: "x" }] });
    expect(merged["2026-06-18"]).toEqual([{ id: "x" }]);
  });
});
