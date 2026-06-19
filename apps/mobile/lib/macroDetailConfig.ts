import { Accent, MacroColors } from "@/constants/theme";
import type { Meal } from "@/app/useMacroDetail";

/**
 * Per-macro config + the single supported-key source for the macro-detail
 * breakdown (ENG-1213).
 *
 * This lives in `lib/` — NOT in the `app/macro-detail.tsx` screen — so the
 * Today macro tiles + bars can import the supported-key set WITHOUT pulling the
 * screen's `expo-router` dependency into every component (and every test) that
 * renders the tiles. The screen and the tile/bar affordance both consume this
 * one module, so the set of macros that opens a breakdown can never drift from
 * the set of macros the screen can actually render.
 *
 * `MACRO_CONFIG` defines protein/carbs/fat/fiber/calories/water. Reference-only
 * nutrients (sugar, sodium) are deliberately absent: they have no per-meal
 * breakdown, so the Today tiles/bars must render them as plain, non-interactive
 * elements and a deep-link to `/macro-detail?macro=sugar` must not silently fall
 * back to protein's data. Mobile DOES support `water` + `calories` here (unlike
 * the web key set, whose handler only resolves protein/carbs/fat/fiber) — see
 * the parity note in the ENG-1213 commit. Mirrors web ENG-1212 / ENG-848.
 */
export const MACRO_CONFIG: Record<
  string,
  { label: string; color: string; unit: string; field: keyof Meal }
> = {
  // 2026-05-14 (premium-bar audit Group H #4): brand-colour mapping for all 4
  // macros + fibre + water. Protein/carbs/fat → MacroColors token set. Calories
  // → MacroColors.calories (plum — consistent with the calorie ring). Fibre →
  // Accent.success (green for plant fibre, distinct from the macro trio). Water
  // → Accent.info (blue, same as Today's water tile). ENG-997: calories
  // reconciled from Accent.primary → plum.
  protein: { label: "Protein", color: MacroColors.protein, unit: "g", field: "protein" },
  carbs: { label: "Carbs", color: MacroColors.carbs, unit: "g", field: "carbs" },
  fat: { label: "Fat", color: MacroColors.fat, unit: "g", field: "fat" },
  fiber: { label: "Fiber", color: Accent.success, unit: "g", field: "fiberG" },
  calories: { label: "Calories", color: MacroColors.calories, unit: "kcal", field: "calories" },
  water: { label: "Water", color: Accent.info, unit: "ml", field: "waterMl" },
};

/**
 * Single source of truth for which macro keys open the per-macro breakdown —
 * DERIVED from `MACRO_CONFIG` so the tile/bar affordance and the screen can
 * never disagree.
 *
 * Consumed by:
 *   - apps/mobile/app/macro-detail.tsx (the screen's own unsupported-key guard)
 *   - apps/mobile/components/today/TodayDashboardMacroTiles.tsx (tile affordance)
 *   - apps/mobile/components/today/TodayDashboardMacroBars.tsx  (bar affordance)
 */
export const MACRO_DETAIL_SUPPORTED_KEYS = Object.keys(
  MACRO_CONFIG,
) as readonly string[];

const MACRO_DETAIL_SUPPORTED_SET: ReadonlySet<string> = new Set(
  MACRO_DETAIL_SUPPORTED_KEYS,
);

/** True when `macro` opens the per-macro breakdown (a tile/bar is interactive). */
export function isMacroDetailSupported(macro: string): boolean {
  return MACRO_DETAIL_SUPPORTED_SET.has(macro);
}
