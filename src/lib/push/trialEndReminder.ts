/**
 * ENG-968 — Duolingo-style trial-end reminder day picker (Day 5 / 6 / 7).
 *
 * Shared preference shape + scheduling math for mobile local push and web
 * paywall parity. Copy is a courtesy heads-up — never threat framing.
 */

export const TRIAL_LENGTH_DAYS = 7;

export type TrialEndReminderDay = 5 | 6 | 7;

export const TRIAL_END_REMINDER_DAY_OPTIONS: readonly TrialEndReminderDay[] = [
  5, 6, 7,
] as const;

export const DEFAULT_TRIAL_END_REMINDER_DAY: TrialEndReminderDay = 5;

export type TrialEndReminderPref = {
  enabled: boolean;
  reminderDay: TrialEndReminderDay;
};

export const DEFAULT_TRIAL_END_REMINDER_PREF: TrialEndReminderPref = {
  enabled: true,
  reminderDay: DEFAULT_TRIAL_END_REMINDER_DAY,
};

export function parseTrialEndReminderDay(raw: unknown): TrialEndReminderDay | null {
  const n = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
  if (n === 5 || n === 6 || n === 7) return n;
  return null;
}

export function parseTrialEndReminderPref(raw: unknown): TrialEndReminderPref | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.enabled !== true) {
    return { enabled: false, reminderDay: DEFAULT_TRIAL_END_REMINDER_DAY };
  }
  const day = parseTrialEndReminderDay(o.reminderDay);
  if (!day) return null;
  return { enabled: true, reminderDay: day };
}

/** Fire at `localHour` on the chosen trial day (day 1 = trial start). */
export function computeTrialEndReminderFireDate(
  trialStart: Date,
  reminderDay: TrialEndReminderDay,
  localHour = 10,
): Date {
  const fire = new Date(trialStart);
  fire.setHours(0, 0, 0, 0);
  fire.setDate(fire.getDate() + (reminderDay - 1));
  fire.setHours(localHour, 0, 0, 0);
  return fire;
}

export function buildTrialEndReminderCopy(): { title: string; body: string } {
  return {
    title: "Your Sloe Pro trial ends soon",
    body:
      "A quick heads-up before your trial ends — cancel anytime in your subscription settings if Pro isn't for you.",
  };
}

export function trialEndReminderDayLabel(day: TrialEndReminderDay): string {
  return `Day ${day}`;
}
