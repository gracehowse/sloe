/**
 * Canonical lucide glyph names for macro roles (web + mobile parity).
 *
 * Values are the exported component names from `lucide-react` /
 * `lucide-react-native` — not kebab-case slugs. Mobile and web map these
 * to platform components locally; drift is caught by
 * `tests/unit/macroGlyphsParity.test.ts`.
 *
 * Figma Today `654:2`: protein = Dumbbell (`654:101`), carbs = Wheat,
 * fat = Droplet, fibre = Sprout, calories = Flame.
 *
 * @see docs/decisions/2026-05-31-icon-strategy.md (ENG-808, ENG-986)
 */

export const MACRO_GLYPH_KEYS = {
  calories: "Flame",
  protein: "Dumbbell",
  carbs: "Wheat",
  fat: "Droplet",
  fiber: "Sprout",
  /** Hydration shares the droplet glyph on both platforms. */
  water: "Droplet",
} as const;

export type MacroGlyphRole = keyof typeof MACRO_GLYPH_KEYS;

/** Macro roles rendered in the standard P/C/F (+ optional fibre) icon row. */
export const MACRO_ROW_GLYPH_ROLES = ["protein", "carbs", "fat", "fiber"] as const satisfies readonly MacroGlyphRole[];
