/**
 * Unit tests for the shared "Eat again" dismiss helper (audit L4,
 * 2026-04-18). Pin the v2 storage shape, the same-day rule, the
 * 12-hour clock-rollback safety window, and the v1 → v2 migration.
 *
 * Pure-helper suite — no jsdom storage, no Date mocking beyond
 * explicit `now` args passed through.
 */
import { describe, expect, it } from "vitest";
import {
  DISMISS_ROLLBACK_WINDOW_MS,
  LEGACY_STORAGE_KEY_V1,
  STORAGE_KEY,
  migrateLegacyDismiss,
  parseDismissState,
  readDismissState,
  recordDismiss,
  serialiseDismissState,
  shouldShowEatAgain,
  type DismissState,
} from "@/lib/nutrition/eatAgainDismiss";

describe("eatAgainDismiss — storage key constants", () => {
  it("v2 key follows the audit-specified string", () => {
    expect(STORAGE_KEY).toBe("suppr-eat-again-dismissed-v2");
  });

  it("v1 legacy key follows the pre-L4 string", () => {
    expect(LEGACY_STORAGE_KEY_V1).toBe("suppr-eat-again-dismissed");
  });

  it("rollback window is 12 hours", () => {
    expect(DISMISS_ROLLBACK_WINDOW_MS).toBe(12 * 60 * 60 * 1000);
  });
});

describe("recordDismiss", () => {
  it("captures both the local dateKey and an ISO timestamp at `now`", () => {
    const now = new Date(2026, 3, 18, 9, 30, 0); // local 2026-04-18 09:30
    const state = recordDismiss(now);
    expect(state.dateKey).toBe("2026-04-18");
    expect(new Date(state.dismissedAt).getTime()).toBe(now.getTime());
  });

  it("falls back to a safe `new Date()` when passed an invalid Date", () => {
    const state = recordDismiss(new Date("nope"));
    // Shape is still intact — dateKey is a YYYY-MM-DD, dismissedAt parses.
    expect(state.dateKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isFinite(Date.parse(state.dismissedAt))).toBe(true);
  });
});

describe("serialiseDismissState / parseDismissState", () => {
  it("round-trips a valid state", () => {
    const state: DismissState = {
      dateKey: "2026-04-18",
      dismissedAt: "2026-04-18T09:30:00.000Z",
    };
    const raw = serialiseDismissState(state);
    expect(parseDismissState(raw)).toEqual(state);
  });

  it("returns null for null / empty / invalid JSON", () => {
    expect(parseDismissState(null)).toBeNull();
    expect(parseDismissState(undefined)).toBeNull();
    expect(parseDismissState("")).toBeNull();
    expect(parseDismissState("   ")).toBeNull();
    expect(parseDismissState("not-json")).toBeNull();
    expect(parseDismissState("[1,2,3]")).toBeNull();
  });

  it("rejects wrong-shape blobs", () => {
    expect(parseDismissState(JSON.stringify({ dateKey: "2026-04-18" }))).toBeNull();
    expect(
      parseDismissState(JSON.stringify({ dateKey: "nope", dismissedAt: "2026-04-18T09:00:00Z" })),
    ).toBeNull();
    expect(
      parseDismissState(JSON.stringify({ dateKey: "2026-04-18", dismissedAt: "nope" })),
    ).toBeNull();
  });
});

describe("shouldShowEatAgain", () => {
  const now = new Date(2026, 3, 18, 9, 30, 0); // local 2026-04-18 09:30

  it("shows the banner when there is no stored state", () => {
    expect(shouldShowEatAgain(null, now)).toBe(true);
    expect(shouldShowEatAgain(undefined, now)).toBe(true);
  });

  it("hides the banner when stored dateKey === today's local date", () => {
    const state: DismissState = {
      dateKey: "2026-04-18",
      // Synthesised dismissedAt hours earlier — still today.
      dismissedAt: new Date(2026, 3, 18, 8, 0, 0).toISOString(),
    };
    expect(shouldShowEatAgain(state, now)).toBe(false);
  });

  it("shows the banner when the stored dateKey is a different day AND the dismiss is older than 12h", () => {
    // Dismissed yesterday morning (~25h ago) — past the rollback window.
    const state: DismissState = {
      dateKey: "2026-04-17",
      dismissedAt: new Date(2026, 3, 17, 8, 0, 0).toISOString(),
    };
    expect(shouldShowEatAgain(state, now)).toBe(true);
  });

  it("hides the banner via the clock-rollback window when the stored day is in the FUTURE", () => {
    // Device wobbled forward by 30 min; user dismissed at that forward
    // time (dateKey still same day but dismissedAt is 30 min in the
    // future). Then device rolled back to real local time. The 12h
    // window catches the dismiss regardless of dateKey.
    const future = new Date(now.getTime() + 30 * 60 * 1000);
    const state: DismissState = {
      dateKey: "2026-04-17", // off-by-one on purpose to force the window check
      dismissedAt: future.toISOString(),
    };
    expect(shouldShowEatAgain(state, now)).toBe(false);
  });

  it("hides the banner via the rollback window when the user just dismissed (regardless of dateKey)", () => {
    // Simulate: user travelled across timezones, stored dateKey no longer
    // matches, but dismissedAt was 10 minutes ago.
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
    const state: DismissState = {
      dateKey: "2026-04-17", // off-by-one
      dismissedAt: tenMinutesAgo.toISOString(),
    };
    expect(shouldShowEatAgain(state, now)).toBe(false);
  });

  it("shows the banner when `now` is invalid (degrade safely to visible)", () => {
    const state: DismissState = {
      dateKey: "2026-04-18",
      dismissedAt: "2026-04-18T09:00:00.000Z",
    };
    expect(shouldShowEatAgain(state, new Date("nope"))).toBe(true);
  });

  it("shows the banner when the stored dismissedAt is not parseable (defensive)", () => {
    const state = { dateKey: "2026-04-17", dismissedAt: "not-a-date" } as DismissState;
    expect(shouldShowEatAgain(state, now)).toBe(true);
  });
});

describe("migrateLegacyDismiss", () => {
  it("lifts a v1 bare `YYYY-MM-DD` string into a v2 record stamped at `now`", () => {
    const now = new Date(2026, 3, 18, 9, 30, 0);
    const state = migrateLegacyDismiss("2026-04-18", now);
    expect(state).not.toBeNull();
    expect(state!.dateKey).toBe("2026-04-18");
    // dismissedAt is synthesised at `now` (belt-and-braces for the rollback window).
    expect(new Date(state!.dismissedAt).getTime()).toBe(now.getTime());
  });

  it("returns null for empty / null / invalid v1 blobs", () => {
    const now = new Date(2026, 3, 18, 9, 30, 0);
    expect(migrateLegacyDismiss(null, now)).toBeNull();
    expect(migrateLegacyDismiss(undefined, now)).toBeNull();
    expect(migrateLegacyDismiss("", now)).toBeNull();
    expect(migrateLegacyDismiss("   ", now)).toBeNull();
    expect(migrateLegacyDismiss("not-a-date", now)).toBeNull();
    expect(migrateLegacyDismiss("2026-04", now)).toBeNull();
  });

  it("returns null when `now` is invalid so callers don't persist garbage", () => {
    expect(migrateLegacyDismiss("2026-04-18", new Date("nope"))).toBeNull();
  });
});

describe("readDismissState — v2 first, v1 fallback", () => {
  const now = new Date(2026, 3, 18, 9, 30, 0);

  it("prefers v2 when present and valid", () => {
    const v2 = serialiseDismissState({ dateKey: "2026-04-18", dismissedAt: now.toISOString() });
    // Even if a v1 blob is present, v2 wins.
    const v1 = "2026-04-10";
    const out = readDismissState(v2, v1, now);
    expect(out).toEqual({ dateKey: "2026-04-18", dismissedAt: now.toISOString() });
  });

  it("falls back to v1 when v2 is missing", () => {
    const out = readDismissState(null, "2026-04-18", now);
    expect(out).not.toBeNull();
    expect(out!.dateKey).toBe("2026-04-18");
  });

  it("falls back to v1 when v2 is corrupt", () => {
    const out = readDismissState("not-json", "2026-04-18", now);
    expect(out).not.toBeNull();
    expect(out!.dateKey).toBe("2026-04-18");
  });

  it("returns null when neither key has a usable value", () => {
    expect(readDismissState(null, null, now)).toBeNull();
    expect(readDismissState("garbage", "also-garbage", now)).toBeNull();
  });
});

describe("end-to-end — dismiss now, then query banner visibility later", () => {
  it("dismiss at 09:30 → still hidden at 11:00 (same day)", () => {
    const at930 = new Date(2026, 3, 18, 9, 30, 0);
    const at11 = new Date(2026, 3, 18, 11, 0, 0);
    const state = recordDismiss(at930);
    expect(shouldShowEatAgain(state, at11)).toBe(false);
  });

  it("dismiss at 23:30 → visible again at 14:00 next day (well past window)", () => {
    const lateNight = new Date(2026, 3, 18, 23, 30, 0);
    const nextAfternoon = new Date(2026, 3, 19, 14, 0, 0);
    const state = recordDismiss(lateNight);
    expect(shouldShowEatAgain(state, nextAfternoon)).toBe(true);
  });

  it("dismiss at 23:30 → still hidden at 06:00 next day (inside 12h window)", () => {
    // 6.5 hours after dismiss — inside the safety window.
    const lateNight = new Date(2026, 3, 18, 23, 30, 0);
    const earlyMorning = new Date(2026, 3, 19, 6, 0, 0);
    const state = recordDismiss(lateNight);
    expect(shouldShowEatAgain(state, earlyMorning)).toBe(false);
  });

  it("clock rolls back past midnight — banner stays hidden via dismissedAt window", () => {
    // User dismisses at 11:50 PM. Device rolls back 10 mins → now 11:40 PM same day.
    const realNow = new Date(2026, 3, 18, 23, 50, 0);
    const rolledBack = new Date(2026, 3, 18, 23, 40, 0);
    const state = recordDismiss(realNow);
    // dateKey still matches — same-day hide.
    expect(shouldShowEatAgain(state, rolledBack)).toBe(false);
  });

  it("clock rolls back across midnight — banner stays hidden via 12h window", () => {
    // User dismisses at 00:10 AM on 04-19. Device rolls back 30 mins → 23:40 on 04-18.
    const realNow = new Date(2026, 3, 19, 0, 10, 0);
    const rolledBack = new Date(2026, 3, 18, 23, 40, 0);
    const state = recordDismiss(realNow);
    // dateKey ("2026-04-19") does NOT match the rolled-back local date
    // ("2026-04-18"), but the rollback window catches it.
    expect(state.dateKey).toBe("2026-04-19");
    expect(shouldShowEatAgain(state, rolledBack)).toBe(false);
  });
});
