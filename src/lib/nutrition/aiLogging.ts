/**
 * AI logging shared helpers (Batch 5.13).
 *
 * Pure, platform-agnostic. Imported by both the web `NutritionTracker`
 * flow and the mobile Today tab so voice + photo logs never drift.
 *
 * The web and mobile UI shells differ (MediaRecorder vs expo-av,
 * `<input type="file">` vs expo-image-picker) but the data contract,
 * confidence classification, aggregation and sanitisation are shared.
 *
 * CLAUDE.md rule alignment:
 *  - Low-confidence matches (< 0.5) are flagged and never auto-logged.
 *  - Nutrition values are surfaced as AI estimates — never inventing
 *    numbers silently. Callers must route through `verifyIngredients`
 *    on the server; this module deals only with the return shape.
 */

export type AiLoggingSource = "voice" | "ai_photo";

/**
 * Canonical source strings for AI-logged diary rows (audit M10, 2026-04-18).
 *
 * Written by voice + photo commit paths on both platforms so new rows
 * carry a single, human-readable tag. Historical rows with legacy
 * strings (`"voice"`, `"ai_voice"`, `"ai_photo"`) are still recognised
 * by `isAiSourcedFoodHistoryItem` in `foodHistory.ts` — the detector
 * is permissive by design; writes are strict.
 *
 * Do not migrate historical rows; the detector handles backwards
 * compatibility.
 */
export const AI_VOICE_SOURCE = "AI voice" as const;
export const AI_PHOTO_SOURCE = "AI photo" as const;

/**
 * Resolve the canonical source string for a committed AI-logged item
 * based on its `source` discriminator. `"voice"` → `AI_VOICE_SOURCE`,
 * any photo source → `AI_PHOTO_SOURCE`. Centralises the mapping so
 * the two commit paths (web `NutritionTracker` and mobile Today) can
 * never drift.
 */
export function aiLoggingSourceLabel(source: AiLoggingSource): string {
  return source === "voice" ? AI_VOICE_SOURCE : AI_PHOTO_SOURCE;
}

export type AiLoggedItem = {
  name: string;
  quantity?: number;
  unit?: string;
  /** Edible weight in grams, when the server pipeline resolved one. */
  grams?: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  /** Match confidence in [0, 1]. Values <0.5 are flagged as low. */
  confidence: number;
  source: AiLoggingSource;
  /** Photo-log only (2026-05-01 range-first re-architecture):
   *  preserves the model's kcal / macro RANGES so the review UI can
   *  display "~120-150 kcal" instead of the lossy midpoint, and the
   *  commit pipeline can stash low/high in `meal_logs.metadata` for
   *  uncertainty-aware analytics. Voice path leaves this unset. */
  range?: {
    calories: { low: number; high: number };
    protein: { low: number; high: number } | null;
    carbs: { low: number; high: number } | null;
    fat: { low: number; high: number } | null;
  };
  /** Macro-role grouping label assigned by the photo-log model
   *  (e.g. "Bread + dips", "Protein + fats", "Extras"). Voice path
   *  leaves this unset; absent => render flat without grouping. */
  category?: string;
  /** Verbal portion hint from the photo-log model — "~40-50g",
   *  "1 piece". Distinct from `unit` (which historical voice rows
   *  also use); duplicated here for the photo-log review UI so a
   *  later refactor of `unit`'s semantics can't strip it. */
  quantityHint?: string;
  /**
   * F-74 / F-103 (2026-05-07) — optional caffeine + alcohol payload
   * an AI pipeline MAY surface when the recognised food has a known
   * reference (e.g. "espresso" maps to a generic-beverage row in
   * `genericBeverages.ts`). Both fields are absolute per-serving
   * values (not per-100g) so the commit path can stash them straight
   * onto the meal row's `micros` map without re-scaling. Per-meal
   * `micros` is the canonical SoT for food-derived stimulants.
   *
   * Per CLAUDE.md "no invented nutrition values" rule — these MUST come
   * from a deterministic upstream lookup, never from the LLM's free-text
   * inference. When the pipeline cannot resolve a reference value, both
   * fields are left undefined and the commit path skips the daily bump.
   * The chips will still reflect the meal's caffeine / alcohol if the
   * AI populates `meal.micros.caffeineMg` via a future API revision; the
   * top-level fields here are the staging slot for that path.
   */
  caffeineMg?: number;
  alcoholG?: number;
};

export type ConfidenceLevel = "low" | "medium" | "high";

/**
 * Bucket a 0–1 confidence into low / medium / high.
 *
 * Thresholds mirror the existing web `ConfidenceDot` and the
 * `verifyIngredients` tier classifier:
 *  - >= 0.75 → high
 *  - >= 0.5  → medium
 *  - else    → low
 *
 * NaN, negative values, or values > 1 are clamped to [0, 1] before
 * classification so a malformed API response can never bypass the
 * low-confidence warning.
 */
export function classifyConfidence(confidence: number): ConfidenceLevel {
  const c = Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0;
  if (c >= 0.75) return "high";
  if (c >= 0.5) return "medium";
  return "low";
}

/** Minimum confidence required to commit an item without user override. */
export const LOW_CONFIDENCE_THRESHOLD = 0.5;

/** True when an item should be flagged as "Low confidence — please verify". */
export function isLowConfidence(item: Pick<AiLoggedItem, "confidence">): boolean {
  const c = Number.isFinite(item.confidence)
    ? Math.min(1, Math.max(0, item.confidence))
    : 0;
  return c < LOW_CONFIDENCE_THRESHOLD;
}

export type AiLoggedTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Present only when at least one item reported fiber. */
  fiber?: number;
};

/**
 * Sum macro totals across a list of AI-logged items.
 *
 * - Non-finite macro values coerce to 0 rather than poisoning the sum.
 * - Fiber is emitted only if at least one item contributed a finite
 *   fiber value (matches the CLAUDE.md "don't display data we don't
 *   have" rule — fiber is conditional on the plan).
 */
export function aggregateTotals(items: readonly AiLoggedItem[]): AiLoggedTotals {
  let calories = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  let fiber = 0;
  let sawFiber = false;

  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    calories += Number.isFinite(item.calories) ? item.calories : 0;
    protein += Number.isFinite(item.protein) ? item.protein : 0;
    carbs += Number.isFinite(item.carbs) ? item.carbs : 0;
    fat += Number.isFinite(item.fat) ? item.fat : 0;
    if (item.fiber != null && Number.isFinite(item.fiber)) {
      fiber += item.fiber;
      sawFiber = true;
    }
  }

  const totals: AiLoggedTotals = {
    calories: Math.round(calories),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
  };
  if (sawFiber) totals.fiber = Math.round(fiber);
  return totals;
}

/**
 * Compute the average confidence across a list of AI-logged items.
 * Used for analytics payloads (`voice_log_committed.avgConfidence`).
 * Returns 0 for an empty list. Clamps each input to [0, 1].
 */
export function averageConfidence(items: readonly AiLoggedItem[]): number {
  if (!items.length) return 0;
  let total = 0;
  let count = 0;
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const c = Number.isFinite(item.confidence) ? item.confidence : 0;
    total += Math.min(1, Math.max(0, c));
    count += 1;
  }
  if (count === 0) return 0;
  return Math.round((total / count) * 100) / 100;
}

/**
 * Validate and normalise a raw item returned by `/api/nutrition/voice-log`
 * or `/api/nutrition/photo-log`. Returns `null` if any required field
 * is missing or malformed; the caller should drop null items before
 * rendering the review list (never silently substitute zeros).
 *
 * Accepts the existing server shape (`{ quantity: string, calories,
 * protein, carbs, fat, confidence?, source? }`) so UI consumers don't
 * need to touch the API contract.
 */
export function sanitiseAiItem(
  raw: unknown,
  source: AiLoggingSource,
): AiLoggedItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const name = typeof r.name === "string" ? r.name.trim() : "";
  if (!name) return null;

  const calories = finiteNumber(r.calories);
  const protein = finiteNumber(r.protein);
  const carbs = finiteNumber(r.carbs);
  const fat = finiteNumber(r.fat);
  // Macros must be finite numbers (>= 0); reject negative or non-numeric.
  if (
    calories === null ||
    protein === null ||
    carbs === null ||
    fat === null ||
    calories < 0 ||
    protein < 0 ||
    carbs < 0 ||
    fat < 0
  ) {
    return null;
  }

  const fiberRaw = finiteNumber(r.fiber);
  const fiber = fiberRaw != null && fiberRaw >= 0 ? fiberRaw : undefined;

  // Confidence: clamp NaN / out-of-range to 0 so low-confidence UI wins.
  const confidenceRaw = Number(r.confidence);
  const confidence = Number.isFinite(confidenceRaw)
    ? Math.min(1, Math.max(0, confidenceRaw))
    : 0;

  const item: AiLoggedItem = {
    name,
    calories: Math.round(calories),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
    confidence,
    source,
  };

  if (fiber !== undefined) item.fiber = Math.round(fiber);

  // Optional structured quantity / unit / grams — keep if sane, drop otherwise.
  const qty = finiteNumber(r.quantity);
  if (qty !== null && qty > 0) item.quantity = qty;
  if (typeof r.unit === "string" && r.unit.trim()) item.unit = r.unit.trim();
  const grams = finiteNumber(r.grams);
  if (grams !== null && grams > 0) item.grams = grams;

  // Server may send `quantity` as a free-text string like "2 large".
  // Preserve it as `unit` only when the numeric parse failed, so the
  // review UI can still render it. Never treat it as a number.
  if (item.quantity == null && typeof r.quantity === "string") {
    const trimmed = r.quantity.trim();
    if (trimmed && !item.unit) item.unit = trimmed;
  }

  return item;
}

/**
 * Bulk sanitise, dropping nulls. Convenience for UI code.
 */
export function sanitiseAiItems(
  raw: unknown,
  source: AiLoggingSource,
): AiLoggedItem[] {
  if (!Array.isArray(raw)) return [];
  const out: AiLoggedItem[] = [];
  for (const r of raw) {
    const item = sanitiseAiItem(r, source);
    if (item) out.push(item);
  }
  return out;
}

function finiteNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Detect whether the user's reviewed item meaningfully diverges from
 * the original AI suggestion. Returns true when the name changed
 * (case-insensitive trimmed) OR any macro differs by more than the
 * rounding noise floor (2 kcal / 0.5 g). Used by the photo-log
 * commit path to decide whether to persist the row to the user's
 * personal food bank — round-tripping the AI's own values would
 * pollute the bank with no learning, and would mean every photo log
 * grows the bank by N rows even when the user accepted everything.
 *
 * The 2 kcal / 0.5 g thresholds match the smallest practical edit a
 * user can make through the macro inputs (which round to whole kcal
 * and 1 dp grams) — anything tighter is rounding noise.
 */
export function isMeaningfulPhotoCorrection(
  original: Pick<AiLoggedItem, "name" | "calories" | "protein" | "carbs" | "fat" | "fiber">,
  corrected: Pick<AiLoggedItem, "name" | "calories" | "protein" | "carbs" | "fat" | "fiber">,
): boolean {
  const a = String(original.name ?? "").trim().toLowerCase();
  const b = String(corrected.name ?? "").trim().toLowerCase();
  if (a !== b) return true;
  if (Math.abs((corrected.calories ?? 0) - (original.calories ?? 0)) > 2) return true;
  if (Math.abs((corrected.protein ?? 0) - (original.protein ?? 0)) > 0.5) return true;
  if (Math.abs((corrected.carbs ?? 0) - (original.carbs ?? 0)) > 0.5) return true;
  if (Math.abs((corrected.fat ?? 0) - (original.fat ?? 0)) > 0.5) return true;
  const oFiber = original.fiber;
  const cFiber = corrected.fiber;
  if (oFiber == null && cFiber == null) return false;
  if (oFiber == null || cFiber == null) return true;
  if (Math.abs(cFiber - oFiber) > 0.5) return true;
  return false;
}
