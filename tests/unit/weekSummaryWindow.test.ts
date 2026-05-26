import { describe, expect, it } from "vitest";
import {
  nextWeekSummaryMode,
  normalizeWeekSummaryMode,
  weekSummaryDateKeys,
  weekSummaryToggleLabel,
  type WeekSummaryMode,
} from "../../src/lib/nutrition/weekSummaryWindow.ts";

describe("normalizeWeekSummaryMode", () => {
  it("defaults invalid values to rolling", () => {
    expect(normalizeWeekSummaryMode(undefined)).toBe("rolling");
    expect(normalizeWeekSummaryMode("")).toBe("rolling");
    expect(normalizeWeekSummaryMode("weekly")).toBe("rolling");
  });

  it("accepts calendar_week", () => {
    expect(normalizeWeekSummaryMode("calendar_week")).toBe("calendar_week");
  });
});

describe("weekSummaryDateKeys", () => {
  it("rolling: seven days ending on anchor", () => {
    const anchor = new Date(2026, 3, 14, 12, 0, 0, 0); // 14 Apr 2026
    const keys = weekSummaryDateKeys("rolling", anchor, "monday");
    expect(keys).toHaveLength(7);
    expect(keys[0]).toBe("2026-04-14");
    expect(keys[6]).toBe("2026-04-08");
  });

  it("calendar_week monday: week containing anchor", () => {
    // Wed 8 Apr 2026 → week Mon 6 Apr – Sun 12 Apr
    const anchor = new Date(2026, 3, 8, 12, 0, 0, 0);
    const keys = weekSummaryDateKeys("calendar_week", anchor, "monday");
    expect(keys[0]).toBe("2026-04-06");
    expect(keys[6]).toBe("2026-04-12");
  });

  it("calendar_week sunday: week containing anchor", () => {
    // Wed 8 Apr 2026 → Sun 5 Apr – Sat 11 Apr
    const anchor = new Date(2026, 3, 8, 12, 0, 0, 0);
    const keys = weekSummaryDateKeys("calendar_week", anchor, "sunday");
    expect(keys[0]).toBe("2026-04-05");
    expect(keys[6]).toBe("2026-04-11");
  });

  it("rolling vs calendar_week select different day sets for the same anchor", () => {
    // Mon 13 Apr 2026 — rolling looks back 7 days; calendar week is
    // Mon 13 – Sun 19. The two windows must NOT be identical, otherwise
    // the in-place toggle would be a no-op for the user.
    const anchor = new Date(2026, 3, 13, 12, 0, 0, 0);
    const rolling = weekSummaryDateKeys("rolling", anchor, "monday");
    const calendar = weekSummaryDateKeys("calendar_week", anchor, "monday");
    expect(rolling).not.toEqual(calendar);
    // Rolling reaches back into the prior week; calendar week reaches
    // forward to Sunday — neither set is a subset of the other here.
    expect(rolling).toContain("2026-04-07"); // 6 days before Mon anchor
    expect(calendar).toContain("2026-04-19"); // Sunday of anchor's week
  });
});

describe("nextWeekSummaryMode — two-state flip helper", () => {
  // The in-place Today toggle that consumed this helper was removed
  // 2026-05-26 (the control now lives in Settings). The helper is
  // retained as a tested two-state flip; these assertions guard its
  // involution so any future re-use stays correct.
  it("flips rolling → calendar_week and back", () => {
    expect(nextWeekSummaryMode("rolling")).toBe("calendar_week");
    expect(nextWeekSummaryMode("calendar_week")).toBe("rolling");
  });

  it("two flips return to the starting mode (involution)", () => {
    const start: WeekSummaryMode = "rolling";
    expect(nextWeekSummaryMode(nextWeekSummaryMode(start))).toBe(start);
  });
});

describe("weekSummaryToggleLabel — describes the destination of a switch", () => {
  it("viewing rolling offers to switch to this week", () => {
    expect(weekSummaryToggleLabel("rolling")).toBe("Switch to this week");
  });

  it("viewing calendar_week offers to switch to last 7 days", () => {
    expect(weekSummaryToggleLabel("calendar_week")).toBe("Switch to last 7 days");
  });
});

describe("weekSummaryMode — Settings persist + rehydrate round-trip", () => {
  // The Settings control (web `Settings.tsx` segmented; mobile
  // `SettingsBundleContent.tsx` picker) writes the chosen mode into
  // `profiles.notification_prefs.weekSummaryMode`. On next load the
  // Today host AND the mobile Settings row hydrate via
  // `normalizeWeekSummaryMode`. This proves the value chosen in Settings
  // survives the serialise → store → normalize round-trip for both
  // modes, and that a change genuinely persists the OTHER mode.
  function roundTrip(mode: WeekSummaryMode): WeekSummaryMode {
    const prefsBlob = JSON.parse(JSON.stringify({ weekSummaryMode: mode })) as {
      weekSummaryMode?: unknown;
    };
    return normalizeWeekSummaryMode(prefsBlob.weekSummaryMode);
  }

  it("rolling survives persist + rehydrate", () => {
    expect(roundTrip("rolling")).toBe("rolling");
  });

  it("calendar_week survives persist + rehydrate", () => {
    expect(roundTrip("calendar_week")).toBe("calendar_week");
  });

  it("switching from the hydrated mode persists the OTHER mode", () => {
    // Start hydrated as rolling, user picks calendar_week in Settings →
    // calendar_week persisted → rehydrates as calendar_week (not back to
    // the rolling default).
    const hydrated = normalizeWeekSummaryMode(undefined); // "rolling" default
    const picked = nextWeekSummaryMode(hydrated);
    expect(roundTrip(picked)).toBe("calendar_week");
  });
});
