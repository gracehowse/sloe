/**
 * Shared types + constants for the Today macro-display preference.
 *
 * The user can choose between two visual treatments for the Today
 * macros block:
 *
 *   - `tiles`  — the existing 2×2 grid of larger emoji-icon tiles
 *                (`TodayDashboardMacroTiles`). Default.
 *   - `bars`   — a vertical stack of `Name … Value / Target` rows
 *                with a thin colored bar beneath each
 *                (`TodayDashboardMacroBars`). Cronometer / Lose It
 *                aesthetic; packs more macros per vertical inch.
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

export type MacroDisplayStyle = "tiles" | "bars";

export const MACRO_DISPLAY_STYLES: readonly MacroDisplayStyle[] = [
  "tiles",
  "bars",
] as const;

// SLOE redesign (2026-06-03): default flipped back "bars" → "tiles".
// The canonical Sloe `01 · Today` frame renders the 2×2 macro TILE grid
// (Protein / Carbs / Fat / Fibre, each with a progress bar) below the
// multi-ring hero — so tiles is the redesign default. The 2026-05-22 C1
// bars default belonged to the single-ring layout that the Sloe
// multi-ring supersedes. The `bars` treatment stays available in
// Settings → Display for users who prefer the denser list.
export const DEFAULT_MACRO_DISPLAY_STYLE: MacroDisplayStyle = "tiles";

export const MACRO_DISPLAY_STORAGE_KEY = "suppr.prefs.macro_display";

/**
 * Coerce an unknown value (from localStorage / AsyncStorage / DB) to
 * a valid {@link MacroDisplayStyle}. Returns the default when the
 * stored value is missing, malformed, or out of range.
 */
export function resolveMacroDisplayStyle(raw: unknown): MacroDisplayStyle {
  if (raw === "tiles" || raw === "bars") return raw;
  return DEFAULT_MACRO_DISPLAY_STYLE;
}
