/**
 * Shared types + constants for the Today macro-display preference.
 *
 * The user can choose between three visual treatments for the Today
 * macros block (Sloe v3 Tiles / Bars / Rings switcher):
 *
 *   - `tiles`  — the existing 2×2 grid of larger icon tiles
 *                (`TodayDashboardMacroTiles`). Default.
 *   - `bars`   — a vertical stack of `Name … Value / Target` rows
 *                with a thin colored bar beneath each
 *                (`TodayDashboardMacroBars`). Cronometer / Lose It
 *                aesthetic; packs more macros per vertical inch.
 *   - `rings`  — three small macro watch-dials (Protein / Carbs / Fat)
 *                in the macro hue (`TodayDashboardMacroRings`), the
 *                v3 jewel-dial grammar scaled down.
 *
 * Persistence:
 *   - Web: `localStorage["suppr.prefs.macro_display"]`
 *     (see `src/lib/preferences/useMacroDisplayStyle.ts` for the React hook)
 *   - Mobile: AsyncStorage `"suppr.prefs.macro_display"`
 *     (see `apps/mobile/lib/macroDisplayStyle.ts`)
 *
 * Both platforms use the same string keys and the same fallback
 * (`tiles`) so a user's preference reads identically across surfaces
 * when we add cross-device sync.
 */

export type MacroDisplayStyle = "tiles" | "bars" | "rings";

export const MACRO_DISPLAY_STYLES: readonly MacroDisplayStyle[] = [
  "tiles",
  "bars",
  "rings",
] as const;

/** Labelled options for the Settings switcher — shared so web + mobile match. */
export const MACRO_DISPLAY_OPTIONS: ReadonlyArray<{
  value: MacroDisplayStyle;
  label: string;
}> = [
  { value: "tiles", label: "Tiles (2×2)" },
  { value: "bars", label: "Bars (list)" },
  { value: "rings", label: "Rings" },
];

// Sloe v3 (Grace 2026-06-25): default → "rings". The v3 prototype's Today shows
// the colourful macro RING donuts by default (Protein/Carbs/Fat, value in the
// centre, a progress sweep in each macro's colour) — so rings is the canonical
// out-of-box macro display. Tiles + bars stay available in Settings → Display.
// (Earlier "tiles" default predated SEEing the prototype's rendered Today.)
export const DEFAULT_MACRO_DISPLAY_STYLE: MacroDisplayStyle = "rings";

export const MACRO_DISPLAY_STORAGE_KEY = "suppr.prefs.macro_display";

/**
 * Coerce an unknown value (from localStorage / AsyncStorage / DB) to
 * a valid {@link MacroDisplayStyle}. Returns the default when the
 * stored value is missing, malformed, or out of range.
 */
export function resolveMacroDisplayStyle(raw: unknown): MacroDisplayStyle {
  if (raw === "tiles" || raw === "bars" || raw === "rings") return raw;
  return DEFAULT_MACRO_DISPLAY_STYLE;
}
