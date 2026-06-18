/**
 * Mobile lucide-react-native bindings for {@link FIGMA_MACRO_ICON_GLYPHS}.
 */
import {
  Dumbbell,
  Droplet,
  Flame,
  Sprout,
  Wheat,
  type LucideIcon,
} from "lucide-react-native";

import {
  FIGMA_MACRO_ICON_GLYPHS,
  type MacroIconKey,
} from "@suppr/shared/macroIcons";

export { FIGMA_MACRO_ICON_GLYPHS, MACRO_ICON_KEYS, type MacroIconKey } from "@suppr/shared/macroIcons";

const GLYPH_COMPONENTS = {
  Flame,
  Dumbbell,
  Wheat,
  Droplet,
  Sprout,
} as const satisfies Record<(typeof FIGMA_MACRO_ICON_GLYPHS)[MacroIconKey], LucideIcon>;

export const MACRO_ICONS: Record<MacroIconKey, LucideIcon> = {
  calories: GLYPH_COMPONENTS[FIGMA_MACRO_ICON_GLYPHS.calories],
  protein: GLYPH_COMPONENTS[FIGMA_MACRO_ICON_GLYPHS.protein],
  carbs: GLYPH_COMPONENTS[FIGMA_MACRO_ICON_GLYPHS.carbs],
  fat: GLYPH_COMPONENTS[FIGMA_MACRO_ICON_GLYPHS.fat],
  fiber: GLYPH_COMPONENTS[FIGMA_MACRO_ICON_GLYPHS.fiber],
};
