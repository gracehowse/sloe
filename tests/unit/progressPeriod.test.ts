import { describe, expect, it } from "vitest";
import {
  DEFAULT_PERIOD,
  PERIOD_TYPES,
  clampOffsetToPresent,
  filterMapToPeriod,
  isCurrentPeriod,
  nextPeriod,
  periodAdherenceOverline,
  periodChartAnchorISO,
  periodDateKey,
  periodLabel,
  periodTypeAccessibilityLabel,
  periodWindow,
  previousPeriod,
  progressPeriodToWeightRange,
  withPeriodType,
  type ProgressPeriod,
} from "@/lib/nutrition/progressPeriod";

/**
 * ENG-1030 — Apple Health range grammar (D/W/M/6M/Y) + period paging.
 *
 * The helper is the single source of truth for both platforms, so the window
 * + label maths is pinned exhaustively here: month lengths, year wrap,
 * week-start settings, 6M block anchoring, paging clamps, DST-safe local dates,
 * and the empty-window filter.
 *
 * `now` is always injected (no real clock) so the suite is calendar-stable.
 */

// A fixed reference instant: Wed 10 Jun 2026, local time.
const NOW = new Date(2026, 5, 10, 14, 30, 0); // month 5 = June

describe("progressPeriod — defaults & inventory", () => {
  it("defaults to the current week", () => {
    expect(DEFAULT_PERIOD).toEqual({ type: "W", offset: 0 });
  });

  it("exposes the five Apple segments in order", () => {
    expect(PERIOD_TYPES).toEqual(["D", "W", "M", "6M", "Y"]);
  });

  it("gives every segment an accessibility label", () => {
    expect(PERIOD_TYPES.map(periodTypeAccessibilityLabel)).toEqual([
      "Day",
      "Week",
      "Month",
      "Six months",
      "Year",
    ]);
  });
});

describe("periodWindow — DAY", () => {
  it("current day is a single key", () => {
    const w = periodWindow({ type: "D", offset: 0 }, "monday", NOW);
    expect(w).toEqual({ startKey: "2026-06-10", endKey: "2026-06-10" });
  });

  it("offset -1 is yesterday", () => {
    const w = periodWindow({ type: "D", offset: -1 }, "monday", NOW);
    expect(w).toEqual({ startKey: "2026-06-09", endKey: "2026-06-09" });
  });

  it("crosses a month boundary backwards (1 Jun → 31 May)", () => {
    const w = periodWindow({ type: "D", offset: -10 }, "monday", NOW);
    expect(w).toEqual({ startKey: "2026-05-31", endKey: "2026-05-31" });
  });

  it("crosses a year boundary backwards", () => {
    const jan2 = new Date(2026, 0, 2, 9, 0, 0);
    const w = periodWindow({ type: "D", offset: -3 }, "monday", jan2);
    expect(w).toEqual({ startKey: "2025-12-30", endKey: "2025-12-30" });
  });
});

describe("periodWindow — WEEK (week-start aware)", () => {
  it("monday-start week containing Wed 10 Jun is Mon 8 – Sun 14", () => {
    const w = periodWindow({ type: "W", offset: 0 }, "monday", NOW);
    expect(w).toEqual({ startKey: "2026-06-08", endKey: "2026-06-14" });
  });

  it("sunday-start week containing Wed 10 Jun is Sun 7 – Sat 13", () => {
    const w = periodWindow({ type: "W", offset: 0 }, "sunday", NOW);
    expect(w).toEqual({ startKey: "2026-06-07", endKey: "2026-06-13" });
  });

  it("monday-start handles a Sunday `now` correctly (belongs to the prior Monday's week)", () => {
    const sunday = new Date(2026, 5, 14, 12, 0, 0); // Sun 14 Jun
    const w = periodWindow({ type: "W", offset: 0 }, "monday", sunday);
    expect(w).toEqual({ startKey: "2026-06-08", endKey: "2026-06-14" });
  });

  it("offset -1 is the previous 7-day block", () => {
    const w = periodWindow({ type: "W", offset: -1 }, "monday", NOW);
    expect(w).toEqual({ startKey: "2026-06-01", endKey: "2026-06-07" });
  });

  it("a week straddling a year boundary keeps 7 days (29 Dec 2025 – 4 Jan 2026)", () => {
    const jan1 = new Date(2026, 0, 1, 12, 0, 0); // Thu 1 Jan 2026
    const w = periodWindow({ type: "W", offset: 0 }, "monday", jan1);
    expect(w).toEqual({ startKey: "2025-12-29", endKey: "2026-01-04" });
  });
});

describe("periodWindow — MONTH (month-length aware)", () => {
  it("June 2026 spans 1–30", () => {
    const w = periodWindow({ type: "M", offset: 0 }, "monday", NOW);
    expect(w).toEqual({ startKey: "2026-06-01", endKey: "2026-06-30" });
  });

  it("offset -1 is May (31 days)", () => {
    const w = periodWindow({ type: "M", offset: -1 }, "monday", NOW);
    expect(w).toEqual({ startKey: "2026-05-01", endKey: "2026-05-31" });
  });

  it("February in a non-leap year ends on the 28th", () => {
    const feb = new Date(2026, 1, 15, 12, 0, 0);
    const w = periodWindow({ type: "M", offset: 0 }, "monday", feb);
    expect(w).toEqual({ startKey: "2026-02-01", endKey: "2026-02-28" });
  });

  it("February in a leap year ends on the 29th", () => {
    const feb = new Date(2024, 1, 15, 12, 0, 0); // 2024 is a leap year
    const w = periodWindow({ type: "M", offset: 0 }, "monday", feb);
    expect(w).toEqual({ startKey: "2024-02-01", endKey: "2024-02-29" });
  });

  it("paging back across a year boundary lands on December", () => {
    const w = periodWindow({ type: "M", offset: -6 }, "monday", NOW); // Jun -6 = Dec 2025
    expect(w).toEqual({ startKey: "2025-12-01", endKey: "2025-12-31" });
  });
});

describe("periodWindow — 6 MONTHS (Jan–Jun / Jul–Dec anchoring)", () => {
  it("June sits in the Jan–Jun block", () => {
    const w = periodWindow({ type: "6M", offset: 0 }, "monday", NOW);
    expect(w).toEqual({ startKey: "2026-01-01", endKey: "2026-06-30" });
  });

  it("July sits in the Jul–Dec block", () => {
    const jul = new Date(2026, 6, 4, 12, 0, 0);
    const w = periodWindow({ type: "6M", offset: 0 }, "monday", jul);
    expect(w).toEqual({ startKey: "2026-07-01", endKey: "2026-12-31" });
  });

  it("offset -1 from the Jan–Jun block is the previous Jul–Dec block", () => {
    const w = periodWindow({ type: "6M", offset: -1 }, "monday", NOW);
    expect(w).toEqual({ startKey: "2025-07-01", endKey: "2025-12-31" });
  });

  it("December block ends on the 31st", () => {
    const dec = new Date(2026, 11, 25, 12, 0, 0);
    const w = periodWindow({ type: "6M", offset: 0 }, "monday", dec);
    expect(w).toEqual({ startKey: "2026-07-01", endKey: "2026-12-31" });
  });
});

describe("periodWindow — YEAR (year wrap)", () => {
  it("2026 spans 1 Jan – 31 Dec", () => {
    const w = periodWindow({ type: "Y", offset: 0 }, "monday", NOW);
    expect(w).toEqual({ startKey: "2026-01-01", endKey: "2026-12-31" });
  });

  it("offset -1 is the whole previous year", () => {
    const w = periodWindow({ type: "Y", offset: -1 }, "monday", NOW);
    expect(w).toEqual({ startKey: "2025-01-01", endKey: "2025-12-31" });
  });

  it("a leap year still ends 31 Dec (year-level windows are unaffected by Feb length)", () => {
    const w = periodWindow({ type: "Y", offset: -2 }, "monday", NOW); // 2024
    expect(w).toEqual({ startKey: "2024-01-01", endKey: "2024-12-31" });
  });
});

describe("DST-safety — windows snap to local midnight across a transition", () => {
  // UK clocks spring forward on the last Sunday of March; autumn back on the
  // last Sunday of October. Using calendar arithmetic (not ms) keeps the
  // window boundaries on local midnight regardless of the 23/25-hour day.
  it("a March week spanning the spring-forward Sunday keeps 7 calendar days", () => {
    // Last Sunday of March 2026 is the 29th.
    const dst = new Date(2026, 2, 30, 12, 0, 0); // Mon 30 Mar 2026
    const w = periodWindow({ type: "W", offset: -1 }, "monday", dst);
    // Previous week = Mon 23 – Sun 29 Mar (contains the transition Sunday).
    expect(w).toEqual({ startKey: "2026-03-23", endKey: "2026-03-29" });
  });

  it("March has 31 days even though one day is 23h long", () => {
    const mar = new Date(2026, 2, 15, 12, 0, 0);
    const w = periodWindow({ type: "M", offset: 0 }, "monday", mar);
    expect(w).toEqual({ startKey: "2026-03-01", endKey: "2026-03-31" });
  });
});

describe("paging — clamps & helpers", () => {
  it("clampOffsetToPresent forbids the future", () => {
    expect(clampOffsetToPresent(3)).toBe(0);
    expect(clampOffsetToPresent(0)).toBe(0);
    expect(clampOffsetToPresent(-2)).toBe(-2);
  });

  it("previousPeriod always steps back", () => {
    expect(previousPeriod({ type: "W", offset: 0 })).toEqual({ type: "W", offset: -1 });
    expect(previousPeriod({ type: "M", offset: -3 })).toEqual({ type: "M", offset: -4 });
  });

  it("nextPeriod never moves into the future", () => {
    expect(nextPeriod({ type: "W", offset: -2 })).toEqual({ type: "W", offset: -1 });
    expect(nextPeriod({ type: "W", offset: 0 })).toEqual({ type: "W", offset: 0 });
  });

  it("isCurrentPeriod is true only at offset 0", () => {
    expect(isCurrentPeriod({ type: "Y", offset: 0 })).toBe(true);
    expect(isCurrentPeriod({ type: "Y", offset: -1 })).toBe(false);
  });

  it("switching segment resets to the current period (offset 0)", () => {
    expect(withPeriodType({ type: "M", offset: -5 }, "Y")).toEqual({ type: "Y", offset: 0 });
    expect(withPeriodType({ type: "W", offset: -2 }, "D")).toEqual({ type: "D", offset: 0 });
  });
});

describe("periodLabel — Apple-style headers", () => {
  it("D → 'Wed 10 Jun' (current year omits the year)", () => {
    expect(periodLabel({ type: "D", offset: 0 }, "monday", NOW)).toBe("Wed 10 Jun");
  });

  it("D in a different year shows the year", () => {
    expect(periodLabel({ type: "D", offset: -200 }, "monday", NOW)).toMatch(/2025$/);
  });

  it("W within one month → '8–14 Jun'", () => {
    expect(periodLabel({ type: "W", offset: 0 }, "monday", NOW)).toBe("8–14 Jun");
  });

  it("W spanning two months → '29 Jun – 5 Jul'", () => {
    // Week containing 1 Jul 2026 (Wed) — Mon 29 Jun … Sun 5 Jul.
    const jul1 = new Date(2026, 6, 1, 12, 0, 0);
    expect(periodLabel({ type: "W", offset: 0 }, "monday", jul1)).toBe("29 Jun – 5 Jul");
  });

  it("W spanning two years shows both years", () => {
    const jan1 = new Date(2026, 0, 1, 12, 0, 0);
    expect(periodLabel({ type: "W", offset: 0 }, "monday", jan1)).toBe(
      "29 Dec 2025 – 4 Jan 2026",
    );
  });

  it("M → 'June 2026'", () => {
    expect(periodLabel({ type: "M", offset: 0 }, "monday", NOW)).toBe("June 2026");
  });

  it("6M → 'Jan – Jun 2026'", () => {
    expect(periodLabel({ type: "6M", offset: 0 }, "monday", NOW)).toBe("Jan – Jun 2026");
  });

  it("Y → '2026'", () => {
    expect(periodLabel({ type: "Y", offset: 0 }, "monday", NOW)).toBe("2026");
  });
});

describe("periodAdherenceOverline — window descriptor", () => {
  it("current periods read 'THIS …' / 'TODAY'", () => {
    expect(periodAdherenceOverline({ type: "D", offset: 0 }, "monday", NOW)).toBe("TODAY");
    expect(periodAdherenceOverline({ type: "W", offset: 0 }, "monday", NOW)).toBe("THIS WEEK");
    expect(periodAdherenceOverline({ type: "M", offset: 0 }, "monday", NOW)).toBe("THIS MONTH");
    expect(periodAdherenceOverline({ type: "6M", offset: 0 }, "monday", NOW)).toBe(
      "LAST 6 MONTHS",
    );
    expect(periodAdherenceOverline({ type: "Y", offset: 0 }, "monday", NOW)).toBe("THIS YEAR");
  });

  it("past month reads the month name", () => {
    expect(periodAdherenceOverline({ type: "M", offset: -1 }, "monday", NOW)).toBe("MAY");
  });

  it("past year reads the year number", () => {
    expect(periodAdherenceOverline({ type: "Y", offset: -1 }, "monday", NOW)).toBe("2025");
  });
});

describe("filterMapToPeriod — inclusive window filter", () => {
  const map: Record<string, number> = {
    "2026-06-07": 1, // Sun — outside the Mon-start week
    "2026-06-08": 2, // Mon — start
    "2026-06-10": 3, // Wed — inside
    "2026-06-14": 4, // Sun — end (inclusive)
    "2026-06-15": 5, // Mon — outside (next week)
  };

  it("includes both boundary days and excludes neighbours (monday week)", () => {
    const out = filterMapToPeriod(map, { type: "W", offset: 0 }, "monday", NOW);
    expect(out.map(([k]) => k).sort()).toEqual([
      "2026-06-08",
      "2026-06-10",
      "2026-06-14",
    ]);
  });

  it("a sunday-start week shifts the window by one day", () => {
    const out = filterMapToPeriod(map, { type: "W", offset: 0 }, "sunday", NOW);
    // Sun 7 – Sat 13: includes 7,8,10 but not 14 (which is the next week's Sun).
    expect(out.map(([k]) => k).sort()).toEqual([
      "2026-06-07",
      "2026-06-08",
      "2026-06-10",
    ]);
  });

  it("an empty period returns []", () => {
    const out = filterMapToPeriod(map, { type: "D", offset: -1 }, "monday", NOW);
    expect(out).toEqual([]);
  });
});

describe("periodDateKey — local ISO", () => {
  it("zero-pads month and day", () => {
    expect(periodDateKey(new Date(2026, 0, 3))).toBe("2026-01-03");
  });

  it("is stable under a non-midnight time", () => {
    expect(periodDateKey(new Date(2026, 11, 31, 23, 59))).toBe("2026-12-31");
  });
});

describe("weight-chart bridge", () => {
  it("maps each segment to a sensible WeightChart bucket range", () => {
    expect(progressPeriodToWeightRange("D")).toBe("1w");
    expect(progressPeriodToWeightRange("W")).toBe("1w");
    expect(progressPeriodToWeightRange("M")).toBe("1m");
    expect(progressPeriodToWeightRange("6M")).toBe("3m");
    expect(progressPeriodToWeightRange("Y")).toBe("1y");
  });

  it("anchors the current period's chart window at today (never the future)", () => {
    // June's window ends 30 Jun, but NOW is the 10th — anchor must clamp.
    expect(periodChartAnchorISO({ type: "M", offset: 0 }, "monday", NOW)).toBe("2026-06-10");
  });

  it("anchors a past period's chart window at the period's end day", () => {
    expect(periodChartAnchorISO({ type: "M", offset: -1 }, "monday", NOW)).toBe("2026-05-31");
    expect(periodChartAnchorISO({ type: "W", offset: -1 }, "monday", NOW)).toBe("2026-06-07");
  });
});

describe("exhaustive offset sweep — windows stay contiguous and ordered", () => {
  const types: ProgressPeriod["type"][] = ["D", "W", "M", "6M", "Y"];
  for (const type of types) {
    it(`${type}: every window has start <= end and never enters the future`, () => {
      for (let offset = 0; offset >= -24; offset--) {
        const w = periodWindow({ type, offset }, "monday", NOW);
        expect(w.startKey <= w.endKey).toBe(true);
        // offset 0 window may extend to a future end (e.g. current month's
        // last day) — that's correct; what's forbidden is a window whose
        // START is after today.
        expect(w.startKey <= periodDateKey(NOW)).toBe(true);
      }
    });
  }
});
