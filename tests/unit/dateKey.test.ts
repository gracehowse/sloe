import { describe, expect, it } from "vitest";

import { dateKeyFromDate } from "../../src/lib/dates/dateKey";

describe("dateKeyFromDate", () => {
  it("formats local calendar dates as zero-padded YYYY-MM-DD keys", () => {
    expect(dateKeyFromDate(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(dateKeyFromDate(new Date(2026, 10, 15))).toBe("2026-11-15");
  });
});
