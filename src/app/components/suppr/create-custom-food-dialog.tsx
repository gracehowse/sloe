"use client";

/**
 * CreateCustomFoodDialog (Batch 3.9) — create or edit a user's custom
 * food row, with repeatable named serving sizes and a live macro preview.
 *
 * Flow:
 *  1. User types name (required) + optional brand.
 *  2. User picks the gram basis the macros are defined for (default 100g)
 *     and fills in kcal / protein / carbs / fat / (optional) fiber.
 *  3. User adds any number of named serving shortcuts (e.g.
 *     "1 bowl = 80g"). A preview row shows the scaled macros for the
 *     first saved serving so the user can sanity-check the math.
 *  4. On Save the dialog hands the payload back — it does no I/O. The
 *     caller (food-search entry point) runs it through
 *     `createCustomFood` / `updateCustomFood`.
 *
 * Accessibility:
 *  - All inputs have explicit `<Label>` + `htmlFor`.
 *  - Macro inputs use `inputMode="decimal"`.
 *  - Add / remove serving-row buttons have `aria-label`s describing
 *    which row they act on.
 *  - Zero-macro save is allowed but surfaces a soft "Macros not set"
 *    notice; we intentionally do not block (homemade items often get
 *    macros filled in later).
 */

import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  CUSTOM_FOOD_NAME_MAX,
  dedupeServings,
  normaliseCustomFoodName,
  scaleMacrosForGrams,
  type CustomFood,
  type CustomFoodServing,
} from "../../../lib/nutrition/customFoods";

export type CreateCustomFoodPayload = {
  name: string;
  brand?: string;
  baseGrams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  servings: CustomFoodServing[];
};

export type CreateCustomFoodDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fill for edit; when undefined the dialog opens in "create" mode. */
  initialFood?: CustomFood;
  /** Optional name prefill (e.g. from the search query). */
  initialName?: string;
  onSave: (payload: CreateCustomFoodPayload) => void | Promise<void>;
};

type ServingDraft = { id: string; label: string; gramsText: string };

// Stable id generator for uncontrolled rows; we do not rely on index
// because removing/reordering would cause React to reuse stale input
// state on the wrong row.
let servingDraftCounter = 0;
function nextServingDraftId(): string {
  servingDraftCounter += 1;
  return `sd_${servingDraftCounter}`;
}

function toNumber(text: string): number {
  const t = String(text ?? "").trim();
  if (!t) return 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

function formatNumber(n: number | undefined): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "";
  // Keep integers clean; keep decimals as typed.
  return Number.isInteger(n) ? String(n) : String(n);
}

export function CreateCustomFoodDialog({
  open,
  onOpenChange,
  initialFood,
  initialName,
  onSave,
}: CreateCustomFoodDialogProps) {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [baseGramsText, setBaseGramsText] = useState("100");
  const [caloriesText, setCaloriesText] = useState("");
  const [proteinText, setProteinText] = useState("");
  const [carbsText, setCarbsText] = useState("");
  const [fatText, setFatText] = useState("");
  const [fiberText, setFiberText] = useState("");
  const [servings, setServings] = useState<ServingDraft[]>([]);
  const [saving, setSaving] = useState(false);

  // Reset every time the dialog opens so a cancelled edit doesn't leak
  // into a new session.
  useEffect(() => {
    if (!open) return;
    if (initialFood) {
      setName(initialFood.name);
      setBrand(initialFood.brand ?? "");
      setBaseGramsText(formatNumber(initialFood.baseGrams) || "100");
      setCaloriesText(formatNumber(initialFood.calories));
      setProteinText(formatNumber(initialFood.protein));
      setCarbsText(formatNumber(initialFood.carbs));
      setFatText(formatNumber(initialFood.fat));
      setFiberText(initialFood.fiber != null ? formatNumber(initialFood.fiber) : "");
      setServings(
        (initialFood.servings ?? []).map((s) => ({
          id: nextServingDraftId(),
          label: s.label,
          gramsText: formatNumber(s.grams),
        })),
      );
    } else {
      setName(initialName ?? "");
      setBrand("");
      setBaseGramsText("100");
      setCaloriesText("");
      setProteinText("");
      setCarbsText("");
      setFatText("");
      setFiberText("");
      setServings([{ id: nextServingDraftId(), label: "", gramsText: "" }]);
    }
    setSaving(false);
  }, [open, initialFood, initialName]);

  const macros = useMemo(
    () => ({
      baseGrams: toNumber(baseGramsText),
      calories: toNumber(caloriesText),
      protein: toNumber(proteinText),
      carbs: toNumber(carbsText),
      fat: toNumber(fatText),
      fiber: fiberText.trim() ? toNumber(fiberText) : undefined,
    }),
    [baseGramsText, caloriesText, proteinText, carbsText, fatText, fiberText],
  );

  const cleanedServings = useMemo(
    () => dedupeServings(servings.map((s) => ({ label: s.label, grams: toNumber(s.gramsText) }))),
    [servings],
  );

  const trimmedName = normaliseCustomFoodName(name);
  const hasValidBase = macros.baseGrams > 0;
  const allMacrosZero =
    macros.calories === 0 &&
    macros.protein === 0 &&
    macros.carbs === 0 &&
    macros.fat === 0 &&
    (macros.fiber == null || macros.fiber === 0);

  const canSave = trimmedName.length > 0 && hasValidBase && !saving;

  // Live preview: scale the food's macros to the first saved serving
  // (if any) so the user can sanity-check the math. Falls back to
  // `baseGrams` worth of macros.
  const previewServing = cleanedServings[0];
  const previewGrams = previewServing ? previewServing.grams : macros.baseGrams;
  const previewScaled = useMemo(
    () => scaleMacrosForGrams(macros, previewGrams),
    [macros, previewGrams],
  );

  const handleAddServing = () => {
    setServings((prev) => [...prev, { id: nextServingDraftId(), label: "", gramsText: "" }]);
  };
  const handleRemoveServing = (id: string) => {
    setServings((prev) => prev.filter((s) => s.id !== id));
  };
  const handleServingLabelChange = (id: string, label: string) => {
    setServings((prev) => prev.map((s) => (s.id === id ? { ...s, label } : s)));
  };
  const handleServingGramsChange = (id: string, gramsText: string) => {
    setServings((prev) => prev.map((s) => (s.id === id ? { ...s, gramsText } : s)));
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload: CreateCustomFoodPayload = {
        name: trimmedName,
        baseGrams: macros.baseGrams,
        calories: macros.calories,
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat,
        servings: cleanedServings,
      };
      const brandTrimmed = brand.trim();
      if (brandTrimmed) payload.brand = brandTrimmed;
      if (macros.fiber != null && fiberText.trim()) payload.fiber = macros.fiber;
      await onSave(payload);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const isEditing = Boolean(initialFood);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {isEditing ? "Edit custom food" : "Create custom food"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            For foods that aren&apos;t in the database — e.g. homemade granola or a
            local-bakery pastry.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 overflow-y-auto">
          <div className="grid gap-1.5">
            <Label htmlFor="custom-food-name">Name</Label>
            <Input
              id="custom-food-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Homemade granola"
              autoFocus
              maxLength={CUSTOM_FOOD_NAME_MAX}
              aria-required="true"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="custom-food-brand">Brand (optional)</Label>
            <Input
              id="custom-food-brand"
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="e.g. My recipe, Local bakery"
              maxLength={80}
            />
          </div>

          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium text-foreground">Macros per</legend>
            <div className="flex items-center gap-2">
              <Input
                id="custom-food-base-grams"
                type="number"
                inputMode="decimal"
                value={baseGramsText}
                onChange={(e) => setBaseGramsText(e.target.value)}
                className="w-24"
                min={1}
                step="any"
                aria-label="Base grams"
              />
              <span className="text-sm text-muted-foreground">grams</span>
            </div>
            {!hasValidBase && (
              <p className="text-xs text-destructive" aria-live="polite">
                Base grams must be greater than zero.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="grid gap-1">
                <Label htmlFor="custom-food-calories">Calories (kcal)</Label>
                <Input
                  id="custom-food-calories"
                  type="number"
                  inputMode="decimal"
                  value={caloriesText}
                  onChange={(e) => setCaloriesText(e.target.value)}
                  min={0}
                  step="any"
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="custom-food-protein">Protein (g)</Label>
                <Input
                  id="custom-food-protein"
                  type="number"
                  inputMode="decimal"
                  value={proteinText}
                  onChange={(e) => setProteinText(e.target.value)}
                  min={0}
                  step="any"
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="custom-food-carbs">Carbs (g)</Label>
                <Input
                  id="custom-food-carbs"
                  type="number"
                  inputMode="decimal"
                  value={carbsText}
                  onChange={(e) => setCarbsText(e.target.value)}
                  min={0}
                  step="any"
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="custom-food-fat">Fat (g)</Label>
                <Input
                  id="custom-food-fat"
                  type="number"
                  inputMode="decimal"
                  value={fatText}
                  onChange={(e) => setFatText(e.target.value)}
                  min={0}
                  step="any"
                />
              </div>
              <div className="grid gap-1 col-span-2">
                <Label htmlFor="custom-food-fiber">Fibre (g, optional)</Label>
                <Input
                  id="custom-food-fiber"
                  type="number"
                  inputMode="decimal"
                  value={fiberText}
                  onChange={(e) => setFiberText(e.target.value)}
                  min={0}
                  step="any"
                />
              </div>
            </div>
            {allMacrosZero && (
              <p
                className="text-xs text-muted-foreground"
                aria-live="polite"
                role="status"
              >
                Macros not set. You can fill these in later.
              </p>
            )}
          </fieldset>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Serving sizes</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleAddServing}
                aria-label="Add serving size"
                className="h-7 px-2 text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Add
              </Button>
            </div>
            {servings.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No saved servings. You can still log this food in grams.
              </p>
            )}
            <ul className="grid gap-2">
              {servings.map((row, i) => {
                const label = row.label.trim() || `serving ${i + 1}`;
                return (
                  <li key={row.id} className="flex items-center gap-2">
                    <Input
                      type="text"
                      value={row.label}
                      onChange={(e) => handleServingLabelChange(row.id, e.target.value)}
                      placeholder="e.g. 1 bowl"
                      maxLength={40}
                      aria-label={`Serving ${i + 1} label`}
                      className="flex-1"
                    />
                    <span className="text-sm text-muted-foreground">=</span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={row.gramsText}
                      onChange={(e) => handleServingGramsChange(row.id, e.target.value)}
                      placeholder="grams"
                      min={0}
                      step="any"
                      aria-label={`Serving ${i + 1} grams`}
                      className="w-24"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveServing(row.id)}
                      aria-label={`Remove ${label}`}
                      className="size-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Live preview */}
          <div
            className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs"
            role="status"
            aria-live="polite"
          >
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Preview
            </div>
            <div className="tabular-nums text-foreground">
              {previewServing
                ? `${previewServing.label} (${previewServing.grams}g): ${previewScaled.calories} kcal · P ${previewScaled.protein} · C ${previewScaled.carbs} · F ${previewScaled.fat}`
                : hasValidBase
                  ? `${macros.baseGrams}g: ${previewScaled.calories} kcal · P ${previewScaled.protein} · C ${previewScaled.carbs} · F ${previewScaled.fat}`
                  : "Add macros above to see preview."}
              {previewScaled.fiber != null ? ` · Fi ${previewScaled.fiber}` : ""}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave} aria-disabled={!canSave}>
            {saving ? "Saving…" : isEditing ? "Save changes" : "Save food"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CreateCustomFoodDialog;
