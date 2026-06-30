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

/** Light-mode macro hexes — pinned to `:root` block in theme.css. Sloe v3
 *  (2026-06-21): calories + fiber → sage, protein → plum, carbs → amber,
 *  fat → berry-rose (new), sugar → damson, sodium → clay, water → muted teal.
 *  Icon + label carry the differentiation where hues sit close. Drift vs
 *  `theme.css` is caught by `tests/unit/settingsMacroTokens.test.ts`. */
export const MACRO_COLORS_LIGHT = {
  calories: "#5E7C5A",
  protein:  "#3B2A4D",
  carbs:    "#C9892C",
  fat:      "#B25D7A",
  fiber:    "#5E7C5A",
  sugar:    "#6A4B7A",
  sodium:   "#C8794E",
  water:    "#5A8A99",
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

/** AA-safe text colours for macro values on the card surface, light AND dark
 *  (ENG-1109 light; ENG-1217 dark). Icons and progress fills keep
 *  {@link MACRO_COLOR_VARS}; tile-value ink reads the `-solid` token, which the
 *  cascade resolves per `:root` / `.dark`. Every macro now routes through a
 *  `-solid`: protein/carbs/fat/fiber were already darkened on white; sugar
 *  already passed as fill so its `-solid` == fill; sodium/water gained darkened
 *  `-solid`s on white (their fills only clear ~3.3–3.8:1 as text — ENG-1217).
 *  In `.dark` every `-solid` equals the OLED-lifted fill and clears AA on the
 *  dark card — measured by `tests/unit/eng1109MacroContrastCensus.test.ts`. */
export const MACRO_TEXT_COLOR_VARS = {
  calories: "var(--macro-calories)",
  protein: "var(--macro-protein-solid)",
  carbs: "var(--macro-carbs-solid)",
  fat: "var(--macro-fat-solid)",
  fiber: "var(--macro-fiber-solid)",
  sugar: "var(--macro-sugar-solid)",
  sodium: "var(--macro-sodium-solid)",
  water: "var(--macro-water-solid)",
} as const;

export type MacroColorKey = keyof typeof MACRO_COLORS_LIGHT;

/** Resolve a tracked-macro key to its canonical CSS variable. */
export function macroColorVarFor(key: string): string {
  if (key in MACRO_COLOR_VARS) {
    return MACRO_COLOR_VARS[key as MacroColorKey];
  }
  return MACRO_COLOR_VARS.protein;
}

/** AA-safe value ink for tier-v1 macro tiles (Storybook a11y + ENG-1109). */
export function macroTextColorVarFor(key: string): string {
  if (key in MACRO_TEXT_COLOR_VARS) {
    return MACRO_TEXT_COLOR_VARS[key as MacroColorKey];
  }
  return MACRO_TEXT_COLOR_VARS.protein;
}
