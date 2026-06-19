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
 * `MACRO_CONFIG` defines protein/carbs/fat/fiber/calories/water — these are the
 * keys the macro-detail SCREEN can render. Reference-only nutrients (sugar,
 * sodium) are deliberately absent: they have no per-meal breakdown, so the Today
 * tiles/bars must render them as plain, non-interactive elements and a deep-link
 * to `/macro-detail?macro=sugar` must not silently fall back to protein's data.
 *
 * The TILE-AFFORDANCE set (`MACRO_DETAIL_SUPPORTED_KEYS`) is narrower than
 * `MACRO_CONFIG`: it excludes `calories` because there is NO calories tile —
 * calories is the ring — so calories must never render as a tappable tile/bar.
 * The screen still renders calories via `MACRO_CONFIG[macro]` for the ring
 * deep-link (it checks `MACRO_CONFIG`, not the supported set). `water` IS in the
 * affordance set: it has a real per-meal breakdown (`nutrition_entries.water_ml`
 * → a "By meal" list; excluded from the "By ingredient" toggle). This exact set
 * — {protein, carbs, fat, fiber, water} — is now web↔mobile parity (ENG-1213);
 * web matches it in `src/app/components/MacroDetailPanel.tsx`. Mirrors web
 * ENG-1212 / ENG-848.
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
 * Single source of truth for which macro keys render an interactive tile/bar
 * (i.e. open the per-macro breakdown). An EXPLICIT list — NOT `Object.keys(
 * MACRO_CONFIG)` — because the tile-affordance set is deliberately narrower than
 * the screen's renderable set: `calories` is in `MACRO_CONFIG` (so the screen
 * can render the ring deep-link) but is excluded here because there is no
 * calories tile. This {protein, carbs, fat, fiber, water} set is web↔mobile
 * parity (ENG-1213).
 *
 * The macro-detail SCREEN gates on `MACRO_CONFIG[macro]`, not on this set, so
 * dropping `calories` here does NOT stop the screen rendering a calories
 * breakdown — it only stops a calories TILE/BAR from existing (there is none).
 *
 * Consumed by:
 *   - apps/mobile/app/macro-detail.tsx (the screen's own unsupported-key guard)
 *   - apps/mobile/components/today/TodayDashboardMacroTiles.tsx (tile affordance)
 *   - apps/mobile/components/today/TodayDashboardMacroBars.tsx  (bar affordance)
 */
export const MACRO_DETAIL_SUPPORTED_KEYS = [
  "protein",
  "carbs",
  "fat",
  "fiber",
  "water",
] as readonly string[];

const MACRO_DETAIL_SUPPORTED_SET: ReadonlySet<string> = new Set(
  MACRO_DETAIL_SUPPORTED_KEYS,
);

/** True when `macro` opens the per-macro breakdown (a tile/bar is interactive). */
export function isMacroDetailSupported(macro: string): boolean {
  return MACRO_DETAIL_SUPPORTED_SET.has(macro);
}
