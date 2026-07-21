/**
 * Shared nutrition-label logging model.
 *
 * `/api/nutrition/scan-label` returns canonical per-100 g values. The first-
 * class logging flow reviews per-serving values, so both web and iOS must use
 * exactly the same scaling, rounding, and validation rules before committing a
 * journal row. This module is deliberately platform-free and is re-exported
 * through `@suppr/nutrition-core/labelLogging` for mobile.
 */

export const NUTRITION_LABEL_SOURCE = "Nutrition label" as const;

export type LabelScanConfidence = "high" | "medium" | "low";

export type LabelLogReview = {
  name: string;
  servingSizeG: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG?: number;
  sugarG?: number;
  saturatedFatG?: number;
  sodiumMg?: number;
  confidence: LabelScanConfidence;
  implausible: boolean;
  plausibilityReason?: string;
};

export type LabelLogItem = LabelLogReview;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonNegative(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function positive(value: unknown): number | null {
  const parsed = nonNegative(value);
  return parsed != null && parsed > 0 ? parsed : null;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function scaledOptional(value: unknown, scale: number, integer = false): number | undefined {
  const parsed = positive(value);
  if (parsed == null) return undefined;
  const scaled = parsed * scale;
  return integer ? Math.round(scaled) : round1(scaled);
}

/**
 * Convert the scan endpoint's per-100 g response into editable per-serving
 * values. Missing serving size deliberately falls back to 100 g: the review UI
 * names that basis explicitly instead of inventing a household serving.
 */
export function labelScanResultToReview(payload: unknown): LabelLogReview | null {
  if (!isRecord(payload) || payload.ok !== true) return null;

  const caloriesPer100g = nonNegative(payload.calories);
  const proteinPer100g = nonNegative(payload.protein);
  const carbsPer100g = nonNegative(payload.carbs);
  const fatPer100g = nonNegative(payload.fat);
  if (
    caloriesPer100g == null ||
    proteinPer100g == null ||
    carbsPer100g == null ||
    fatPer100g == null
  ) {
    return null;
  }

  const servingSizeG = positive(payload.servingSizeG) ?? 100;
  const scale = servingSizeG / 100;
  const confidence: LabelScanConfidence =
    payload.confidence === "high" ||
    payload.confidence === "medium" ||
    payload.confidence === "low"
      ? payload.confidence
      : "low";

  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const plausibilityReason =
    typeof payload.plausibilityReason === "string" && payload.plausibilityReason.trim()
      ? payload.plausibilityReason.trim()
      : undefined;
  const fiberG = scaledOptional(payload.fiberG, scale);
  const sugarG = scaledOptional(payload.sugarG, scale);
  const saturatedFatG = scaledOptional(payload.saturatedFatG, scale);
  const sodiumMg = scaledOptional(payload.sodiumMg, scale, true);

  return {
    name,
    servingSizeG: round1(servingSizeG),
    calories: Math.round(caloriesPer100g * scale),
    protein: round1(proteinPer100g * scale),
    carbs: round1(carbsPer100g * scale),
    fat: round1(fatPer100g * scale),
    ...(fiberG != null ? { fiberG } : {}),
    ...(sugarG != null ? { sugarG } : {}),
    ...(saturatedFatG != null ? { saturatedFatG } : {}),
    ...(sodiumMg != null ? { sodiumMg } : {}),
    confidence,
    implausible: payload.implausible === true,
    ...(plausibilityReason ? { plausibilityReason } : {}),
  };
}

export type LabelLogReviewFields = {
  name: string;
  servingSizeG: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
};

/** Validate the user-confirmed core fields before journal commit. */
export function confirmedLabelLogItem(
  fields: LabelLogReviewFields,
  scan: LabelLogReview,
): LabelLogItem | null {
  const name = fields.name.trim();
  const servingSizeG = Number(fields.servingSizeG);
  const calories = Number(fields.calories);
  const protein = Number(fields.protein);
  const carbs = Number(fields.carbs);
  const fat = Number(fields.fat);

  if (
    !name ||
    !Number.isFinite(servingSizeG) ||
    servingSizeG <= 0 ||
    !Number.isFinite(calories) ||
    calories < 0 ||
    !Number.isFinite(protein) ||
    protein < 0 ||
    !Number.isFinite(carbs) ||
    carbs < 0 ||
    !Number.isFinite(fat) ||
    fat < 0
  ) {
    return null;
  }

  const servingScale = servingSizeG / scan.servingSizeG;
  return {
    ...scan,
    name,
    servingSizeG: round1(servingSizeG),
    calories: Math.round(calories),
    protein: round1(protein),
    carbs: round1(carbs),
    fat: round1(fat),
    ...(scan.fiberG != null ? { fiberG: round1(scan.fiberG * servingScale) } : {}),
    ...(scan.sugarG != null ? { sugarG: round1(scan.sugarG * servingScale) } : {}),
    ...(scan.saturatedFatG != null
      ? { saturatedFatG: round1(scan.saturatedFatG * servingScale) }
      : {}),
    ...(scan.sodiumMg != null
      ? { sodiumMg: Math.round(scan.sodiumMg * servingScale) }
      : {}),
  };
}
