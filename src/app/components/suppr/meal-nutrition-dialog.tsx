"use client";

import { useMemo } from "react";
import { CircleAlert, Salad } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  listMicroNutrientsCompleteDisplay,
  mealContributedFiberG,
  sumDayFiberFromMeals,
  sumMicrosFromLoggedMeals,
} from "../../../lib/nutrition/microNutrientDisplay";
import {
  macroSplitConfidence,
  macroSplitIncompleteCopy,
} from "../../../lib/nutrition/macroSplitConfidence";
import { macroCalorieSplit } from "../../../lib/nutrition/macroCalorieSplit";
import { formatNutritionSourceLabel } from "../../../lib/nutrition/sourceLabel";
import { isFeatureEnabled } from "@/lib/analytics/track";
import { MacroTotalGrid, type MacroTotalCell, type MacroTotalKey } from "./MacroTotalGrid";

/**
 * MealNutritionDialog — web per-meal AND per-slot nutrition-detail surface.
 *
 * P5 parity gap #15 (2026-05-31) + ENG-837 slot-aggregate (2026-06-19). The web
 * mirror of the mobile `apps/mobile/app/meal-nutrition.tsx` SCREEN, which has
 * TWO modes: single-meal (`?id=`) and slot-aggregate (`?slot=&date=`, sums every
 * logged item in a slot). Web is a single-page app (NutritionTracker), so the
 * analog is a Dialog (sibling to MacroDetailPanel / FullNutrientPanelSheet), NOT
 * a route — the meal/slot items are already in memory, so there is no Supabase
 * fetch here (mobile only fetches by id/slot+date because it is a deep-linkable
 * route).
 *
 * Two callers, mutually exclusive:
 *  - `meal` set  → single-meal mode (the per-meal kebab "View nutrition")
 *  - `slotAggregate` set → slot-aggregate mode (the slot-header "View slot
 *    nutrition"), summing every meal in that slot into one breakdown.
 *
 * Renders, mirroring the mobile screen:
 *  - meta line (slot name · time · source for a single meal; slot label · item
 *    count for an aggregate) + optional portion line (single-meal, ≠1 only)
 *  - total kcal headline (summed across the slot in aggregate mode)
 *  - macro calorie-split bar + the v3 4-cell `.md-totalgrid` (Protein / Carbs /
 *    Fat / Fibre — grams only, each cell tappable into macro-detail), gated on
 *    `macroSplitConfidence` (shared): `complete` draws the bar + grid,
 *    `single_macro` shows the incomplete-data explainer + grid, `empty` a neutral bar
 *  - a "Vitamins, minerals & more" micro table (vitamins/minerals only — fibre
 *    now leads the grid, not this table), with the same source-attributed empty /
 *    populated copy as mobile (aggregate
 *    mode attributes to "your logged items in this slot")
 *
 * The slot sum reuses the SAME shared helpers mobile uses for the slot total —
 * `sumMicrosFromLoggedMeals` (micros) + `sumDayFiberFromMeals` (fibre), both from
 * `@/lib/nutrition/microNutrientDisplay` (mobile reaches them via
 * `@suppr/shared/nutrition/microNutrientDisplay`, the same file). Macros sum the
 * same way as mobile (`reduce`, kcal rounded). The Hamilton-rounding macro split,
 * the confidence policy, and the micro display list are likewise the SHARED
 * web/mobile modules, so the numbers match mobile by construction.
 *
 * The affordance(s) + this dialog mount unconditionally at the call site
 * (NutritionTracker) — `web_meal_nutrition_detail` collapsed, ENG-1651. This
 * component renders nothing of its own when `open` is false.
 */

export type MealNutritionMeal = {
  id: string;
  name: string;
  recipeTitle: string;
  time?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG?: number | null;
  portionMultiplier?: number | null;
  micros?: Record<string, number> | null;
  source?: string | null;
};

/**
 * ENG-837 — slot-aggregate input. When set, the dialog ignores `meal` and renders
 * the SUMMED nutrition for `meals` (every logged item in `slotLabel`), mirroring
 * the mobile `?slot=&date=` screen mode. `slotLabel` is the slot name shown as the
 * title (e.g. "Breakfast"). `meals` may be empty — the dialog then renders the
 * designed slot-empty state rather than a zeroed breakdown.
 */
export type MealNutritionSlotAggregate = {
  slotLabel: string;
  meals: MealNutritionMeal[];
};

export interface MealNutritionDialogProps {
  meal: MealNutritionMeal | null;
  open: boolean;
  onClose: () => void;
  /**
   * ENG-837 — slot-aggregate mode. When set, takes precedence over `meal`: the
   * dialog sums `slotAggregate.meals` (shared helpers) and renders the slot label
   * + combined breakdown. Undefined → single-meal mode (the existing behaviour).
   */
  slotAggregate?: MealNutritionSlotAggregate | null;
  /**
   * Optional "Edit" affordance — mirrors the mobile screen's header-right Edit
   * action. When omitted, no Edit button renders (the dialog is read-only).
   * Ignored in slot-aggregate mode (mobile also hides Edit on the aggregate —
   * there is no single entry to edit).
   */
  onEdit?: (mealId: string) => void;
  /**
   * Open the day's macro-detail breakdown when a `.md-totalgrid` cell is tapped
   * (ENG-1247). When omitted the cells render as static (no dead taps). The host
   * (`NutritionTracker`) closes this dialog then opens `MacroDetailPanel`.
   */
  onMacroTap?: (macro: MacroTotalKey) => void;
}

const MACRO_VARS = {
  protein: "var(--macro-protein)",
  carbs: "var(--macro-carbs)",
  fat: "var(--macro-fat)",
  fiber: "var(--macro-fiber)",
} as const;

export function MealNutritionDialog({
  meal,
  open,
  onClose,
  slotAggregate,
  onEdit,
  onMacroTap,
}: MealNutritionDialogProps) {
  const isSlotAggregate = slotAggregate != null;
  const slotItems = slotAggregate?.meals ?? null;

  // ENG-837 — build the slot aggregate from the SAME shared helpers mobile uses
  // in `apps/mobile/app/meal-nutrition.tsx` (lines 161-177): macros sum via
  // `reduce` (kcal rounded, P/C/F raw — the bar/split round them), micros via
  // `sumMicrosFromLoggedMeals`, fibre via `sumDayFiberFromMeals`. `fiberG` is
  // deleted from the merged micros so the table draws fibre from the summed
  // column once (not double-counted) — mobile does the identical delete. Empty
  // micros → `undefined`, so the table shows the source-attributed empty state.
  const aggregateMeal = useMemo<MealNutritionMeal | null>(() => {
    if (!slotAggregate || slotAggregate.meals.length === 0) return null;
    const items = slotAggregate.meals;
    const mergedMicros = sumMicrosFromLoggedMeals(items);
    delete mergedMicros.fiberG;
    return {
      id: "__slot_aggregate__",
      name: slotAggregate.slotLabel,
      recipeTitle: slotAggregate.slotLabel,
      calories: Math.round(items.reduce((a, m) => a + m.calories, 0)),
      protein: items.reduce((a, m) => a + m.protein, 0),
      carbs: items.reduce((a, m) => a + m.carbs, 0),
      fat: items.reduce((a, m) => a + m.fat, 0),
      fiberG: sumDayFiberFromMeals(items),
      micros: Object.keys(mergedMicros).length > 0 ? mergedMicros : null,
    };
  }, [slotAggregate]);

  // The breakdown is computed off the EFFECTIVE meal: the aggregate when in
  // slot mode, otherwise the single passed-in meal.
  const effectiveMeal = isSlotAggregate ? aggregateMeal : meal;

  const fiberDisplay = effectiveMeal ? mealContributedFiberG(effectiveMeal) : 0;

  // ENG-1247 (v3 `.md-totalgrid`): Fibre now leads the 4-cell macro grid (real
  // `mealContributedFiberG`, not the prototype's `carbs × 0.13` guess), so it no
  // longer belongs in the "Vitamins, minerals & more" table — strip `fiberG`
  // here so it is never shown twice. The grid is its single home.
  const microRows = useMemo(() => {
    const micros = { ...(effectiveMeal?.micros ?? {}) };
    delete micros.fiberG;
    return listMicroNutrientsCompleteDisplay(micros);
  }, [effectiveMeal?.micros]);

  // v3 `.md-totalgrid` cells — Protein / Carbs / Fat / Fibre. Fibre is REAL
  // (`fiberDisplay`), never a guess. Tapping a cell opens that macro's day
  // breakdown via `onMacroTap` (host wires `MacroDetailPanel`).
  const macroCells: MacroTotalCell[] = effectiveMeal
    ? [
        { key: "protein", label: "Protein", grams: effectiveMeal.protein, cssVar: MACRO_VARS.protein },
        { key: "carbs", label: "Carbs", grams: effectiveMeal.carbs, cssVar: MACRO_VARS.carbs },
        { key: "fat", label: "Fat", grams: effectiveMeal.fat, cssVar: MACRO_VARS.fat },
        { key: "fiber", label: "Fibre", grams: fiberDisplay, cssVar: MACRO_VARS.fiber },
      ]
    : [];

  const split = useMemo(
    () =>
      effectiveMeal
        ? macroCalorieSplit(effectiveMeal)
        : { proteinPct: 0, carbsPct: 0, fatPct: 0, proteinKcal: 0, carbsKcal: 0, fatKcal: 0 },
    [effectiveMeal],
  );

  const splitConfidence = useMemo(
    () =>
      effectiveMeal
        ? macroSplitConfidence({
            calories: effectiveMeal.calories,
            protein: effectiveMeal.protein,
            carbs: effectiveMeal.carbs,
            fat: effectiveMeal.fat,
          })
        : ({ state: "empty" } as const),
    [effectiveMeal],
  );

  const sectionA = isFeatureEnabled("eng1247_section_a_v1");
  const metaLine = effectiveMeal
    ? isSlotAggregate
      ? `${slotItems?.length ?? 0} item${(slotItems?.length ?? 0) !== 1 ? "s" : ""} in this slot`
      : `${[effectiveMeal.name, effectiveMeal.time].filter(Boolean).join(" · ")}${
          effectiveMeal.source ? ` · ${formatNutritionSourceLabel(effectiveMeal.source)}` : ""
        }`
    : "";

  const portion = effectiveMeal?.portionMultiplier ?? 1;
  // Hide the "Portion ×1" line when the multiplier is the default — it adds no
  // info (mobile parity). Never shown in aggregate mode (no single portion).
  const showPortionLine = !isSlotAggregate && Math.abs(portion - 1) > 0.001;
  const portionLabel = Number.isInteger(portion) ? String(portion) : String(Math.round(portion * 100) / 100);

  const populatedCount = microRows.filter((row) => row.value !== "—").length;
  // Aggregate mode attributes micros to the slot's items, not a single source
  // (mobile parity — meal-nutrition.tsx line 589-591). Single-meal keeps the
  // per-entry source label.
  const sourceLabel = isSlotAggregate
    ? "your logged items in this slot"
    : (formatNutritionSourceLabel(meal?.source) ?? "the data source");

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="bg-card border-border max-w-md" data-testid="meal-nutrition-dialog">
        {effectiveMeal == null ? (
          // Empty state. Two shapes:
          //  - slot-aggregate with no items → "Nothing in {slot}" (mobile's
          //    NO_SLOT_ITEMS state, meal-nutrition.tsx line 265-285).
          //  - single-meal with a null meal → "Meal not found" (removed mid-flow).
          isSlotAggregate ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-foreground">
                  {slotAggregate?.slotLabel?.trim() || "Slot nutrition"}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  No items logged in this slot yet.
                </DialogDescription>
              </DialogHeader>
              <div
                data-testid="meal-nutrition-slot-empty"
                className="my-4 flex flex-col items-center gap-2 rounded-xl border border-border bg-card px-5 py-8 text-center"
              >
                <span className="mb-1 grid h-14 w-14 place-items-center rounded-full bg-muted">
                  <Salad className="h-6 w-6 text-muted-foreground" strokeWidth={1.75} aria-hidden />
                </span>
                <p className="text-[18px] font-bold text-foreground">
                  Nothing in {slotAggregate?.slotLabel ?? "this slot"}
                </p>
                <p className="max-w-[280px] text-sm leading-5 text-muted-foreground">
                  Add food to this slot from Today, then open this summary again.
                </p>
              </div>
            </>
          ) : (
            // Defensive empty state — the host only opens with a resolved meal,
            // but if the meal was removed mid-flow we surface a designed dead-end
            // rather than a blank dialog (mirrors mobile's NutritionDetailEmptyState).
            <>
              <DialogHeader>
                <DialogTitle className="text-foreground">Meal nutrition</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  This meal is no longer available.
                </DialogDescription>
              </DialogHeader>
              <div
                data-testid="meal-nutrition-missing"
                className="my-4 flex flex-col items-center gap-2 rounded-xl border border-border bg-card px-5 py-8 text-center"
              >
                <span className="mb-1 grid h-14 w-14 place-items-center rounded-full bg-muted">
                  <CircleAlert className="h-6 w-6 text-muted-foreground" strokeWidth={1.75} aria-hidden />
                </span>
                <p className="text-[18px] font-bold text-foreground">Meal not found</p>
                <p className="max-w-[280px] text-sm leading-5 text-muted-foreground">
                  It may have been deleted. Close this and open the meal again from Today.
                </p>
              </div>
            </>
          )
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-foreground">
                {isSlotAggregate
                  ? slotAggregate?.slotLabel?.trim() || "Slot nutrition"
                  : effectiveMeal.recipeTitle?.trim() || "Meal nutrition"}
              </DialogTitle>
              {sectionA && metaLine ? (
                <p className="section-label mt-1" data-testid="meal-nutrition-meta-overline">
                  {metaLine}
                </p>
              ) : (
                <DialogDescription className="text-muted-foreground">
                  {metaLine}
                </DialogDescription>
              )}
            </DialogHeader>

            <div className="pt-1">
              {/* Macro summary card */}
              <div className="rounded-card bg-card card-slab p-3.5">
                {showPortionLine ? (
                  <p className="mb-1 text-[13px] text-muted-foreground">Portion ×{portionLabel}</p>
                ) : null}
                <p
                  data-testid="meal-nutrition-kcal"
                  className="mb-3 text-[40px] font-headline tabular-nums leading-none text-foreground"
                >
                  {Math.round(effectiveMeal.calories)} kcal
                </p>
                {/* Aggregate sub-label — mirrors mobile's "Combined macros"
                    (meal-nutrition.tsx line 532-535). Single-meal mode shows
                    nothing here (the meta line already carries the context). */}
                {isSlotAggregate ? (
                  <p
                    data-testid="meal-nutrition-aggregate-caption"
                    className="mb-3 text-[13px] font-semibold text-muted-foreground"
                  >
                    Combined macros across {slotItems?.length ?? 0} logged item
                    {(slotItems?.length ?? 0) !== 1 ? "s" : ""}
                  </p>
                ) : null}

                {splitConfidence.state === "single_macro" ? (
                  // F-82 — incomplete-data state. Skip the misleading split bar
                  // and explain what's missing; the grams grid still renders.
                  <div data-testid="meal-nutrition-incomplete" className="mb-3">
                    <p className="mb-3 text-[13px] leading-[18px] text-muted-foreground">
                      {macroSplitIncompleteCopy(splitConfidence.presentMacro)}
                    </p>
                    <MacroTotalGrid cells={macroCells} onMacroTap={onMacroTap} />
                  </div>
                ) : (
                  <>
                    {!sectionA ? (
                      <div
                        data-testid="meal-nutrition-macro-bar"
                        className="mb-3 flex h-2.5 overflow-hidden rounded-full"
                      >
                        {splitConfidence.state === "complete" ? (
                          <>
                            <div style={{ flex: Math.max(split.proteinPct, 1), backgroundColor: MACRO_VARS.protein }} />
                            <div style={{ flex: Math.max(split.carbsPct, 1), backgroundColor: MACRO_VARS.carbs }} />
                            <div style={{ flex: Math.max(split.fatPct, 1), backgroundColor: MACRO_VARS.fat }} />
                          </>
                        ) : (
                          <div style={{ flex: 1, backgroundColor: "var(--border)" }} />
                        )}
                      </div>
                    ) : null}
                    <MacroTotalGrid cells={macroCells} onMacroTap={onMacroTap} />
                  </>
                )}
              </div>

              {/* Vitamins, minerals & more */}
              <div className="mt-3 rounded-card bg-card card-slab p-3.5">
                <p className="mb-1 text-[15px] font-bold text-foreground">Vitamins, minerals &amp; more</p>
                {/* F-86 — when every micro row is "—" the panel reads as a debug
                    surface. Collapse to a source-attributed empty state; otherwise
                    render the full list with an attribution line that frames absence
                    as the source's gap, not Suppr's. */}
                {populatedCount === 0 ? (
                  <p data-testid="meal-nutrition-micros-empty" className="text-xs leading-[17px] text-muted-foreground">
                    {isSlotAggregate
                      ? "None of the entries in this slot included published vitamin or mineral data."
                      : `${sourceLabel} did not publish vitamin or mineral data for this product.`}
                  </p>
                ) : (
                  <>
                    <p className="mb-2 text-xs leading-[17px] text-muted-foreground">
                      {populatedCount} of {microRows.length} fields published by {sourceLabel}
                      {showPortionLine ? `; values reflect portion ×${portionLabel}` : ""}.
                    </p>
                    {/* e2e walk 2026-06-10 — only populated rows render; the
                        absent fields collapse to one quiet summary line
                        (mirror of mobile meal-nutrition.tsx). */}
                    <div data-testid="meal-nutrition-micros-list">
                      {microRows
                        .filter((row) => row.value !== "—")
                        .map((row) => (
                          <div
                            key={row.key}
                            className="flex items-center justify-between gap-3 border-b border-border/30 py-2.5 last:border-b-0"
                          >
                            <span className="flex-1 text-sm text-foreground">{row.label}</span>
                            <span className="text-sm tabular-nums text-muted-foreground">{row.value}</span>
                          </div>
                        ))}
                    </div>
                    {populatedCount < microRows.length ? (
                      <p
                        data-testid="meal-nutrition-micros-rest"
                        className="mt-2 text-xs leading-[17px] text-muted-foreground"
                      >
                        {microRows.length - populatedCount} more not published by {sourceLabel}.
                      </p>
                    ) : null}
                  </>
                )}
              </div>

              {/* Edit is a single-meal action only — the slot aggregate has no
                  single entry to route to (mobile hides Edit on the aggregate
                  too, meal-nutrition.tsx line 380-394). */}
              {onEdit && !isSlotAggregate ? (
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    data-testid="meal-nutrition-edit"
                    onClick={() => onEdit(effectiveMeal.id)}
                    className="rounded-md px-3 py-1.5 text-sm font-semibold text-primary-solid hover:bg-primary/5"
                    aria-label="Edit this meal"
                  >
                    Edit
                  </button>
                </div>
              ) : null}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default MealNutritionDialog;
