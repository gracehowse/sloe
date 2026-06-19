/**
 * Macro "By ingredient" breakdown — shared web + mobile derive/scale/reconcile.
 *
 * ENG-748 #10. Per the data-integrity DERIVE verdict (no schema change):
 * a logged `nutrition_entries` row stores `recipe_id` (FK) + `portion_multiplier`,
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
 * Entries with no `recipeId` (single foods, AI/photo multi-item meals, or recipes
 * deleted after logging → `recipe_id` SET NULL), or whose recipe has zero ingredient
 * rows, render as a single self-named "ingredient" line carrying the entry's own
 * stored macros. We never show nothing for a logged entry.
 *
 * ## AI/photo/voice snapshot path (ENG-751)
 * AI/photo/voice meals carry their item breakdown only in the unpersisted AI
 * response — there is no `recipe_id`. ENG-751 persists that breakdown into a
 * `nutrition_entry_ingredients` snapshot child table at commit time. When an
 * entry has snapshot rows AND the caller opts in (`preferSnapshot`, gated by the
 * `nutrition_entry_ingredients_v1` display flag), those rows take precedence over
 * BOTH the recipe-derived path and the single-line fallback: the entry splits
 * into one line per snapshot item, reconciled to the entry's stored total exactly
 * like the recipe path. Recipes keep the recipe-derived path; entries with neither
 * snapshot rows nor recipe rows keep the single self-named fallback line.
 * See {@link ./nutritionEntryIngredients}.
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

/**
 * A persisted AI/photo/voice snapshot item (ENG-751), normalised for the
 * breakdown. `entryId` links it to its parent {@link BreakdownEntry}; its macro
 * fields are the item's OWN contribution (already at the logged portion — the
 * snapshot is captured post-scale, so there is no portion multiplier to apply).
 * `lowConfidence` lets the read path flag the line without re-deriving from the
 * raw confidence float.
 */
export interface BreakdownSnapshotRow extends BreakdownMacroValues {
  entryId: string;
  name: string;
  lowConfidence: boolean;
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
  /**
   * True when this line came from a low-confidence AI snapshot item (ENG-751).
   * The UI flags it ("estimated — low confidence") rather than dropping it, per
   * the trust posture. Recipe-derived and fallback lines are never low-confidence.
   */
  lowConfidence: boolean;
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
 * ## Snapshot precedence (ENG-751)
 * When `options.preferSnapshot` is set AND an entry has ≥1 snapshot row, those
 * rows take precedence over the recipe path and the fallback for that entry: it
 * splits into one line per snapshot item, reconciled to the entry's stored total
 * (so the parts still equal the logged whole, even if the snapshot was rounded
 * differently at commit). Each line carries `lowConfidence` from its source item.
 * `preferSnapshot` is the display-flag gate — OFF restores today's behaviour
 * (recipe path / single-line fallback) even when snapshot rows exist, so the data
 * can backfill while dark.
 *
 * @param entries     the day's logged entries, normalised
 * @param ingredients all base-servings ingredient rows for the day's recipes (one
 *                    batched query, keyed by recipeId)
 * @param macro       the active macro to break down
 * @param options     `snapshots`: persisted AI snapshot rows keyed by entryId;
 *                    `preferSnapshot`: gate (the `nutrition_entry_ingredients_v1`
 *                    display flag) — when false, snapshots are ignored entirely.
 */
export function deriveIngredientBreakdown(
  entries: BreakdownEntry[],
  ingredients: BreakdownIngredientRow[],
  macro: BreakdownMacro,
  options?: {
    snapshots?: BreakdownSnapshotRow[];
    preferSnapshot?: boolean;
  },
): IngredientBreakdownResult {
  // Index ingredient rows by recipe so each entry resolves its rows in O(1).
  const byRecipe = new Map<string, BreakdownIngredientRow[]>();
  for (const row of ingredients) {
    if (!row.recipeId) continue;
    const list = byRecipe.get(row.recipeId);
    if (list) list.push(row);
    else byRecipe.set(row.recipeId, [row]);
  }

  // Index snapshot rows by entry — only when the display flag opts in, so a
  // flag-OFF read can't accidentally split (the data is captured always-on but
  // dark). An empty / absent snapshot set leaves every entry on its prior path.
  const preferSnapshot = options?.preferSnapshot === true;
  const bySnapshotEntry = new Map<string, BreakdownSnapshotRow[]>();
  if (preferSnapshot && options?.snapshots) {
    for (const row of options.snapshots) {
      if (!row.entryId) continue;
      const list = bySnapshotEntry.get(row.entryId);
      if (list) list.push(row);
      else bySnapshotEntry.set(row.entryId, [row]);
    }
  }

  // Aggregate reconciled contributions by ingredient name. Track fallback-ness so a
  // name that only ever appears as a fallback line is flagged; if a name appears both
  // as a real ingredient and a fallback (unlikely but possible) the real wins.
  // `lowConfidence` is sticky: any low-confidence contribution to a name flags the
  // whole line (we never hide uncertainty by averaging it away).
  const agg = new Map<
    string,
    { value: number; isFallback: boolean; lowConfidence: boolean }
  >();

  const addLine = (
    name: string,
    value: number,
    isFallback: boolean,
    lowConfidence = false,
  ) => {
    const key = name.trim() || "Item";
    const existing = agg.get(key);
    if (existing) {
      existing.value += value;
      existing.isFallback = existing.isFallback && isFallback;
      existing.lowConfidence = existing.lowConfidence || lowConfidence;
    } else {
      agg.set(key, { value, isFallback, lowConfidence });
    }
  };

  for (const entry of entries) {
    const storedMacro = macroOf(entry, macro);

    // 1. Snapshot path (ENG-751) — preferred when the entry has persisted AI
    //    item rows and the display flag is on. Splits the entry into one line
    //    per snapshot item, reconciled to the entry's stored total exactly like
    //    the recipe path, carrying each item's low-confidence flag.
    const snapRows = bySnapshotEntry.get(entry.id);
    if (snapRows && snapRows.length > 0) {
      const snapValues = snapRows.map((r) => macroOf(r, macro));
      const snapSum = snapValues.reduce((s, v) => s + v, 0);
      if (snapSum <= 0) {
        // Snapshot items contribute 0 to this macro (e.g. a fat-free item set
        // under the fat view). Show each item at 0 so composition is visible,
        // matching the recipe-path 0 behaviour. No fabricated fallback line.
        snapRows.forEach((r) => addLine(r.name, 0, false, r.lowConfidence));
      } else {
        // Reconcile to the entry's stored total (handles commit-time rounding
        // drift between the snapshot rows and the entry column).
        const factor = storedMacro / snapSum;
        snapRows.forEach((r, i) =>
          addLine(r.name, snapValues[i] * factor, false, r.lowConfidence),
        );
      }
      continue;
    }

    // 2. Recipe path (or fallback). Resolve the entry's recipe ingredient rows.
    const rows = entry.recipeId ? byRecipe.get(entry.recipeId) : undefined;

    // Fallback: no recipe link, or the recipe has no ingredient rows.
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
    .map(([name, v]) => ({
      name,
      value: v.value,
      isFallback: v.isFallback,
      lowConfidence: v.lowConfidence,
    }))
    .sort((a, b) => b.value - a.value);

  const total = lines.reduce((s, l) => s + l.value, 0);
  return { lines, total };
}

/**
 * Normalise a raw `nutrition_entry_ingredients` snapshot row (snake_case from
 * Supabase) into a {@link BreakdownSnapshotRow}. Shared so web + mobile build
 * snapshot rows identically. `lowConfidence` is resolved by the caller via the
 * shared `isSnapshotRowLowConfidence` helper (the confidence threshold lives in
 * `aiLogging.ts`, single-sourced).
 */
export function toBreakdownSnapshotRow(input: {
  entryId: string;
  name?: string | null;
  lowConfidence: boolean;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  fiberG?: number | null;
}): BreakdownSnapshotRow {
  return {
    entryId: input.entryId,
    name: input.name ?? "",
    lowConfidence: input.lowConfidence,
    calories: Number(input.calories) || 0,
    protein: Number(input.protein) || 0,
    carbs: Number(input.carbs) || 0,
    fat: Number(input.fat) || 0,
    fiberG: Number(input.fiberG) || 0,
  };
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
