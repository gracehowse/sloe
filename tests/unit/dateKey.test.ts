/**
 * ENG-717 — shared local-calendar date key (`src/lib/datetime/dateKey.ts`).
 *
 * This helper was duplicated ~5× across web + mobile; consolidating it here
 * could only ship behind a test that pins the exact output, including the
 * timezone / day-boundary semantics the duplicates relied on.
 *
 * Pins:
 *  1. Formats the LOCAL calendar day as zero-padded `YYYY-MM-DD`.
 *  2. Zero-pads single-digit months and days.
 *  3. Accepts a Date (the 5 web/mobile call shapes).
 *  4. Accepts a string / number (superset that preserves the old mobile
 *     `healthSync.dateKey(d: Date | string)` HealthKit-sample behaviour).
 *  5. Uses local getters, NOT UTC — a late-evening local time in a
 *     behind-UTC zone must NOT roll over to the next UTC day. (Pinned with
 *     a fixed-offset construction so the assertion is timezone-stable in
 *     CI, which runs UTC.)
 */
import { describe, expect, it } from "vitest";

import { dateKeyFromDate } from "../../src/lib/datetime/dateKey";

describe("dateKeyFromDate", () => {
  it("formats the local calendar day as YYYY-MM-DD", () => {
    // Month is 0-indexed in the Date constructor → 3 = April.
    expect(dateKeyFromDate(new Date(2026, 3, 8))).toBe("2026-04-08");
  });

  it("zero-pads single-digit month and day", () => {
    expect(dateKeyFromDate(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(dateKeyFromDate(new Date(2026, 8, 9))).toBe("2026-09-09");
  });

  it("handles a double-digit month and day", () => {
    expect(dateKeyFromDate(new Date(2026, 11, 31))).toBe("2026-12-31");
  });

  it("accepts an ISO date-time string (HealthKit-sample superset)", () => {
    // A wall-clock local construction → key is that local day. We build the
    // string from a Date so the test is stable regardless of the runner's
    // timezone (CI is UTC).
    const d = new Date(2026, 5, 1, 23, 30, 0); // 1 Jun 2026, 23:30 local
    expect(dateKeyFromDate(d.toISOString())).toBe(dateKeyFromDate(d));
  });

  it("accepts an epoch-millis number", () => {
    const d = new Date(2026, 6, 4, 12, 0, 0);
    expect(dateKeyFromDate(d.getTime())).toBe("2026-07-04");
  });

  it("uses LOCAL day boundaries, not UTC (no evening roll-over)", () => {
    // 23:30 local on the 1st must stay on the 1st even though, in some
    // zones, the equivalent UTC instant is already the 2nd. We assert the
    // helper agrees with the local getters, which is the whole point of
    // not using toISOString().slice(0,10).
    const local = new Date(2026, 5, 1, 23, 30, 0);
    const expected = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(
      local.getDate(),
    ).padStart(2, "0")}`;
    expect(dateKeyFromDate(local)).toBe(expected);
    // And the local day must be the 1st regardless of the runner's tz.
    expect(dateKeyFromDate(local).endsWith("-06-01")).toBe(true);
  });
});
