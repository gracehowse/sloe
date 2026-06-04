/**
 * Canonical macro colour values for the web client.
 *
 * Single source of truth synchronised with the CSS custom properties
 * declared in `src/styles/theme.css`. Use the CSS-var names whenever a
 * style can read from the cascade (so dark-mode swaps automatically);
 * the hex values below exist for the small set of cases where a runtime
 * `style={{ backgroundColor: "#…" }}` or canvas/SVG fill is needed and
 * the cascade isn't reachable.
 *
 * Drift between this module and `theme.css` is caught by
 * `tests/unit/settingsMacroTokens.test.ts`.
 *
 * Keep the keys aligned with `WIDGET_MACRO_OPTIONS` in
 * `src/app/components/Settings.tsx` and mobile `MacroColors` in
 * `apps/mobile/constants/theme.ts`.
 */

/** Light-mode macro hexes — pinned to `:root` block in theme.css. SLOE Phase 0
 *  (2026-06-03): calories → plum (the calorie ring / chrome hue), protein →
 *  olive-sage, carbs → clay, fat → amber, fiber → teal. Sugar follows carbs;
 *  sodium → amber; water → teal. Icon + label carry the differentiation where
 *  hues sit close. Drift vs `theme.css` is caught by
 *  `tests/unit/settingsMacroTokens.test.ts`. */
export const MACRO_COLORS_LIGHT = {
  calories: "#3B2A4D",
  protein:  "#7C8466",
  carbs:    "#C8794E",
  fat:      "#C9892C",
  fiber:    "#4A7878",
  sugar:    "#C8794E",
  sodium:   "#C9892C",
  water:    "#4A7878",
} as const;

/** CSS-var references — preferred for inline `style` values (auto dark-mode). */
export const MACRO_COLOR_VARS = {
  calories: "var(--macro-calories)",
  protein: "var(--macro-protein)",
  carbs: "var(--macro-carbs)",
  fat: "var(--macro-fat)",
  fiber: "var(--macro-fiber)",
  sugar: "var(--macro-sugar)",
  sodium: "var(--macro-sodium)",
  water: "var(--macro-water)",
} as const;

export type MacroColorKey = keyof typeof MACRO_COLORS_LIGHT;

/** Resolve a tracked-macro key to its canonical CSS variable. */
export function macroColorVarFor(key: string): string {
  if (key in MACRO_COLOR_VARS) {
    return MACRO_COLOR_VARS[key as MacroColorKey];
  }
  return MACRO_COLOR_VARS.protein;
}
