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
  /**
   * Optional explicit lower bound on the calorie midpoint reported by
   * the server. When present (and >= 1 kcal lower than `calories`),
   * `rangeFor` returns `{ low, high }` directly; otherwise the helper
   * derives a band from the confidence tier (see `rangeFor` doc).
   *
   * NOTE 2026-05-02: the photo-log API currently returns only a point
   * estimate for `calories`. The bands are derived from confidence
   * tiers as a deliberate placeholder until `nutrition-engine` ships
   * real per-item variance metrics. See
   * `docs/decisions/2026-05-02-photo-log-confidence-framing.md`.
   */
  caloriesLow?: number;
  /** Optional explicit upper bound on the calorie midpoint. See `caloriesLow`. */
  caloriesHigh?: number;
  /**
   * Verification flag. Set to `true` after the user matches the item
   * against the verified database (USDA / Open Food Facts) — the row
   * is then logged with full-confidence chrome and the range caption
   * drops. Edit-without-verify must NOT auto-set this.
   */
  verified?: boolean;
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
 * The midpoint calorie value to display as the headline number for an
 * AI-logged item or a plate aggregate. Currently this is just the
 * stored `calories` field — but callers MUST go through this helper
 * (rather than reading `.calories` directly) so that, when the
 * `nutrition-engine` follow-up lands a true mean-of-distribution per
 * item, every photo-log surface picks up the upgrade in lock-step.
 *
 * Returns 0 for non-finite inputs (matches `aggregateTotals`).
 */
export function midpoint(item: Pick<AiLoggedItem, "calories">): number {
  const c = Number.isFinite(item.calories) ? item.calories : 0;
  return Math.round(c);
}

/**
 * Compute a `{ low, high }` calorie range to render under the midpoint
 * as the "Range 780–960 · medium confidence" caption.
 *
 * Resolution order:
 *  1. If the API returned explicit `caloriesLow` / `caloriesHigh`
 *     bounds (and `low <= mid <= high`, both finite, both > 0), use
 *     them verbatim — the server is the authority.
 *  2. Otherwise derive a placeholder band from the confidence tier:
 *       - high   (>=0.75) → ±5%
 *       - medium (>=0.5)  → ±12%
 *       - low    (<0.5)   → ±20%
 *
 * The derived bands are a deliberate placeholder per the 2026-05-02
 * decision doc. `nutrition-engine` owns the follow-up to replace this
 * with real per-item variance.
 *
 * Both endpoints are rounded to whole kcal. `low` is floored to 0 so
 * a negative low never appears in the UI.
 */
export function rangeFor(
  item: Pick<AiLoggedItem, "calories" | "confidence" | "caloriesLow" | "caloriesHigh">,
): { low: number; high: number } {
  const mid = midpoint(item);

  const explicitLow = Number.isFinite(item.caloriesLow) ? Number(item.caloriesLow) : null;
  const explicitHigh = Number.isFinite(item.caloriesHigh) ? Number(item.caloriesHigh) : null;
  if (
    explicitLow != null &&
    explicitHigh != null &&
    explicitLow >= 0 &&
    explicitHigh >= explicitLow &&
    explicitLow <= mid &&
    explicitHigh >= mid
  ) {
    return {
      low: Math.max(0, Math.round(explicitLow)),
      high: Math.max(0, Math.round(explicitHigh)),
    };
  }

  // Placeholder band derivation — keep in sync with `aiLogging.test.ts`
  // and the decision doc. Symmetrical around the midpoint.
  let pct: number;
  const level = classifyConfidence(item.confidence);
  if (level === "high") pct = 0.05;
  else if (level === "medium") pct = 0.12;
  else pct = 0.2;

  const low = Math.max(0, Math.round(mid * (1 - pct)));
  const high = Math.max(low, Math.round(mid * (1 + pct)));
  return { low, high };
}

/**
 * Aggregate `rangeFor` across a list of items to produce a plate-level
 * range. Sums lower bounds and upper bounds independently, returning
 * the rounded { low, high } pair the plate hero card displays under
 * the midpoint.
 *
 * Empty input returns `{ low: 0, high: 0 }` — callers should suppress
 * the range caption when both endpoints are 0.
 */
export function aggregateRange(items: readonly AiLoggedItem[]): { low: number; high: number } {
  let low = 0;
  let high = 0;
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const r = rangeFor(item);
    low += r.low;
    high += r.high;
  }
  return { low: Math.round(low), high: Math.round(high) };
}

/**
 * Plate-level confidence tier. Returns the lowest tier across items
 * (any low → low, any medium → medium, else high). An empty list is
 * treated as low — there's nothing to be confident about.
 *
 * Used by the plate hero card meter and the "medium confidence"
 * caption suffix.
 */
export function plateConfidence(items: readonly AiLoggedItem[]): ConfidenceLevel {
  if (!items.length) return "low";
  let sawMedium = false;
  for (const item of items) {
    const level = classifyConfidence(item.confidence);
    if (level === "low") return "low";
    if (level === "medium") sawMedium = true;
  }
  return sawMedium ? "medium" : "high";
}

/**
 * Tri-state save-button copy for the photo-log review footer. Pinned
 * by `tests/unit/photoLogSaveCopy.test.ts`.
 *
 *  - all items verified            → "Log verified"
 *  - some verified, some not       → "Log meal"     + subcaption "K of N verified"
 *  - none verified (or empty list) → "Log estimate"
 */
export type PhotoLogSaveCopy = {
  primary: "Log verified" | "Log meal" | "Log estimate";
  subcaption?: string;
};

export function photoLogSaveCopy(items: readonly AiLoggedItem[]): PhotoLogSaveCopy {
  if (!items.length) return { primary: "Log estimate" };
  let verified = 0;
  for (const item of items) {
    if (item?.verified === true) verified += 1;
  }
  if (verified === 0) return { primary: "Log estimate" };
  if (verified === items.length) return { primary: "Log verified" };
  return {
    primary: "Log meal",
    subcaption: `${verified} of ${items.length} verified`,
  };
}
