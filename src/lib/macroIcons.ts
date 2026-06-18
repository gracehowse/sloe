/**
 * ENG-986 — canonical macro→glyph mapping (Figma `654:101`).
 *
 * Icon components live in platform files (`macroIconsLucide.ts` web,
 * `apps/mobile/lib/macroIconsLucide.ts`) because lucide-react and
 * lucide-react-native are separate packages. This module is the SSOT for
 * which glyph each macro uses so drift is caught by one test.
 */
export const MACRO_ICON_KEYS = [
  "calories",
  "protein",
  "carbs",
  "fat",
  "fiber",
] as const;

export type MacroIconKey = (typeof MACRO_ICON_KEYS)[number];

/** Lucide icon export names — pinned to Figma `654:101` / `654:2`. */
export const FIGMA_MACRO_ICON_GLYPHS = {
  calories: "Flame",
  protein: "Dumbbell",
  carbs: "Wheat",
  fat: "Droplet",
  fiber: "Sprout",
} as const satisfies Record<MacroIconKey, string>;
