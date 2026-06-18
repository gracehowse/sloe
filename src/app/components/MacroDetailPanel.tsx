"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Salad } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import {
  deriveIngredientBreakdown,
  toBreakdownEntry,
  type BreakdownIngredientRow,
  type BreakdownMacro,
} from "@/lib/nutrition/macroIngredientBreakdown";
import { isFeatureEnabled } from "../../lib/analytics/track.ts";

export type MacroKey = "protein" | "carbs" | "fat" | "fiber" | "calories";

/**
 * Single source of truth for which macro keys actually open the per-macro
 * detail panel. The Today macro tiles + bars render these — and only these —
 * as interactive controls; the `openMacroDetail` handler in NutritionTracker
 * guards on the same set. Reference-only nutrients (sugar, sodium, water) are
 * NOT in this set: the panel has no breakdown for them, so they must render as
 * plain, non-interactive elements (ENG-848 — dead-tap a11y fix). `calories` is
 * a valid `MacroKey` for the panel itself but is not surfaced as a tile/bar, so
 * it is intentionally excluded here.
 *
 * Consumed by:
 *   - src/app/components/suppr/today-dashboard-macro-tiles.tsx (affordance)
 *   - src/app/components/suppr/today-dashboard-macro-bars.tsx  (affordance)
 *   - src/app/components/NutritionTracker.tsx → openMacroDetail (handler guard)
 */
export const MACRO_DETAIL_SUPPORTED_KEYS = [
  "protein",
  "carbs",
  "fat",
  "fiber",
] as const satisfies readonly MacroKey[];

export type MacroDetailSupportedKey =
  (typeof MACRO_DETAIL_SUPPORTED_KEYS)[number];

const MACRO_DETAIL_SUPPORTED_SET: ReadonlySet<string> = new Set(
  MACRO_DETAIL_SUPPORTED_KEYS,
);

/** True when `macro` opens a per-macro detail panel (a tile/bar is interactive). */
export function isMacroDetailSupported(
  macro: string,
): macro is MacroDetailSupportedKey {
  return MACRO_DETAIL_SUPPORTED_SET.has(macro);
}

export interface MacroMeal {
  name: string;
  recipeTitle: string;
  /**
   * Optional fields used by the "By ingredient" breakdown (ENG-748 #10). When
   * absent, the meal still renders in the "By meal" view; the ingredient view
   * falls back to a self-named line for that entry.
   */
  id?: string;
  recipeId?: string | null;
  portionMultiplier?: number | null;
  [key: string]: number | string | Record<string, number> | null | undefined;
}

export interface MacroDetailPanelProps {
  macro: MacroKey;
  meals: MacroMeal[];
  open: boolean;
  onClose: () => void;
  /**
   * Base-servings `recipe_ingredients` rows for the day's recipes (one batched
   * query, keyed by recipeId). Optional — when omitted the "By ingredient" view
   * falls back to one self-named line per entry. The CALLER does the I/O
   * (mirrors the mobile macro-detail screen): fetch the day's distinct non-null
   * recipe_ids and run a single `.in("recipe_id", ids)` query.
   */
  ingredientRows?: BreakdownIngredientRow[];
}

const MACRO_CONFIG: Record<
  MacroKey,
  { label: string; cssVar: string; unit: string }
> = {
  protein: { label: "Protein", cssVar: "var(--macro-protein)", unit: "g" },
  carbs: { label: "Carbs", cssVar: "var(--macro-carbs)", unit: "g" },
  fat: { label: "Fat", cssVar: "var(--macro-fat)", unit: "g" },
  fiber: { label: "Fiber", cssVar: "var(--success)", unit: "g" },
  calories: { label: "Calories", cssVar: "var(--macro-calories)", unit: "kcal" },
};

type BreakdownMode = "meal" | "ingredient";

/**
 * Look up the numeric value for the given macro from a meal record.
 *
 * Handles both the direct key ("protein", "carbs", "fat", "calories") and the
 * mobile-style key ("fiberG") for fiber.
 */
export function getMacroValue(meal: MacroMeal, macro: MacroKey): number {
  if (macro === "fiber") {
    const raw = meal.fiberG ?? meal.fiber ?? 0;
    const direct = typeof raw === "number" ? raw : Number(raw) || 0;
    if (direct > 0) return direct;
    // ENG-732 — fall back to micros.fiberG. Health / dense-log entries store
    // fibre only in the micros map, not as a top-level column; without this
    // the breakdown under-reports vs the day total + mobile, which both use
    // the shared `mealContributedFiberG`. `micros` isn't part of MacroMeal's
    // index signature, so read it defensively.
    const micros = (meal as { micros?: Record<string, number> | null }).micros;
    const fromMicro = micros?.fiberG;
    return typeof fromMicro === "number" && Number.isFinite(fromMicro)
      ? Math.max(0, fromMicro)
      : 0;
  }
  const v = meal[macro] ?? 0;
  return typeof v === "number" ? v : Number(v) || 0;
}

/**
 * MacroDetailPanel -- Per-meal / per-ingredient breakdown of a specific macro.
 *
 * "By meal" lists each logged meal with the macro value + a proportion bar.
 * "By ingredient" (ENG-748 #10) derives each logged recipe's ingredient
 * contributions (ingredient base-servings macro × entry portion_multiplier,
 * reconciled to the entry's stored total) via the shared web+mobile helper.
 * Matches apps/mobile/app/macro-detail.tsx.
 */
export function MacroDetailPanel({
  macro,
  meals,
  open,
  onClose,
  ingredientRows,
}: MacroDetailPanelProps) {
  const config = MACRO_CONFIG[macro];
  const router = useRouter();
  const [mode, setMode] = useState<BreakdownMode>("meal");
  // ENG-825 (2026-05-31 design-direction macro/meal lane). Web mirror of the
  // mobile `NutritionDetailEmptyState`: when `design_system_elevation` is ON
  // the empty state becomes an iconified, elevated card (modern radius +
  // ambient shadow) instead of a single line of text in a sea of whitespace.
  // Flag OFF keeps the legacy one-line empty state alive in the else.
  const redesignElevation = isFeatureEnabled("design_system_elevation");
  // P5 parity gap #9 (2026-05-31). Mirror of the mobile macro-detail empty
  // state's "Log a meal" commit CTA (NutritionDetailEmptyState +
  // apps/mobile/app/macro-detail.tsx): the CTA recolours its fill to the blue
  // commit colour when `design_system_colours` is ON, and falls back to the
  // saturated macro hue (mobile's `ctaColorLegacy={config.color}`) when OFF.
  // The button itself only renders inside the elevated empty card, matching
  // mobile; the old flag-OFF (legacy macro-hue) fill stays alive in the else.
  const redesignColours = isFeatureEnabled("design_system_colours");

  // Web macro-detail is a Dialog (mobile's is a full screen routing to Today).
  // Mirror the mobile CTA action — open the Today log flow — by closing the
  // dialog first, then navigating to the canonical web Today route.
  const handleLogMeal = () => {
    onClose();
    router.push("/today");
  };

  const { total, mealValues } = useMemo(() => {
    const values = meals.map((meal) => ({
      meal,
      value: getMacroValue(meal, macro),
    }));
    const sum = values.reduce((acc, v) => acc + v.value, 0);
    return { total: sum, mealValues: values };
  }, [meals, macro]);

  // Derive the per-ingredient breakdown via the SHARED helper (same module
  // mobile uses) so the scale/reconcile logic is single-sourced.
  const ingredientBreakdown = useMemo(() => {
    const entries = meals.map((m) =>
      toBreakdownEntry({
        id: m.id ?? "",
        name: m.name,
        recipeTitle: m.recipeTitle,
        recipeId: m.recipeId ?? null,
        portionMultiplier: m.portionMultiplier ?? 1,
        calories: typeof m.calories === "number" ? m.calories : Number(m.calories) || 0,
        protein: typeof m.protein === "number" ? m.protein : Number(m.protein) || 0,
        carbs: typeof m.carbs === "number" ? m.carbs : Number(m.carbs) || 0,
        fat: typeof m.fat === "number" ? m.fat : Number(m.fat) || 0,
        fiberG: getMacroValue(m, "fiber"),
      }),
    );
    return deriveIngredientBreakdown(entries, ingredientRows ?? [], macro as BreakdownMacro);
  }, [meals, ingredientRows, macro]);

  const formatValue = (v: number): string => {
    const rounded = Math.round(v * 10) / 10;
    return `${rounded}${config.unit}`;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {config.label} Breakdown
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {mode === "meal"
              ? `Per-meal ${config.label.toLowerCase()} breakdown for today.`
              : `Per-ingredient ${config.label.toLowerCase()} breakdown for today.`}
          </DialogDescription>
        </DialogHeader>

        <div className="pt-2">
          {meals.length === 0 ? (
            redesignElevation ? (
              <div
                data-testid="macro-detail-empty"
                // Flat-card surfaces (2026-06-12, Withings grammar): the
                // redesign empty-state card sits flat — the ambient lift
                // (`shadow-[0_4px_12px_…]`, a soft-lift-wave sibling) is retired.
                className="my-4 flex flex-col items-center gap-2 rounded-xl border border-border bg-card px-5 py-8 text-center"
              >
                <div className="mb-1 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                  <Salad className="h-6 w-6 text-muted-foreground" strokeWidth={1.75} />
                </div>
                <p className="text-[18px] font-bold text-foreground">
                  No meals logged yet
                </p>
                <p className="max-w-[280px] text-sm leading-5 text-muted-foreground">
                  Log a meal to see your {config.label.toLowerCase()} broken down here.
                </p>
                {/* Blue commit CTA (parity gap #9): mirrors the mobile
                    macro-detail empty-state "Log a meal" button. Fill recolours
                    to the blue commit colour under `design_system_colours`;
                    flag-OFF keeps the saturated macro hue (mobile's
                    `ctaColorLegacy={config.color}`). */}
                <button
                  type="button"
                  onClick={handleLogMeal}
                  aria-label="Log a meal on Today"
                  className={`mt-3 inline-flex items-center gap-2 rounded-md px-6 py-2.5 text-sm font-bold ${
                    redesignColours ? "bg-primary text-primary-foreground" : "text-white"
                  }`}
                  style={!redesignColours ? { backgroundColor: config.cssVar } : undefined}
                >
                  <Plus className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                  Log a meal
                </button>
              </div>
            ) : (
              <p data-testid="macro-detail-empty" className="py-8 text-center text-sm text-muted-foreground">
                No meals logged for this day.
              </p>
            )
          ) : (
            <>
              {/* Segmented toggle: By meal / By ingredient. Mirrors the mobile
                  macro-detail screen control. */}
              <div
                role="tablist"
                aria-label="Breakdown mode"
                className="mb-3 flex gap-0.5 rounded-full bg-muted p-0.5"
              >
                {(["meal", "ingredient"] as const).map((m) => {
                  const isActive = mode === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      aria-label={m === "meal" ? "By meal" : "By ingredient"}
                      onClick={() => setMode(m)}
                      // Segmented grammar (web parity 2026-06-10, ENG-1022):
                      // active thumb = white `bg-card` lift + `primary-solid`
                      // label + `font-semibold` + `shadow-sm` (matches the
                      // Progress Trend/Scale toggle, treatment §8). Was a
                      // `font-bold text-foreground` thumb — converged so both
                      // segmented controls read identically.
                      className={`flex-1 rounded-full py-1.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                        isActive
                          ? "bg-card font-semibold text-primary-solid shadow-sm"
                          : "font-medium text-muted-foreground"
                      }`}
                    >
                      {m === "meal" ? "By meal" : "By ingredient"}
                    </button>
                  );
                })}
              </div>

              {mode === "ingredient" ? (
                <div data-testid="macro-detail-ingredient-list" className="divide-y divide-border">
                  {ingredientBreakdown.lines.map((line, i) => {
                    const pct =
                      ingredientBreakdown.total > 0
                        ? line.value / ingredientBreakdown.total
                        : 0;
                    return (
                      <div key={`${line.name}-${i}`} className="flex items-center gap-3 py-3">
                        <div
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: config.cssVar, opacity: 0.3 + pct * 0.7 }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {line.name}
                          </p>
                        </div>
                        <span
                          className="shrink-0 text-sm font-bold tabular-nums"
                          style={{ color: config.cssVar }}
                        >
                          {formatValue(line.value)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <>
                  {/* Meal list */}
                  <div className="divide-y divide-border">
                    {mealValues.map(({ meal, value }, i) => {
                      const pct = total > 0 ? value / total : 0;
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-3 py-3"
                        >
                          {/* Proportion dot */}
                          <div
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{
                              backgroundColor: config.cssVar,
                              opacity: 0.3 + pct * 0.7,
                            }}
                          />

                          {/* Meal info */}
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              {meal.name}
                            </p>
                            <p className="truncate text-sm font-medium text-foreground">
                              {meal.recipeTitle}
                            </p>
                          </div>

                          {/* Value */}
                          <span
                            className="shrink-0 text-sm font-bold tabular-nums"
                            style={{ color: config.cssVar }}
                          >
                            {formatValue(value)}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Visual breakdown bar */}
                  <div
                    className="mt-4 rounded-lg p-3"
                    style={{ backgroundColor: `color-mix(in srgb, ${config.cssVar} 8%, transparent)` }}
                  >
                    <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-border">
                      {mealValues.map(({ value }, i) => {
                        const pct = total > 0 ? (value / total) * 100 : 0;
                        return (
                          <div
                            key={i}
                            className="h-full"
                            style={{
                              width: `${Math.max(pct, 1)}%`,
                              backgroundColor: config.cssVar,
                              opacity: 0.4 + (i % 3) * 0.2,
                            }}
                          />
                        );
                      })}
                    </div>
                    <p className="mt-2 text-center text-[11px] text-muted-foreground">
                      {formatValue(total)} across {meals.length} meal{meals.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </>
              )}

              {/* Total */}
              <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                <span className="text-sm font-bold text-foreground">Total</span>
                <span
                  className="text-base font-extrabold tabular-nums"
                  style={{ color: config.cssVar }}
                >
                  {formatValue(mode === "ingredient" ? ingredientBreakdown.total : total)}
                </span>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
