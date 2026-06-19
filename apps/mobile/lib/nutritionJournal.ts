/** Micronutrients from Health import or rich logging (sugarG, sodiumMg, vitamins, minerals, …). */
export type NutritionMicrosMap = Record<string, number>;

/** Matches web `LoggedMeal` / `nutrition_journals.by_day` JSON shape. */
export type JournalMeal = {
  id: string;
  name: string;
  recipeTitle: string;
  time: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  portionMultiplier?: number;
  fiberG?: number;
  waterMl?: number;
  micros?: NutritionMicrosMap | null;
  /** Provenance for nutrition confidence UI (matches web `LoggedMeal.source`). */
  source?: string | null;
  /** ISO from `nutrition_entries.created_at` when loaded (optional timestamps in UI). */
  createdAt?: string | null;
  /** ENG-772 — consumption instant (`nutrition_entries.eaten_at`). */
  eatenAt?: string | null;
  /**
   * Schema refactor Phase 2 (2026-05-11) — typed FK to `recipes.id`.
   * Mirrors web's `LoggedMeal.recipeId`. Populated for recipe-detail
   * + planner-log paths where the recipe id is in scope; left
   * undefined for Health-import / manual / barcode-only logs.
   */
  recipeId?: string;
  recipeImageUrl?: string | null;
  imageUrl?: string | null;
};

/** One journal slot for all snacks; migrate legacy DB value `Snack` → `Snacks`. */
export function normalizeJournalSlotName(raw: string | null | undefined): string {
  const n = String(raw ?? "").trim();
  return n === "Snack" ? "Snacks" : n;
}

export type ByDay = Record<string, JournalMeal[]>;

/** Normalize `nutrition_micros` JSONB from Supabase into a number map. */
export function parseNutritionMicrosJson(raw: unknown): NutritionMicrosMap | undefined {
  if (raw == null) return undefined;
  if (typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const out: NutritionMicrosMap = {};
  for (const [k, v] of Object.entries(o)) {
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n) && n !== 0) out[k] = n;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

// ENG-717 — single source of truth for the local-calendar date key lives
// in `src/lib/datetime/dateKey` (shared with web). Re-exported via the
// `@suppr/shared` alias so existing `from "./nutritionJournal"` importers
// stay unchanged.
export { dateKeyFromDate } from "@suppr/shared/datetime/dateKey";

export function newMealId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}
