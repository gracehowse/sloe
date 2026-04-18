"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { RemainingMacrosBar } from "./remaining-macros-bar";
import { clampPortionMultiplier } from "../../../lib/nutrition/portionMultiplier";
import { effectiveFoodSearchQuery } from "../../../lib/nutrition/foodSearchQuery";
import type { RecipeCard } from "../../../types/recipe";

/**
 * TodayAddMealDialog — the recipe / manual / search "Log a meal" dialog.
 *
 * Extracted from `NutritionTracker.tsx` (audit H3, 2026-04-18). State
 * stays in the composition root so `handleAddMeal` keeps firing the
 * same analytics + toast sequence. This component is a pure view +
 * local fetch for USDA search (the search is scoped to this dialog).
 */

export type AddMealMode = "recipe" | "manual" | "search";

export type UsdaHit = { fdcId: number; description: string; dataType?: string; brandName?: string };
export type UsdaFoodDetails = {
  fdcId: number;
  description: string;
  macrosPer100g: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiberG: number;
    sugarG: number;
    sodiumMg: number;
  };
};

export interface TodayAddMealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date;
  mealSlot: string;
  onMealSlotChange: (slot: string) => void;
  addMode: AddMealMode;
  onAddModeChange: (mode: AddMealMode) => void;
  recipeId: string;
  onRecipeIdChange: (id: string) => void;
  recipeOptions: RecipeCard[];
  savedRecipesEmpty: boolean;
  recipePortionMultiplier: number;
  onRecipePortionMultiplierChange: (next: number | ((prev: number) => number)) => void;
  // manual
  manualName: string;
  onManualNameChange: (v: string) => void;
  manualCalories: number;
  onManualCaloriesChange: (v: number) => void;
  manualProtein: number;
  onManualProteinChange: (v: number) => void;
  manualCarbs: number;
  onManualCarbsChange: (v: number) => void;
  manualFat: number;
  onManualFatChange: (v: number) => void;
  manualFiber: number;
  onManualFiberChange: (v: number) => void;
  manualWater: number;
  onManualWaterChange: (v: number) => void;
  // search
  foodQuery: string;
  onFoodQueryChange: (v: string) => void;
  foodHits: UsdaHit[] | null;
  onFoodHitsChange: (v: UsdaHit[] | null) => void;
  foodLoading: boolean;
  onFoodLoadingChange: (v: boolean) => void;
  foodSelected: UsdaFoodDetails | null;
  onFoodSelectedChange: (v: UsdaFoodDetails | null) => void;
  foodGrams: number;
  onFoodGramsChange: (v: number) => void;
  // remaining-bar context
  effectiveCalorieTarget: number;
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;
  targetFiber: number;
  consumedCalories: number;
  consumedProtein: number;
  consumedCarbs: number;
  consumedFat: number;
  consumedFiber: number;
  // submit + time
  timeLabel: string;
  onTimeLabelChange: (v: string) => void;
  onSubmit: () => void;
}

export function TodayAddMealDialog(props: TodayAddMealDialogProps) {
  const {
    open,
    onOpenChange,
    selectedDate,
    mealSlot,
    onMealSlotChange,
    addMode,
    onAddModeChange,
    recipeId,
    onRecipeIdChange,
    recipeOptions,
    savedRecipesEmpty,
    recipePortionMultiplier,
    onRecipePortionMultiplierChange,
    manualName,
    onManualNameChange,
    manualCalories,
    onManualCaloriesChange,
    manualProtein,
    onManualProteinChange,
    manualCarbs,
    onManualCarbsChange,
    manualFat,
    onManualFatChange,
    manualFiber,
    onManualFiberChange,
    manualWater,
    onManualWaterChange,
    foodQuery,
    onFoodQueryChange,
    foodHits,
    onFoodHitsChange,
    foodLoading,
    onFoodLoadingChange,
    foodSelected,
    onFoodSelectedChange,
    foodGrams,
    onFoodGramsChange,
    effectiveCalorieTarget,
    targetProtein,
    targetCarbs,
    targetFat,
    targetFiber,
    consumedCalories,
    consumedProtein,
    consumedCarbs,
    consumedFat,
    consumedFiber,
    timeLabel,
    onTimeLabelChange,
    onSubmit,
  } = props;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-h-[90vh] min-h-[28rem] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">Log a meal</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Add macros for {selectedDate.toLocaleDateString()} from a saved recipe, the catalog, or enter food manually.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="flex rounded-lg border border-border p-1 bg-muted/50">
            {(["recipe", "manual", "search"] as const).map((mode) => {
              const label = mode === "recipe" ? "Recipe" : mode === "manual" ? "Manual food" : "Search";
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onAddModeChange(mode)}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                    addMode === mode ? "bg-card shadow text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <label className="grid gap-1">
            <span className="text-sm font-medium text-foreground">Meal</span>
            <select
              value={mealSlot}
              onChange={(e) => onMealSlotChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
            >
              {["Breakfast", "Lunch", "Dinner", "Snacks"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          {addMode === "recipe" ? (
            <>
              <label className="grid gap-1">
                <span className="text-sm font-medium text-foreground">Recipe</span>
                <select
                  value={recipeId}
                  onChange={(e) => onRecipeIdChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
                  disabled={!recipeOptions.length}
                >
                  {recipeOptions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
                </select>
                {savedRecipesEmpty && (
                  <span className="text-xs text-muted-foreground">Save recipes from Discover to see them here.</span>
                )}
              </label>
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2 bg-muted/40">
                <span className="text-sm font-medium text-foreground">Portions</span>
                <span className="text-xs text-muted-foreground max-w-[14rem]">
                  1 = just you · 2 = shared (partner, family plate, double batch)
                </span>
                <div className="flex items-center gap-1 ml-auto">
                  <button
                    type="button"
                    aria-label="Fewer portions"
                    onClick={() => onRecipePortionMultiplierChange((m) => clampPortionMultiplier(m - 0.5))}
                    className="w-9 h-9 rounded-lg border border-border text-lg font-semibold text-foreground hover:bg-muted/60"
                  >
                    −
                  </button>
                  <span className="min-w-[3rem] text-center text-sm font-semibold text-foreground">
                    {recipePortionMultiplier === Math.floor(recipePortionMultiplier)
                      ? recipePortionMultiplier
                      : recipePortionMultiplier.toFixed(1)}
                    ×
                  </span>
                  <button
                    type="button"
                    aria-label="More portions"
                    onClick={() => onRecipePortionMultiplierChange((m) => clampPortionMultiplier(m + 0.5))}
                    className="w-9 h-9 rounded-lg border border-border text-lg font-semibold text-foreground hover:bg-muted/60"
                  >
                    +
                  </button>
                </div>
              </div>
            </>
          ) : addMode === "search" ? (
            <div className="grid gap-2">
              <span className="text-sm font-medium text-foreground">Food search</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={foodQuery}
                  onChange={(e) => onFoodQueryChange(e.target.value)}
                  placeholder="e.g. chicken breast, rice cooked"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={foodLoading}
                  onClick={() => {
                    const q = effectiveFoodSearchQuery(foodQuery.trim());
                    if (!q) return;
                    onFoodLoadingChange(true);
                    onFoodSelectedChange(null);
                    fetch(`/api/usda/search?q=${encodeURIComponent(q)}`)
                      .then((r) => r.json())
                      .then((data: { ok?: boolean; hits?: UsdaHit[]; message?: string }) => {
                        if (!data.ok || !data.hits) {
                          toast.error(data.message ?? "Food search failed");
                          return;
                        }
                        onFoodHitsChange(data.hits.slice(0, 10));
                      })
                      .catch(() => toast.error("Food search failed"))
                      .finally(() => onFoodLoadingChange(false));
                  }}
                >
                  {foodLoading ? "…" : "Go"}
                </Button>
              </div>

              {foodHits?.length ? (
                <div className="max-h-56 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                  {foodHits.map((h) => (
                    <button
                      key={h.fdcId}
                      type="button"
                      className="w-full text-left p-3 hover:bg-muted/60/40"
                      onClick={() => {
                        onFoodLoadingChange(true);
                        fetch(`/api/usda/food?fdcId=${h.fdcId}`)
                          .then((r) => r.json())
                          .then((data: { ok?: boolean; message?: string } & Partial<UsdaFoodDetails>) => {
                            if (!data.ok || !data.macrosPer100g || !data.description) {
                              toast.error(data.message ?? "Could not load food details");
                              return;
                            }
                            onFoodSelectedChange({
                              fdcId: data.fdcId!,
                              description: data.description!,
                              macrosPer100g: data.macrosPer100g!,
                            });
                          })
                          .catch(() => toast.error("Could not load food details"))
                          .finally(() => onFoodLoadingChange(false));
                      }}
                    >
                      <div className="text-sm font-medium text-foreground truncate">{h.description}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {h.dataType ?? "Food"}
                        {h.brandName ? ` · ${h.brandName}` : ""}
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}

              {foodSelected ? (
                <div className="rounded-lg border border-border p-3 bg-muted/40">
                  <div className="text-sm font-semibold text-foreground truncate">{foodSelected.description}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-sm text-foreground w-16">Grams</span>
                    <input
                      type="number"
                      min={1}
                      value={foodGrams}
                      onChange={(e) => onFoodGramsChange(Number(e.target.value))}
                      className="flex-1 px-3 py-2 rounded-lg border border-border bg-card text-foreground"
                    />
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {(() => {
                      const g = Math.max(1, Math.round(foodGrams) || 1);
                      const mult = g / 100;
                      const m = foodSelected.macrosPer100g;
                      return `${Math.round(m.calories * mult)} kcal · ${Math.round(m.protein * mult)}P · ${Math.round(
                        m.carbs * mult,
                      )}C · ${Math.round(m.fat * mult)}F`;
                    })()}
                  </div>
                  {/* Fit-this-in preview — parity with mobile FoodSearchModal. */}
                  <RemainingMacrosBar
                    className="mt-2"
                    targets={{
                      calories: effectiveCalorieTarget,
                      protein: targetProtein,
                      carbs: targetCarbs,
                      fat: targetFat,
                      fiber: targetFiber,
                    }}
                    consumed={{
                      calories: consumedCalories,
                      protein: consumedProtein,
                      carbs: consumedCarbs,
                      fat: consumedFat,
                      fiber: consumedFiber,
                    }}
                    candidate={(() => {
                      const g = Math.max(1, Math.round(foodGrams) || 1);
                      const mult = g / 100;
                      const m = foodSelected.macrosPer100g;
                      return {
                        calories: m.calories * mult,
                        protein: m.protein * mult,
                        carbs: m.carbs * mult,
                        fat: m.fat * mult,
                        fiber: (m.fiberG ?? 0) * mult,
                      };
                    })()}
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <label className="grid gap-1">
                <span className="text-sm font-medium text-foreground">Food name</span>
                <input
                  type="text"
                  value={manualName}
                  onChange={(e) => onManualNameChange(e.target.value)}
                  placeholder="e.g. Greek yogurt with berries"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1">
                  <span className="text-sm font-medium text-foreground">Calories</span>
                  <input
                    type="number"
                    min={0}
                    value={manualCalories || ""}
                    onChange={(e) => onManualCaloriesChange(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-medium text-foreground">Protein (g)</span>
                  <input
                    type="number"
                    min={0}
                    value={manualProtein || ""}
                    onChange={(e) => onManualProteinChange(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-medium text-foreground">Carbs (g)</span>
                  <input
                    type="number"
                    min={0}
                    value={manualCarbs || ""}
                    onChange={(e) => onManualCarbsChange(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-medium text-foreground">Fat (g)</span>
                  <input
                    type="number"
                    min={0}
                    value={manualFat || ""}
                    onChange={(e) => onManualFatChange(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-medium text-foreground">Fiber (g)</span>
                  <input
                    type="number"
                    min={0}
                    value={manualFiber || ""}
                    onChange={(e) => onManualFiberChange(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-medium text-foreground">Water (ml)</span>
                  <input
                    type="number"
                    min={0}
                    value={manualWater || ""}
                    onChange={(e) => onManualWaterChange(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
                  />
                </label>
              </div>
            </>
          )}
          <label className="grid gap-1">
            <span className="text-sm font-medium text-foreground">Time</span>
            <input
              type="text"
              value={timeLabel}
              onChange={(e) => onTimeLabelChange(e.target.value)}
              placeholder="e.g. 12:30 PM"
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
            />
          </label>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={onSubmit}>
            Add meal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
