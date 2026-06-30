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
 * A "Scan label" OCR entry (2026-06-11) sits at the top: it uploads a
 * nutrition-panel photo to /api/nutrition/scan-label and PRE-FILLS the
 * per-100g macros. The form stays the source of truth — the user confirms
 * every value before saving; low-confidence / implausible scans surface a
 * "double-check" warning (never silently accepted).
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

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, Camera, ChevronDown, ChevronUp, Loader2, Plus, X } from "lucide-react";
import { track, isFeatureEnabled } from "../../../lib/analytics/track";
import { AnalyticsEvents } from "../../../lib/analytics/events";
import { COMPLETE_DAY_V3_COPY } from "../../../lib/completeDayV3";
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
  convertMacrosBetweenBases,
  customFoodToMacrosPer100g,
  normaliseCustomFoodName,
  validateCustomFoodBarcode,
  type CustomFood,
  type CustomFoodServing,
  type MacroBasis,
} from "../../../lib/nutrition/customFoods";
// ENG-748 #15 (2026-05-27) — density-aware "1 cup → grams" converter
// (web parity with the mobile CreateCustomFoodSheet). Same shared, sourced
// density table + conversion math; only converts when density is known.
import { isVolumeUnit, volumeToGrams } from "../../../lib/nutrition/volumeToGrams";
import { parseIngredientLine } from "../../../lib/recipe-ingredients/parseIngredientLine";

/** F-156 PR-1 — localStorage key for the user's last-chosen macro basis. */
const MACRO_BASIS_STORAGE_KEY = "suppr.customFood.macroBasis.v1";

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
  /**
   * F-156 PR-2 (2026-05-10) — barcode prefill from a scan-not-found
   * flow. When set (and `initialFood` is unset, i.e. create mode), the
   * barcode field is pre-populated and the detailed-nutrition disclosure
   * is auto-opened. Wired from the today-barcode-dialog
   * "Add as custom food" CTA.
   */
  initialBarcode?: string;
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
  initialBarcode,
  onSave,
}: CreateCustomFoodDialogProps) {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [servingLabel, setServingLabel] = useState("");
  const [servingGramsText, setServingGramsText] = useState("");
  /**
   * F-156 PR-2 (2026-05-10) — additional serving rows beyond the first
   * canonical natural serving. First row stays in `servingLabel` +
   * `servingGramsText` because it drives the basis toggle, preview,
   * and per-serving conversion. Unlimited (Grace 2026-05-10 override).
   */
  const [additionalServings, setAdditionalServings] = useState<
    Array<{ label: string; grams: string }>
  >([]);
  const [servingsPerContainerText, setServingsPerContainerText] = useState("");
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
  // F-156 PR-1 — macro basis the user is currently entering values in.
  const [macroBasis, setMacroBasis] = useState<MacroBasis>("per_100g");
  const [conversionNotice, setConversionNotice] = useState<string | null>(null);
  const conversionNoticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialBasisAppliedRef = useRef(false);
  // Recipe-vision contract (2026-06-11) — "Scan label" OCR pre-fill state.
  // Web parity with the mobile CreateCustomFoodSheet. The form stays the
  // source of truth: OCR only pre-fills per-100g values the user confirms.
  const scanInputRef = useRef<HTMLInputElement | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanWarning, setScanWarning] = useState<string | null>(null);

  // Reset every time the dialog opens so a cancelled edit doesn't leak
  // into a new session.
  useEffect(() => {
    if (!open) {
      initialBasisAppliedRef.current = false;
      return;
    }
    if (initialFood) {
      setName(initialFood.name);
      setBrand(initialFood.brand ?? "");
      const first = (initialFood.servings ?? []).find(
        (s) => s.label.trim() !== "" && s.grams > 0,
      );
      setServingLabel(first?.label ?? "");
      setServingGramsText(first ? formatNumber(first.grams) : "");
      // F-156 PR-2 — load any saved servings beyond the first into
      // the additional rows.
      const rest = (initialFood.servings ?? [])
        .filter(
          (s, idx) =>
            !(idx === (initialFood.servings ?? []).indexOf(first!) && first) &&
            s.label.trim() !== "" &&
            s.grams > 0,
        )
        .map((s) => ({ label: s.label, grams: formatNumber(s.grams) }));
      setAdditionalServings(rest);
      setServingsPerContainerText(
        initialFood.servingsPerContainer != null
          ? formatNumber(initialFood.servingsPerContainer)
          : "",
      );
      // F-156 PR-1 — render macro fields in the chosen basis.
      const servingG = first?.grams ?? 0;
      const initialBasis: MacroBasis = servingG > 0 ? "per_serving" : "per_100g";
      const per100g = customFoodToMacrosPer100g({
        baseGrams: initialFood.baseGrams,
        calories: initialFood.calories,
        protein: initialFood.protein,
        carbs: initialFood.carbs,
        fat: initialFood.fat,
        fiber: initialFood.fiber,
      });
      const displayed = convertMacrosBetweenBases(
        {
          calories: per100g.calories,
          protein: per100g.protein,
          carbs: per100g.carbs,
          fat: per100g.fat,
          fiber: per100g.fiberG,
        },
        "per_100g",
        initialBasis,
        servingG,
      );
      setCaloriesText(displayed.calories > 0 ? formatNumber(displayed.calories) : "");
      setProteinText(displayed.protein > 0 ? formatNumber(displayed.protein) : "");
      setCarbsText(displayed.carbs > 0 ? formatNumber(displayed.carbs) : "");
      setFatText(displayed.fat > 0 ? formatNumber(displayed.fat) : "");
      setFiberText(initialFood.fiber != null && displayed.fiber > 0 ? formatNumber(displayed.fiber) : "");
      setMacroBasis(initialBasis);
      initialBasisAppliedRef.current = true;
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
      setAdditionalServings([]);
      setServingsPerContainerText("");
      setCaloriesText("");
      setProteinText("");
      setCarbsText("");
      setFatText("");
      setFiberText("");
      setSugarText("");
      setSatFatText("");
      setSodiumText("");
      // F-156 PR-2 — prefill barcode + auto-open the disclosure when
      // the host opened the dialog from a barcode-not-found CTA.
      setBarcode(initialBarcode ?? "");
      setDetailsOpen(Boolean(initialBarcode));
      // F-156 PR-1 — restore last-chosen basis from localStorage.
      let stored: string | null = null;
      try {
        stored = typeof window !== "undefined" ? window.localStorage.getItem(MACRO_BASIS_STORAGE_KEY) : null;
      } catch {
        stored = null;
      }
      setMacroBasis(stored === "per_serving" ? "per_serving" : "per_100g");
      initialBasisAppliedRef.current = true;
    }
    setSaving(false);
    setConversionNotice(null);
    setScanLoading(false);
    setScanError(null);
    setScanWarning(null);
    if (conversionNoticeTimeoutRef.current) {
      clearTimeout(conversionNoticeTimeoutRef.current);
      conversionNoticeTimeoutRef.current = null;
    }
  }, [open, initialFood, initialName, initialBarcode]);

  // Cleanup timer on unmount.
  useEffect(() => {
    return () => {
      if (conversionNoticeTimeoutRef.current) {
        clearTimeout(conversionNoticeTimeoutRef.current);
      }
    };
  }, []);

  const servingGrams = toNumber(servingGramsText);
  const servingLabelClean = servingLabel.trim();
  const hasServingLabel = servingLabelClean.length > 0;
  const hasServingGrams = servingGrams > 0;

  // ENG-748 #15 — density-aware volume→grams helper for the primary serving
  // row (mirrors the mobile sheet). When the serving label parses to a volume
  // measure and the food's density is known, offer a one-tap convert; when
  // the density is unknown, say so plainly rather than guessing.
  const volumeConversion = useMemo<
    | { kind: "known"; grams: number; unitLabel: string; gPerMl: number }
    | { kind: "unknown"; unitLabel: string }
    | null
  >(() => {
    if (!hasServingLabel) return null;
    const parsed = parseIngredientLine(servingLabelClean);
    const unit = parsed.unit.trim().toLowerCase();
    if (!isVolumeUnit(unit)) return null;
    const amount = Number.parseFloat(parsed.amount);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    const result = volumeToGrams({ foodName: name, amount, unit });
    const unitLabel = `${amount} ${unit}`;
    if (result.densityKnown) {
      return { kind: "known", grams: result.grams, unitLabel, gPerMl: result.gPerMl };
    }
    return { kind: "unknown", unitLabel };
  }, [hasServingLabel, servingLabelClean, name]);

  const firstServingValid =
    (!hasServingLabel && !hasServingGrams) ||
    (hasServingLabel && hasServingGrams);
  // F-156 PR-2 — same both-or-neither rule per additional row.
  const additionalServingsValid = additionalServings.every((row) => {
    const hasLabel = row.label.trim().length > 0;
    const grams = toNumber(row.grams);
    const hasG = grams > 0;
    return (!hasLabel && !hasG) || (hasLabel && hasG);
  });
  const servingValid = firstServingValid && additionalServingsValid;

  // F-156 PR-1 — per_serving requires a valid serving.
  const perServingAvailable = hasServingLabel && hasServingGrams;
  const effectiveBasis: MacroBasis = perServingAvailable ? macroBasis : "per_100g";
  const baseGrams = effectiveBasis === "per_serving" ? servingGrams : 100;

  const macros = useMemo(
    () => ({
      baseGrams,
      calories: toNumber(caloriesText),
      protein: toNumber(proteinText),
      carbs: toNumber(carbsText),
      fat: toNumber(fatText),
      fiber: fiberText.trim() ? toNumber(fiberText) : undefined,
      sugarG: sugarText.trim() ? toNumber(sugarText) : undefined,
      sodiumMg: sodiumText.trim() ? toNumber(sodiumText) : undefined,
    }),
    [baseGrams, caloriesText, proteinText, carbsText, fatText, fiberText, sugarText, sodiumText],
  );

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

  // F-156 PR-1 — basis flip handler (mirrors mobile).
  const flipBasisTo = (next: MacroBasis) => {
    if (next === macroBasis) return;
    if (next === "per_serving" && !perServingAvailable) return;
    const hasAnyMacro =
      caloriesText.trim() !== "" ||
      proteinText.trim() !== "" ||
      carbsText.trim() !== "" ||
      fatText.trim() !== "" ||
      fiberText.trim() !== "";
    if (hasAnyMacro && servingGrams > 0) {
      const converted = convertMacrosBetweenBases(
        {
          calories: toNumber(caloriesText),
          protein: toNumber(proteinText),
          carbs: toNumber(carbsText),
          fat: toNumber(fatText),
          fiber: toNumber(fiberText),
        },
        macroBasis,
        next,
        servingGrams,
      );
      if (caloriesText.trim() !== "") setCaloriesText(formatNumber(converted.calories));
      if (proteinText.trim() !== "") setProteinText(formatNumber(converted.protein));
      if (carbsText.trim() !== "") setCarbsText(formatNumber(converted.carbs));
      if (fatText.trim() !== "") setFatText(formatNumber(converted.fat));
      if (fiberText.trim() !== "") setFiberText(formatNumber(converted.fiber));
      const targetLabel = next === "per_serving" ? "per serving" : "per 100 g";
      setConversionNotice(`Values converted to ${targetLabel}.`);
      if (conversionNoticeTimeoutRef.current) {
        clearTimeout(conversionNoticeTimeoutRef.current);
      }
      conversionNoticeTimeoutRef.current = setTimeout(() => {
        setConversionNotice(null);
        conversionNoticeTimeoutRef.current = null;
      }, 3000);
    }
    setMacroBasis(next);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(MACRO_BASIS_STORAGE_KEY, next);
      }
    } catch {
      /* localStorage may be unavailable in some embedded contexts */
    }
  };

  // Snap basis back if the serving fields are cleared.
  useEffect(() => {
    if (!open || !initialBasisAppliedRef.current) return;
    if (macroBasis === "per_serving" && !perServingAvailable) {
      setMacroBasis("per_100g");
    }
  }, [open, macroBasis, perServingAvailable]);

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

  // Recipe-vision contract (2026-06-11) — "Scan label" OCR pre-fill (web
  // parity with the mobile CreateCustomFoodSheet). Uploads a nutrition-label
  // photo to /api/nutrition/scan-label, pre-fills the per-100g macro fields,
  // and warns when the route flags low confidence / implausible macros. The
  // form stays the source of truth: the user confirms every value before
  // saving. Auth rides the browser's Supabase cookie (no header needed).
  const handleScanLabelFile = async (file: File) => {
    setScanLoading(true);
    setScanError(null);
    setScanWarning(null);
    try {
      const form = new FormData();
      form.append("image", file);
      const ac = new AbortController();
      const clientTimeout = setTimeout(() => ac.abort(), 55_000);
      let resp: Response;
      try {
        resp = await fetch("/api/nutrition/scan-label", {
          method: "POST",
          body: form,
          signal: ac.signal,
        });
      } finally {
        clearTimeout(clientTimeout);
      }
      const data = (await resp.json().catch(() => null)) as
        | (Record<string, unknown> & { ok: true })
        | { ok: false; message?: string }
        | null;
      if (!data || !resp.ok || data.ok !== true) {
        setScanError(
          (data && "message" in data && typeof data.message === "string" && data.message) ||
            "Couldn't read the label. Try a sharper, well-lit photo of the nutrition panel.",
        );
        return;
      }
      const d = data as Record<string, unknown>;
      const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

      setMacroBasis("per_100g");
      try {
        localStorage.setItem(MACRO_BASIS_STORAGE_KEY, "per_100g");
      } catch {
        /* localStorage may be unavailable (private mode) */
      }
      if (typeof d.name === "string" && d.name.trim() && !name.trim()) {
        setName(d.name.trim());
      }
      setCaloriesText(formatNumber(Math.round(num(d.calories))));
      setProteinText(formatNumber(Math.round(num(d.protein) * 10) / 10));
      setCarbsText(formatNumber(Math.round(num(d.carbs) * 10) / 10));
      setFatText(formatNumber(Math.round(num(d.fat) * 10) / 10));
      setFiberText(num(d.fiberG) > 0 ? formatNumber(Math.round(num(d.fiberG) * 10) / 10) : "");
      setSugarText(num(d.sugarG) > 0 ? formatNumber(Math.round(num(d.sugarG) * 10) / 10) : "");
      setSatFatText(
        num(d.saturatedFatG) > 0 ? formatNumber(Math.round(num(d.saturatedFatG) * 10) / 10) : "",
      );
      setSodiumText(num(d.sodiumMg) > 0 ? formatNumber(Math.round(num(d.sodiumMg))) : "");
      setDetailsOpen(true);

      if (d.implausible === true) {
        setScanWarning(
          "These numbers look unusual — the label may have been read wrong. Double-check each value before saving.",
        );
      } else if (d.confidence === "low") {
        setScanWarning("The label was hard to read. Double-check each value before saving.");
      }

      try {
        track(AnalyticsEvents.custom_food_label_scanned, {
          confidence: typeof d.confidence === "string" ? d.confidence : "unknown",
          implausible: d.implausible === true,
          platform: "web",
        });
      } catch {
        /* noop */
      }
    } catch {
      setScanError("Couldn't reach the AI service. Check your connection and try again.");
    } finally {
      setScanLoading(false);
    }
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      // F-156 PR-2 — first row + any valid additional rows. Empty
      // trailing rows stripped silently; per-row validation is
      // already enforced by `servingValid`.
      const servings: CustomFoodServing[] =
        hasServingLabel && hasServingGrams
          ? [{ label: servingLabelClean, grams: servingGrams }]
          : [];
      for (const row of additionalServings) {
        const label = row.label.trim();
        const grams = toNumber(row.grams);
        if (label.length > 0 && grams > 0) {
          servings.push({ label, grams });
        }
      }
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
          {/* Recipe-vision contract (2026-06-11) — "Scan label" OCR fast-fill
              (web parity with the mobile sheet). Uploads a nutrition-label
              photo and pre-fills the per-100g macros below; the user confirms
              every value before saving. Secondary outline treatment — Save is
              the dialog's one filled CTA. */}
          <div className="grid gap-1.5">
            <input
              ref={scanInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              data-testid="custom-food-scan-input"
              onChange={(e) => {
                const f = e.target.files?.[0];
                // Reset so re-selecting the same file re-triggers onChange.
                e.target.value = "";
                if (f) void handleScanLabelFile(f);
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={scanLoading}
              aria-busy={scanLoading}
              data-testid="custom-food-scan-label"
              onClick={() => scanInputRef.current?.click()}
              className="w-full"
            >
              {scanLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Camera className="h-4 w-4" aria-hidden />
              )}
              {scanLoading ? "Reading label…" : "Scan label"}
            </Button>
            {scanError && (
              <p className="text-xs text-destructive" role="alert" aria-live="polite">
                {scanError}
              </p>
            )}
            {scanWarning && (
              <p className="text-xs text-warning-solid" role="status" aria-live="polite">
                {scanWarning}
              </p>
            )}
          </div>
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

            {/* ENG-748 #15 (2026-05-27) — density-aware volume→grams
                converter. Shows only when the serving label is a volume
                measure. Known density → one-tap convert; unknown → say so
                rather than guessing a wrong gram weight. */}
            {volumeConversion?.kind === "known" && !hasServingGrams && (
              <button
                type="button"
                onClick={() => setServingGramsText(formatNumber(volumeConversion.grams))}
                data-testid="custom-food-volume-convert"
                aria-label={`Convert ${volumeConversion.unitLabel} to ${volumeConversion.grams} grams`}
                className="flex items-center gap-1 text-sm font-medium text-primary-solid hover:underline self-start py-1"
              >
                <ArrowLeftRight className="w-4 h-4" />
                Convert {volumeConversion.unitLabel} → {formatNumber(volumeConversion.grams)} g
              </button>
            )}
            {volumeConversion?.kind === "unknown" && !hasServingGrams && (
              <p
                data-testid="custom-food-volume-unknown"
                role="status"
                aria-live="polite"
                className="text-xs text-muted-foreground leading-relaxed"
              >
                We can&apos;t auto-convert {volumeConversion.unitLabel} for this food — its weight
                depends on density. Weigh it and enter grams.
              </p>
            )}

            {/* F-156 PR-2 (2026-05-10) — additional serving rows.
                Compact list ([label] [grams] [×]) under the first
                row so users can add "1 slice" + "1 loaf" + "1 cup".
                Unlimited (Grace 2026-05-10 override). First row above
                stays the canonical serving used by the basis toggle
                + preview. */}
            {additionalServings.map((row, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2"
                data-testid={`custom-food-additional-serving-${idx}`}
              >
                <Input
                  type="text"
                  value={row.label}
                  onChange={(e) =>
                    setAdditionalServings((rows) =>
                      rows.map((r, i) => (i === idx ? { ...r, label: e.target.value } : r)),
                    )
                  }
                  placeholder="e.g. 1 cup"
                  maxLength={40}
                  aria-label={`Additional serving ${idx + 2} label`}
                  className="flex-1"
                />
                <Input
                  type="number"
                  inputMode="decimal"
                  value={row.grams}
                  onChange={(e) =>
                    setAdditionalServings((rows) =>
                      rows.map((r, i) => (i === idx ? { ...r, grams: e.target.value } : r)),
                    )
                  }
                  placeholder="grams"
                  min={0}
                  step="any"
                  aria-label={`Additional serving ${idx + 2} grams`}
                  className="w-24"
                />
                <button
                  type="button"
                  onClick={() =>
                    setAdditionalServings((rows) => rows.filter((_, i) => i !== idx))
                  }
                  aria-label={`Remove serving ${idx + 2}`}
                  data-testid={`custom-food-additional-serving-remove-${idx}`}
                  className="text-muted-foreground hover:text-foreground p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setAdditionalServings((rows) => [...rows, { label: "", grams: "" }])
              }
              data-testid="custom-food-add-serving"
              aria-label="Add another serving"
              className="flex items-center gap-1 text-sm font-medium text-primary-solid hover:underline self-start py-1"
            >
              <Plus className="w-4 h-4" />
              Add another serving
            </button>

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
            <legend className="text-sm font-medium text-foreground">Macros entered as</legend>
            {/* F-156 PR-1 — basis toggle. Macros are stored per-100g
                internally; the toggle picks which basis the user
                enters them in. Per-serving option is disabled until a
                natural serving (label + grams) is set. */}
            <div
              role="radiogroup"
              aria-label="Macro entry basis"
              className="grid grid-cols-2 gap-1 rounded-md border border-border p-0.5"
            >
              {(
                [
                  { value: "per_serving" as MacroBasis, label: "Per serving", disabled: !perServingAvailable },
                  { value: "per_100g" as MacroBasis, label: "Per 100 g", disabled: false },
                ]
              ).map((opt) => {
                const selected = effectiveBasis === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-disabled={opt.disabled}
                    disabled={opt.disabled}
                    onClick={() => flipBasisTo(opt.value)}
                    data-testid={`custom-food-basis-${opt.value}`}
                    className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                      selected
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-muted/40"
                    } ${opt.disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {effectiveBasis === "per_100g" && !perServingAvailable && (
              <p className="text-xs text-muted-foreground">
                Add a serving size above to switch to per-serving entry.
              </p>
            )}
            {conversionNotice && (
              <p className="text-xs text-success" aria-live="polite" role="status">
                {conversionNotice}
              </p>
            )}
            {/* F-156 PR-1 — 2x3 macro grid. Fibre joins the grid as a
                first-class field so the visual rhythm matches the four
                core macros. */}
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
              <div className="grid gap-1">
                <Label htmlFor="custom-food-fiber">Fibre (g)</Label>
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
              {/* Empty cell preserves the 2-column rhythm. */}
              <div />
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
                  {isFeatureEnabled("eng1247_section_a_v1") && barcode.trim() ? (
                    <p className="text-xs leading-5 text-muted-foreground">
                      {COMPLETE_DAY_V3_COPY.sharedAnonymouslyNote}
                    </p>
                  ) : null}
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
