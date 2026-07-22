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
  type BreakdownSnapshotRow,
} from "@/lib/nutrition/macroIngredientBreakdown";
import { NUTRITION_ENTRY_INGREDIENTS_FLAG } from "@/lib/nutrition/nutritionEntryIngredients";
import { SegmentedTrack } from "./ui/segmented-track";
import { isFeatureEnabled } from "../../lib/analytics/track.ts";

export type MacroKey = "protein" | "carbs" | "fat" | "fiber" | "calories" | "water";

/**
 * Single source of truth for which macro keys actually open the per-macro
 * detail panel. The Today macro tiles + bars render these — and only these —
 * as interactive controls; the `openMacroDetail` handler in NutritionTracker
 * guards on the same set.
 *
 * The interactive set is web↔mobile parity (ENG-1213): protein/carbs/fat/fiber
 * each have a per-meal AND per-ingredient breakdown; `water` has a per-meal
 * breakdown only (sourced from `nutrition_entries.water_ml`), so the panel hides
 * the By meal / By ingredient toggle for it and always shows the By-meal view —
 * mirroring the mobile `BREAKDOWN_MACROS` exclusion in `app/useMacroDetail.ts`.
 *
 * Reference-only nutrients (sugar, sodium) are NOT in this set: the panel has no
 * breakdown for them, so they must render as plain, non-interactive elements
 * (ENG-848 — dead-tap a11y fix). `calories` is a valid `MacroKey` the panel can
 * still render (e.g. via the ring deep-link) but is NOT a tile/bar — there is no
 * calories tile (calories is the ring) — so it is intentionally excluded from the
 * tile-affordance set on both platforms.
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
  "water",
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
  /**
   * Persisted AI/photo/voice per-item snapshot rows (ENG-751), keyed by entryId.
   * Optional — when present AND the `nutrition_entry_ingredients_v1` flag is on,
   * an AI entry's snapshot rows take precedence over its single-line fallback
   * (the entry splits into one line per item). The CALLER does the I/O (gated by
   * the same flag) and passes them in; mirrors the mobile `useMacroDetail` fetch.
   */
  snapshotRows?: BreakdownSnapshotRow[];
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
  water: { label: "Water", cssVar: "var(--macro-water)", unit: "ml" },
};

/**
 * Macros with a per-ingredient decomposition (the "By ingredient" toggle).
 * `water` is per-meal only (it has no `recipe_ingredients` column to scale),
 * so the toggle is hidden for it — mirrors the mobile `BREAKDOWN_MACROS` set in
 * `apps/mobile/app/useMacroDetail.ts`.
 */
const INGREDIENT_BREAKDOWN_MACROS: ReadonlySet<MacroKey> = new Set<MacroKey>([
  "protein",
  "carbs",
  "fat",
  "fiber",
  "calories",
]);

type BreakdownMode = "meal" | "ingredient";

/**
 * Look up the numeric value for the given macro from a meal record.
 *
 * Handles both the direct key ("protein", "carbs", "fat", "calories") and the
 * mobile-style key ("fiberG") for fiber.
 */
export function getMacroValue(meal: MacroMeal, macro: MacroKey): number {
  if (macro === "water") {
    // Water lives on `nutrition_entries.water_ml` → mapped to `waterMl` on the
    // in-memory LoggedMeal (see useNutritionJournalState). Read defensively
    // (mobile-style `waterMl`, snake `water_ml`, or a bare `water`) and coerce
    // to a finite number ≥ 0 — mirrors the fiber fallback below.
    const raw = meal.waterMl ?? meal.water_ml ?? meal.water ?? 0;
    const n = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }
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
  snapshotRows,
}: MacroDetailPanelProps) {
  const config = MACRO_CONFIG[macro];
  const router = useRouter();
  const [mode, setMode] = useState<BreakdownMode>("meal");
  // Water has a per-meal breakdown only (no `recipe_ingredients` column to
  // scale), so the By meal / By ingredient toggle is hidden for it and the view
  // is pinned to "meal" — mirrors mobile's `BREAKDOWN_MACROS` exclusion.
  const supportsIngredientBreakdown = INGREDIENT_BREAKDOWN_MACROS.has(macro);
  const effectiveMode: BreakdownMode = supportsIngredientBreakdown ? mode : "meal";
  // ENG-825 (2026-05-31 design-direction macro/meal lane). Web mirror of the
  // mobile `NutritionDetailEmptyState`: the empty state is an iconified,
  // elevated card (modern radius + ambient shadow) instead of a single line
  // of text in a sea of whitespace. `design_system_elevation` collapsed
  // (ENG-1651) — this was permanently ON via REDESIGN_DEFAULT_ON; the legacy
  // one-line empty state is removed.
  // P5 parity gap #9 (2026-05-31). Mirror of the mobile macro-detail empty
  // state's "Log a meal" commit CTA (NutritionDetailEmptyState +
  // apps/mobile/app/macro-detail.tsx): the CTA recolours its fill to the blue
  // commit colour when `design_system_colours` is ON, and falls back to the
  // saturated macro hue (mobile's `ctaColorLegacy={config.color}`) when OFF.
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
  // mobile uses) so the scale/reconcile logic is single-sourced. Skipped
  // entirely for water — it has no per-ingredient decomposition.
  // ENG-751 — prefer persisted AI snapshot rows over the single-line fallback
  // when present + the `nutrition_entry_ingredients_v1` display flag is on.
  const preferSnapshot = isFeatureEnabled(NUTRITION_ENTRY_INGREDIENTS_FLAG);
  const ingredientBreakdown = useMemo(() => {
    if (!supportsIngredientBreakdown) return { lines: [], total: 0 };
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
    return deriveIngredientBreakdown(entries, ingredientRows ?? [], macro as BreakdownMacro, {
      snapshots: snapshotRows ?? [],
      preferSnapshot,
    });
  }, [meals, ingredientRows, snapshotRows, macro, supportsIngredientBreakdown, preferSnapshot]);

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
            {effectiveMode === "meal"
              ? `Per-meal ${config.label.toLowerCase()} breakdown for today.`
              : `Per-ingredient ${config.label.toLowerCase()} breakdown for today.`}
          </DialogDescription>
        </DialogHeader>

        <div className="pt-2">
          {meals.length === 0 ? (
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
            <>
              {/* Segmented toggle: By meal / By ingredient. Mirrors the mobile
                  macro-detail screen control. Hidden for water — it has no
                  per-ingredient breakdown, so the view is pinned to By meal
                  (mobile `BREAKDOWN_MACROS` exclusion, ENG-1213). */}
              {supportsIngredientBreakdown ? (
                // ENG-1375 S2 — the canonical §8 SegmentedTrack (this toggle
                // was one of the conforming treatments the primitive absorbed).
                <SegmentedTrack
                  role="tablist"
                  ariaLabel="Breakdown mode"
                  className="mb-3"
                  options={(["meal", "ingredient"] as const).map((m) => ({
                    value: m,
                    label: m === "meal" ? "By meal" : "By ingredient",
                    ariaLabel: m === "meal" ? "By meal" : "By ingredient",
                  }))}
                  value={mode}
                  onChange={setMode}
                />
              ) : null}

              {effectiveMode === "ingredient" ? (
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
                          {/* ENG-751 — low-confidence AI snapshot lines carry a
                              quiet "Estimated" flag (trust posture — flagged,
                              never dropped). Mirrors the mobile MacroIngredientList. */}
                          {line.lowConfidence ? (
                            <p className="truncate text-xs text-muted-foreground">
                              Estimated — low confidence
                            </p>
                          ) : null}
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
                  <div data-testid="macro-detail-meal-list" className="divide-y divide-border">
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
                  {formatValue(effectiveMode === "ingredient" ? ingredientBreakdown.total : total)}
                </span>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
