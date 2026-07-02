import { describe, expect, it } from "vitest";

import {
  DEFAULT_TRIAL_END_REMINDER_DAY,
  TRIAL_END_REMINDER_DAY_OPTIONS,
  buildTrialEndReminderCopy,
  computeTrialEndReminderFireDate,
  parseTrialEndReminderDay,
  parseTrialEndReminderPref,
  trialEndReminderDayLabel,
} from "../../src/lib/push/trialEndReminder";

describe("trialEndReminder (ENG-968)", () => {
  it("parses reminder days 5, 6, 7 only", () => {
    expect(parseTrialEndReminderDay(5)).toBe(5);
    expect(parseTrialEndReminderDay(6)).toBe(6);
    expect(parseTrialEndReminderDay(7)).toBe(7);
    expect(parseTrialEndReminderDay(4)).toBeNull();
    expect(parseTrialEndReminderDay("7")).toBe(7);
  });

  it("parses notification_prefs trialEndReminder shape", () => {
    expect(parseTrialEndReminderPref(null)).toBeNull();
    expect(parseTrialEndReminderPref({ enabled: false })).toEqual({
      enabled: false,
      reminderDay: DEFAULT_TRIAL_END_REMINDER_DAY,
    });
    expect(parseTrialEndReminderPref({ enabled: true, reminderDay: 6 })).toEqual({
      enabled: true,
      reminderDay: 6,
    });
    expect(parseTrialEndReminderPref({ enabled: true, reminderDay: 99 })).toBeNull();
  });

  it("computes fire date on the chosen trial day at 10:00 local", () => {
    const start = new Date("2026-07-01T15:30:00");
    const fire = computeTrialEndReminderFireDate(start, 5);
    expect(fire.getFullYear()).toBe(2026);
    expect(fire.getMonth()).toBe(6);
    expect(fire.getDate()).toBe(5);
    expect(fire.getHours()).toBe(10);
    expect(fire.getMinutes()).toBe(0);
  });

  it("uses calm courtesy copy — no charge-threat language", () => {
    const { title, body } = buildTrialEndReminderCopy();
    expect(title).toMatch(/trial ends soon/i);
    expect(body).not.toMatch(/charged|forget|surprise/i);
    expect(body).toMatch(/cancel anytime/i);
  });

  it("exposes Day 5/6/7 labels for the picker", () => {
    expect(TRIAL_END_REMINDER_DAY_OPTIONS).toEqual([5, 6, 7]);
    expect(trialEndReminderDayLabel(5)).toBe("Day 5");
  });
});
