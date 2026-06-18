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
} as const satisfies Record<"Flame" | "Dumbbell" | "Wheat" | "Droplet" | "Sprout", LucideIcon>;

type GlyphName = keyof typeof GLYPH_COMPONENTS;

function lucideGlyph(name: GlyphName): LucideIcon {
  return GLYPH_COMPONENTS[name];
}

export const MACRO_ICONS: Record<MacroIconKey, LucideIcon> = {
  calories: lucideGlyph(FIGMA_MACRO_ICON_GLYPHS.calories as GlyphName),
  protein: lucideGlyph(FIGMA_MACRO_ICON_GLYPHS.protein as GlyphName),
  carbs: lucideGlyph(FIGMA_MACRO_ICON_GLYPHS.carbs as GlyphName),
  fat: lucideGlyph(FIGMA_MACRO_ICON_GLYPHS.fat as GlyphName),
  fiber: lucideGlyph(FIGMA_MACRO_ICON_GLYPHS.fiber as GlyphName),
};
