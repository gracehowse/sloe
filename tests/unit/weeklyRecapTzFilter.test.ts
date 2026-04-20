/**
 * Pin the tz-aware fan-out filter for the weekly recap push (T12,
 * 2026-04-20 — `docs/decisions/2026-04-20-weekly-recap-tz-aware-fanout.md`).
 *
 * Cases we care about:
 *   1. Exact local 18:00 on the correct end-of-week day → fires.
 *   2. Any other local hour → no fire.
 *   3. Correct hour on the wrong weekday → no fire.
 *   4. DST transition: same IANA zone, two different UTC instants
 *      that both resolve to local 18:00 on Sunday — both fire.
 *   5. Null / empty / unrecognised tz → falls back to UTC so pushes
 *      don't silently drop.
 */

import { describe, expect, it } from "vitest";

import { shouldPushWeeklyRecapNow } from "../../src/lib/push/weeklyRecapTzFilter";

// Helpers — build a UTC instant from an explicit year/month/day/hour.
function utc(y: number, m: number, d: number, h: number): Date {
  // Month is 1-indexed in the helper for readability; Date wants 0-indexed.
  return new Date(Date.UTC(y, m - 1, d, h, 0, 0));
}

describe("shouldPushWeeklyRecapNow — happy path (18:00 local on end-of-week day)", () => {
  it("fires for a UK monday-start user at 18:00 GMT on Sunday (winter)", () => {
    // 2026-01-04 is a Sunday. UK is on GMT in January (offset 0).
    const nowUtc = utc(2026, 1, 4, 18);
    const ok = shouldPushWeeklyRecapNow(
      { tzIana: "Europe/London", weekStartDay: "monday" },
      nowUtc,
    );
    expect(ok).toBe(true);
  });

  it("fires for a UK monday-start user at 18:00 BST on Sunday (summer)", () => {
    // 2026-06-07 is a Sunday. UK is on BST in June (offset +1) —
    // so 17:00 UTC = 18:00 BST.
    const nowUtc = utc(2026, 6, 7, 17);
    const ok = shouldPushWeeklyRecapNow(
      { tzIana: "Europe/London", weekStartDay: "monday" },
      nowUtc,
    );
    expect(ok).toBe(true);
  });

  it("fires for a Perth monday-start user at 18:00 AWST on Sunday", () => {
    // Perth is UTC+8 year-round. 10:00 UTC = 18:00 AWST.
    // 2026-04-26 is a Sunday.
    const nowUtc = utc(2026, 4, 26, 10);
    const ok = shouldPushWeeklyRecapNow(
      { tzIana: "Australia/Perth", weekStartDay: "monday" },
      nowUtc,
    );
    expect(ok).toBe(true);
  });

  it("fires for a Cayman monday-start user at 18:00 EST on Sunday", () => {
    // Cayman is UTC-5 year-round (no DST). 23:00 UTC = 18:00 local.
    // 2026-04-26 is a Sunday.
    const nowUtc = utc(2026, 4, 26, 23);
    const ok = shouldPushWeeklyRecapNow(
      { tzIana: "America/Cayman", weekStartDay: "monday" },
      nowUtc,
    );
    expect(ok).toBe(true);
  });

  it("fires for a Sunday-start user at 18:00 local on Saturday", () => {
    // 2026-04-25 is a Saturday. 18:00 UTC = 18:00 GMT (Europe/London winter)
    // but April is BST. Use a UK winter month instead.
    // 2026-01-03 is a Saturday. 18:00 UTC = 18:00 GMT (winter).
    const nowUtc = utc(2026, 1, 3, 18);
    const ok = shouldPushWeeklyRecapNow(
      { tzIana: "Europe/London", weekStartDay: "sunday" },
      nowUtc,
    );
    expect(ok).toBe(true);
  });
});

describe("shouldPushWeeklyRecapNow — negative cases", () => {
  it("does NOT fire at 17:00 local", () => {
    const nowUtc = utc(2026, 1, 4, 17);
    const ok = shouldPushWeeklyRecapNow(
      { tzIana: "Europe/London", weekStartDay: "monday" },
      nowUtc,
    );
    expect(ok).toBe(false);
  });

  it("does NOT fire at 19:00 local", () => {
    const nowUtc = utc(2026, 1, 4, 19);
    const ok = shouldPushWeeklyRecapNow(
      { tzIana: "Europe/London", weekStartDay: "monday" },
      nowUtc,
    );
    expect(ok).toBe(false);
  });

  it("does NOT fire on Saturday for monday-start user", () => {
    // 2026-01-03 Saturday, 18:00 local.
    const nowUtc = utc(2026, 1, 3, 18);
    const ok = shouldPushWeeklyRecapNow(
      { tzIana: "Europe/London", weekStartDay: "monday" },
      nowUtc,
    );
    expect(ok).toBe(false);
  });

  it("does NOT fire on Sunday for sunday-start user", () => {
    // 2026-01-04 Sunday, 18:00 local.
    const nowUtc = utc(2026, 1, 4, 18);
    const ok = shouldPushWeeklyRecapNow(
      { tzIana: "Europe/London", weekStartDay: "sunday" },
      nowUtc,
    );
    expect(ok).toBe(false);
  });
});

describe("shouldPushWeeklyRecapNow — DST correctness via IANA lookup", () => {
  it("fires at 17:00 UTC in BST and 18:00 UTC in GMT for the same user", () => {
    // BST (Sunday in summer): 17:00 UTC = 18:00 BST.
    const bstSunday = utc(2026, 6, 7, 17);
    expect(
      shouldPushWeeklyRecapNow(
        { tzIana: "Europe/London", weekStartDay: "monday" },
        bstSunday,
      ),
    ).toBe(true);

    // GMT (Sunday in winter): 18:00 UTC = 18:00 GMT.
    const gmtSunday = utc(2026, 1, 4, 18);
    expect(
      shouldPushWeeklyRecapNow(
        { tzIana: "Europe/London", weekStartDay: "monday" },
        gmtSunday,
      ),
    ).toBe(true);

    // 18:00 UTC in BST → that's 19:00 local — must NOT fire.
    const wrongBstInstant = utc(2026, 6, 7, 18);
    expect(
      shouldPushWeeklyRecapNow(
        { tzIana: "Europe/London", weekStartDay: "monday" },
        wrongBstInstant,
      ),
    ).toBe(false);
  });
});

describe("shouldPushWeeklyRecapNow — fallback behaviour", () => {
  it("treats null tz as UTC (fires at 18:00 UTC on Sunday for monday-start)", () => {
    const nowUtc = utc(2026, 1, 4, 18);
    const ok = shouldPushWeeklyRecapNow(
      { tzIana: null, weekStartDay: "monday" },
      nowUtc,
    );
    expect(ok).toBe(true);
  });

  it("treats empty-string tz as UTC", () => {
    const nowUtc = utc(2026, 1, 4, 18);
    const ok = shouldPushWeeklyRecapNow(
      { tzIana: "", weekStartDay: "monday" },
      nowUtc,
    );
    expect(ok).toBe(true);
  });

  it("treats an unrecognised tz as UTC (does not silently drop users)", () => {
    const nowUtc = utc(2026, 1, 4, 18);
    const ok = shouldPushWeeklyRecapNow(
      { tzIana: "Not/AZone", weekStartDay: "monday" },
      nowUtc,
    );
    expect(ok).toBe(true);
  });

  it("null tz: does not fire at other UTC hours", () => {
    const nowUtc = utc(2026, 1, 4, 15);
    const ok = shouldPushWeeklyRecapNow(
      { tzIana: null, weekStartDay: "monday" },
      nowUtc,
    );
    expect(ok).toBe(false);
  });
});
