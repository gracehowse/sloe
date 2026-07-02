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
import { FilterChip } from "../ui/filter-chip";
import { SupprButton } from "./suppr-button";
import { isFeatureEnabled } from "../../../lib/analytics/track";
import { MEAL_SLOTS } from "../../../lib/nutrition/mealSlots";
import {
  localTimeInputValueFromIso,
  nutritionEntryDateKeyAndEatenAt,
  parseLocalTimeInput,
  defaultEatenAtForNewLog,
} from "../../../lib/nutrition/mealEatenAt";
import { scaleLoggedMealFiberAndMicros } from "../../../lib/nutrition/scaleLoggedMealPortion";
import type { LoggedMeal } from "../../../types/recipe";

/** Clamp edit portion to mobile parity bounds (0.125–24). */
export function clampEditPortionMultiplier(raw: number): number {
  if (!Number.isFinite(raw)) return 1;
  return Math.max(0.125, Math.min(24, raw));
}

export function buildEditedLoggedMeal(input: {
  original: LoggedMeal;
  anchorDayKey: string;
  slot: string;
  title: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  portionMultiplier: number;
  eatenAtTime?: string;
  editableEatenAt?: boolean;
  timeZone?: string | null;
}): LoggedMeal {
  const {
    original,
    anchorDayKey,
    slot,
    title,
    calories,
    protein,
    carbs,
    fat,
    portionMultiplier,
    eatenAtTime,
    editableEatenAt,
    timeZone,
  } = input;
  const p0 =
    original.portionMultiplier && original.portionMultiplier > 0
      ? original.portionMultiplier
      : 1;
  const portionMul = clampEditPortionMultiplier(portionMultiplier);
  const localTime =
    editableEatenAt && eatenAtTime ? parseLocalTimeInput(eatenAtTime) : null;
  const { eatenAt } = nutritionEntryDateKeyAndEatenAt(original, anchorDayKey, localTime, { timeZone });
  return {
    ...original,
    name: slot,
    recipeTitle: title.trim() || original.recipeTitle,
    calories: Math.round(calories),
    protein: Math.round(protein * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fat: Math.round(fat * 10) / 10,
    portionMultiplier: portionMul,
    ...(eatenAt ? { eatenAt } : {}),
    ...scaleLoggedMealFiberAndMicros({
      fiberG: original.fiberG,
      micros: original.micros,
      ratio: portionMul / p0,
    }),
  };
}

export interface EditMealDialogProps {
  meal: LoggedMeal | null;
  anchorDayKey: string;
  open: boolean;
  slotLabels?: readonly string[];
  timeZone?: string | null;
  onClose: () => void;
  onSave: (updated: LoggedMeal) => void | Promise<void>;
}

export function EditMealDialog({
  meal,
  anchorDayKey,
  open,
  slotLabels = MEAL_SLOTS,
  timeZone,
  onClose,
  onSave,
}: EditMealDialogProps) {
  const [slot, setSlot] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [calories, setCalories] = React.useState("");
  const [protein, setProtein] = React.useState("");
  const [carbs, setCarbs] = React.useState("");
  const [fat, setFat] = React.useState("");
  const [portion, setPortion] = React.useState("1");
  const [eatenAtTime, setEatenAtTime] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const editableEatenAt = isFeatureEnabled("editable_eaten_at");

  React.useEffect(() => {
    if (!meal || !open) return;
    setSlot(meal.name);
    setTitle(meal.recipeTitle);
    setCalories(String(meal.calories));
    setProtein(String(meal.protein));
    setCarbs(String(meal.carbs));
    setFat(String(meal.fat));
    setPortion(String(meal.portionMultiplier && meal.portionMultiplier > 0 ? meal.portionMultiplier : 1));
    const chronIso =
      meal.eatenAt ??
      meal.createdAt ??
      defaultEatenAtForNewLog(anchorDayKey, timeZone);
    setEatenAtTime(localTimeInputValueFromIso(chronIso, timeZone));
  }, [meal, open, anchorDayKey, timeZone]);

  const handleSave = async () => {
    if (!meal) return;
    setSaving(true);
    try {
      const updated = buildEditedLoggedMeal({
        original: meal,
        anchorDayKey,
        slot,
        title,
        calories: Number(calories) || meal.calories,
        protein: Number(protein) || 0,
        carbs: Number(carbs) || 0,
        fat: Number(fat) || 0,
        portionMultiplier: parseFloat(portion.replace(",", ".")) || 1,
        eatenAtTime,
        editableEatenAt,
        timeZone,
      });
      await onSave(updated);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!meal) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="sm:max-w-md" data-testid="edit-meal-dialog">
        <DialogHeader>
          <DialogTitle>Edit meal</DialogTitle>
          <DialogDescription>
            Update slot, portion, and macros for this log entry.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Meal slot
            </p>
            <div className="flex flex-wrap gap-2">
              {slotLabels.map((label) => (
                <FilterChip
                  key={label}
                  label={label}
                  selected={slot === label}
                  size="md"
                  data-testid={`edit-meal-slot-${label}`}
                  onClick={() => setSlot(label)}
                />
              ))}
            </div>
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Title</span>
            <input
              data-testid="edit-meal-title"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Portion</span>
            <input
              data-testid="edit-meal-portion"
              type="number"
              min={0.125}
              max={24}
              step={0.125}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={portion}
              onChange={(e) => setPortion(e.target.value)}
            />
          </label>

          {/* Serif kcal hero (headline metric) over the protein/carbs/fat
              triple — mirrors the v3 prototype MealEdit hierarchy (ENG-1247)
              while keeping every value directly editable (parity with mobile). */}
          <div className="space-y-3">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Calories</span>
              <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3">
                <input
                  data-testid="edit-meal-kcal"
                  type="number"
                  className="w-full bg-transparent py-2 font-headline text-[28px] outline-none"
                  value={calories}
                  onChange={(e) => setCalories(e.target.value)}
                />
                <span className="text-xs text-muted-foreground">kcal</span>
              </div>
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  ["Protein (g)", protein, setProtein, "edit-meal-protein"],
                  ["Carbs (g)", carbs, setCarbs, "edit-meal-carbs"],
                  ["Fat (g)", fat, setFat, "edit-meal-fat"],
                ] as const
              ).map(([label, value, setter, testId]) => (
                <label key={testId} className="block space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">{label}</span>
                  <input
                    data-testid={testId}
                    type="number"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                  />
                </label>
              ))}
            </div>
          </div>

          {editableEatenAt ? (
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Time eaten</span>
              <input
                data-testid="edit-meal-time-eaten"
                type="time"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={eatenAtTime}
                onChange={(e) => setEatenAtTime(e.target.value)}
              />
            </label>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <SupprButton
            type="button"
            variant="primary"
            data-testid="edit-meal-save"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            Save
          </SupprButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
