"use client";

import { useMemo } from "react";
import { CircleAlert } from "lucide-react";
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
} from "../../../lib/nutrition/microNutrientDisplay";
import {
  macroSplitConfidence,
  macroSplitIncompleteCopy,
} from "../../../lib/nutrition/macroSplitConfidence";
import { macroCalorieSplit } from "../../../lib/nutrition/macroCalorieSplit";

/**
 * MealNutritionDialog — web per-meal nutrition-detail surface.
 *
 * P5 parity gap #15 (2026-05-31). The web mirror of the mobile
 * `apps/mobile/app/meal-nutrition.tsx` SCREEN. Web is a single-page app
 * (NutritionTracker), so the analog is a Dialog (sibling to MacroDetailPanel /
 * FullNutrientPanelSheet), NOT a route — the meal object is already in memory,
 * so there is no Supabase fetch here (mobile only fetches by id because it is a
 * deep-linkable route).
 *
 * Renders, mirroring the mobile single-meal mode:
 *  - meta line (slot name · time · source) + optional portion line (≠1 only)
 *  - total kcal headline
 *  - macro calorie-split bar + per-macro grams / kcal / "% of kcal", gated on
 *    `macroSplitConfidence` (shared): `complete` draws the bar + %, `single_macro`
 *    shows the incomplete-data explainer + grams only, `empty` draws a neutral bar
 *  - a "Vitamins, minerals & more" micro table (fibre injected as the first row),
 *    with the same source-attributed empty / populated copy as mobile
 *
 * The Hamilton-rounding macro split + the confidence policy + the micro display
 * list are all the SHARED web/mobile modules, so the numbers match mobile by
 * construction.
 *
 * Feature flag: the entire affordance + this dialog mount behind
 * `web_meal_nutrition_detail` at the call site (NutritionTracker). This
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

export interface MealNutritionDialogProps {
  meal: MealNutritionMeal | null;
  open: boolean;
  onClose: () => void;
  /**
   * Optional "Edit" affordance — mirrors the mobile screen's header-right Edit
   * action. When omitted, no Edit button renders (the dialog is read-only).
   */
  onEdit?: (mealId: string) => void;
}

const MACRO_VARS = {
  protein: "var(--macro-protein)",
  carbs: "var(--macro-carbs)",
  fat: "var(--macro-fat)",
} as const;

function MacroStat({
  label,
  grams,
  kcal,
  pct,
  cssVar,
}: {
  label: string;
  grams: number;
  kcal: number;
  /** `null` suppresses the "% of kcal" + kcal line for incomplete-data rows. */
  pct: number | null;
  cssVar: string;
}) {
  return (
    <div className="flex-1">
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: cssVar }} />
        <span className="text-[13px] font-semibold text-foreground">{label}</span>
      </div>
      <p className="mt-1 text-[15px] font-bold tabular-nums text-foreground">
        {Math.round(grams * 10) / 10}g
      </p>
      {pct != null ? (
        <p className="text-xs tabular-nums" style={{ color: cssVar, opacity: 0.85 }}>
          {Math.round(kcal)} kcal · {pct}% of kcal
        </p>
      ) : null}
    </div>
  );
}

export function MealNutritionDialog({ meal, open, onClose, onEdit }: MealNutritionDialogProps) {
  const fiberDisplay = meal ? mealContributedFiberG(meal) : 0;

  // Fibre leads the micro table (mobile parity — MICRO_LINES puts fiberG first).
  // Inject the resolved fibre value into the micros payload so the shared helper
  // surfaces it as the first row.
  const microRows = useMemo(
    () =>
      listMicroNutrientsCompleteDisplay({
        ...(meal?.micros ?? {}),
        fiberG: fiberDisplay > 0 ? fiberDisplay : (meal?.micros?.fiberG ?? 0),
      }),
    [meal?.micros, fiberDisplay],
  );

  const split = useMemo(
    () =>
      meal
        ? macroCalorieSplit(meal)
        : { proteinPct: 0, carbsPct: 0, fatPct: 0, proteinKcal: 0, carbsKcal: 0, fatKcal: 0 },
    [meal],
  );

  const splitConfidence = useMemo(
    () =>
      meal
        ? macroSplitConfidence({
            calories: meal.calories,
            protein: meal.protein,
            carbs: meal.carbs,
            fat: meal.fat,
          })
        : ({ state: "empty" } as const),
    [meal],
  );

  const portion = meal?.portionMultiplier ?? 1;
  // Hide the "Portion ×1" line when the multiplier is the default — it adds no
  // info (mobile parity). Show only when the user altered the portion.
  const showPortionLine = Math.abs(portion - 1) > 0.001;
  const portionLabel = Number.isInteger(portion) ? String(portion) : String(Math.round(portion * 100) / 100);

  const populatedCount = microRows.filter((row) => row.value !== "—").length;
  const sourceLabel = meal?.source ? meal.source : "the data source";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="bg-card border-border max-w-md" data-testid="meal-nutrition-dialog">
        {meal == null ? (
          // Defensive empty state — the host only opens with a resolved meal, but
          // if the meal was removed mid-flow we surface a designed dead-end rather
          // than a blank dialog (mirrors mobile's NutritionDetailEmptyState).
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
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-foreground">
                {meal.recipeTitle?.trim() || "Meal nutrition"}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {[meal.name, meal.time].filter(Boolean).join(" · ")}
                {meal.source ? ` · ${meal.source}` : ""}
              </DialogDescription>
            </DialogHeader>

            <div className="pt-1">
              {/* Macro summary card */}
              <div className="rounded-card border border-border bg-card p-3.5">
                {showPortionLine ? (
                  <p className="mb-1 text-[13px] text-muted-foreground">Portion ×{portionLabel}</p>
                ) : null}
                <p
                  data-testid="meal-nutrition-kcal"
                  className="mb-3 text-[28px] font-extrabold tabular-nums leading-none text-foreground"
                >
                  {Math.round(meal.calories)} kcal
                </p>

                {splitConfidence.state === "single_macro" ? (
                  // F-82 — incomplete-data state. Skip the misleading bar +
                  // "% of kcal" labels and explain what's missing.
                  <div data-testid="meal-nutrition-incomplete" className="mb-3">
                    <p className="mb-3 text-[13px] leading-[18px] text-muted-foreground">
                      {macroSplitIncompleteCopy(splitConfidence.presentMacro)}
                    </p>
                    <div className="flex justify-between gap-2">
                      <MacroStat label="Protein" grams={meal.protein} kcal={split.proteinKcal} pct={null} cssVar={MACRO_VARS.protein} />
                      <MacroStat label="Carbs" grams={meal.carbs} kcal={split.carbsKcal} pct={null} cssVar={MACRO_VARS.carbs} />
                      <MacroStat label="Fat" grams={meal.fat} kcal={split.fatKcal} pct={null} cssVar={MACRO_VARS.fat} />
                    </div>
                  </div>
                ) : (
                  <>
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
                    <div className="flex justify-between gap-2">
                      <MacroStat
                        label="Protein"
                        grams={meal.protein}
                        kcal={split.proteinKcal}
                        pct={splitConfidence.state === "complete" ? split.proteinPct : null}
                        cssVar={MACRO_VARS.protein}
                      />
                      <MacroStat
                        label="Carbs"
                        grams={meal.carbs}
                        kcal={split.carbsKcal}
                        pct={splitConfidence.state === "complete" ? split.carbsPct : null}
                        cssVar={MACRO_VARS.carbs}
                      />
                      <MacroStat
                        label="Fat"
                        grams={meal.fat}
                        kcal={split.fatKcal}
                        pct={splitConfidence.state === "complete" ? split.fatPct : null}
                        cssVar={MACRO_VARS.fat}
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Vitamins, minerals & more */}
              <div className="mt-3 rounded-card border border-border bg-card p-3.5">
                <p className="mb-1 text-[15px] font-bold text-foreground">Vitamins, minerals &amp; more</p>
                {/* F-86 — when every micro row is "—" the panel reads as a debug
                    surface. Collapse to a source-attributed empty state; otherwise
                    render the full list with an attribution line that frames absence
                    as the source's gap, not Suppr's. */}
                {populatedCount === 0 ? (
                  <p data-testid="meal-nutrition-micros-empty" className="text-xs leading-[17px] text-muted-foreground">
                    {sourceLabel} did not publish vitamin or mineral data for this product.
                  </p>
                ) : (
                  <>
                    <p className="mb-2 text-xs leading-[17px] text-muted-foreground">
                      {populatedCount} of {microRows.length} fields published by {sourceLabel}
                      {showPortionLine ? `; values reflect portion ×${portionLabel}` : ""}.
                    </p>
                    <div data-testid="meal-nutrition-micros-list">
                      {microRows.map((row) => (
                        <div
                          key={row.key}
                          className="flex items-center justify-between gap-3 border-b border-border/30 py-2.5 last:border-b-0"
                        >
                          <span className="flex-1 text-sm text-foreground">{row.label}</span>
                          <span
                            className={`text-sm tabular-nums ${
                              row.value === "—" ? "text-muted-foreground/60" : "text-muted-foreground"
                            }`}
                          >
                            {row.value === "—" ? "Not published" : row.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {onEdit ? (
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    data-testid="meal-nutrition-edit"
                    onClick={() => onEdit(meal.id)}
                    className="rounded-md px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/5"
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
