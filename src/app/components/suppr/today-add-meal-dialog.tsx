"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { AddRowButton } from "../ui/add-row-button";
import { Icons } from "../ui/icons";
import { SupprButton } from "./suppr-button";
import { isFeatureEnabled } from "../../../lib/analytics/track";
import { clampPortionMultiplier } from "../../../lib/nutrition/portionMultiplier";
import type { RecipeCard } from "../../../types/recipe";

/**
 * TodayAddMealDialog — the recipe / manual "Log a meal" dialog.
 *
 * Extracted from `NutritionTracker.tsx` (audit H3, 2026-04-18). State
 * stays in the composition root so `handleAddMeal` keeps firing the
 * same analytics + toast sequence. This component is a pure view.
 *
 * Post-ship #5 (C1a, 2026-04-18) removed the inline USDA-only "search"
 * tab. Search now goes through the shared `<FoodSearch>` component so
 * custom foods surface on the primary Today log path (parity with
 * mobile's `FoodSearchModal`). The dialog still exposes a "Search
 * foods" CTA which the host wires to open `<FoodSearch>` standalone —
 * the add-meal dialog closes when the search modal opens, matching
 * mobile's Add-meal → Search-modal hand-off.
 */

export type AddMealMode = "recipe" | "manual";

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
  // submit + time
  timeLabel: string;
  onTimeLabelChange: (v: string) => void;
  onSubmit: () => void;
  /**
   * Opens the shared `<FoodSearch>` modal (custom foods + USDA + OFF).
   * Host should close this dialog before opening search so the two
   * modals don't stack — matches mobile's Add-meal → FoodSearchModal
   * hand-off.
   */
  onOpenSearch: () => void;
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
    timeLabel,
    onTimeLabelChange,
    onSubmit,
    onOpenSearch,
  } = props;

  // Audit 2026-04-30 visual-qa P0 #5 — the dialog used to put the
  // submit button directly inside an `overflow-y-auto` content. With
  // a soft keyboard plus 6 manual-food fields the submit scrolled out
  // of reach. Now the DialogContent is a flex column with a fixed
  // header, a `flex-1 overflow-y-auto` body, and a sticky `border-t`
  // footer that holds Cancel + Add meal. Mirrors P0 #1 (FoodSearch).

  // ENG-821 (Redesign — Design Direction 2026) parity gap #20: this was the
  // ONLY suppr dialog never swept onto the design-direction surface — its
  // three direct siblings (recipe-edit / add-ingredient / override-ingredient)
  // all move from the pure-white `bg-card` + hairline border onto the
  // warm-cream `bg-background` surface and let the real soft
  // `--elev-card-soft` shadow carry separation (no border-as-depth). Mirrors
  // them exactly — dialogs keep their float per the 2026-07-10 card-grammar
  // ruling (ENG-1497). `design_system_elevation` collapsed (ENG-1651) — this
  // was permanently ON via REDESIGN_DEFAULT_ON. Inputs already use semantic
  // borders; the Add CTA is the dialog's ONE primary action → solid-plum
  // `SupprButton` primary (button system 2026-06-12), mirroring mobile
  // quick-add "Add to Today".
  const surfaceCls =
    "bg-background border-transparent shadow-[var(--elev-card-soft)]";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`${surfaceCls} max-h-[90vh] min-h-[28rem] flex flex-col p-0 gap-0`}
        data-testid="today-add-meal-dialog"
      >
        <DialogHeader className="px-6 pt-6 pb-3 shrink-0">
          <DialogTitle className="text-foreground">Log a meal</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Add macros for {selectedDate.toLocaleDateString()} from a saved recipe or enter food manually.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2 px-6 flex-1 overflow-y-auto">
          <div className="flex rounded-lg border border-border p-1 bg-muted/50">
            {(["recipe", "manual"] as const).map((mode) => {
              const label = mode === "recipe" ? "Recipe" : "Manual food";
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onAddModeChange(mode)}
                  // Sloe treatment system (2026-06-08): segmented control
                  // active segment = white lift + primary-solid label;
                  // inactive = muted on the warm-grey rail.
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                    addMode === mode ? "bg-card shadow text-primary-solid" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {/* Search foods CTA — hand-off to shared <FoodSearch>. Matches
              mobile parity: the Add-meal dialog does not render an
              inline search view; tapping this opens the standalone
              search modal and closes the Add-meal sheet. AddControl ruling
              (2026-07-10, ENG-1375 S4): this is an add-food action, not an
              upload dropzone — the dashed border folds into the shared
              quiet-fill AddRowButton primitive (search glyph, same hand-off). */}
          <AddRowButton
            onClick={onOpenSearch}
            label="Search foods (includes your custom foods)"
            icon={<Icons.search className="h-4 w-4 shrink-0" aria-hidden />}
            aria-label="Search foods including your custom foods, USDA, and Open Food Facts"
          />
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
            {isFeatureEnabled("editable_eaten_at") ? (
              <input
                type="time"
                value={timeLabel}
                onChange={(e) => onTimeLabelChange(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
              />
            ) : (
              <input
                type="text"
                value={timeLabel}
                onChange={(e) => onTimeLabelChange(e.target.value)}
                placeholder="e.g. 12:30 PM"
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
              />
            )}
          </label>
        </div>
        <DialogFooter className="border-t border-border bg-card px-6 py-4 shrink-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {/* Button system (2026-06-12,
              docs/decisions/2026-06-12-button-system-solid-primary.md): the
              dialog's ONE primary action is the SOLID-plum SupprButton primary
              (white label, pill, no shadow). Mirror of mobile quick-add
              "Add to Today" (primary). Supersedes the old aubergine-OUTLINE. */}
          <SupprButton variant="primary" type="button" onClick={onSubmit}>
            Add meal
          </SupprButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
