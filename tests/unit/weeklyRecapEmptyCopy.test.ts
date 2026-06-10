/**
 * weeklyRecapEmptyCopy — pin the history-aware copy matrix for the
 * weekly-recap empty state + the TDEE check-in cold-start line.
 *
 * Authority: ENG-1019 "hasHistory disease" pattern (third instance —
 * ENG-1020 item 2). Mirrors the philosophy pinned in
 * `progressStoryGate.test.ts`:
 *   - True cold start → "starts here" copy that promises the FIRST
 *     insight / first meal.
 *   - Returning user, empty current week → week-scoped copy that never
 *     implies starting from nothing.
 *
 * Web (`<Digest>`) and mobile (`weekly-recap.tsx`) both consume this
 * module, so the strings can't drift between platforms.
 */

import { describe, expect, it } from "vitest";
import {
  CHECKIN_FIRST_WEEK_COLD_START,
  buildWeeklyRecapEmptyCopy,
  resolveCheckinFirstWeekHeadline,
} from "../../src/lib/nutrition/weeklyRecapEmptyCopy";
import { buildWeeklyCheckin } from "../../src/lib/nutrition/weeklyCheckin";

describe("buildWeeklyRecapEmptyCopy", () => {
  it("true cold start (default) → 'starts here' copy promising the first meal", () => {
    const out = buildWeeklyRecapEmptyCopy();
    expect(out.headline).toBe("Your streak starts here.");
    expect(out.body).toContain("come back after your first meal");
    // The cold-start copy is the only place the "first meal" promise is legal.
    expect(out.body).toContain("two different days");
  });

  it("explicit hasHistory:false keeps the cold-start copy untouched", () => {
    const out = buildWeeklyRecapEmptyCopy({ hasHistory: false });
    expect(out.headline).toBe("Your streak starts here.");
    expect(out.body).toContain("come back after your first meal");
  });

  it("hasHistory:true → week-scoped copy, never 'first meal' / 'starts here'", () => {
    const out = buildWeeklyRecapEmptyCopy({ hasHistory: true });
    expect(out.headline).toBe("Nothing logged this week yet");
    expect(out.body).toContain("This week's recap builds as you log");
    // The returning-user copy must NOT read as a cold start.
    expect(out.headline).not.toContain("starts here");
    expect(out.body).not.toContain("first meal");
    expect(out.body).not.toContain("nothing to recap yet");
  });
});

describe("resolveCheckinFirstWeekHeadline", () => {
  it("true cold start (default) → null (caller keeps the engine first_week headline)", () => {
    expect(resolveCheckinFirstWeekHeadline()).toBeNull();
    expect(resolveCheckinFirstWeekHeadline({ hasHistory: false })).toBeNull();
  });

  it("hasHistory:true → a week-scoped override, not the 7-day cold-start claim", () => {
    const headline = resolveCheckinFirstWeekHeadline({ hasHistory: true });
    expect(headline).not.toBeNull();
    expect(headline).toBe("Your check-in updates as you log this week.");
    // Must not re-assert the cold-start "7 days of data" claim.
    expect(headline).not.toContain("7 days");
    expect(headline).not.toBe(CHECKIN_FIRST_WEEK_COLD_START);
  });
});

describe("CHECKIN_FIRST_WEEK_COLD_START", () => {
  it("equals the exact headline `buildWeeklyCheckin` emits for first_week", () => {
    // The override guard in both surfaces only fires when the engine
    // headline equals this constant — cross-check against the live
    // cascade so a copy change in `weeklyCheckin.ts` can't silently
    // break the swap (the guard would stop matching and the cold-start
    // line would leak back onto returning users).
    const out = buildWeeklyCheckin({
      previousTdeeKcal: null, // missing snapshot → first_week
      currentTdeeKcal: 2400,
      weeklyIntakeKcal: 0,
      dailyTargetKcal: 2100,
      weightStartKg: null,
      weightEndKg: null,
      weighInsThisWeek: 0,
      daysLogged: 0,
    });
    expect(out.kind).toBe("first_week");
    expect(out.headline).toBe(CHECKIN_FIRST_WEEK_COLD_START);
    expect(CHECKIN_FIRST_WEEK_COLD_START).toBe(
      "Your check-in starts after 7 days of data.",
    );
  });
});
