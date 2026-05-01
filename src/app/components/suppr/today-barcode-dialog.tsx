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
import { Checkbox } from "../ui/checkbox";
import {
  fetchProductByBarcode,
  type OffProductMacros,
} from "../../../lib/openFoodFacts/fetchProductByBarcode";
import { scaleFromPer100gGrams } from "../../../lib/openFoodFacts/scaleFromPer100g";
import {
  clampRememberedToServingOptions,
  getRememberedPortion,
  recordPortion,
} from "../../../lib/barcodePortionMemory";

/**
 * TodayBarcodeDialog — the Open Food Facts barcode lookup + review.
 *
 * Extracted from `NutritionTracker.tsx` (audit H3, 2026-04-18). State
 * stays in the host so the recent-foods cache + analytics firing
 * point for `barcode_lookup` still live alongside the other logging
 * primitives in the composition root.
 */

export interface TodayBarcodeConfirmPayload {
  product: OffProductMacros;
  titleForLog: string;
  portion: string;
  /**
   * F-13 (2026-04-19) — the raw gram weight the dialog used to scale
   * macros. Forwarded so the host can compute caffeine/alcohol deltas
   * with `scaleCaffeineAlcohol` against the original per-100 g
   * envelope.
   */
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG: number | undefined;
  adjusted: boolean;
}

function parseNonnegNumber(raw: string): number | null {
  const n = Number.parseFloat(raw.replace(",", ".").trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function barcodePortionLabel(product: OffProductMacros, grams: number): string {
  const hit = product.servingOptions.find((o) => Math.abs(o.grams - grams) < 0.51);
  return hit?.label ?? `${Math.round(grams * 10) / 10} g`;
}

export interface TodayBarcodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  barcodeValue: string;
  onBarcodeValueChange: (v: string) => void;
  barcodeBusy: boolean;
  onBarcodeBusyChange: (v: boolean) => void;
  barcodePreview: OffProductMacros | null;
  onBarcodePreviewChange: (v: OffProductMacros | null) => void;
  barcodeGramsStr: string;
  onBarcodeGramsStrChange: (v: string) => void;
  barcodeGramsParsed: number;
  barcodeTitleOverride: string;
  onBarcodeTitleOverrideChange: (v: string) => void;
  barcodeMacrosManual: boolean;
  onBarcodeMacrosManualChange: (v: boolean) => void;
  barcodeEditCal: string;
  onBarcodeEditCalChange: (v: string) => void;
  barcodeEditPro: string;
  onBarcodeEditProChange: (v: string) => void;
  barcodeEditCarb: string;
  onBarcodeEditCarbChange: (v: string) => void;
  barcodeEditFat: string;
  onBarcodeEditFatChange: (v: string) => void;
  mealSlot: string;
  onMealSlotChange: (v: string) => void;
  recentFoods: string[];
  onPickRecentFood: (name: string) => void;
  onConfirm: (payload: TodayBarcodeConfirmPayload) => void;
}

export function TodayBarcodeDialog(props: TodayBarcodeDialogProps) {
  // Audit/2026-04-30 — barcode portion memory parity with mobile.
  // Cleared on close so a fresh open doesn't surface a stale hint.
  const [rememberedPortion, setRememberedPortion] = React.useState<number | null>(null);
  const {
    open,
    onOpenChange,
    barcodeValue,
    onBarcodeValueChange,
    barcodeBusy,
    onBarcodeBusyChange,
    barcodePreview,
    onBarcodePreviewChange,
    barcodeGramsStr,
    onBarcodeGramsStrChange,
    barcodeGramsParsed,
    barcodeTitleOverride,
    onBarcodeTitleOverrideChange,
    barcodeMacrosManual,
    onBarcodeMacrosManualChange,
    barcodeEditCal,
    onBarcodeEditCalChange,
    barcodeEditPro,
    onBarcodeEditProChange,
    barcodeEditCarb,
    onBarcodeEditCarbChange,
    barcodeEditFat,
    onBarcodeEditFatChange,
    mealSlot,
    onMealSlotChange,
    recentFoods,
    onPickRecentFood,
    onConfirm,
  } = props;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        {!barcodePreview ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-foreground">Barcode (Open Food Facts)</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Enter a barcode. On the next screen you can fix the product name, meal, portion, or override calories and
                macros if the match is wrong.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <label className="grid gap-1">
                <span className="text-sm font-medium text-foreground">Barcode</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={barcodeValue}
                  onChange={(e) => onBarcodeValueChange(e.target.value.replace(/\D/g, ""))}
                  placeholder="8–13 digits"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-card"
                />
              </label>
              {recentFoods.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs text-muted-foreground w-full">Recent:</span>
                  {recentFoods.map((n) => (
                    <button
                      key={n}
                      type="button"
                      className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-muted/70"
                      onClick={() => onPickRecentFood(n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={barcodeBusy}
                onClick={async () => {
                  onBarcodeBusyChange(true);
                  try {
                    const result = await fetchProductByBarcode(barcodeValue);
                    if (!result.ok) {
                      toast.error(
                        result.error === "not_found"
                          ? "Product not found"
                          : result.error === "invalid"
                            ? "Enter a valid barcode"
                            : "Could not reach Open Food Facts",
                      );
                      return;
                    }
                    const p = result.product;
                    onBarcodePreviewChange(p);
                    onBarcodeTitleOverrideChange(p.name);
                    onBarcodeMacrosManualChange(false);
                    onBarcodeEditCalChange("");
                    onBarcodeEditProChange("");
                    onBarcodeEditCarbChange("");
                    onBarcodeEditFatChange("");
                    // Audit/2026-04-30 — pre-fill grams with the
                    // remembered portion when the user has logged this
                    // barcode before; otherwise fall back to the OFF
                    // reference serving.
                    const remembered = getRememberedPortion(barcodeValue);
                    if (remembered != null && remembered > 0) {
                      const snapped = clampRememberedToServingOptions(
                        remembered,
                        p.servingOptions ?? null,
                      );
                      setRememberedPortion(remembered);
                      onBarcodeGramsStrChange(String(Math.round(snapped * 10) / 10));
                    } else {
                      setRememberedPortion(null);
                      onBarcodeGramsStrChange(
                        typeof p.servingSizeG === "number" && p.servingSizeG > 0
                          ? String(Math.round(p.servingSizeG * 10) / 10)
                          : "100",
                      );
                    }
                  } finally {
                    onBarcodeBusyChange(false);
                  }
                }}
              >
                {barcodeBusy ? "Looking up…" : "Look up"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-foreground">Review & log</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Open Food Facts can mismatch your package or have wrong macros. Fix the name or values here, or try
                another barcode.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2 max-h-[60vh] overflow-y-auto pr-0.5">
              {(() => {
                const p = barcodePreview;
                const scaled = scaleFromPer100gGrams(p, barcodeGramsParsed);
                const portion = barcodePortionLabel(p, barcodeGramsParsed);
                const titleForLog = barcodeTitleOverride.trim() || p.name;
                return (
                  <>
                    <label className="grid gap-1">
                      <span className="text-sm font-medium text-foreground">Food name</span>
                      <input
                        type="text"
                        value={barcodeTitleOverride}
                        onChange={(e) => onBarcodeTitleOverrideChange(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
                        placeholder={p.name}
                      />
                      <span className="text-[11px] text-muted-foreground">
                        Shown on your diary; does not change the database.
                      </span>
                    </label>
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

                    <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/30 p-3">
                      <Checkbox
                        id="barcode-macros-manual"
                        checked={barcodeMacrosManual}
                        className="mt-0.5"
                        onCheckedChange={(c) => {
                          const on = c === true;
                          onBarcodeMacrosManualChange(on);
                          if (on) {
                            const s = scaleFromPer100gGrams(p, barcodeGramsParsed);
                            onBarcodeEditCalChange(String(s.calories));
                            onBarcodeEditProChange(String(s.protein));
                            onBarcodeEditCarbChange(String(s.carbs));
                            onBarcodeEditFatChange(String(s.fat));
                          }
                        }}
                      />
                      <label htmlFor="barcode-macros-manual" className="text-sm leading-snug cursor-pointer">
                        <span className="font-medium text-foreground">Edit calories & macros</span>
                        <span className="block text-xs text-muted-foreground mt-0.5">
                          Overrides label math for this entry only. Turn on if the pack values do not match what
                          you scanned.
                        </span>
                      </label>
                    </div>

                    {!barcodeMacrosManual ? (
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">{scaled.calories}</span> kcal · P{" "}
                        {scaled.protein}g · C {scaled.carbs}g · F {scaled.fat}g
                        {scaled.fiberG > 0 ? ` · Fiber ${scaled.fiberG}g` : ""}
                        <span className="block text-[11px] mt-1">From label per 100 g × grams below.</span>
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <label className="grid gap-1 col-span-2 sm:col-span-1">
                          <span className="text-xs font-medium text-foreground">Calories (kcal)</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={barcodeEditCal}
                            onChange={(e) => onBarcodeEditCalChange(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
                          />
                        </label>
                        <label className="grid gap-1 col-span-2 sm:col-span-1">
                          <span className="text-xs font-medium text-foreground">Protein (g)</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={barcodeEditPro}
                            onChange={(e) => onBarcodeEditProChange(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
                          />
                        </label>
                        <label className="grid gap-1">
                          <span className="text-xs font-medium text-foreground">Carbs (g)</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={barcodeEditCarb}
                            onChange={(e) => onBarcodeEditCarbChange(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
                          />
                        </label>
                        <label className="grid gap-1">
                          <span className="text-xs font-medium text-foreground">Fat (g)</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={barcodeEditFat}
                            onChange={(e) => onBarcodeEditFatChange(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
                          />
                        </label>
                      </div>
                    )}

                    <label className="grid gap-1">
                      <span className="text-sm font-medium text-foreground">Portion (grams)</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={barcodeGramsStr}
                        onChange={(e) => onBarcodeGramsStrChange(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
                      />
                      <span className="text-[11px] text-muted-foreground">
                        Used for the serving note in your diary
                        {!barcodeMacrosManual ? " and to scale macros from the label" : ""}.
                      </span>
                    </label>
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">Quick picks</span>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {p.servingOptions.map((o) => {
                          const selected = Math.abs(o.grams - barcodeGramsParsed) < 0.51;
                          return (
                            <button
                              key={`${o.label}-${o.grams}`}
                              type="button"
                              onClick={() => onBarcodeGramsStrChange(String(o.grams))}
                              className={`text-xs px-2.5 py-1.5 rounded-full border transition-colors ${
                                selected
                                  ? "border-primary bg-primary/15 text-foreground"
                                  : "border-border bg-muted/40 hover:bg-muted"
                              }`}
                            >
                              {o.label}
                            </button>
                          );
                        })}
                        {[50, 150, 200]
                          .filter((g) => !p.servingOptions.some((o) => Math.abs(o.grams - g) < 0.51))
                          .map((g) => {
                            const selected = Math.abs(g - barcodeGramsParsed) < 0.51;
                            return (
                              <button
                                key={`g-${g}`}
                                type="button"
                                onClick={() => onBarcodeGramsStrChange(String(g))}
                                className={`text-xs px-2.5 py-1.5 rounded-full border transition-colors ${
                                  selected
                                    ? "border-primary bg-primary/15 text-foreground"
                                    : "border-border bg-muted/40 hover:bg-muted"
                                }`}
                              >
                                {g} g
                              </button>
                            );
                          })}
                      </div>
                    </div>
                    {rememberedPortion != null && rememberedPortion > 0 ? (
                      <p className="text-xs text-primary">
                        You usually log {Math.round(rememberedPortion)} g — using that.
                      </p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      Diary line: <span className="font-medium text-foreground">{titleForLog}</span> ({portion})
                    </p>
                  </>
                );
              })()}
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => {
                  onBarcodePreviewChange(null);
                  onBarcodeMacrosManualChange(false);
                  onBarcodeEditCalChange("");
                  onBarcodeEditProChange("");
                  onBarcodeEditCarbChange("");
                  onBarcodeEditFatChange("");
                }}
              >
                Try another barcode
              </Button>
              <div className="flex w-full sm:w-auto gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    const p = barcodePreview;
                    if (!p) return;
                    const portion = barcodePortionLabel(p, barcodeGramsParsed);
                    const titleForLog = barcodeTitleOverride.trim() || p.name;
                    const scaled = scaleFromPer100gGrams(p, barcodeGramsParsed);
                    let calories: number;
                    let protein: number;
                    let carbs: number;
                    let fat: number;
                    let fiberG: number | undefined;
                    if (barcodeMacrosManual) {
                      const c = Number.parseInt(barcodeEditCal.replace(/\s/g, ""), 10);
                      const pr = parseNonnegNumber(barcodeEditPro);
                      const cb = parseNonnegNumber(barcodeEditCarb);
                      const ft = parseNonnegNumber(barcodeEditFat);
                      if (!Number.isFinite(c) || c < 0 || c > 50_000) {
                        toast.error("Enter a valid calorie amount (0–50000).");
                        return;
                      }
                      if (pr == null || cb == null || ft == null) {
                        toast.error("Enter protein, carbs, and fat (numbers ≥ 0).");
                        return;
                      }
                      calories = c;
                      protein = Math.round(pr * 10) / 10;
                      carbs = Math.round(cb * 10) / 10;
                      fat = Math.round(ft * 10) / 10;
                      fiberG = undefined;
                    } else {
                      calories = scaled.calories;
                      protein = scaled.protein;
                      carbs = scaled.carbs;
                      fat = scaled.fat;
                      fiberG = scaled.fiberG > 0 ? scaled.fiberG : undefined;
                    }
                    const adjusted = barcodeMacrosManual || titleForLog.trim() !== p.name.trim();
                    // Audit/2026-04-30 — remember this portion for the
                    // next lookup of the same barcode (parity with mobile).
                    recordPortion(barcodeValue, barcodeGramsParsed);
                    setRememberedPortion(null);
                    onConfirm({
                      product: p,
                      titleForLog,
                      portion,
                      grams: barcodeGramsParsed,
                      calories,
                      protein,
                      carbs,
                      fat,
                      fiberG,
                      adjusted,
                    });
                  }}
                >
                  Add to diary
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
