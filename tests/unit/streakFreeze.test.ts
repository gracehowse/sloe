/**
 * Unit tests for the shared streak-freeze helper (Batch 4.11).
 *
 * These cover the same pure module that web (`ProgressDashboard`,
 * `NutritionTracker`) and mobile (`progress.tsx`, Today screen) both
 * consume, so any regression is caught once and protects both platforms.
 */
import { describe, expect, it } from "vitest";

import {
  availableFreezes,
  computeProtectedStreak,
  dropOldFreezesForMonth,
  earnFreezeIfMilestone,
  readFreezeLedger,
  type FreezeLedger,
  type StreakByDay,
} from "../../src/lib/nutrition/streakFreeze";
import { computeLoggingStreak } from "../../src/lib/nutrition/trackerStats";

function meal(cals = 500) {
  return { calories: cals, protein: 0, carbs: 0, fat: 0 } as const;
}
function byDayFrom(keys: string[]): StreakByDay {
  const m: StreakByDay = {};
  for (const k of keys) m[k] = [meal()];
  return m;
}

const EMPTY_LEDGER: FreezeLedger = { earnedAt: [], usedHistory: [] };

describe("availableFreezes", () => {
  it("returns 0 when budgetMax is 0 (feature disabled)", () => {
    const ledger: FreezeLedger = {
      earnedAt: [{ earnedAt: "2026-04-10T00:00:00Z" }],
      usedHistory: [],
    };
    expect(availableFreezes(ledger, 0)).toBe(0);
  });

  it("returns earned - used when both < budgetMax", () => {
    const ledger: FreezeLedger = {
      earnedAt: [
        { earnedAt: "2026-04-01T00:00:00Z" },
        { earnedAt: "2026-04-08T00:00:00Z" },
      ],
      usedHistory: [{ dateKey: "2026-04-05", earnedAt: "2026-04-05T00:00:00Z" }],
    };
    expect(availableFreezes(ledger, 3)).toBe(1);
  });

  it("caps at budgetMax when earned-used exceeds the cap", () => {
    const ledger: FreezeLedger = {
      earnedAt: [
        { earnedAt: "2026-04-01T00:00:00Z" },
        { earnedAt: "2026-04-08T00:00:00Z" },
        { earnedAt: "2026-04-15T00:00:00Z" },
        { earnedAt: "2026-04-22T00:00:00Z" },
        { earnedAt: "2026-04-29T00:00:00Z" },
      ],
      usedHistory: [],
    };
    expect(availableFreezes(ledger, 3)).toBe(3);
  });

  it("clamps to 0 when used exceeds earned (defensive)", () => {
    const ledger: FreezeLedger = {
      earnedAt: [],
      usedHistory: [{ dateKey: "2026-04-05", earnedAt: "" }],
    };
    expect(availableFreezes(ledger, 3)).toBe(0);
  });

  it("tolerates missing arrays (partial DB rows)", () => {
    expect(
      availableFreezes({ earnedAt: undefined as any, usedHistory: undefined as any }, 3),
    ).toBe(0);
  });
});

describe("computeProtectedStreak", () => {
  const now = new Date("2026-04-15T14:00:00Z");

  it("matches computeLoggingStreak when no freezes are needed", () => {
    // Three consecutive logged days — no gaps to protect.
    const data = byDayFrom(["2026-04-13", "2026-04-14", "2026-04-15"]);
    const raw = computeLoggingStreak(data as any, now);
    const protectedInfo = computeProtectedStreak(data, EMPTY_LEDGER, 3, now);
    expect(protectedInfo.streakLength).toBe(raw);
    expect(protectedInfo.streakLength).toBe(3);
    expect(protectedInfo.freezesConsumed).toBe(0);
    expect(protectedInfo.protectedDateKeys).toEqual([]);
  });

  it("spends a freeze on a single zero-day in the middle of the streak", () => {
    const data = byDayFrom(["2026-04-12", "2026-04-14", "2026-04-15"]);
    const ledger: FreezeLedger = {
      earnedAt: [{ earnedAt: "2026-04-10T00:00:00Z" }],
      usedHistory: [],
    };
    const info = computeProtectedStreak(data, ledger, 3, now);
    expect(info.streakLength).toBe(4); // Mon + Tue(frozen) + Wed + today
    expect(info.freezesConsumed).toBe(1);
    expect(info.protectedDateKeys).toEqual(["2026-04-13"]);
  });

  it("consumes multiple freezes on consecutive zero days", () => {
    const data = byDayFrom(["2026-04-11", "2026-04-14", "2026-04-15"]);
    const ledger: FreezeLedger = {
      earnedAt: [
        { earnedAt: "2026-04-05T00:00:00Z" },
        { earnedAt: "2026-04-06T00:00:00Z" },
      ],
      usedHistory: [],
    };
    const info = computeProtectedStreak(data, ledger, 3, now);
    // Expect today + Mon(logged) + Tue(freeze) + Wed(freeze) + Sat(logged) = 5
    expect(info.streakLength).toBe(5);
    expect(info.freezesConsumed).toBe(2);
    expect(info.protectedDateKeys).toEqual(["2026-04-13", "2026-04-12"]);
  });

  it("stops at a real break once all freezes are exhausted", () => {
    // Today + yesterday logged; two missing days; then more logged days.
    const data = byDayFrom(["2026-04-10", "2026-04-14", "2026-04-15"]);
    const ledger: FreezeLedger = {
      earnedAt: [{ earnedAt: "2026-04-05T00:00:00Z" }],
      usedHistory: [],
    };
    const info = computeProtectedStreak(data, ledger, 3, now);
    // today + yesterday(14) + freeze(13) then 12 is zero with no freeze → stop.
    expect(info.streakLength).toBe(3);
    expect(info.freezesConsumed).toBe(1);
  });

  it("respects budgetMax over the earned count", () => {
    const data = byDayFrom(["2026-04-10", "2026-04-15"]);
    const ledger: FreezeLedger = {
      earnedAt: [
        { earnedAt: "2026-04-05T00:00:00Z" },
        { earnedAt: "2026-04-06T00:00:00Z" },
        { earnedAt: "2026-04-07T00:00:00Z" },
        { earnedAt: "2026-04-08T00:00:00Z" },
        { earnedAt: "2026-04-09T00:00:00Z" },
      ],
      usedHistory: [],
    };
    // budgetMax=1 caps us to a single freeze, not 5.
    const info = computeProtectedStreak(data, ledger, 1, now);
    expect(info.freezesConsumed).toBe(1);
    // today logged(1) + freeze on yesterday(14) = 2 → then 13 zero stops.
    expect(info.streakLength).toBe(2);
  });

  it("uses grace window: today empty, yesterday starts the walk", () => {
    // Today is empty, yesterday logged.
    const data = byDayFrom(["2026-04-13", "2026-04-14"]);
    const info = computeProtectedStreak(data, EMPTY_LEDGER, 3, now);
    expect(info.streakLength).toBe(2);
    expect(info.freezesConsumed).toBe(0);
  });

  it("returns zero cleanly when the user has no logs at all", () => {
    const info = computeProtectedStreak({}, EMPTY_LEDGER, 3, now);
    expect(info.streakLength).toBe(0);
    expect(info.freezesConsumed).toBe(0);
    expect(info.protectedDateKeys).toEqual([]);
  });

  // 2026-04-18 audit H7 — DayStrip renders a ❄ glyph on each tile whose
  // key is in `protectedDateKeys`. Pin the array shape (a plain
  // dateKey[], not a Set) so the consumer contract can't silently flip.
  it("returns protectedDateKeys as a dateKey[] for a single zero-day mid-streak", () => {
    const data = byDayFrom(["2026-04-12", "2026-04-14", "2026-04-15"]);
    const ledger: FreezeLedger = {
      earnedAt: [{ earnedAt: "2026-04-10T00:00:00Z" }],
      usedHistory: [],
    };
    const info = computeProtectedStreak(data, ledger, 3, now);
    expect(Array.isArray(info.protectedDateKeys)).toBe(true);
    expect(info.protectedDateKeys).toEqual(["2026-04-13"]);
    // Every entry must satisfy the YYYY-MM-DD shape the DayStrip hash
    // matches against, otherwise the ❄ glyph silently won't render.
    for (const key of info.protectedDateKeys) {
      expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("earnFreezeIfMilestone", () => {
  it("earns on the 7-day crossing", () => {
    const r = earnFreezeIfMilestone(6, 7);
    expect(r.earned).toBe(true);
    expect(typeof r.at).toBe("string");
  });

  it("earns on the 14-day crossing", () => {
    const r = earnFreezeIfMilestone(13, 14);
    expect(r.earned).toBe(true);
  });

  it("does not earn when both sides sit inside the same 7-day bucket", () => {
    expect(earnFreezeIfMilestone(7, 8).earned).toBe(false);
    expect(earnFreezeIfMilestone(8, 13).earned).toBe(false);
  });

  it("does not earn on equal or decreasing streaks", () => {
    expect(earnFreezeIfMilestone(7, 7).earned).toBe(false);
    expect(earnFreezeIfMilestone(10, 5).earned).toBe(false);
  });

  it("earns exactly once when jumping 0 → 7", () => {
    const r = earnFreezeIfMilestone(0, 7);
    expect(r.earned).toBe(true);
  });

  it("earns once when jumping 6 → 14 (crosses one bucket boundary)", () => {
    const r = earnFreezeIfMilestone(6, 14);
    expect(r.earned).toBe(true);
    // Callers only push one entry per call — the fact that 14 crosses
    // two buckets (7 and 14) doesn't change the "one credit per call"
    // contract; it matches the docs ("earn 1 each time streak crosses
    // multiples of 7") for the realistic +1-per-day increment path.
  });

  it("is safe on non-finite inputs", () => {
    expect(earnFreezeIfMilestone(NaN, 7).earned).toBe(false);
    expect(earnFreezeIfMilestone(0, Infinity).earned).toBe(false);
  });
});

describe("dropOldFreezesForMonth", () => {
  it("drops earned entries older than 90 days", () => {
    const now = new Date("2026-04-15T00:00:00Z");
    const ledger: FreezeLedger = {
      earnedAt: [
        { earnedAt: "2025-12-01T00:00:00Z" }, // > 90 days ago → drop
        { earnedAt: "2026-03-01T00:00:00Z" }, // within 90 → keep
        { earnedAt: "2026-04-14T00:00:00Z" }, // within 90 → keep
      ],
      usedHistory: [{ dateKey: "2025-10-01", earnedAt: "2025-10-01T00:00:00Z" }],
    };
    const out = dropOldFreezesForMonth(ledger, now);
    expect(out.earnedAt).toHaveLength(2);
    // usedHistory is preserved for the UI log.
    expect(out.usedHistory).toHaveLength(1);
  });

  it("handles missing/invalid timestamps defensively", () => {
    const now = new Date("2026-04-15T00:00:00Z");
    const ledger: FreezeLedger = {
      earnedAt: [
        { earnedAt: "not-a-date" },
        { earnedAt: "2026-04-14T00:00:00Z" },
      ],
      usedHistory: [],
    };
    const out = dropOldFreezesForMonth(ledger, now);
    expect(out.earnedAt).toHaveLength(1);
    expect(out.earnedAt[0]!.earnedAt).toBe("2026-04-14T00:00:00Z");
  });
});

describe("readFreezeLedger", () => {
  it("parses valid raw shapes into typed arrays", () => {
    const parsed = readFreezeLedger({
      earnedAt: [{ earnedAt: "2026-04-10T00:00:00Z" }],
      usedHistory: [
        { dateKey: "2026-04-12", earnedAt: "2026-04-12T00:00:00Z" },
      ],
    });
    expect(parsed.earnedAt).toHaveLength(1);
    expect(parsed.usedHistory).toHaveLength(1);
  });

  it("rejects malformed dateKey entries", () => {
    const parsed = readFreezeLedger({
      earnedAt: [],
      usedHistory: [
        { dateKey: "not-a-date", earnedAt: "" },
        { dateKey: "2026-04-12", earnedAt: "" },
      ],
    });
    expect(parsed.usedHistory).toHaveLength(1);
    expect(parsed.usedHistory[0]!.dateKey).toBe("2026-04-12");
  });

  it("tolerates non-array inputs", () => {
    const parsed = readFreezeLedger({ earnedAt: "nope" as unknown, usedHistory: null as unknown });
    expect(parsed.earnedAt).toEqual([]);
    expect(parsed.usedHistory).toEqual([]);
  });
});
