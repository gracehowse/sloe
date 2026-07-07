import { describe, expect, it } from "vitest";
import {
  brokenStreakHeadline,
  findBrokenStreakDay,
  fullWeekdayNameForDateKey,
  proteinDigestLine,
  streakFreezeMechanicLine,
  streakResetLine,
} from "../../src/lib/nutrition/weeklyRecapBrokenStreakGrace";

describe("brokenStreakHeadline — achievement-led framing", () => {
  it("the ticket's 6-of-7 case", () => {
    expect(brokenStreakHeadline(6)).toBe("6 of 7 days — a strong week.");
  });

  it("never says 'missed' or frames it as a loss", () => {
    for (let n = 0; n <= 7; n++) {
      expect(brokenStreakHeadline(n)).not.toMatch(/missed/i);
    }
  });
});

describe("streakResetLine — one-clause reset, no legalese", () => {
  it("verbatim string with the day name interpolated", () => {
    expect(streakResetLine("Saturday")).toBe(
      "Your streak reset on Saturday. One missed day doesn't undo the habit — start the next run today.",
    );
  });

  it("never carries the retired definition-as-consolation phrase", () => {
    expect(streakResetLine("Tuesday")).not.toMatch(/counts every day/i);
  });
});

describe("streakFreezeMechanicLine — surfaced AT the break, not omitted", () => {
  it("freeze-covered branch names the day + the continuing run", () => {
    expect(
      streakFreezeMechanicLine({
        freezeCoveredBreak: true,
        brokenDayLabel: "Saturday",
        continuingStreakLength: 12,
      }),
    ).toBe("A streak freeze covered Saturday — your 12-day run continues.");
  });

  it("no-freeze branch is the earn-path invitation", () => {
    expect(
      streakFreezeMechanicLine({
        freezeCoveredBreak: false,
        brokenDayLabel: "Saturday",
        continuingStreakLength: 0,
      }),
    ).toBe("Log 7 days in a row to earn a streak freeze — it covers days like Saturday.");
  });
});

describe("findBrokenStreakDay — locates the zero-calorie day in a 7-day window", () => {
  const week = [
    { key: "2026-06-15", label: "Mon", calories: 1800 },
    { key: "2026-06-16", label: "Tue", calories: 2000 },
    { key: "2026-06-17", label: "Wed", calories: 1900 },
    { key: "2026-06-18", label: "Thu", calories: 2100 },
    { key: "2026-06-19", label: "Fri", calories: 1950 },
    { key: "2026-06-20", label: "Sat", calories: 0 },
    { key: "2026-06-21", label: "Sun", calories: 2050 },
  ];

  it("finds the zero-calorie Saturday, unprotected", () => {
    const result = findBrokenStreakDay(week, new Set());
    expect(result).toEqual({ key: "2026-06-20", label: "Sat", freezeCovered: false });
  });

  it("flags freezeCovered true when the day is in protectedDateKeys", () => {
    const result = findBrokenStreakDay(week, new Set(["2026-06-20"]));
    expect(result).toEqual({ key: "2026-06-20", label: "Sat", freezeCovered: true });
  });

  it("accepts a plain array for protectedDateKeys too", () => {
    const result = findBrokenStreakDay(week, ["2026-06-20"]);
    expect(result?.freezeCovered).toBe(true);
  });

  it("returns null when every day has food logged (no break to explain)", () => {
    const fullWeek = week.map((d) => (d.calories === 0 ? { ...d, calories: 1500 } : d));
    expect(findBrokenStreakDay(fullWeek, new Set())).toBeNull();
  });

  it("with multiple zero-days, returns the MOST RECENT break", () => {
    const twoZeroDays = week.map((d) =>
      d.key === "2026-06-17" ? { ...d, calories: 0 } : d,
    );
    // Both Wed (06-17) and Sat (06-20) are zero; most-recent-first walk
    // should surface Saturday.
    const result = findBrokenStreakDay(twoZeroDays, new Set());
    expect(result?.key).toBe("2026-06-20");
  });
});

describe("fullWeekdayNameForDateKey — full name, not the 3-letter grid label", () => {
  it("resolves a known date to its weekday name", () => {
    // 2026-06-20 is a Saturday.
    expect(fullWeekdayNameForDateKey("2026-06-20")).toBe("Saturday");
    // 2026-06-15 is a Monday.
    expect(fullWeekdayNameForDateKey("2026-06-15")).toBe("Monday");
  });

  it("falls back to the raw key on unparsable input", () => {
    expect(fullWeekdayNameForDateKey("not-a-date")).toBe("not-a-date");
  });
});

describe("proteinDigestLine — wires the digest cascade's 'easiest fix' line into the recap", () => {
  it("verbatim format matching weeklyDigestSuggestion.ts's protein-nudge body", () => {
    expect(proteinDigestLine(27, 130)).toBe(
      "Protein averaged 27g against 130g. A high-protein breakfast is the easiest fix.",
    );
  });

  it("rounds non-integer inputs", () => {
    expect(proteinDigestLine(26.6, 129.5)).toBe(
      "Protein averaged 27g against 130g. A high-protein breakfast is the easiest fix.",
    );
  });
});
