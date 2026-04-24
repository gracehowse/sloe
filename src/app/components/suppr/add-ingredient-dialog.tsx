"use client";

/**
 * AddIngredientDialog (Batch 2.7) — let the user add a new ingredient to an
 * already-imported recipe. Covers the "I also added cheese" gap where the
 * importer missed a row.
 *
 * Flow:
 *  1. User types a name (e.g. "cheddar cheese") + quantity + unit.
 *  2. "Find match" button calls the verify pipeline with a single-row body
 *     to pull macros from USDA / OFF / Suppr DB.
 *  3. If a match is found, its macros populate the preview. If not, the
 *     user can expand the "Manual override" section and type label values.
 *  4. On Save, the new row is persisted with `addedByUser: true`. When a
 *     manual override was typed, it's persisted as `overrideMacros` too.
 *
 * The dialog itself does not persist — it calls `onAdd(payload)` and lets
 * the parent (`RecipeDetail`) do the actual write. This keeps the dialog
 * testable and keeps the Supabase-write logic in one place.
 */

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
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
import type { IngredientOverride } from "../../../types/recipe";
import { AnalyticsEvents } from "../../../lib/analytics/events";
import { track } from "../../../lib/analytics/track";
import { sanitizeOverrideInput } from "../../../lib/nutrition/ingredientOverrides";
import { ingredientVerifyNeedsReview } from "../../../lib/nutrition/verifyConfidencePolicy";

export type AddIngredientPayload = {
  name: string;
  amount: string;
  unit: string;
  /** Matched-source macros (may be zero when the user skipped find-match). */
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
  /** "USDA" / "OFF" / "Manual" / "Estimated". */
  source: string;
  /** True when the verify pipeline returned a plausible match. */
  hasMatch: boolean;
  /** Confidence from the pipeline (0–1). Used to flag low-confidence rows. */
  confidence: number;
  /** When the user typed in override numbers, persist them. */
  overrideMacros?: IngredientOverride;
};

/** Shape the verify endpoint returns (partial — only what we use). */
type VerifyMatch = {
  matchedName: string | null;
  confidence: number;
  source: string;
  macros: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiberG: number;
    sugarG: number;
    sodiumMg: number;
  } | null;
};

export type AddIngredientDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the new ingredient payload when the user taps Add. */
  onAdd: (payload: AddIngredientPayload) => void | Promise<void>;
  /** When set, low-confidence pipeline matches emit `recipe_verify_needs_review` with this id. */
  recipeId?: string;
};

const UNIT_OPTIONS: { label: string; value: string }[] = [
  { label: "g", value: "g" },
  { label: "ml", value: "ml" },
  { label: "oz", value: "oz" },
  { label: "lb", value: "lb" },
  { label: "tbsp", value: "tbsp" },
  { label: "tsp", value: "tsp" },
  { label: "cup", value: "cup" },
  { label: "piece", value: "piece" },
  { label: "slice", value: "slice" },
];

export function AddIngredientDialog({ open, onOpenChange, onAdd, recipeId }: AddIngredientDialogProps) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("1");
  const [unit, setUnit] = useState("g");
  const [matching, setMatching] = useState(false);
  const [match, setMatch] = useState<VerifyMatch | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [showOverride, setShowOverride] = useState(false);
  const [overrideCal, setOverrideCal] = useState("");
  const [overrideP, setOverrideP] = useState("");
  const [overrideC, setOverrideC] = useState("");
  const [overrideF, setOverrideF] = useState("");
  const [overrideFiber, setOverrideFiber] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset every time the dialog opens so a previous session can't leak.
  useEffect(() => {
    if (open) {
      setName("");
      setAmount("1");
      setUnit("g");
      setMatching(false);
      setMatch(null);
      setMatchError(null);
      setShowOverride(false);
      setOverrideCal("");
      setOverrideP("");
      setOverrideC("");
      setOverrideF("");
      setOverrideFiber("");
      setSaving(false);
    }
  }, [open]);

  const canFindMatch = name.trim().length > 1 && !matching;

  const handleFindMatch = async () => {
    if (!canFindMatch) return;
    setMatching(true);
    setMatchError(null);
    try {
      const res = await fetch("/api/nutrition/verify-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredients: [{ name: name.trim(), amount: amount.trim() || "1", unit: unit.trim() }],
          servings: 1,
        }),
      });
      if (!res.ok) {
        setMatchError("Could not look up macros. Try manual numbers below.");
        setMatch(null);
        return;
      }
      const json = (await res.json()) as {
        ok: boolean;
        verified?: VerifyMatch[];
        avgIngredientConfidence?: number;
        minIngredientConfidence?: number;
      };
      const v = json.ok && Array.isArray(json.verified) ? json.verified[0] : null;
      if (v && v.macros) {
        setMatch(v);
        setMatchError(null);
        const avg = typeof json.avgIngredientConfidence === "number" ? json.avgIngredientConfidence : v.confidence;
        const min = typeof json.minIngredientConfidence === "number" ? json.minIngredientConfidence : v.confidence;
        if (ingredientVerifyNeedsReview(avg, min)) {
          track(AnalyticsEvents.recipe_verify_needs_review, {
            ...(recipeId ? { recipe_id: recipeId } : {}),
            source: "add_ingredient_match",
            platform: "web",
            avgIngredientConfidence: avg,
            minIngredientConfidence: min,
          });
        }
      } else {
        setMatch(null);
        setMatchError("No confident match. Expand manual macros below to enter label values.");
        setShowOverride(true);
      }
    } catch {
      setMatchError("Lookup failed. Try again or enter manual numbers.");
      setMatch(null);
    } finally {
      setMatching(false);
    }
  };

  const overrideRaw = useMemo(
    () => ({
      calories: overrideCal === "" ? null : overrideCal,
      protein: overrideP === "" ? null : overrideP,
      carbs: overrideC === "" ? null : overrideC,
      fat: overrideF === "" ? null : overrideF,
      fiber: overrideFiber === "" ? null : overrideFiber,
    }),
    [overrideCal, overrideP, overrideC, overrideF, overrideFiber],
  );

  const canAdd = name.trim().length > 0 && amount.trim().length > 0 && !saving;

  const handleAdd = async () => {
    if (!canAdd) return;
    setSaving(true);
    try {
      const matchMacros = match?.macros;
      const override = showOverride ? sanitizeOverrideInput(overrideRaw) : null;

      // If the user typed override numbers but no match exists, treat the
      // override values as the row's base macros AND persist the override
      // so the UI shows an "override" badge. If a match exists, the
      // override replaces the match when computing totals.
      const baseCalories = matchMacros?.calories ?? override?.calories ?? 0;
      const baseProtein = matchMacros?.protein ?? override?.protein ?? 0;
      const baseCarbs = matchMacros?.carbs ?? override?.carbs ?? 0;
      const baseFat = matchMacros?.fat ?? override?.fat ?? 0;
      const baseFiber = matchMacros?.fiberG ?? override?.fiber ?? 0;
      const baseSugar = matchMacros?.sugarG ?? 0;
      const baseSodium = matchMacros?.sodiumMg ?? 0;

      const source = match?.source ?? (override ? "Manual" : "Unverified");
      const confidence = match?.confidence ?? (override ? 0.5 : 0);

      const payload: AddIngredientPayload = {
        name: match?.matchedName ?? name.trim(),
        amount: amount.trim(),
        unit: unit.trim(),
        calories: baseCalories,
        protein: baseProtein,
        carbs: baseCarbs,
        fat: baseFat,
        fiberG: baseFiber,
        sugarG: baseSugar,
        sodiumMg: baseSodium,
        source,
        hasMatch: Boolean(matchMacros),
        confidence,
      };
      if (override) {
        payload.overrideMacros = override;
      }
      await onAdd(payload);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Add ingredient</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Add a row the importer missed. We&apos;ll look up macros from USDA / OFF automatically; you can also type label values below.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="add-ing-name" className="text-sm font-medium text-foreground">
              Ingredient
            </Label>
            <Input
              id="add-ing-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. cheddar cheese"
              autoFocus
              autoComplete="off"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="add-ing-amount" className="text-sm font-medium text-foreground">
                Amount
              </Label>
              <Input
                id="add-ing-amount"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="add-ing-unit" className="text-sm font-medium text-foreground">
                Unit
              </Label>
              <select
                id="add-ing-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-input-background px-3 text-sm text-foreground"
              >
                {UNIT_OPTIONS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => void handleFindMatch()}
            disabled={!canFindMatch}
          >
            {matching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Looking up…
              </>
            ) : (
              "Find match"
            )}
          </Button>

          {match?.macros ? (
            <div
              className="rounded-lg border border-border bg-muted/50 p-3 text-sm"
              aria-live="polite"
            >
              <p className="font-medium text-foreground">
                Match: {match.matchedName ?? name.trim()}
              </p>
              <p className="text-xs text-muted-foreground">
                {match.source} · {Math.round(match.macros.calories)} kcal ·{" "}
                {Math.round(match.macros.protein)}P / {Math.round(match.macros.carbs)}C /{" "}
                {Math.round(match.macros.fat)}F
              </p>
            </div>
          ) : null}

          {matchError ? (
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {matchError}
            </p>
          ) : null}

          <details
            open={showOverride}
            onToggle={(e) => setShowOverride((e.target as HTMLDetailsElement).open)}
            className="rounded-lg border border-border bg-card"
          >
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-foreground">
              Manual macros (from label)
            </summary>
            <div className="grid grid-cols-2 gap-3 px-3 pb-3 pt-1">
              <div className="grid gap-1.5">
                <Label htmlFor="ov-cal" className="text-xs text-muted-foreground">
                  Calories (kcal)
                </Label>
                <Input
                  id="ov-cal"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={overrideCal}
                  onChange={(e) => setOverrideCal(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ov-p" className="text-xs text-muted-foreground">
                  Protein (g)
                </Label>
                <Input
                  id="ov-p"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={overrideP}
                  onChange={(e) => setOverrideP(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ov-c" className="text-xs text-muted-foreground">
                  Carbs (g)
                </Label>
                <Input
                  id="ov-c"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={overrideC}
                  onChange={(e) => setOverrideC(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ov-f" className="text-xs text-muted-foreground">
                  Fat (g)
                </Label>
                <Input
                  id="ov-f"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={overrideF}
                  onChange={(e) => setOverrideF(e.target.value)}
                />
              </div>
              <div className="col-span-2 grid gap-1.5">
                <Label htmlFor="ov-fiber" className="text-xs text-muted-foreground">
                  Fiber (g) — optional
                </Label>
                <Input
                  id="ov-fiber"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={overrideFiber}
                  onChange={(e) => setOverrideFiber(e.target.value)}
                />
              </div>
            </div>
          </details>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleAdd()} disabled={!canAdd}>
            {saving ? "Adding…" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AddIngredientDialog;
