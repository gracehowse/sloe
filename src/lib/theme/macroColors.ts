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
 * `src/app/components/Settings.tsx` and the matching mobile `Macros.*`
 * tokens.
 */

/** Light-mode macro hexes — pinned to `:root` block in theme.css. */
export const MACRO_COLORS_LIGHT = {
  /** --macro-protein */
  protein: "#4c6ce0",
  /** --macro-carbs — 2026-05-12 (DC10): split from --warning (#e8a020
   *  amber) to a dedicated warm-orange. Amber now reserved for
   *  over-budget warnings only. */
  carbs: "#ed6b2a",
  /** --macro-fat */
  fat: "#e04888",
  /** --success — fibre rides on the success-green track. */
  fiber: "#22a860",
  /** --chart-5 / --stimulant-caffeine — violet hue. There is no
   *  dedicated `--sugar` token in theme.css; chart-5 is the canonical
   *  fifth-track colour and reads cleanly next to protein-blue +
   *  carbs-amber in the same picker without clashing. */
  sugar: "#8b5cf6",
  /** --source-fatsecret / orange — sodium intentionally amber-orange.
   *  Project carryover rule (2026-04-27): "sodium = orange". */
  sodium: "#f97316",
  /** --macro-water */
  water: "#06b6d4",
} as const;

/** CSS-var references — preferred for inline `style` values when the
 *  consumer can read from the cascade (auto dark-mode swap). */
export const MACRO_COLOR_VARS = {
  protein: "var(--macro-protein)",
  carbs: "var(--macro-carbs)",
  fat: "var(--macro-fat)",
  fiber: "var(--success)",
  sugar: "var(--chart-5)",
  sodium: "var(--source-fatsecret)",
  water: "var(--macro-water)",
} as const;

export type MacroColorKey = keyof typeof MACRO_COLORS_LIGHT;
