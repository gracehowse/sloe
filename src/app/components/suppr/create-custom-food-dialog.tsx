"use client";

/**
 * CreateCustomFoodDialog — create or edit a user's custom food row.
 *
 * Scope (TestFlight `AE52_fIRZ-ZIupmoJ8T4yaI`, 2026-04-19): matches the
 * MFP / LoseIt field set without becoming a seven-section wall.
 *
 * Layout:
 *  1. Name (required) + optional brand.
 *  2. Natural serving row — label + grams + servings per container —
 *     prominent above the macro grid so users reason about the label.
 *  3. Macros per `base_grams` (default 100 g) with a live per-serving
 *     preview underneath.
 *  4. Collapsed "Add detailed nutrition" disclosure with sugar / sat fat
 *     / sodium and a barcode text input (validated to 8 / 12 / 13 / 14
 *     digits — no camera-scanner here; that's a separate track).
 *  5. Save (disabled until valid) / Cancel.
 *
 * Does no I/O; hands the payload back via `onSave` so the caller can run
 * it through `createCustomFood` / `updateCustomFood`. Shares every piece
 * of pure logic (barcode validation, macro scaling, dedupe) with the
 * mobile sheet through `src/lib/nutrition/customFoods.ts`.
 *
 * Accessibility:
 *  - All inputs have explicit `<Label>` + `htmlFor`.
 *  - Macro inputs use `inputMode="decimal"`.
 *  - Barcode error + serving-pair error use `role="alert"` / `aria-live`.
 *  - Zero-macro save is allowed but surfaces a soft "Macros not set"
 *    notice; we intentionally do not block (homemade items often get
 *    macros filled in later).
 */

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
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
  customFoodToMacrosPer100g,
  normaliseCustomFoodName,
  validateCustomFoodBarcode,
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
  servingsPerContainer?: number;
  sugarG?: number;
  saturatedFatG?: number;
  sodiumMg?: number;
  barcode?: string;
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
  const [servingLabel, setServingLabel] = useState("");
  const [servingGramsText, setServingGramsText] = useState("");
  const [servingsPerContainerText, setServingsPerContainerText] = useState("");
  const [baseGramsText, setBaseGramsText] = useState("100");
  const [caloriesText, setCaloriesText] = useState("");
  const [proteinText, setProteinText] = useState("");
  const [carbsText, setCarbsText] = useState("");
  const [fatText, setFatText] = useState("");
  const [fiberText, setFiberText] = useState("");
  const [sugarText, setSugarText] = useState("");
  const [satFatText, setSatFatText] = useState("");
  const [sodiumText, setSodiumText] = useState("");
  const [barcode, setBarcode] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reset every time the dialog opens so a cancelled edit doesn't leak
  // into a new session.
  useEffect(() => {
    if (!open) return;
    if (initialFood) {
      setName(initialFood.name);
      setBrand(initialFood.brand ?? "");
      const first = (initialFood.servings ?? []).find(
        (s) => s.label.trim() !== "" && s.grams > 0,
      );
      setServingLabel(first?.label ?? "");
      setServingGramsText(first ? formatNumber(first.grams) : "");
      setServingsPerContainerText(
        initialFood.servingsPerContainer != null
          ? formatNumber(initialFood.servingsPerContainer)
          : "",
      );
      setBaseGramsText(formatNumber(initialFood.baseGrams) || "100");
      setCaloriesText(formatNumber(initialFood.calories));
      setProteinText(formatNumber(initialFood.protein));
      setCarbsText(formatNumber(initialFood.carbs));
      setFatText(formatNumber(initialFood.fat));
      setFiberText(initialFood.fiber != null ? formatNumber(initialFood.fiber) : "");
      setSugarText(initialFood.sugarG != null ? formatNumber(initialFood.sugarG) : "");
      setSatFatText(
        initialFood.saturatedFatG != null ? formatNumber(initialFood.saturatedFatG) : "",
      );
      setSodiumText(initialFood.sodiumMg != null ? formatNumber(initialFood.sodiumMg) : "");
      setBarcode(initialFood.barcode ?? "");
      setDetailsOpen(
        initialFood.sugarG != null ||
          initialFood.saturatedFatG != null ||
          initialFood.sodiumMg != null ||
          Boolean(initialFood.barcode),
      );
    } else {
      setName(initialName ?? "");
      setBrand("");
      setServingLabel("");
      setServingGramsText("");
      setServingsPerContainerText("");
      setBaseGramsText("100");
      setCaloriesText("");
      setProteinText("");
      setCarbsText("");
      setFatText("");
      setFiberText("");
      setSugarText("");
      setSatFatText("");
      setSodiumText("");
      setBarcode("");
      setDetailsOpen(false);
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
      sugarG: sugarText.trim() ? toNumber(sugarText) : undefined,
      sodiumMg: sodiumText.trim() ? toNumber(sodiumText) : undefined,
    }),
    [baseGramsText, caloriesText, proteinText, carbsText, fatText, fiberText, sugarText, sodiumText],
  );

  const servingGrams = toNumber(servingGramsText);
  const servingLabelClean = servingLabel.trim();
  const hasServingLabel = servingLabelClean.length > 0;
  const hasServingGrams = servingGrams > 0;
  const servingValid =
    (!hasServingLabel && !hasServingGrams) ||
    (hasServingLabel && hasServingGrams);

  const barcodeParsed = useMemo(() => validateCustomFoodBarcode(barcode), [barcode]);
  const barcodeValid = barcodeParsed.ok;

  const trimmedName = normaliseCustomFoodName(name);
  const hasValidBase = macros.baseGrams > 0;
  const allMacrosZero =
    macros.calories === 0 &&
    macros.protein === 0 &&
    macros.carbs === 0 &&
    macros.fat === 0 &&
    (macros.fiber == null || macros.fiber === 0);

  const canSave =
    trimmedName.length > 0 &&
    hasValidBase &&
    servingValid &&
    barcodeValid &&
    !saving;

  // Live preview: scale the food's macros to the natural serving, if the
  // user has set one; else to `baseGrams`. Uses `customFoodToMacrosPer100g`
  // so the math agrees with the per-100g path search + log uses.
  const previewGrams = hasServingLabel && hasServingGrams ? servingGrams : macros.baseGrams;
  const previewScaled = useMemo(() => {
    if (!(previewGrams > 0) || !hasValidBase) {
      return { calories: 0, protein: 0, carbs: 0, fat: 0 };
    }
    const per100g = customFoodToMacrosPer100g(macros);
    const f = previewGrams / 100;
    return {
      calories: Math.round(per100g.calories * f),
      protein: Math.round(per100g.protein * f * 10) / 10,
      carbs: Math.round(per100g.carbs * f * 10) / 10,
      fat: Math.round(per100g.fat * f * 10) / 10,
    };
  }, [macros, previewGrams, hasValidBase]);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const servings: CustomFoodServing[] =
        hasServingLabel && hasServingGrams
          ? [{ label: servingLabelClean, grams: servingGrams }]
          : [];
      const payload: CreateCustomFoodPayload = {
        name: trimmedName,
        baseGrams: macros.baseGrams,
        calories: macros.calories,
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat,
        servings,
      };
      const brandTrimmed = brand.trim();
      if (brandTrimmed) payload.brand = brandTrimmed;
      if (macros.fiber != null && fiberText.trim()) payload.fiber = macros.fiber;
      const spc = toNumber(servingsPerContainerText);
      if (servingsPerContainerText.trim() && spc > 0) payload.servingsPerContainer = spc;
      if (sugarText.trim()) payload.sugarG = toNumber(sugarText);
      if (satFatText.trim()) payload.saturatedFatG = toNumber(satFatText);
      if (sodiumText.trim()) payload.sodiumMg = toNumber(sodiumText);
      if (barcodeParsed.ok && barcodeParsed.value) payload.barcode = barcodeParsed.value;
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

          {/* Natural serving row — prominent, above the macro grid. */}
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium text-foreground">
              Serving size (optional)
            </legend>
            <div className="flex items-center gap-2">
              <Input
                id="custom-food-serving-label"
                type="text"
                value={servingLabel}
                onChange={(e) => setServingLabel(e.target.value)}
                placeholder="e.g. 1 slice"
                maxLength={40}
                aria-label="Serving size label"
                className="flex-1"
              />
              <Input
                id="custom-food-serving-grams"
                type="number"
                inputMode="decimal"
                value={servingGramsText}
                onChange={(e) => setServingGramsText(e.target.value)}
                placeholder="grams"
                min={0}
                step="any"
                aria-label="Serving size grams"
                className="w-24"
              />
            </div>
            <div className="flex items-center gap-2">
              <Input
                id="custom-food-servings-per-container"
                type="number"
                inputMode="decimal"
                value={servingsPerContainerText}
                onChange={(e) => setServingsPerContainerText(e.target.value)}
                min={0}
                step="any"
                aria-label="Servings per container"
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">
                servings per container (optional)
              </span>
            </div>
            {!servingValid && (
              <p
                className="text-xs text-destructive"
                aria-live="polite"
                role="alert"
              >
                Enter both a serving size label and grams, or leave both blank.
              </p>
            )}
          </fieldset>

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

          {/* Live per-serving preview — below the macro grid so the user
              sees instant feedback that the label adds up. */}
          <div
            className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs"
            role="status"
            aria-live="polite"
          >
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Per-serving preview
            </div>
            <div className="tabular-nums text-foreground">
              {hasServingLabel && hasServingGrams && hasValidBase
                ? `${servingLabelClean} (${servingGrams} g) ≈ ${previewScaled.calories} kcal · P ${previewScaled.protein} · C ${previewScaled.carbs} · F ${previewScaled.fat}`
                : hasValidBase
                  ? `${macros.baseGrams} g: ${previewScaled.calories} kcal · P ${previewScaled.protein} · C ${previewScaled.carbs} · F ${previewScaled.fat}`
                  : "Add macros above to see preview."}
            </div>
          </div>

          {/* Disclosure: detailed nutrition (sugar / sat fat / sodium) +
              barcode. Hidden by default to keep the form short. */}
          <div className="grid gap-2">
            <button
              type="button"
              onClick={() => setDetailsOpen((v) => !v)}
              aria-expanded={detailsOpen}
              aria-controls="custom-food-details"
              aria-label={
                detailsOpen ? "Hide detailed nutrition" : "Add detailed nutrition"
              }
              className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/40"
            >
              <span>
                {detailsOpen ? "Hide detailed nutrition" : "Add detailed nutrition"}
              </span>
              {detailsOpen ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
            {detailsOpen && (
              <div id="custom-food-details" className="grid gap-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="grid gap-1">
                    <Label htmlFor="custom-food-sugar">Sugar (g)</Label>
                    <Input
                      id="custom-food-sugar"
                      type="number"
                      inputMode="decimal"
                      value={sugarText}
                      onChange={(e) => setSugarText(e.target.value)}
                      min={0}
                      step="any"
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="custom-food-sat-fat">Sat fat (g)</Label>
                    <Input
                      id="custom-food-sat-fat"
                      type="number"
                      inputMode="decimal"
                      value={satFatText}
                      onChange={(e) => setSatFatText(e.target.value)}
                      min={0}
                      step="any"
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="custom-food-sodium">Sodium (mg)</Label>
                    <Input
                      id="custom-food-sodium"
                      type="number"
                      inputMode="decimal"
                      value={sodiumText}
                      onChange={(e) => setSodiumText(e.target.value)}
                      min={0}
                      step="any"
                    />
                  </div>
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="custom-food-barcode">Barcode (optional)</Label>
                  <Input
                    id="custom-food-barcode"
                    type="text"
                    inputMode="numeric"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="e.g. 5012345678900"
                    maxLength={14}
                    aria-invalid={!barcodeValid}
                    aria-describedby={!barcodeValid ? "custom-food-barcode-err" : undefined}
                  />
                  {!barcodeValid && (
                    <p
                      id="custom-food-barcode-err"
                      className="text-xs text-destructive"
                      aria-live="polite"
                      role="alert"
                    >
                      Enter a valid 8, 12, 13, or 14-digit barcode, or leave blank.
                    </p>
                  )}
                </div>
              </div>
            )}
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
