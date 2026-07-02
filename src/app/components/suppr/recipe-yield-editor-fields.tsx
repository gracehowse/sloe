"use client";

import * as React from "react";

import { Input } from "../ui/input.tsx";
import { FilterChip } from "../ui/filter-chip.tsx";
import { Label } from "../ui/label.tsx";
import {
  type RecipeYieldEditorDraft,
  type RecipeYieldEditorMode,
} from "../../../lib/recipes/recipeYieldEditor.ts";

const MODES: Array<{ id: RecipeYieldEditorMode; label: string }> = [
  { id: "servings_only", label: "Servings" },
  { id: "weight", label: "By weight" },
  { id: "units", label: "By piece" },
  { id: "weight_and_units", label: "Weight + pieces" },
];

export type RecipeYieldEditorFieldsProps = {
  draft: RecipeYieldEditorDraft;
  onChange: (next: RecipeYieldEditorDraft) => void;
  disabled?: boolean;
};

export function RecipeYieldEditorFields({ draft, onChange, disabled }: RecipeYieldEditorFieldsProps) {
  const sectionCls =
    "text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-2";

  const setMode = (mode: RecipeYieldEditorMode) => {
    onChange({ ...draft, mode });
  };

  return (
    <div className="space-y-4" data-testid="recipe-yield-editor">
      <div>
        <p className={sectionCls}>Batch yield</p>
        <p className="mb-3 text-xs text-muted-foreground">
          Optional — define total batch weight or pieces so you can log by grams or slices, not
          just servings.
        </p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Yield style">
          {MODES.map((m) => {
            const active = draft.mode === m.id;
            return (
              <FilterChip
                key={m.id}
                label={m.label}
                selected={active}
                size="md"
                data-testid={`recipe-yield-mode-${m.id}`}
                disabled={disabled}
                onClick={() => setMode(m.id)}
              />
            );
          })}
        </div>
      </div>

      {draft.mode !== "servings_only" ? (
        <div className="grid gap-2">
          <Label htmlFor="recipe-yield-servings">Recipe makes (servings)</Label>
          <Input
            id="recipe-yield-servings"
            inputMode="numeric"
            disabled={disabled}
            value={String(draft.servings)}
            onChange={(e) =>
              onChange({ ...draft, servings: Number.parseInt(e.target.value, 10) || 1 })
            }
          />
          <p className="text-xs text-muted-foreground">
            Per-serving macros stay tied to this count — used when logging by serving.
          </p>
        </div>
      ) : null}

      {draft.mode === "weight" || draft.mode === "weight_and_units" ? (
        <div className="grid gap-2">
          <Label htmlFor="recipe-yield-grams">Total batch weight (g)</Label>
          <Input
            id="recipe-yield-grams"
            inputMode="decimal"
            disabled={disabled}
            value={draft.totalGrams}
            onChange={(e) => onChange({ ...draft, totalGrams: e.target.value })}
            placeholder="e.g. 680"
          />
        </div>
      ) : null}

      {draft.mode === "units" || draft.mode === "weight_and_units" ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label htmlFor="recipe-yield-unit-count">Pieces in batch</Label>
            <Input
              id="recipe-yield-unit-count"
              inputMode="numeric"
              disabled={disabled}
              value={draft.unitCount}
              onChange={(e) => onChange({ ...draft, unitCount: e.target.value })}
              placeholder="12"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="recipe-yield-unit-name">Piece name</Label>
            <Input
              id="recipe-yield-unit-name"
              disabled={disabled}
              value={draft.unitSingular}
              onChange={(e) => onChange({ ...draft, unitSingular: e.target.value })}
              placeholder="slice"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default RecipeYieldEditorFields;
