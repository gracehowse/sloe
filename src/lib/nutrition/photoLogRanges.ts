/**
 * Photo-log range schema (2026-05-01 — re-architecture per Grace's
 * "ChatGPT-grade itemized breakdown" brief).
 *
 * Replaces the previous `verifyIngredients`-pinned response shape that
 * blanket-failed (502 `verify_failed` / 422 `no_food_detected`) the
 * moment any single item couldn't be matched against USDA / OFF /
 * FatSecret. The new shape is honest about vision uncertainty: the
 * model returns kcal RANGES per item, grouped by macro role, with
 * optional add-on suggestions (e.g. "add wine: +120-150 kcal") and
 * a plate total range.
 *
 * Pure, platform-agnostic. The API route (`app/api/nutrition/photo-log/route.ts`)
 * imports the parser; mobile (`apps/mobile/components/PhotoLogSheet.tsx`)
 * and web (`src/app/components/suppr/photo-log-dialog.tsx`) import the
 * types and `groupItemsByCategory`.
 *
 * See `docs/decisions/2026-05-01-photo-log-rangefirst.md` for the
 * "why" and the explicit target output Grace pinned.
 */

import {
  type AiLoggedItem,
  AI_PHOTO_SOURCE,
} from "./aiLogging";
import { checkItemMacroConsistency } from "./macroPlausibility";

/** Inclusive low/high kcal (or macro-gram) range. low <= high. */
export type Range = { low: number; high: number };

/** A single photo-logged item with kcal range, optional macro ranges,
 *  and a verbal portion hint (e.g. "~40-50g", "1 piece"). */
export type PhotoLogItemRanged = {
  /** Stable id so the client can edit / remove / verify a row by reference. */
  id: string;
  /** Display name — e.g. "Pita", "Half egg", "Cheese". */
  name: string;
  /** Verbal portion hint — e.g. "~40-50g", "1 piece", "1/2 cup".
   *  Free-text from the model; never parsed for math. May be omitted. */
  quantityHint?: string;
  /** Kcal range. Wider range -> lower confidence. */
  calories: Range;
  /** Optional macro ranges. `null` when the model declines to estimate. */
  protein?: Range | null;
  carbs?: Range | null;
  fat?: Range | null;
  /** Vision confidence bucket — derived from range tightness or model
   *  signal. Not a 0-1 score (those collapse to point estimates in
   *  user perception). */
  confidence: "high" | "medium" | "low";
  /** Macro-role grouping label. Model picks from a default set
   *  ("Bread + dips", "Protein + fats", "Extras", "Drinks", "Sweets")
   *  or supplies its own when the plate calls for it (e.g. "Pasta + sauce"). */
  category: string;
  /** Always `"ai"` at the API boundary. The optional client-side
   *  per-item "Verify with database" flow swaps this row to a
   *  USDA / OFF / FatSecret-matched single-number row before commit. */
  source: "ai";
  /**
   * ENG-1421 — soft plausibility flag. `true` when the item's own kcal and
   * macros fail a scale-invariant Atwater self-consistency check (the model
   * contradicted itself). The item is NEVER dropped — its confidence is
   * downgraded to "low" so the existing amber "verify before logging"
   * treatment fires, and `plausibilityReason` is surfaced for optional
   * display. Absent = passed, or the model gave no macros to cross-check.
   */
  implausible?: boolean;
  plausibilityReason?: "atwater_mismatch" | "single_macro_only" | null;
};

/** Suggested add-on the photo doesn't show — "a glass of wine with
 *  this charcuterie", "a bun for this burger". The client renders
 *  these as opt-in chips below the item list. */
export type PhotoLogAddon = {
  id: string;
  name: string;
  /** Conditional hint — "if you're also having wine". Optional. */
  hint?: string;
  calories: Range;
};

/** The successful response shape returned by `/api/nutrition/photo-log`. */
export type PhotoLogRangedResponse = {
  ok: true;
  /** Items in the model's preferred grouping order. The client groups
   *  by `category` for rendering; preserve order within group. */
  items: PhotoLogItemRanged[];
  /** Optional add-on suggestions. May be omitted or empty. */
  addons?: PhotoLogAddon[];
  /** Sum of all `items[].calories` ranges. */
  totalKcal: Range;
  /** Hint of upper bound when the user adds every suggested addon. */
  totalKcalWithAddons?: Range;
  /** Free-text caveats from the model — "dressing not visible — likely +30-50 kcal". */
  notes?: string;
  /** Model identifier for debugging / drift detection. */
  modelVersion: string;
  /**
   * 2026-05-02 — free-taster quota signal. `null` for Pro (uncapped
   * at the user-visible level); a non-negative integer for Free +
   * Base, representing the number of free photo logs left in the
   * current rolling-7-day window after this successful call. Optional
   * because the parser populates the rest of the shape — the route
   * adds this field after parse. See
   * `docs/decisions/2026-05-02-photo-log-free-taster.md`.
   */
  freeQuotaRemaining?: number | null;
};

/** Default category set the prompt instructs the model to prefer. */
export const DEFAULT_PHOTO_LOG_CATEGORIES = [
  "Bread + dips",
  "Protein + fats",
  "Extras",
  "Drinks",
  "Sweets",
] as const;

/** Parse outcome — discriminates between "structurally broken JSON
 *  (model regressed)" and "valid shape but no food detected (user
 *  uploaded a non-food photo)". The route maps these to distinct
 *  HTTP statuses (502 vs 422). */
export type PhotoLogParseOutcome =
  | { kind: "ok"; response: PhotoLogRangedResponse }
  | { kind: "no_items"; response: null }
  | { kind: "unparseable"; response: null };

/**
 * Parse a raw model JSON payload into a strict `PhotoLogRangedResponse`.
 * Tolerant of the variations the model produces in practice:
 *  - Numbers as strings ("120", "120.5") — coerce to number.
 *  - Single-number kcal field ("calories": 120) — promote to {low:120,high:120}.
 *  - Missing `protein` / `carbs` / `fat` — emit as `null`.
 *  - Missing or non-array `addons` — drop the field.
 *  - Missing `totalKcal` — compute from `items[].calories`.
 *  - Items with non-finite or negative kcal — drop the item.
 *  - Items missing `category` — default to "Other".
 *  - Items missing `id` — generate `ai-${index}`.
 *
 * The parser NEVER widens or invents kcal values silently — if a row
 * has only one kcal number, `low === high`, signalling a point
 * estimate to the UI (it can render `~120 kcal` instead of `~120-120`).
 */
export function parsePhotoLogRangedResponse(
  raw: unknown,
  modelVersion: string,
): PhotoLogParseOutcome {
  if (!raw || typeof raw !== "object") {
    return { kind: "unparseable", response: null };
  }
  const r = raw as Record<string, unknown>;

  const itemsRaw = Array.isArray(r.items) ? r.items : null;
  if (!itemsRaw) {
    // Missing or non-array `items` is a model schema regression — the
    // route signals model_unparseable (502).
    return { kind: "unparseable", response: null };
  }

  const items: PhotoLogItemRanged[] = [];
  for (let i = 0; i < itemsRaw.length; i += 1) {
    const parsed = parseItem(itemsRaw[i], i);
    if (parsed) items.push(parsed);
  }
  if (items.length === 0) {
    // Valid shape, just no food in the photo. Route returns 422
    // no_food_detected so the user knows to try a clearer shot.
    return { kind: "no_items", response: null };
  }

  const addonsRaw = Array.isArray(r.addons) ? r.addons : null;
  const addons: PhotoLogAddon[] = [];
  if (addonsRaw) {
    for (let i = 0; i < addonsRaw.length; i += 1) {
      const a = parseAddon(addonsRaw[i], i);
      if (a) addons.push(a);
    }
  }

  // Always recompute the plate total from items so the UI never
  // disagrees with what it displays. The model is an accomplice, not
  // a source of truth, on aggregate math.
  const totalKcal = sumRanges(items.map((it) => it.calories));

  const result: PhotoLogRangedResponse = {
    ok: true,
    items,
    totalKcal,
    modelVersion,
  };
  if (addons.length > 0) {
    result.addons = addons;
    result.totalKcalWithAddons = {
      low: totalKcal.low + sumRanges(addons.map((a) => a.calories)).low,
      high: totalKcal.high + sumRanges(addons.map((a) => a.calories)).high,
    };
  }
  if (typeof r.notes === "string" && r.notes.trim()) {
    result.notes = r.notes.trim().slice(0, 400);
  }
  return { kind: "ok", response: result };
}

function parseItem(raw: unknown, index: number): PhotoLogItemRanged | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const name = typeof r.name === "string" ? r.name.trim() : "";
  if (!name) return null;

  const calories = parseRange(r.calories);
  if (!calories || calories.high <= 0) return null;

  const id = typeof r.id === "string" && r.id.trim()
    ? r.id.trim()
    : `ai-${index}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24)}`;

  const protein = parseRange(r.protein) ?? null;
  const carbs = parseRange(r.carbs) ?? null;
  const fat = parseRange(r.fat) ?? null;

  const confidence = parseConfidence(r.confidence, calories);
  const category = typeof r.category === "string" && r.category.trim()
    ? r.category.trim()
    : "Other";

  const quantityHint =
    typeof r.quantityHint === "string" && r.quantityHint.trim()
      ? r.quantityHint.trim()
      : typeof r.quantity_hint === "string" && (r.quantity_hint as string).trim()
        ? (r.quantity_hint as string).trim()
        : undefined;

  const item: PhotoLogItemRanged = {
    id,
    name,
    calories,
    protein,
    carbs,
    fat,
    confidence,
    category,
    source: "ai",
  };

  // ENG-1421 — soft plausibility gate on the only previously-ungated AI
  // logging path. Cross-check the item's own kcal against its macros (Atwater,
  // at range midpoints). On failure, flag it and drop to "low" confidence so
  // the existing amber verify-before-logging treatment fires — never drop the
  // row (the user may still want to log it after a look).
  const consistency = checkItemMacroConsistency({
    calories: rangeMidpoint(calories),
    protein: protein ? rangeMidpoint(protein) : 0,
    carbs: carbs ? rangeMidpoint(carbs) : 0,
    fat: fat ? rangeMidpoint(fat) : 0,
  });
  if (!consistency.ok) {
    item.implausible = true;
    item.plausibilityReason = consistency.reason;
    item.confidence = "low";
  }

  if (quantityHint) item.quantityHint = quantityHint;
  return item;
}

function parseAddon(raw: unknown, index: number): PhotoLogAddon | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === "string" ? r.name.trim() : "";
  if (!name) return null;
  const calories = parseRange(r.calories);
  if (!calories || calories.high <= 0) return null;
  const id = typeof r.id === "string" && r.id.trim()
    ? r.id.trim()
    : `addon-${index}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24)}`;
  const addon: PhotoLogAddon = { id, name, calories };
  if (typeof r.hint === "string" && r.hint.trim()) {
    addon.hint = r.hint.trim().slice(0, 120);
  }
  return addon;
}

/**
 * Parse a single field that may be either a number, a string number,
 * or a `{low, high}` object. Returns `null` if neither extracts a
 * sane non-negative number.
 *
 *   42                  -> { low: 42, high: 42 }
 *   "42"                -> { low: 42, high: 42 }
 *   { low: 40, high: 50 } -> { low: 40, high: 50 }
 *   { low: "40", high: "50" } -> { low: 40, high: 50 }
 *   { low: 50, high: 40 } -> { low: 40, high: 50 } (swap)
 *   null / undefined / NaN / negative -> null
 */
export function parseRange(raw: unknown): Range | null {
  if (raw == null) return null;
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw < 0) return null;
    return { low: raw, high: raw };
  }
  if (typeof raw === "string") {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return null;
    return { low: n, high: n };
  }
  if (typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const lowN = toFiniteNonNegative(r.low ?? r.min);
  const highN = toFiniteNonNegative(r.high ?? r.max);
  if (lowN == null && highN == null) return null;
  // If only one bound provided, mirror it.
  const lo = lowN ?? highN!;
  const hi = highN ?? lowN!;
  return lo <= hi ? { low: lo, high: hi } : { low: hi, high: lo };
}

function toFiniteNonNegative(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Derive a confidence bucket from the model's stated confidence (if
 * provided) OR from range tightness. Tight range (<= 15% of midpoint)
 * is high; medium (<= 35%); else low. Mirrors the rule the prompt
 * teaches the model.
 */
function parseConfidence(raw: unknown, calories: Range): "high" | "medium" | "low" {
  if (typeof raw === "string") {
    const v = raw.trim().toLowerCase();
    if (v === "high" || v === "medium" || v === "low") return v;
  }
  const mid = (calories.low + calories.high) / 2;
  if (mid <= 0) return "low";
  const spread = (calories.high - calories.low) / mid;
  if (spread <= 0.15) return "high";
  if (spread <= 0.35) return "medium";
  return "low";
}

/** Sum a list of ranges. Empty list -> {low:0,high:0}. */
export function sumRanges(ranges: readonly Range[]): Range {
  let low = 0;
  let high = 0;
  for (const r of ranges) {
    if (!r) continue;
    if (Number.isFinite(r.low)) low += r.low;
    if (Number.isFinite(r.high)) high += r.high;
  }
  // Round to integers — kcal aren't displayed sub-unit anywhere.
  return { low: Math.round(low), high: Math.round(high) };
}

/** Midpoint, rounded. Used when projecting a range row into the
 *  existing single-number `meal_logs.calories` column at commit time. */
export function rangeMidpoint(r: Range): number {
  return Math.round((r.low + r.high) / 2);
}

/** Format a range as Grace's screenshot pattern — "~120-150" or
 *  "~120" when low === high. Uses an en-dash so the text matches
 *  exactly. */
export function formatRange(r: Range): string {
  if (r.low === r.high) return `~${Math.round(r.low)}`;
  return `~${Math.round(r.low)}–${Math.round(r.high)}`;
}

/** Format a range as "kcal" suffixed — "~120-150 kcal". */
export function formatRangeKcal(r: Range): string {
  return `${formatRange(r)} kcal`;
}

/** Group items into ordered categories. Preserves the model's group
 *  order — first item's category drives that group's first appearance.
 *  Within a group, items keep insertion order. */
export function groupItemsByCategory(
  items: readonly PhotoLogItemRanged[],
): Array<{ category: string; items: PhotoLogItemRanged[] }> {
  const order: string[] = [];
  const map = new Map<string, PhotoLogItemRanged[]>();
  for (const item of items) {
    if (!map.has(item.category)) {
      order.push(item.category);
      map.set(item.category, []);
    }
    map.get(item.category)!.push(item);
  }
  return order.map((c) => ({ category: c, items: map.get(c)! }));
}

/**
 * Project a `PhotoLogItemRanged` to the `AiLoggedItem` shape used by
 * the journal commit pipeline (web `commitAiLoggedItems` + mobile's
 * equivalent). Calories collapse to the range MIDPOINT; macros do
 * the same when present, otherwise default to 0 (the existing
 * pipeline contract requires a finite number).
 *
 * The full range is preserved on the optional `range` field so the
 * client can still render the original ~LOW-HIGH banner after commit
 * (and so analytics or future plate-summary code can reflect
 * uncertainty rather than the lossy midpoint).
 *
 * Confidence buckets project to the existing 0-1 scale:
 *   high   -> 0.9
 *   medium -> 0.65
 *   low    -> 0.35
 * which keeps the existing `LOW_CONFIDENCE_THRESHOLD` (0.5) wall
 * intact — low-bucket items still trigger the amber "verify before
 * logging" UI.
 */
export function rangedItemToLogged(item: PhotoLogItemRanged): AiLoggedItem & {
  range: { calories: Range; protein: Range | null; carbs: Range | null; fat: Range | null };
  category: string;
  quantityHint?: string;
} {
  const cConfidence =
    item.confidence === "high" ? 0.9 : item.confidence === "medium" ? 0.65 : 0.35;
  const out: AiLoggedItem & {
    range: { calories: Range; protein: Range | null; carbs: Range | null; fat: Range | null };
    category: string;
    quantityHint?: string;
  } = {
    name: item.name,
    calories: rangeMidpoint(item.calories),
    protein: item.protein ? rangeMidpoint(item.protein) : 0,
    carbs: item.carbs ? rangeMidpoint(item.carbs) : 0,
    fat: item.fat ? rangeMidpoint(item.fat) : 0,
    confidence: cConfidence,
    source: "ai_photo",
    range: {
      calories: item.calories,
      protein: item.protein ?? null,
      carbs: item.carbs ?? null,
      fat: item.fat ?? null,
    },
    category: item.category,
  };
  if (item.quantityHint) {
    out.unit = item.quantityHint;
    out.quantityHint = item.quantityHint;
  }
  return out;
}

/** Tag for display when the item ships as ai-estimated rather than
 *  database-verified (hands the existing journal pipeline a stable
 *  source string). */
export const PHOTO_LOG_AI_SOURCE_LABEL = AI_PHOTO_SOURCE;
