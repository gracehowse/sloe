/**
 * ENG-1177 — user-configurable meal slots (count + numbered labels).
 *
 * Defaults preserve the classic Breakfast / Lunch / Dinner / Snacks journal.
 * Presets: classic (4 canonical), four_meals (Meal 1–4), six_meals (Meal 1–6).
 */
import { MEAL_SLOTS, normaliseMealSlot, type MealSlot } from "./mealSlots";

export type MealSlotPreset = "classic" | "four_meals" | "six_meals";

export type UserMealSlotConfig = {
  preset: MealSlotPreset;
  /** Optional custom labels — must match preset slot count when provided. */
  labels?: string[];
};

export const DEFAULT_USER_MEAL_SLOT_CONFIG: UserMealSlotConfig = {
  preset: "classic",
};

const NUMBERED_FOUR = ["Meal 1", "Meal 2", "Meal 3", "Meal 4"] as const;
const NUMBERED_SIX = [
  "Meal 1",
  "Meal 2",
  "Meal 3",
  "Meal 4",
  "Meal 5",
  "Meal 6",
] as const;

export function slotCountForPreset(preset: MealSlotPreset): number {
  switch (preset) {
    case "classic":
    case "four_meals":
      return 4;
    case "six_meals":
      return 6;
    default: {
      const _exhaustive: never = preset;
      return _exhaustive;
    }
  }
}

export function parseUserMealSlotConfig(raw: unknown): UserMealSlotConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return DEFAULT_USER_MEAL_SLOT_CONFIG;
  }
  const presetRaw = (raw as { preset?: unknown }).preset;
  const preset: MealSlotPreset =
    presetRaw === "four_meals" || presetRaw === "six_meals" || presetRaw === "classic"
      ? presetRaw
      : "classic";
  const labelsRaw = (raw as { labels?: unknown }).labels;
  if (!Array.isArray(labelsRaw)) {
    return { preset };
  }
  const labels = labelsRaw
    .map((l) => (typeof l === "string" ? l.trim() : ""))
    .filter((l) => l.length > 0);
  const expected = slotCountForPreset(preset);
  if (labels.length !== expected) {
    return { preset };
  }
  return { preset, labels };
}

/** Enabled slot labels in display order for Today / LogSheet / Plan. */
export function enabledMealSlotLabels(
  config: UserMealSlotConfig | null | undefined,
): readonly string[] {
  const c = config ?? DEFAULT_USER_MEAL_SLOT_CONFIG;
  switch (c.preset) {
    case "classic":
      return MEAL_SLOTS;
    case "four_meals":
      return c.labels?.length === 4 ? c.labels : NUMBERED_FOUR;
    case "six_meals":
      return c.labels?.length === 6 ? c.labels : NUMBERED_SIX;
    default: {
      const _exhaustive: never = c.preset;
      return _exhaustive;
    }
  }
}

/** Resolve a logged slot name against user config + legacy canonical names. */
export function normaliseUserMealSlot(
  raw: unknown,
  config: UserMealSlotConfig | null | undefined,
): string | null {
  if (raw == null) return null;
  const lc = String(raw).trim().toLowerCase();
  if (!lc) return null;
  for (const label of enabledMealSlotLabels(config)) {
    if (label.toLowerCase() === lc) return label;
  }
  const canonical = normaliseMealSlot(raw);
  if (canonical && (config ?? DEFAULT_USER_MEAL_SLOT_CONFIG).preset === "classic") {
    return canonical;
  }
  return null;
}

/** Preset picker options for Settings UI. */
export const MEAL_SLOT_PRESET_OPTIONS: ReadonlyArray<{
  id: MealSlotPreset;
  label: string;
  description: string;
}> = [
  {
    id: "classic",
    label: "Breakfast, lunch, dinner & snacks",
    description: "Standard four-meal day (default).",
  },
  {
    id: "four_meals",
    label: "4 smaller meals",
    description: "Meal 1, Meal 2, Meal 3, Meal 4 — for grazers.",
  },
  {
    id: "six_meals",
    label: "6 smaller meals",
    description: "Meal 1 … Meal 6 — for frequent small meals.",
  },
];

/** Equal calorie share per slot (numbered presets). */
export function evenSlotCalorieRatio(slot: string, slots: readonly string[]): number {
  if (slots.length === 0) return 0;
  return slots.includes(slot) ? 1 / slots.length : 0;
}

/** Today journal section order (+ legacy "Planned" tail). */
export function mealSectionSortOrder(
  config: UserMealSlotConfig | null | undefined,
): readonly string[] {
  return [...enabledMealSlotLabels(config), "Planned"];
}

export type { MealSlot };
