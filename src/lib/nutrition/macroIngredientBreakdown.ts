/**
 * Macro "By ingredient" breakdown — shared web + mobile derive/scale/reconcile.
 *
 * ENG-748 #10 + ENG-751. Recipe logs derive from live recipe rows; AI/photo/voice
 * logs may carry immutable `nutrition_entry_ingredients` snapshot rows.
 *
 * For recipes, a logged `nutrition_entries` row stores `recipe_id` (FK) + `portion_multiplier`,
 * and `recipe_ingredients` rows each hold an ingredient's FULL macro contribution
 * at the recipe's base servings. So the per-ingredient contribution to a logged
 * entry is simply `recipe_ingredients[i].<macro> × entry.portion_multiplier`.
 *
 * Pure: no React, no Date, no network, no Supabase. Safe to import from a React
 * Native component (mobile) and a React Server/Client Component (web). The caller
 * does the I/O (fetch entries + a single batched `recipe_ingredients .in(recipe_id)`
 * query) and hands the rows to {@link deriveIngredientBreakdown}.
 *
 * ## Why reconcile?
 * A recipe can be edited AFTER a meal was logged (an ingredient added, removed, or
 * its macros re-verified). The logged entry's stored macro total is the source of
 * truth for what the user actually ate — but the live `recipe_ingredients` rows may
 * no longer sum to it. Showing raw scaled rows that don't add up to the entry total
 * would display nutrition the user never logged. So after scaling, we NORMALISE each
 * ingredient's contribution per-macro so the displayed rows always sum back to the
 * entry's STORED total. This keeps the breakdown nutritionally honest: the parts
 * always equal the whole the user logged.
 *
 * ## Degenerate fallback
 * Entries with no `recipeId` (single foods, AI/photo multi-item meals before ENG-751,
 * or recipes deleted after logging → `recipe_id` SET NULL), or whose recipe/snapshot
 * path has zero rows, render as a single self-named "ingredient" line carrying the
 * entry's own stored macros. We never show nothing for a logged entry.
 */

/** The macro fields this breakdown supports. Mirrors the macro-detail screen config. */
export type BreakdownMacro = "protein" | "carbs" | "fat" | "fiber" | "calories";

/**
 * Map a UI macro key to the numeric field on an ingredient/entry record.
 * Fiber is stored as `fiberG` on entries (mobile) / `fiber_g` on rows; callers
 * normalise into `fiberG` before passing in.
 */
const MACRO_FIELD: Record<BreakdownMacro, keyof BreakdownMacroValues> = {
  protein: "protein",
  carbs: "carbs",
  fat: "fat",
  fiber: "fiberG",
  calories: "calories",
};

/** Per-macro numeric bundle shared by entries and ingredient rows. */
export interface BreakdownMacroValues {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Fibre in grams. Callers normalise `fiber_g` / micros into this single field. */
  fiberG: number;
}

/**
 * A logged entry, normalised for the breakdown.
 * `storedMacros` is what the user actually logged (the source of truth we reconcile
 * to). `recipeId` is null for single foods / AI meals / deleted recipes.
 */
export interface BreakdownEntry extends BreakdownMacroValues {
  /** Stable id of the logged entry (for keying + dedupe). */
  id: string;
  /** Meal-slot label (Breakfast/Lunch/…); falls back to the entry display name. */
  name: string;
  /** Display title of what was logged (recipe title or food name). */
  recipeTitle: string;
  /** FK to the recipe; null → fallback to a single self-named line. */
  recipeId: string | null;
  /** Stored portion multiplier; defaults to 1 when null/invalid. */
  portionMultiplier: number;
}

/**
 * An ingredient row at the recipe's BASE servings (full contribution, unscaled).
 * Macro fields are the ingredient's whole contribution to the recipe at base size.
 */
export interface BreakdownIngredientRow extends BreakdownMacroValues {
  recipeId: string;
  name: string;
}

/** Immutable per-entry snapshot row, usually captured from AI/photo/voice logging. */
export interface BreakdownEntryIngredientSnapshot extends BreakdownMacroValues {
  entryId: string;
  name: string;
  /** Source confidence [0,1], preserved for trust posture when callers need it. */
  confidence?: number | null;
  /** Provenance such as "AI photo" / "AI voice". */
  source?: string | null;
}

/** One aggregated line in the rendered breakdown. */
export interface IngredientBreakdownLine {
  /** Ingredient (or food) display name; aggregation key. */
  name: string;
  /** Reconciled macro value for the active macro, summed across all contributing entries. */
  value: number;
  /**
   * True when this line is a degenerate fallback (the entry had no usable recipe
   * ingredient rows, so the line carries the entry's own stored macro). Lets the
   * UI optionally style it differently, though by default it renders identically.
   */
  isFallback: boolean;
}

export interface IngredientBreakdownResult {
  lines: IngredientBreakdownLine[];
  /** Sum of all line values for the active macro (equals the day's reconciled total). */
  total: number;
}

function macroOf(v: BreakdownMacroValues, macro: BreakdownMacro): number {
  const raw = v[MACRO_FIELD[macro]];
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function safeMultiplier(m: number): number {
  const n = Number(m);
  // A logged entry always represents a real portion; a non-positive or
  // non-finite multiplier is bad data — treat it as 1× rather than zeroing
  // the whole entry out of the breakdown.
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/**
 * Derive the per-ingredient breakdown for a single macro across a day's entries.
 *
 * For each entry:
 *  1. If it has a `recipeId` AND that recipe has ≥1 ingredient row → scale each
 *     ingredient's base-servings macro by the entry's `portionMultiplier`, then
 *     reconcile the scaled rows so they sum to the entry's STORED macro total for
 *     this macro. Reconciliation is proportional: each ingredient keeps its share
 *     of the scaled sum, rescaled to the stored total. If the scaled sum is 0 (e.g.
 *     a 0-protein recipe for the protein view) the rows contribute 0 — matching the
 *     stored 0 — and we do NOT fabricate a fallback line for a genuinely-0 macro.
 *  2. Otherwise (no recipeId, or recipe has no rows) → a single self-named fallback
 *     line carrying the entry's own stored macro value.
 *
 * Lines with the SAME name are aggregated across entries (e.g. "Olive oil" used in
 * two logged recipes sums into one line). Fallback lines aggregate by the entry's
 * display name too.
 *
 * @param entries     the day's logged entries, normalised
 * @param ingredients all base-servings ingredient rows for the day's recipes (one
 *                    batched query, keyed by recipeId)
 * @param macro       the active macro to break down
 */
export function deriveIngredientBreakdown(
  entries: BreakdownEntry[],
  ingredients: BreakdownIngredientRow[],
  macro: BreakdownMacro,
  entryIngredientSnapshots: BreakdownEntryIngredientSnapshot[] = [],
): IngredientBreakdownResult {
  // Index snapshot rows by entry first. ENG-751 snapshots are immutable logged-entry
  // children, so they win over recipe-derived rows whenever present.
  const byEntry = new Map<string, BreakdownEntryIngredientSnapshot[]>();
  for (const row of entryIngredientSnapshots) {
    if (!row.entryId) continue;
    const list = byEntry.get(row.entryId);
    if (list) list.push(row);
    else byEntry.set(row.entryId, [row]);
  }

  // Index ingredient rows by recipe so each entry resolves its rows in O(1).
  const byRecipe = new Map<string, BreakdownIngredientRow[]>();
  for (const row of ingredients) {
    if (!row.recipeId) continue;
    const list = byRecipe.get(row.recipeId);
    if (list) list.push(row);
    else byRecipe.set(row.recipeId, [row]);
  }

  // Aggregate reconciled contributions by ingredient name. Track fallback-ness so a
  // name that only ever appears as a fallback line is flagged; if a name appears both
  // as a real ingredient and a fallback (unlikely but possible) the real wins.
  const agg = new Map<string, { value: number; isFallback: boolean }>();

  const addLine = (name: string, value: number, isFallback: boolean) => {
    const key = name.trim() || "Item";
    const existing = agg.get(key);
    if (existing) {
      existing.value += value;
      existing.isFallback = existing.isFallback && isFallback;
    } else {
      agg.set(key, { value, isFallback });
    }
  };

  for (const entry of entries) {
    const storedMacro = macroOf(entry, macro);
    const snapshotRows = byEntry.get(entry.id);
    const rows = snapshotRows && snapshotRows.length > 0
      ? snapshotRows
      : entry.recipeId
        ? byRecipe.get(entry.recipeId)
        : undefined;

    // Fallback: no snapshot/recipe link, or the recipe has no ingredient rows.
    if (!rows || rows.length === 0) {
      // Only emit a fallback line if the entry actually contributes to this macro,
      // OR it's the sole representation of the entry — we still want the entry
      // visible even at 0 for the active macro so the list mirrors the by-meal view.
      addLine(entry.recipeTitle || entry.name || "Item", storedMacro, true);
      continue;
    }

    const mult = safeMultiplier(entry.portionMultiplier);
    // Scale each ingredient row by the entry's portion multiplier.
    const scaled = rows.map((r) => macroOf(r, macro) * mult);
    const scaledSum = scaled.reduce((s, v) => s + v, 0);

    if (scaledSum <= 0) {
      // The recipe's ingredients contribute 0 to this macro (after scaling). The
      // stored total should also be ~0; distribute nothing. Each ingredient row
      // still gets a 0 line so the user sees the ingredient composition even when
      // this particular macro is absent (e.g. fat view of a fat-free recipe).
      rows.forEach((r) => addLine(r.name, 0, false));
      continue;
    }

    // Reconcile: rescale each ingredient's scaled contribution so the rows sum to the
    // entry's STORED macro total (handles recipes edited after the meal was logged).
    // Proportional: row keeps its share of scaledSum, projected onto storedMacro.
    const factor = storedMacro / scaledSum;
    rows.forEach((r, i) => {
      addLine(r.name, scaled[i] * factor, false);
    });
  }

  const lines: IngredientBreakdownLine[] = Array.from(agg.entries())
    .map(([name, v]) => ({ name, value: v.value, isFallback: v.isFallback }))
    .sort((a, b) => b.value - a.value);

  const total = lines.reduce((s, l) => s + l.value, 0);
  return { lines, total };
}

/**
 * Normalise a raw `nutrition_entries` row (snake_case from Supabase) into a
 * {@link BreakdownEntry}. Shared so web + mobile build entries identically.
 * `fiberG` should already be resolved by the caller (mobile uses
 * `mealContributedFiberG`); pass the resolved grams in.
 */
export function toBreakdownEntry(input: {
  id: string;
  name?: string | null;
  recipeTitle?: string | null;
  recipeId?: string | null;
  portionMultiplier?: number | null;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  fiberG?: number | null;
}): BreakdownEntry {
  return {
    id: input.id,
    name: input.name ?? "",
    recipeTitle: input.recipeTitle ?? "",
    recipeId: input.recipeId ?? null,
    portionMultiplier: input.portionMultiplier ?? 1,
    calories: Number(input.calories) || 0,
    protein: Number(input.protein) || 0,
    carbs: Number(input.carbs) || 0,
    fat: Number(input.fat) || 0,
    fiberG: Number(input.fiberG) || 0,
  };
}

/**
 * Normalise a raw `recipe_ingredients` row (snake_case from Supabase) into a
 * {@link BreakdownIngredientRow}.
 */
export function toBreakdownEntryIngredientSnapshot(input: {
  entryId: string;
  name?: string | null;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  fiberG?: number | null;
  confidence?: number | null;
  source?: string | null;
}): BreakdownEntryIngredientSnapshot {
  return {
    entryId: input.entryId,
    name: input.name ?? "",
    calories: Number(input.calories) || 0,
    protein: Number(input.protein) || 0,
    carbs: Number(input.carbs) || 0,
    fat: Number(input.fat) || 0,
    fiberG: Number(input.fiberG) || 0,
    confidence: input.confidence ?? null,
    source: input.source ?? null,
  };
}

export function toBreakdownIngredientRow(input: {
  recipeId: string;
  name?: string | null;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  fiberG?: number | null;
}): BreakdownIngredientRow {
  return {
    recipeId: input.recipeId,
    name: input.name ?? "",
    calories: Number(input.calories) || 0,
    protein: Number(input.protein) || 0,
    carbs: Number(input.carbs) || 0,
    fat: Number(input.fat) || 0,
    fiberG: Number(input.fiberG) || 0,
  };
}
