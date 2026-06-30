/**
 * ENG-955 — gentle, opt-in weigh-in reminder cadence + anti-nag core.
 *
 * Pins the consequential, headless logic behind the weigh-in reminder push
 * (`src/lib/push/weighInReminder.ts`):
 *   1. Opt-in gate — no pref / disabled pref → never fires.
 *   2. Window gate — fires ONLY on the user's chosen local weekday + hour,
 *      tz-aware (DST-correct via IANA), with a UTC fallback for bad zones.
 *   3. Anti-nag rule #1 — SKIP when a weigh-in already exists this period.
 *   4. Anti-nag rule #2 — dedupe inside the 6-day window.
 *   5. Warm copy — contains the ticket tone, NO badge/streak/threat language.
 *
 * Modelled on `weeklyRecapTzFilter.test.ts` (deterministic UTC instants).
 */

import { describe, expect, it } from "vitest";

import {
  buildWeighInReminderCopy,
  decideWeighInReminder,
  isInWeighInWindow,
  parseWeighInReminderPref,
  DEFAULT_WEIGH_IN_REMINDER_PREF,
  WEIGH_IN_REMINDER_DEDUPE_WINDOW_MS,
  type WeighInReminderPref,
} from "../../src/lib/push/weighInReminder";

/** Build a UTC instant from explicit year/month/day/hour (month 1-indexed). */
function utc(y: number, m: number, d: number, h: number): Date {
  return new Date(Date.UTC(y, m - 1, d, h, 0, 0));
}

// 2026-06-01 is a Monday. UTC offset 0 for Europe/London is GMT in winter,
// BST (+1) in summer — June is BST.
const MONDAY_8AM_PREF: WeighInReminderPref = { enabled: true, weekday: 1, hour: 8 };

describe("parseWeighInReminderPref", () => {
  it("returns null for null / non-object / missing enabled", () => {
    expect(parseWeighInReminderPref(null)).toBeNull();
    expect(parseWeighInReminderPref(undefined)).toBeNull();
    expect(parseWeighInReminderPref("nope")).toBeNull();
    expect(parseWeighInReminderPref({})).toBeNull();
    expect(parseWeighInReminderPref({ weekday: 1, hour: 8 })).toBeNull();
  });

  it("returns null when enabled is explicitly false (respects opt-out)", () => {
    expect(parseWeighInReminderPref({ enabled: false, weekday: 1, hour: 8 })).toBeNull();
  });

  it("parses a valid opted-in pref", () => {
    expect(parseWeighInReminderPref({ enabled: true, weekday: 3, hour: 9 })).toEqual({
      enabled: true,
      weekday: 3,
      hour: 9,
    });
  });

  it("falls back to defaults for out-of-range weekday / hour (never throws)", () => {
    expect(parseWeighInReminderPref({ enabled: true, weekday: 99, hour: -4 })).toEqual({
      enabled: true,
      weekday: DEFAULT_WEIGH_IN_REMINDER_PREF.weekday,
      hour: DEFAULT_WEIGH_IN_REMINDER_PREF.hour,
    });
    expect(parseWeighInReminderPref({ enabled: true, weekday: "x", hour: 9.5 })).toEqual({
      enabled: true,
      weekday: DEFAULT_WEIGH_IN_REMINDER_PREF.weekday,
      hour: DEFAULT_WEIGH_IN_REMINDER_PREF.hour,
    });
  });
});

describe("isInWeighInWindow", () => {
  it("fires at exactly the chosen local weekday + hour (GMT winter)", () => {
    // 2026-01-05 is a Monday; Europe/London is GMT (offset 0) in January.
    expect(
      isInWeighInWindow(MONDAY_8AM_PREF, "Europe/London", utc(2026, 1, 5, 8)),
    ).toBe(true);
  });

  it("is DST-correct — fires at 07:00 UTC in BST for the same Monday-8am pref", () => {
    // 2026-06-01 is a Monday; June is BST (+1) → 07:00 UTC = 08:00 BST.
    expect(
      isInWeighInWindow(MONDAY_8AM_PREF, "Europe/London", utc(2026, 6, 1, 7)),
    ).toBe(true);
    // 08:00 UTC in BST is 09:00 local — must NOT fire.
    expect(
      isInWeighInWindow(MONDAY_8AM_PREF, "Europe/London", utc(2026, 6, 1, 8)),
    ).toBe(false);
  });

  it("does not fire on the wrong hour", () => {
    expect(
      isInWeighInWindow(MONDAY_8AM_PREF, "Europe/London", utc(2026, 1, 5, 9)),
    ).toBe(false);
  });

  it("does not fire on the wrong weekday", () => {
    // 2026-01-06 is a Tuesday.
    expect(
      isInWeighInWindow(MONDAY_8AM_PREF, "Europe/London", utc(2026, 1, 6, 8)),
    ).toBe(false);
  });

  it("treats null / unrecognised tz as UTC (never silently drops the user)", () => {
    // 2026-01-05 Monday 08:00 UTC.
    expect(isInWeighInWindow(MONDAY_8AM_PREF, null, utc(2026, 1, 5, 8))).toBe(true);
    expect(isInWeighInWindow(MONDAY_8AM_PREF, "Not/AZone", utc(2026, 1, 5, 8))).toBe(true);
    expect(isInWeighInWindow(MONDAY_8AM_PREF, "", utc(2026, 1, 5, 8))).toBe(true);
  });

  it("respects a different chosen weekday + hour (Saturday 6pm)", () => {
    const satPm: WeighInReminderPref = { enabled: true, weekday: 6, hour: 18 };
    // 2026-01-03 is a Saturday; 18:00 UTC = 18:00 GMT.
    expect(isInWeighInWindow(satPm, "Europe/London", utc(2026, 1, 3, 18))).toBe(true);
    expect(isInWeighInWindow(satPm, "Europe/London", utc(2026, 1, 3, 17))).toBe(false);
  });
});

describe("decideWeighInReminder — opt-in gate", () => {
  it("does not send when the user has not opted in (null pref)", () => {
    const d = decideWeighInReminder(
      { pref: null, tzIana: "Europe/London", weightKgByDay: {}, lastReminderSentAt: null },
      utc(2026, 1, 5, 8),
    );
    expect(d).toEqual({ send: false, skipReason: "not_opted_in" });
  });
});

describe("decideWeighInReminder — fires on cadence day", () => {
  it("sends at the chosen weekday + hour with no weigh-in this period and no recent send", () => {
    const d = decideWeighInReminder(
      {
        pref: MONDAY_8AM_PREF,
        tzIana: "Europe/London",
        weightKgByDay: {}, // no weigh-ins this period
        lastReminderSentAt: null,
      },
      utc(2026, 1, 5, 8), // Monday 08:00 GMT
    );
    expect(d).toEqual({ send: true, skipReason: null });
  });

  it("does not send outside the chosen window", () => {
    const d = decideWeighInReminder(
      {
        pref: MONDAY_8AM_PREF,
        tzIana: "Europe/London",
        weightKgByDay: {},
        lastReminderSentAt: null,
      },
      utc(2026, 1, 5, 9), // Monday 09:00 — wrong hour
    );
    expect(d).toEqual({ send: false, skipReason: "outside_window" });
  });
});

describe("decideWeighInReminder — anti-nag: already logged this period", () => {
  it("SKIPS when a weigh-in exists earlier the same week (the core anti-nag rule)", () => {
    const d = decideWeighInReminder(
      {
        pref: MONDAY_8AM_PREF,
        tzIana: "Europe/London",
        // Weighed in 2 days before the Monday reminder — inside the 7-day window.
        weightKgByDay: { "2026-01-03": 70.4 },
        lastReminderSentAt: null,
      },
      utc(2026, 1, 5, 8),
    );
    expect(d).toEqual({ send: false, skipReason: "already_logged_this_period" });
  });

  it("SKIPS when the weigh-in is on the reminder day itself", () => {
    const d = decideWeighInReminder(
      {
        pref: MONDAY_8AM_PREF,
        tzIana: "Europe/London",
        weightKgByDay: { "2026-01-05": 70.1 },
        lastReminderSentAt: null,
      },
      utc(2026, 1, 5, 8),
    );
    expect(d.send).toBe(false);
    expect(d.skipReason).toBe("already_logged_this_period");
  });

  it("STILL fires when the last weigh-in is older than the 7-day period", () => {
    const d = decideWeighInReminder(
      {
        pref: MONDAY_8AM_PREF,
        tzIana: "Europe/London",
        // 8 days before Monday 2026-01-05 → 2025-12-28, outside the window.
        weightKgByDay: { "2025-12-28": 71.0 },
        lastReminderSentAt: null,
      },
      utc(2026, 1, 5, 8),
    );
    expect(d).toEqual({ send: true, skipReason: null });
  });

  it("ignores zero / non-finite weigh-in values (a 0 is not a real weigh-in)", () => {
    const d = decideWeighInReminder(
      {
        pref: MONDAY_8AM_PREF,
        tzIana: "Europe/London",
        weightKgByDay: { "2026-01-03": 0, "2026-01-04": Number.NaN as unknown as number },
        lastReminderSentAt: null,
      },
      utc(2026, 1, 5, 8),
    );
    expect(d.send).toBe(true);
  });
});

describe("decideWeighInReminder — anti-nag: dedupe window", () => {
  it("SKIPS when a reminder was sent inside the 6-day dedupe window", () => {
    const now = utc(2026, 1, 5, 8);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const d = decideWeighInReminder(
      {
        pref: MONDAY_8AM_PREF,
        tzIana: "Europe/London",
        weightKgByDay: {},
        lastReminderSentAt: oneDayAgo,
      },
      now,
    );
    expect(d).toEqual({ send: false, skipReason: "deduped" });
  });

  it("fires when the last reminder is older than the dedupe window", () => {
    const now = utc(2026, 1, 5, 8);
    const justOver = new Date(
      now.getTime() - WEIGH_IN_REMINDER_DEDUPE_WINDOW_MS - 60_000,
    ).toISOString();
    const d = decideWeighInReminder(
      {
        pref: MONDAY_8AM_PREF,
        tzIana: "Europe/London",
        weightKgByDay: {},
        lastReminderSentAt: justOver,
      },
      now,
    );
    expect(d).toEqual({ send: true, skipReason: null });
  });

  it("dedupe is checked before the anti-nag ledger walk (deduped wins)", () => {
    const now = utc(2026, 1, 5, 8);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const d = decideWeighInReminder(
      {
        pref: MONDAY_8AM_PREF,
        tzIana: "Europe/London",
        weightKgByDay: { "2026-01-03": 70.4 }, // also already logged
        lastReminderSentAt: oneDayAgo,
      },
      now,
    );
    // Either skip reason is "anti-nag"; we pin the documented order: deduped.
    expect(d.skipReason).toBe("deduped");
  });
});

describe("buildWeighInReminderCopy — warm, never a streak/badge/threat", () => {
  const { title, body } = buildWeighInReminderCopy();

  it("uses the ticket tone", () => {
    expect(body).toBe("Ready for a quick weigh-in? Mornings give the steadiest trend.");
  });

  it("contains NO badge / streak / threat language", () => {
    const banned = [
      "streak",
      "badge",
      "don't lose",
      "dont lose",
      "keep your",
      "you'll lose",
      "youll lose",
      "broken",
      "miss",
      "last chance",
      "don't break",
      "dont break",
    ];
    const haystack = `${title} ${body}`.toLowerCase();
    for (const word of banned) {
      expect(haystack, `copy must not contain "${word}"`).not.toContain(word);
    }
  });

  it("has no exclamation marks or performance adjectives (Suppr voice)", () => {
    const haystack = `${title} ${body}`.toLowerCase();
    expect(haystack).not.toContain("!");
    for (const adj of ["amazing", "great job", "crushing", "smashed"]) {
      expect(haystack).not.toContain(adj);
    }
  });

  it("makes no weight-loss / health claim", () => {
    const haystack = `${title} ${body}`.toLowerCase();
    for (const claim of ["lose weight", "burn fat", "slim", "drop"]) {
      expect(haystack).not.toContain(claim);
    }
  });
});
