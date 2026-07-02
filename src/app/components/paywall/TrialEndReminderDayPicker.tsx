"use client";

import {
  DEFAULT_TRIAL_END_REMINDER_DAY,
  TRIAL_END_REMINDER_DAY_OPTIONS,
  trialEndReminderDayLabel,
  type TrialEndReminderDay,
} from "@/lib/push/trialEndReminder";

export interface TrialEndReminderDayPickerProps {
  visible: boolean;
  value: TrialEndReminderDay;
  onChange: (day: TrialEndReminderDay) => void;
}

/**
 * ENG-968 — web parity for the trial-end reminder day picker on annual trial
 * surfaces. Persists preference only (no browser push in v1).
 */
export function TrialEndReminderDayPicker({
  visible,
  value,
  onChange,
}: TrialEndReminderDayPickerProps) {
  if (!visible) return null;

  return (
    <div className="mt-4" data-testid="trial-end-reminder-picker">
      <p className="text-[12px] text-muted-foreground leading-snug mb-2">
        We&apos;ll remind you before your trial ends — choose when.
      </p>
      <div
        className="inline-flex w-full rounded-xl border border-border bg-card p-1 gap-1"
        role="radiogroup"
        aria-label="Trial reminder day"
      >
        {TRIAL_END_REMINDER_DAY_OPTIONS.map((day) => {
          const selected = value === day;
          return (
            <button
              key={day}
              type="button"
              role="radio"
              aria-checked={selected}
              data-testid={`trial-reminder-day-${day}`}
              onClick={() => onChange(day)}
              className={`flex-1 rounded-lg px-3 py-2 text-[11px] font-semibold transition-colors ${
                selected
                  ? "bg-primary/15 text-primary-solid"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {trialEndReminderDayLabel(day)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { DEFAULT_TRIAL_END_REMINDER_DAY };
