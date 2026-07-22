/**
 * ENG-1642 — meal share links (MFP-parity "share a meal").
 *
 * Wire format + pure serialization for the `meal_shares` snapshot loop: the
 * sharer serializes ONE logged meal (web `LoggedMeal` / mobile `JournalMeal`
 * — deliberately parallel shapes) into snake_case wire items matching the
 * `create_meal_share` RPC whitelist; recipients parse `get_meal_share`
 * payloads and re-materialize loggable meals anchored to THEIR chosen
 * day + slot. `eatenAt` is deliberately never carried — the recipient's row
 * anchors purely on the target `date_key` (ENG-1107 lesson: a carried
 * source-day instant silently re-buckets the entry).
 *
 * Privacy pin (ENG-25): items carry meal nutrition only — never targets,
 * day budget, or identity. `shared_by` is a live display name resolved
 * server-side (ENG-154 — never snapshotted).
 *
 * Keep in sync with the item whitelist in
 * `supabase/migrations/20260722090000_eng1642_meal_share_links.sql`.
 * Shared web + mobile (mobile imports via `@suppr/shared/share/mealShareLink`).
 */

/** Kill-switch flag: off → exact pre-ENG-1642 text-only share behaviour. */
export const MEAL_SHARE_FLAG = "meal_share_links_v1";

/** localStorage key for the signed-out landing → post-auth resume handoff. */
export const MEAL_SHARE_STORAGE_KEY = "suppr.pending_meal_share";

export type MealShareStatus = "ok" | "invalid" | "expired" | "revoked";

export type MealShareItem = {
  recipeTitle: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG?: number;
  waterMl?: number;
  portionMultiplier?: number;
  nutritionMicros?: Record<string, number>;
  source?: string;
  recipeId?: string;
};

export type MealSharePayload = {
  title: string;
  mealSlot: string;
  items: MealShareItem[];
  sharedBy: string | null;
  createdAt: string | null;
};

export type MealShareLookup =
  | { status: "ok"; payload: MealSharePayload }
  | { status: Exclude<MealShareStatus, "ok"> };

/** Meal fields the serializer reads — the LoggedMeal/JournalMeal common core. */
export type ShareableLoggedMeal = {
  recipeTitle: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG?: number | null;
  waterMl?: number | null;
  portionMultiplier?: number | null;
  micros?: Record<string, number> | null;
  source?: string | null;
  recipeId?: string | null;
};

/**
 * Loggable shape a recipient's accept flow feeds into the platform insert
 * path (`Omit<LoggedMeal, "id">` on web / pre-`newMealId()` `JournalMeal` on
 * mobile). No `eatenAt` on purpose — see module doc.
 */
export type LoggableSharedMeal = {
  name: string;
  recipeTitle: string;
  time: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG?: number;
  waterMl?: number;
  portionMultiplier?: number;
  micros?: Record<string, number>;
  source?: string;
  recipeId?: string;
};

const isFiniteNumber = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

/** Mirrors the SQL whitelist's per-micro bound — keep the two in sync. */
const MICRO_VALUE_MAX = 100000;

const finiteMicros = (
  raw: unknown,
): Record<string, number> | undefined => {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return undefined;
  }
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (isFiniteNumber(value) && value >= 0 && value <= MICRO_VALUE_MAX) {
      out[key] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
};

/**
 * Serialize one logged meal into the snake_case wire item the
 * `create_meal_share` RPC whitelist accepts. Non-finite numbers and empty
 * strings are dropped rather than sent (the RPC would reject them anyway).
 */
export function mealToShareItem(
  meal: ShareableLoggedMeal,
): Record<string, unknown> | null {
  const recipeTitle = (meal.recipeTitle ?? "").trim();
  if (
    !recipeTitle ||
    !isFiniteNumber(meal.calories) ||
    !isFiniteNumber(meal.protein) ||
    !isFiniteNumber(meal.carbs) ||
    !isFiniteNumber(meal.fat)
  ) {
    return null;
  }
  const item: Record<string, unknown> = {
    recipe_title: recipeTitle.slice(0, 200),
    calories: meal.calories,
    protein: meal.protein,
    carbs: meal.carbs,
    fat: meal.fat,
  };
  if (isFiniteNumber(meal.fiberG)) item.fiber_g = meal.fiberG;
  if (isFiniteNumber(meal.waterMl)) item.water_ml = meal.waterMl;
  if (isFiniteNumber(meal.portionMultiplier) && meal.portionMultiplier > 0) {
    item.portion_multiplier = meal.portionMultiplier;
  }
  const micros = finiteMicros(meal.micros);
  if (micros) item.nutrition_micros = micros;
  const source = (meal.source ?? "").trim();
  if (source) item.source = source.slice(0, 40);
  const recipeId = (meal.recipeId ?? "").trim();
  if (recipeId) item.recipe_id = recipeId;
  return item;
}

const parseWireItem = (raw: unknown): MealShareItem | null => {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const recipeTitle =
    typeof r.recipe_title === "string" ? r.recipe_title.trim() : "";
  if (
    !recipeTitle ||
    !isFiniteNumber(r.calories) ||
    !isFiniteNumber(r.protein) ||
    !isFiniteNumber(r.carbs) ||
    !isFiniteNumber(r.fat)
  ) {
    return null;
  }
  const item: MealShareItem = {
    recipeTitle,
    calories: r.calories,
    protein: r.protein,
    carbs: r.carbs,
    fat: r.fat,
  };
  if (isFiniteNumber(r.fiber_g)) item.fiberG = r.fiber_g;
  if (isFiniteNumber(r.water_ml)) item.waterMl = r.water_ml;
  if (isFiniteNumber(r.portion_multiplier) && r.portion_multiplier > 0) {
    item.portionMultiplier = r.portion_multiplier;
  }
  const micros = finiteMicros(r.nutrition_micros);
  if (micros) item.nutritionMicros = micros;
  if (typeof r.source === "string" && r.source.trim()) {
    item.source = r.source.trim();
  }
  if (typeof r.recipe_id === "string" && r.recipe_id.trim()) {
    item.recipeId = r.recipe_id.trim();
  }
  return item;
};

/**
 * Parse a `get_meal_share` RPC response (defence in depth — the RPC already
 * whitelist-rebuilds items, but the client never trusts the wire blindly).
 * Unknown/malformed statuses collapse to "invalid"; an "ok" payload with
 * zero parseable items also collapses to "invalid".
 */
export function parseMealShareLookup(data: unknown): MealShareLookup {
  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    return { status: "invalid" };
  }
  const r = data as Record<string, unknown>;
  const status = typeof r.status === "string" ? r.status : "invalid";
  if (status === "expired" || status === "revoked") return { status };
  if (status !== "ok") return { status: "invalid" };

  const title = typeof r.title === "string" ? r.title.trim() : "";
  const mealSlot = typeof r.meal_slot === "string" ? r.meal_slot : "";
  const rawItems = Array.isArray(r.items) ? r.items : [];
  const items = rawItems
    .map(parseWireItem)
    .filter((i): i is MealShareItem => i !== null);
  if (!title || !mealSlot || items.length === 0) {
    return { status: "invalid" };
  }
  return {
    status: "ok",
    payload: {
      title,
      mealSlot,
      items,
      sharedBy:
        typeof r.shared_by === "string" && r.shared_by.trim()
          ? r.shared_by.trim()
          : null,
      createdAt: typeof r.created_at === "string" ? r.created_at : null,
    },
  };
}

/**
 * Materialize a share item as a loggable meal for the recipient's chosen
 * slot. `time` is the recipient's local clock label (mirrors the saved-meal
 * re-log convention); the caller supplies it so this stays pure.
 */
export function shareItemToLoggableMeal(
  item: MealShareItem,
  slot: string,
  timeLabel: string,
): LoggableSharedMeal {
  const meal: LoggableSharedMeal = {
    name: slot,
    recipeTitle: item.recipeTitle,
    time: timeLabel,
    calories: item.calories,
    protein: item.protein,
    carbs: item.carbs,
    fat: item.fat,
  };
  if (item.fiberG !== undefined) meal.fiberG = item.fiberG;
  if (item.waterMl !== undefined) meal.waterMl = item.waterMl;
  if (item.portionMultiplier !== undefined) {
    meal.portionMultiplier = item.portionMultiplier;
  }
  if (item.nutritionMicros) meal.micros = item.nutritionMicros;
  if (item.source) meal.source = item.source;
  if (item.recipeId) meal.recipeId = item.recipeId;
  return meal;
}

/** Sum a payload's items for preview surfaces (landing card, accept sheet). */
export function mealShareTotals(items: readonly MealShareItem[]): {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
} {
  return items.reduce(
    (acc, i) => ({
      calories: acc.calories + i.calories,
      protein: acc.protein + i.protein,
      carbs: acc.carbs + i.carbs,
      fat: acc.fat + i.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

/** Mirror of the SQL-side normalisation: lowercase 32-hex or null. */
export function normaliseMealShareToken(raw: string): string | null {
  const token = raw.replace(/[^a-fA-F0-9]/g, "").toLowerCase();
  return token.length === 32 ? token : null;
}

/** Web URL that opens the share landing (share sheets / clipboard). */
export function buildMealShareUrl(token: string, origin: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/m/${encodeURIComponent(token)}`;
}
