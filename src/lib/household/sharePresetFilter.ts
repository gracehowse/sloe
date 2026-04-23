/**
 * Netflix-model v1 (2026-05-01) — per-member share preset filter.
 *
 * Each household member picks ONE preset that controls which of the
 * shared meals they see in the household surface. The custom preset
 * delegates to `household_member_share_targets` (per-cell grid).
 *
 * Pure logic, no I/O — mirrored between web and mobile via re-export.
 */

export type SharePreset =
  | "all"
  | "dinners"
  | "dinners_weekends"
  | "lunch_dinner"
  | "custom";

export const SHARE_PRESET_VALUES: readonly SharePreset[] = [
  "all",
  "dinners",
  "dinners_weekends",
  "lunch_dinner",
  "custom",
] as const;

export const SHARE_PRESET_LABELS: Record<SharePreset, string> = {
  all: "All meals",
  dinners: "Dinners only",
  dinners_weekends: "Dinners + weekends",
  lunch_dinner: "Lunch + dinner",
  custom: "Custom…",
};

export const SHARE_PRESET_DESCRIPTIONS: Record<SharePreset, string> = {
  all: "Every slot, every day.",
  dinners: "Dinners only — matches the cook-for-the-family pattern.",
  dinners_weekends: "Weekday dinners + weekend all meals.",
  lunch_dinner: "Lunch and dinner every day.",
  custom: "Pick specific slots on a 7×4 grid.",
};

/** Normalises a free-form meal_label column to a canonical slot key. */
export function normaliseMealLabel(label: string | null | undefined): string {
  return (label ?? "").trim().toLowerCase();
}

/** Returns true if the given meal_label is an "eating slot" for the preset logic.
 *  Breakfast / lunch / dinner / snack — anything else is never shared. */
export function isCanonicalSlot(label: string): boolean {
  return label === "breakfast" || label === "lunch" || label === "dinner" || label === "snack";
}

/** Day-of-week from an ISO date key (`YYYY-MM-DD`). 0 = Sunday, 6 = Saturday. */
export function dayOfWeek(dateKeyISO: string): number {
  // Parse as UTC noon to dodge timezone-day-shift issues.
  return new Date(dateKeyISO + "T12:00:00Z").getUTCDay();
}

export function isWeekend(dateKeyISO: string): boolean {
  const d = dayOfWeek(dateKeyISO);
  return d === 0 || d === 6;
}

/** Custom preset's payload shape — a sparse map `{"2026-05-01":{"dinner":true}}`. */
export type CustomShareGrid = Record<string, Partial<Record<string, boolean>>>;

/**
 * Is this (date, label) slot visible to a member on the given preset?
 *
 * - `all`: every canonical slot.
 * - `dinners`: dinners only.
 * - `dinners_weekends`: weekdays = dinner only; Sat/Sun = all canonical slots.
 * - `lunch_dinner`: lunch + dinner every day.
 * - `custom`: honours the per-cell grid. Missing cell → false.
 */
export function slotAllowedForPreset(
  preset: SharePreset,
  dateKeyISO: string,
  rawLabel: string | null | undefined,
  customGrid?: CustomShareGrid | null,
): boolean {
  const label = normaliseMealLabel(rawLabel);
  if (!isCanonicalSlot(label)) return false;

  switch (preset) {
    case "all":
      return true;
    case "dinners":
      return label === "dinner";
    case "dinners_weekends":
      return isWeekend(dateKeyISO) ? true : label === "dinner";
    case "lunch_dinner":
      return label === "lunch" || label === "dinner";
    case "custom": {
      const row = customGrid?.[dateKeyISO];
      return Boolean(row && row[label]);
    }
    default:
      return false;
  }
}

/** Default preset for new members. Keep in sync with the migration default. */
export const DEFAULT_SHARE_PRESET: SharePreset = "dinners";

/** Safely coerce an arbitrary value to a known preset, falling back to the default. */
export function coerceSharePreset(value: unknown): SharePreset {
  return (SHARE_PRESET_VALUES as readonly string[]).includes(String(value))
    ? (value as SharePreset)
    : DEFAULT_SHARE_PRESET;
}
