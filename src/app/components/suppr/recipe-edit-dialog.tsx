"use client";

/**
 * RecipeEditDialog — owner metadata editor (ENG-759, web).
 *
 * Edits title, description, servings, meal-type chips, prep/cook time,
 * and instructions. Ingredient CRUD stays inline on `RecipeDetail`
 * (AddIngredientDialog / OverrideIngredientDialog) — same split as mobile
 * where metadata lives in RecipeEditSheet and verify lives on the tab.
 *
 * Persistence uses shared `recipeEdit` helpers so web + mobile stay aligned.
 */

import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";

import { isFeatureEnabled } from "../../../lib/analytics/track.ts";
import { supabase } from "../../../lib/supabase/browserClient.ts";
import {
  RECIPE_MEAL_TYPES,
  type RecipeMealType,
  buildRecipeMetadataUpdate,
  isMetadataDraftValid,
  recomputeRecipeAggregate,
  toggleMealType,
  clampRecipeServings,
  type AggregatableIngredient,
  type RecipeAggregate,
  type RecipeMetadataUpdate,
} from "../../../lib/recipes/recipeEdit.ts";
import {
  buildRecipeYieldPersistence,
  recipeYieldEditorDraftFromDb,
  validateRecipeYieldEditorDraft,
  type RecipeYieldEditorDraft,
} from "../../../lib/recipes/recipeYieldEditor.ts";
import { RecipeYieldEditorFields } from "./recipe-yield-editor-fields.tsx";
import { effectiveMacros } from "../../../lib/nutrition/ingredientOverrides.ts";
import type { IngredientRow } from "../../../types/recipe.ts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog.tsx";
import { Button } from "../ui/button.tsx";
import { Input } from "../ui/input.tsx";
import { FilterChip } from "../ui/filter-chip.tsx";
import { Label } from "../ui/label.tsx";
import { Textarea } from "../ui/textarea.tsx";

export type RecipeEditDialogInitial = {
  title: string;
  description: string | null;
  instructions: string | null;
  servings: number;
  meal_type: string[] | null;
  prep_time_min: number | null;
  cook_time_min: number | null;
  yield?: unknown;
};

export type RecipeEditDialogSavePayload = RecipeMetadataUpdate &
  RecipeAggregate & { yield?: unknown };

export type RecipeEditDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipeId: string;
  authorId: string;
  initial: RecipeEditDialogInitial;
  /** Ingredient rows used to recompute per-serving macros when servings change. */
  ingredients: ReadonlyArray<IngredientRow>;
  onSaved: (updated: RecipeEditDialogSavePayload) => void | Promise<void>;
};

function ingredientsForAggregate(rows: ReadonlyArray<IngredientRow>): AggregatableIngredient[] {
  return rows.map((ing) => {
    const m = effectiveMacros(ing);
    return {
      calories: m.calories,
      protein: m.protein,
      carbs: m.carbs,
      fat: m.fat,
      fiber_g: ing.fiberG ?? 0,
      sugar_g: ing.sugarG ?? 0,
      sodium_mg: ing.sodiumMg ?? 0,
    };
  });
}

export function RecipeEditDialog({
  open,
  onOpenChange,
  recipeId,
  authorId,
  initial,
  ingredients,
  onSaved,
}: RecipeEditDialogProps) {
  const [title, setTitle] = React.useState(initial.title);
  const [description, setDescription] = React.useState(initial.description ?? "");
  const [servings, setServings] = React.useState(() => clampRecipeServings(initial.servings));
  const [mealType, setMealType] = React.useState<string[]>(initial.meal_type ?? []);
  const [prepTime, setPrepTime] = React.useState(
    initial.prep_time_min != null ? String(initial.prep_time_min) : "",
  );
  const [cookTime, setCookTime] = React.useState(
    initial.cook_time_min != null ? String(initial.cook_time_min) : "",
  );
  const [instructions, setInstructions] = React.useState(initial.instructions ?? "");
  const [saving, setSaving] = React.useState(false);
  const yieldPortionEnabled = isFeatureEnabled("recipe_yield_portion_v1");
  const [yieldDraft, setYieldDraft] = React.useState<RecipeYieldEditorDraft>(() =>
    recipeYieldEditorDraftFromDb(initial.yield, initial.servings),
  );

  React.useEffect(() => {
    if (!open) return;
    setTitle(initial.title);
    setDescription(initial.description ?? "");
    setServings(clampRecipeServings(initial.servings));
    setMealType(initial.meal_type ?? []);
    setPrepTime(initial.prep_time_min != null ? String(initial.prep_time_min) : "");
    setCookTime(initial.cook_time_min != null ? String(initial.cook_time_min) : "");
    setInstructions(initial.instructions ?? "");
    setYieldDraft(recipeYieldEditorDraftFromDb(initial.yield, initial.servings));
    setSaving(false);
  }, [open, initial]);

  const stepServings = (delta: number) => {
    setServings((s) => clampRecipeServings(s + delta));
  };

  const onMealChip = (value: RecipeMealType) => {
    setMealType((prev) => toggleMealType(prev, value));
  };

  const handleSave = async () => {
    if (!isMetadataDraftValid({ title })) {
      toast.error("Add a title before saving.");
      return;
    }
    if (yieldPortionEnabled) {
      const yieldErr = validateRecipeYieldEditorDraft(yieldDraft);
      if (yieldErr) {
        toast.error(yieldErr);
        return;
      }
    }
    setSaving(true);
    try {
      const metadata = buildRecipeMetadataUpdate({
        title,
        description,
        servings,
        mealType,
        prepTimeMin: prepTime,
        cookTimeMin: cookTime,
        instructions,
      });
      const yieldPersistence = yieldPortionEnabled
        ? buildRecipeYieldPersistence(yieldDraft)
        : { servings: metadata.servings, yield: null };
      const effectiveServings = yieldPortionEnabled
        ? yieldPersistence.servings
        : metadata.servings;
      const aggregate = recomputeRecipeAggregate(
        ingredientsForAggregate(ingredients),
        effectiveServings,
      );

      const updatePayload: Record<string, unknown> = {
        ...metadata,
        servings: effectiveServings,
        ...aggregate,
      };
      if (yieldPortionEnabled) {
        updatePayload.yield = yieldPersistence.yield;
      }

      const { error } = await supabase
        .from("recipes")
        .update(updatePayload)
        .eq("id", recipeId)
        .eq("author_id", authorId);

      if (error) {
        toast.error(error.message);
        return;
      }

      const payload: RecipeEditDialogSavePayload = {
        ...metadata,
        servings: effectiveServings,
        ...aggregate,
        ...(yieldPortionEnabled ? { yield: yieldPersistence.yield } : {}),
      };
      await onSaved(payload);
      onOpenChange(false);
      toast.success("Recipe updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save recipe.");
    } finally {
      setSaving(false);
    }
  };

  const sectionCls =
    "text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-2";

  // ENG-821 (Redesign — Design Direction 2026): the design-director review read
  // the edit dialog as "imported from a different design system" — it sat on a
  // pure-white `bg-card` (#fff) surface with a hairline border standing in for
  // depth, against the product's warm-cream canvas. Under
  // `design_system_elevation` we move it onto the warm `bg-background` surface
  // and let the real soft `--elev-card-soft` shadow carry separation (no
  // border). The flag-OFF path keeps today's white/hairline dialog alive.
  // Form-field borders + the commit CTA already use semantic tokens
  // (`border-input` on Input/Textarea; `bg-primary-solid` on the default
  // Button), so no colour repaint is needed here.
  const elevated = isFeatureEnabled("design_system_elevation");
  const surfaceCls = elevated
    ? "bg-background border-transparent shadow-[var(--elev-card-soft)] max-w-lg max-h-[88vh] overflow-y-auto"
    : "bg-card border-border max-w-lg max-h-[88vh] overflow-y-auto";

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className={surfaceCls} data-testid="recipe-edit-dialog">
        <DialogHeader>
          <DialogTitle className="text-foreground">Edit recipe</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Update details here. To change ingredients or nutrition, use the Ingredients tab on
            this recipe — add rows, verify matches, or override macros there.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-5">
          <div className="grid gap-2">
            <Label htmlFor="recipe-edit-title">Title</Label>
            <Input
              id="recipe-edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Recipe name"
              autoFocus
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="recipe-edit-description">Description</Label>
            <Textarea
              id="recipe-edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A short description"
              rows={3}
            />
          </div>

          <div>
            <p className={sectionCls}>Servings</p>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => stepServings(-1)}
                disabled={servings <= 1 || saving || yieldPortionEnabled}
                aria-label="Decrease servings"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="min-w-[3rem] text-center text-xl font-bold tabular-nums text-foreground">
                {servings}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => stepServings(1)}
                disabled={servings >= 48 || saving || yieldPortionEnabled}
                aria-label="Increase servings"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {yieldPortionEnabled ? (
              <p className="mt-2 text-xs text-muted-foreground">
                When batch yield is set below, servings sync from the yield editor.
              </p>
            ) : null}
          </div>

          {yieldPortionEnabled ? (
            <RecipeYieldEditorFields
              draft={yieldDraft}
              onChange={(next) => {
                setYieldDraft(next);
                if (next.mode !== "servings_only") {
                  setServings(clampRecipeServings(next.servings));
                }
              }}
              disabled={saving}
            />
          ) : null}

          <div>
            <p className={sectionCls}>Meal type</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Meal type">
              {RECIPE_MEAL_TYPES.map((m) => {
                const active = mealType.includes(m);
                return (
                  <FilterChip
                    key={m}
                    label={m[0]!.toUpperCase() + m.slice(1)}
                    selected={active}
                    size="md"
                    data-testid={`recipe-edit-meal-${m}`}
                    disabled={saving}
                    onClick={() => onMealChip(m)}
                  />
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="recipe-edit-prep">Prep (min)</Label>
              <Input
                id="recipe-edit-prep"
                inputMode="numeric"
                value={prepTime}
                onChange={(e) => setPrepTime(e.target.value)}
                placeholder="—"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="recipe-edit-cook">Cook (min)</Label>
              <Input
                id="recipe-edit-cook"
                inputMode="numeric"
                value={cookTime}
                onChange={(e) => setCookTime(e.target.value)}
                placeholder="—"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="recipe-edit-instructions">Instructions</Label>
            <Textarea
              id="recipe-edit-instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Step-by-step method"
              rows={8}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSave()}
            disabled={saving || !isMetadataDraftValid({ title })}
            data-testid="recipe-edit-save"
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default RecipeEditDialog;
