/**
 * Recipe timer parser tests (Batch 3.8).
 *
 * Covers the two exported pure helpers in
 * `src/lib/nutrition/recipeTimers.ts`:
 *   - parseTimersInStep
 *   - formatTimer
 *
 * The parser is shared between web `CookMode.tsx` and mobile `cook.tsx`,
 * so these tests are the only place both platforms can drift from.
 */
import { describe, expect, it } from "vitest";
import { parseTimersInStep, formatTimer } from "@/lib/nutrition/recipeTimers";

describe("parseTimersInStep — single matches", () => {
  it("returns [] for empty / non-string input", () => {
    expect(parseTimersInStep("")).toEqual([]);
    // @ts-expect-error — runtime defence
    expect(parseTimersInStep(null)).toEqual([]);
    // @ts-expect-error — runtime defence
    expect(parseTimersInStep(undefined)).toEqual([]);
    // @ts-expect-error — runtime defence
    expect(parseTimersInStep(123)).toEqual([]);
  });

  it("parses '10 minutes' as 600 seconds", () => {
    const [t] = parseTimersInStep("Bake for 10 minutes.");
    expect(t).toBeDefined();
    expect(t!.totalSeconds).toBe(600);
    expect(t!.isRange).toBe(false);
    expect(t!.label.toLowerCase()).toContain("10 minutes");
  });

  it("parses '10 mins' / '10 min' / '10 minute'", () => {
    expect(parseTimersInStep("Simmer 10 mins")[0]!.totalSeconds).toBe(600);
    expect(parseTimersInStep("Simmer 10 min")[0]!.totalSeconds).toBe(600);
    expect(parseTimersInStep("Cook 1 minute")[0]!.totalSeconds).toBe(60);
  });

  it("parses '1 hour' / '2 hours' / '1 hr' / '2 hrs'", () => {
    expect(parseTimersInStep("Bake 1 hour")[0]!.totalSeconds).toBe(3600);
    expect(parseTimersInStep("Bake 2 hours")[0]!.totalSeconds).toBe(7200);
    expect(parseTimersInStep("Bake 1 hr")[0]!.totalSeconds).toBe(3600);
    expect(parseTimersInStep("Bake 2 hrs")[0]!.totalSeconds).toBe(7200);
  });

  it("parses combined '1 hour 20 minutes'", () => {
    const [t] = parseTimersInStep("Braise for 1 hour 20 minutes.");
    expect(t!.totalSeconds).toBe(3600 + 20 * 60);
  });

  it("parses combined '1 hr 20 mins'", () => {
    const [t] = parseTimersInStep("Braise 1 hr 20 mins.");
    expect(t!.totalSeconds).toBe(3600 + 20 * 60);
  });

  it("parses '30 seconds' / '30 secs' / '30 sec'", () => {
    expect(parseTimersInStep("Whisk 30 seconds")[0]!.totalSeconds).toBe(30);
    expect(parseTimersInStep("Whisk 30 secs")[0]!.totalSeconds).toBe(30);
    expect(parseTimersInStep("Whisk 30 sec")[0]!.totalSeconds).toBe(30);
  });

  it("is case-insensitive", () => {
    expect(parseTimersInStep("Bake 10 MINUTES")[0]!.totalSeconds).toBe(600);
    expect(parseTimersInStep("BAKE 2 HOURS")[0]!.totalSeconds).toBe(7200);
    expect(parseTimersInStep("whisk 30 SeCoNdS")[0]!.totalSeconds).toBe(30);
  });
});

describe("parseTimersInStep — ranges", () => {
  it("'5-10 minutes' uses the upper bound and sets isRange=true", () => {
    const [t] = parseTimersInStep("Saute for 5-10 minutes, stirring.");
    expect(t!.totalSeconds).toBe(600);
    expect(t!.isRange).toBe(true);
  });

  it("'5–10 minutes' (en dash) works the same", () => {
    const [t] = parseTimersInStep("Saute for 5\u201310 minutes.");
    expect(t!.totalSeconds).toBe(600);
    expect(t!.isRange).toBe(true);
  });

  it("'20-25 minutes' uses 25 minutes", () => {
    const [t] = parseTimersInStep("Bake 20-25 minutes until golden.");
    expect(t!.totalSeconds).toBe(25 * 60);
    expect(t!.isRange).toBe(true);
  });
});

describe("parseTimersInStep — multiple matches & ordering", () => {
  it("returns all timers in left-to-right order", () => {
    const timers = parseTimersInStep(
      "Heat oil for 30 seconds, then saute onions 5 minutes, then simmer 1 hour.",
    );
    expect(timers).toHaveLength(3);
    expect(timers[0]!.totalSeconds).toBe(30);
    expect(timers[1]!.totalSeconds).toBe(300);
    expect(timers[2]!.totalSeconds).toBe(3600);
    // Spans must be non-overlapping and in order.
    expect(timers[0]!.endIndex).toBeLessThanOrEqual(timers[1]!.startIndex);
    expect(timers[1]!.endIndex).toBeLessThanOrEqual(timers[2]!.startIndex);
  });

  it("captures precise character spans", () => {
    const step = "Cook 15 minutes and rest 5 minutes.";
    const timers = parseTimersInStep(step);
    expect(timers).toHaveLength(2);
    expect(step.slice(timers[0]!.startIndex, timers[0]!.endIndex)).toMatch(/15 minutes/i);
    expect(step.slice(timers[1]!.startIndex, timers[1]!.endIndex)).toMatch(/5 minutes/i);
  });
});

describe("parseTimersInStep — false-positive avoidance", () => {
  it("does NOT match adjective form '10-minute mark'", () => {
    // "the 10-minute mark" is describing a milestone, not a duration.
    // This is the canonical case the spec called out.
    const timers = parseTimersInStep("Check at the 10-minute mark for doneness.");
    expect(timers).toEqual([]);
  });

  it("does NOT match '30-minute meal'", () => {
    const timers = parseTimersInStep("This is a 30-minute meal.");
    expect(timers).toEqual([]);
  });

  it("does NOT match 'minute mark' without a number-plus-unit pairing", () => {
    const timers = parseTimersInStep("Wait for the minute mark.");
    expect(timers).toEqual([]);
  });

  it("still matches 'Rest for 10 minutes, then check the 10-minute mark'", () => {
    // The duration prefix is real; the adjective suffix is not. Only one match.
    const timers = parseTimersInStep(
      "Rest for 10 minutes, then check the 10-minute mark.",
    );
    expect(timers).toHaveLength(1);
    expect(timers[0]!.totalSeconds).toBe(600);
  });
});

describe("parseTimersInStep — no-match cases", () => {
  it("returns [] when there are no time phrases", () => {
    expect(parseTimersInStep("Mix gently until combined.")).toEqual([]);
    expect(parseTimersInStep("Taste and adjust seasoning.")).toEqual([]);
  });

  it("returns [] when the number has no unit", () => {
    expect(parseTimersInStep("Add 3 eggs and stir.")).toEqual([]);
  });

  it("ignores zero-duration phrases", () => {
    expect(parseTimersInStep("Rest 0 minutes.")).toEqual([]);
  });
});

describe("formatTimer", () => {
  it("formats 0 as '0:00'", () => {
    expect(formatTimer(0)).toBe("0:00");
  });

  it("formats 60 as '1:00'", () => {
    expect(formatTimer(60)).toBe("1:00");
  });

  it("formats 3600 as '1:00:00'", () => {
    expect(formatTimer(3600)).toBe("1:00:00");
  });

  it("formats 4260 as '1:11:00' (1h 11m 0s)", () => {
    expect(formatTimer(4260)).toBe("1:11:00");
  });

  it("formats sub-minute values with zero-padded seconds", () => {
    expect(formatTimer(5)).toBe("0:05");
    expect(formatTimer(45)).toBe("0:45");
  });

  it("formats long durations correctly", () => {
    expect(formatTimer(7 * 60 + 30)).toBe("7:30");
    expect(formatTimer(59 * 60)).toBe("59:00");
    expect(formatTimer(2 * 3600 + 5 * 60 + 9)).toBe("2:05:09");
  });

  it("clamps negative / non-finite inputs to 0", () => {
    expect(formatTimer(-30)).toBe("0:00");
    expect(formatTimer(Number.NaN)).toBe("0:00");
    expect(formatTimer(Number.POSITIVE_INFINITY)).toBe("0:00");
  });
});
